from __future__ import annotations

import asyncio
import json

import httpx

from moonraker_cnc_agent import mcp_server


def test_request_unwraps_result_and_sets_api_key_header():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        return httpx.Response(200, json={"result": {"ok": True}})

    async def run() -> None:
        client = mcp_server.MoonrakerClient(
            base_url="http://example.invalid:7125",
            api_key="secret-key",
            transport=httpx.MockTransport(handler),
        )
        result = await client.request("GET", "/server/info")

        assert result == {"ok": True}
        assert captured["method"] == "GET"
        assert captured["url"] == "http://example.invalid:7125/server/info"
        assert captured["headers"]["x-api-key"] == "secret-key"

    asyncio.run(run())


def test_query_printer_objects_posts_expected_body():
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content.decode()))
        return httpx.Response(200, json={"result": {"eventtime": 1.23, "status": {"toolhead": {"status": "ready"}}}})

    async def run() -> None:
        client = mcp_server.MoonrakerClient(
            base_url="http://example.invalid:7125",
            transport=httpx.MockTransport(handler),
        )
        result = await client.query_printer_objects({"toolhead": ["status"]})

        assert result["status"]["toolhead"]["status"] == "ready"
        assert bodies == [{"objects": {"toolhead": ["status"]}}]

    asyncio.run(run())


def test_tool_registration():
    async def run() -> list[str]:
        tools = await mcp_server.mcp.list_tools()
        return [tool.name for tool in tools]

    tool_names = asyncio.run(run())
    assert tool_names == [
        "moonraker_server_info",
        "moonraker_server_config",
        "moonraker_printer_info",
        "moonraker_printer_objects_list",
        "moonraker_query_printer_objects",
        "moonraker_gcode_help",
        "moonraker_send_gcode",
        "moonraker_job_queue_status",
        "moonraker_history_list",
        "moonraker_webcams_list",
        "moonraker_system_info",
        "moonraker_proc_stats",
        "moonraker_request",
    ]


def test_tool_wrapper_uses_client(monkeypatch):
    class FakeClient:
        async def server_info(self):
            return {"moonraker_version": "test"}

    monkeypatch.setattr(mcp_server, "get_client", lambda: FakeClient())

    result = asyncio.run(mcp_server.moonraker_server_info())

    assert result == {"moonraker_version": "test"}
