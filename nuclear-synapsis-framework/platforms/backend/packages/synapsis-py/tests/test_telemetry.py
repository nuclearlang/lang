"""Spec 012: a Telemetry connection traces requests and the use cases the transpiler marks with @traced; @untraced
routes and controllers start no trace; the vendors are only a URL and headers."""

from __future__ import annotations

import base64

import pytest

pytest.importorskip("opentelemetry.sdk")

from fastapi.testclient import TestClient
from opentelemetry.sdk.metrics.export import InMemoryMetricReader
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from synapsis import AppConfig, AppError, Err, NotFound, Ok, Result, controller, create_app, get, untraced
from synapsis.inject import reset
from synapsis.telemetry import Datadog, Grafana, Metric, NewRelic, Telemetry, traced


# what the fastapi dialect writes for `usecase FindOrder` in components/orders/ with plugins(telemetry = true)
class FindOrder:
    @traced("orders › usecase › FindOrder.exec")
    async def exec(self, id: int) -> Result[AppError, dict[str, int]]:
        return Ok({"id": id}) if id > 0 else Err(NotFound("no order"))


@controller("/orders")
class OrderController:
    def __init__(self, find: FindOrder) -> None:
        self.find = find

    @get("/{id}")
    async def one(self, id: int) -> Result[AppError, dict[str, int]]:
        Metric.count("orders.read", region="eu")
        return await self.find.exec(id)

    @get("/health")
    @untraced
    async def health(self) -> dict[str, bool]:
        await self.find.exec(1)  # a use case under an untraced route goes with it
        return {"ok": True}


@untraced
@controller("/internal")
class InternalController:
    @get("/ping")
    async def ping(self) -> dict[str, bool]:
        return {"ok": True}


def trace_of(span: ReadableSpan) -> int:
    context = span.get_span_context()
    assert context is not None
    return context.trace_id


def run(telemetry: Telemetry, *paths: str) -> list[ReadableSpan]:
    reset()
    spans = InMemorySpanExporter()
    telemetry.processor, telemetry.reader = SimpleSpanProcessor(spans), InMemoryMetricReader()

    class Config(AppConfig):
        connections = [telemetry]

    with TestClient(create_app(Config(), controllers=[OrderController, InternalController])) as http:
        for p in paths:
            http.get(p)
        found = list(spans.get_finished_spans())
    reset()
    return found


def test_vendors_are_only_url_and_headers() -> None:
    assert Datadog().url == "http://localhost:4318" and Datadog().headers == {}
    assert Datadog(api_key="k", url="https://intake").headers == {"dd-api-key": "k"} and Datadog.delta
    nr = NewRelic(license_key="lic", region="eu")
    assert nr.url == "https://otlp.eu01.nr-data.net:4318" and nr.headers == {"api-key": "lic"}
    g = Grafana(url="https://otlp-gateway-prod-eu-west-0.grafana.net/otlp", instance_id="123", token="glc_x")
    assert g.headers["Authorization"] == "Basic " + base64.b64encode(b"123:glc_x").decode()
    assert Grafana().headers == {}


def test_requests_and_usecases_are_one_trace_and_errors_are_marked() -> None:
    telemetry = Telemetry("http://unused", service="orders_api")
    spans = run(telemetry, "/orders/7", "/orders/0")
    usecases = [s for s in spans if s.name == "orders › usecase › FindOrder.exec"]
    assert len(usecases) == 2
    failed = [s for s in usecases if not s.status.is_ok]
    assert len(failed) == 1 and failed[0].status.description == "NotFound"
    assert failed[0].attributes is not None and failed[0].attributes["synapsis.component"] == "orders"
    assert failed[0].resource.attributes["service.name"] == "orders_api"
    requests = {trace_of(s) for s in spans if s.name == "GET /orders/{id}"}
    assert len(requests) == 2 and trace_of(failed[0]) in requests
    assert isinstance(telemetry.reader, InMemoryMetricReader)
    data = telemetry.reader.get_metrics_data()
    assert data is not None
    assert "orders.read" in {m.name for rm in data.resource_metrics for sm in rm.scope_metrics for m in sm.metrics}


def test_the_service_is_the_project_by_default() -> None:
    named, default = Telemetry("http://unused", service="billing"), Telemetry("http://unused")

    class Config(AppConfig):
        connections = [named, default]

    create_app(Config(), title="orders_api")
    assert (named.service, default.service) == ("billing", "orders_api")


def test_untraced_routes_and_controllers_start_no_trace() -> None:
    telemetry = Telemetry("http://unused")
    spans = run(telemetry, "/orders/health", "/internal/ping")
    assert spans == []
    assert {"GET /orders/health", "GET /internal/ping"} <= telemetry.untraced


def test_sample_zero_keeps_no_trace() -> None:
    assert run(Telemetry("http://unused", sample=0.0), "/orders/7") == []


def test_traced_keeps_sync_methods_sync() -> None:
    @traced("app › usecase › Sum.exec")
    def total(a: int, b: int) -> int:
        return a + b

    assert total(1, 2) == 3
