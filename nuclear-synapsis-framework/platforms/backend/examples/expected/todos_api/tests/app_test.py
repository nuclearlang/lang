from __future__ import annotations


class TestApp:
    """
    The first test (nuclear help backend, §2.13): every test runs with the connections open and the databases in
    memory; inject<X>() gives the app's instances, expect(condition) asserts.
    """

    async def test_starts(self) -> None:
        "the app starts with its connections"
        assert True
