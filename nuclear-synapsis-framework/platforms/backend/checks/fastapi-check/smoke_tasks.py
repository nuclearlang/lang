"""End-to-end check of the backend example built with fastapi (examples/examples-backend/tasks_api): the guards, and
the same routes and the events over the app's WebSocket (ADR-synapsis-0007, ADR-synapsis-0008). The same run as
nestjs-check/smoke.mjs. Run from the build folder: python smoke_tasks.py"""

import os

os.environ.update(DATABASE=":memory:", TASKS_TOKEN="tasks-secret", OWNER_TOKEN="owner-secret")

from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

from app.main import app  # noqa: E402

TOKEN = {"X-Tasks-Token": "tasks-secret"}

with TestClient(app) as http:
    # the guards: the app's token, no web page, and the controller's own token on top
    assert http.get("/tasks").status_code == 401
    assert http.get("/tasks", headers={**TOKEN, "Origin": "https://example.com"}).status_code == 403
    assert http.get("/tasks", headers=TOKEN).json() == []
    assert http.get("/projects/1", headers=TOKEN).status_code == 401
    assert http.get("/projects/1", headers={**TOKEN, "Authorization": "Bearer owner-secret"}).status_code == 404
    # the WebSocket: the upgrade is guarded, a request answers what HTTP answers, a published event is pushed
    try:
        with http.websocket_connect("/ws") as ws:
            ws.receive_text()
        raise AssertionError("opened without a token")
    except WebSocketDisconnect:
        pass
    with http.websocket_connect("/ws", headers=TOKEN) as ws:
        ws.send_json({"subscribe": "tasks.created"})
        ws.send_json({"id": 1, "method": "POST", "path": "/tasks", "body": {"title": "Call mom"}})
        got = [ws.receive_json(), ws.receive_json()]
        answer = next(f for f in got if f.get("id") == 1)
        assert answer["status"] == 201, answer
        assert {"event": "tasks.created", "data": {"id": answer["body"]["id"], "title": "Call mom"}} in got, got
        ws.send_json({"id": 2, "method": "GET", "path": "/tasks/99"})
        assert ws.receive_json()["status"] == 404
print("smoke: guards and the WebSocket ok")
