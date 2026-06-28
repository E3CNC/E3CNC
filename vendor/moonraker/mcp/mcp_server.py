from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

DEFAULT_BASE_URL = os.environ.get("MOONRAKER_URL", "http://127.0.0.1:7125")
DEFAULT_TIMEOUT = float(os.environ.get("MOONRAKER_TIMEOUT", "15"))
DEFAULT_API_KEY = os.environ.get("MOONRAKER_API_KEY")

mcp = FastMCP(
    name="moonraker-mcp",
    instructions=(
        "Moonraker / Klipper MCP server for E3CNC UI. Use these tools to "
        "inspect printer state, query Klipper objects, send G-code, and read "
        "Moonraker server/system metadata."
    ),
)


class MoonrakerError(RuntimeError):
    """Raised when Moonraker returns an error response."""


@dataclass(slots=True)
class MoonrakerClient:
    base_url: str = DEFAULT_BASE_URL
    api_key: str | None = DEFAULT_API_KEY
    timeout: float = DEFAULT_TIMEOUT
    transport: httpx.AsyncBaseTransport | None = None

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["X-Api-Key"] = self.api_key
        return headers

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
    ) -> Any:
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        request_kwargs: dict[str, Any] = {
            "method": method.upper(),
            "url": url,
            "params": params,
            "headers": self._headers(),
            "timeout": self.timeout,
        }
        if body is not None:
            request_kwargs["json"] = body

        async with httpx.AsyncClient(transport=self.transport) as client:
            response = await client.request(**request_kwargs)

        if response.status_code >= 400:
            raise MoonrakerError(self._format_error(response))

        if not response.content:
            return None

        try:
            payload = response.json()
        except ValueError as exc:
            raise MoonrakerError(f"Moonraker returned non-JSON response for {path}: {response.text}") from exc

        if isinstance(payload, dict) and set(payload.keys()) == {"result"}:
            return payload["result"]
        return payload

    @staticmethod
    def _format_error(response: httpx.Response) -> str:
        detail = response.text.strip()
        if not detail:
            return f"Moonraker returned HTTP {response.status_code}"
        return f"Moonraker returned HTTP {response.status_code}: {detail}"

    async def server_info(self) -> Any:
        return await self.request("GET", "/server/info")

    async def server_config(self) -> Any:
        return await self.request("GET", "/server/config")

    async def printer_info(self) -> Any:
        return await self.request("GET", "/printer/info")

    async def printer_objects_list(self) -> Any:
        return await self.request("GET", "/printer/objects/list")

    async def query_printer_objects(self, objects: dict[str, list[str] | None]) -> Any:
        return await self.request("POST", "/printer/objects/query", body={"objects": objects})

    async def gcode_help(self) -> Any:
        return await self.request("GET", "/printer/gcode/help")

    async def send_gcode(self, script: str) -> Any:
        return await self.request("POST", "/printer/gcode/script", body={"script": script})

    async def job_queue_status(self) -> Any:
        return await self.request("GET", "/server/job_queue/status")

    async def history_list(
        self,
        *,
        limit: int = 50,
        start: int = 0,
        since: float | None = None,
        before: float | None = None,
        order: str = "desc",
    ) -> Any:
        params: dict[str, Any] = {"limit": limit, "start": start, "order": order}
        if since is not None:
            params["since"] = since
        if before is not None:
            params["before"] = before
        return await self.request("GET", "/server/history/list", params=params)

    async def webcams_list(self) -> Any:
        return await self.request("GET", "/server/webcams/list")

    async def system_info(self) -> Any:
        return await self.request("GET", "/machine/system_info")

    async def proc_stats(self) -> Any:
        return await self.request("GET", "/machine/proc_stats")

    async def generic_request(
        self,
        *,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
    ) -> Any:
        return await self.request(method, path, params=params, body=body)


def get_client() -> MoonrakerClient:
    return MoonrakerClient()


@mcp.tool()
async def moonraker_server_info() -> Any:
    """Get Moonraker's server status and loaded components."""

    return await get_client().server_info()


@mcp.tool()
async def moonraker_server_config() -> Any:
    """Get Moonraker's parsed server configuration."""

    return await get_client().server_config()


@mcp.tool()
async def moonraker_printer_info() -> Any:
    """Get Klippy host information."""

    return await get_client().printer_info()


@mcp.tool()
async def moonraker_printer_objects_list() -> Any:
    """List the loaded Klipper printer objects."""

    return await get_client().printer_objects_list()


@mcp.tool()
async def moonraker_query_printer_objects(objects: dict[str, list[str] | None]) -> Any:
    """Query printer object state.

    Pass a mapping like:
    {
      "toolhead": ["position", "status"],
      "extruder": ["temperature", "target"],
      "gcode_move": null
    }
    """

    return await get_client().query_printer_objects(objects)


@mcp.tool()
async def moonraker_gcode_help() -> Any:
    """Get the supported G-code command help mapping."""

    return await get_client().gcode_help()


@mcp.tool()
async def moonraker_send_gcode(script: str) -> Any:
    """Send a G-code script to Klipper."""

    return await get_client().send_gcode(script)


@mcp.tool()
async def moonraker_job_queue_status() -> Any:
    """Get Moonraker job queue status."""

    return await get_client().job_queue_status()


@mcp.tool()
async def moonraker_history_list(
    limit: int = 50,
    start: int = 0,
    since: float | None = None,
    before: float | None = None,
    order: str = "desc",
) -> Any:
    """List Moonraker print-history jobs."""

    return await get_client().history_list(
        limit=limit,
        start=start,
        since=since,
        before=before,
        order=order,
    )


@mcp.tool()
async def moonraker_webcams_list() -> Any:
    """List Moonraker webcam configurations."""

    return await get_client().webcams_list()


@mcp.tool()
async def moonraker_system_info() -> Any:
    """Get host operating system and service information."""

    return await get_client().system_info()


@mcp.tool()
async def moonraker_proc_stats() -> Any:
    """Get process statistics exposed by Moonraker."""

    return await get_client().proc_stats()


@mcp.tool()
async def moonraker_request(
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> Any:
    """Make a raw Moonraker request.

    Use this for endpoints that are not covered by the dedicated tools.
    The path should be relative, for example:

    - /server/info
    - /printer/objects/query
    - /machine/services/restart
    """

    return await get_client().generic_request(method=method, path=path, params=params, body=body)


def main() -> None:
    mcp.run("stdio")


if __name__ == "__main__":
    main()
