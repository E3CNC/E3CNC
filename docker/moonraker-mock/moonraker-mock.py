#!/usr/bin/env python3
"""Moonraker mock — serves API + WebSocket for local E3CNC development.

Runs on all interfaces, port 7125 (matching Moonraker's default).
Responds to both HTTP REST endpoints and WebSocket JSON-RPC.

Usage:
    Direct:  python3 moonraker-mock.py
    Docker:  docker build -t moonraker-mock . && docker run -p 7125:7125 moonraker-mock
"""

import asyncio, json, struct, hashlib, base64, os

HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", "7125"))

# ── Mock state ────────────────────────────────────────────────────────────────

state = {
    "toolhead": {
        "position": [100, 50, 10, 0],
        "max_velocity": 5000,
        "max_accel": 500,
        "homed_axes": "xyz",
    },
    "gcode_move": {
        "absolute_coordinates": True,
        "position": [0, 0, 0, 0],
        "speed": 3000,
        "speed_factor": 1.0,
        "extrude_factor": 1.0,
    },
    "print_stats": {
        "state": "standby",
        "filename": "",
        "total_duration": 0.0,
        "print_duration": 0.0,
        "filament_used": 0.0,
    },
    "mcu": {"mcu_version": "v0.12.0", "last_stats": {"sum": {"rss": 50000}}},
    "configfile": {
        "config": {"printer.cfg": {"modified": 0}},
        "settings": {
            "printer.cfg": {
                "work_coordinate_systems": {
                    "G54": [0, 0, 0],
                    "G55": [0, 0, 0],
                    "G56": [0, 0, 0],
                    "G57": [0, 0, 0],
                    "G58": [0, 0, 0],
                    "G59": [100, 50, 0],
                }
            }
        },
    },
    "virtual_sdcard": {
        "file_path": "",
        "progress": 0.0,
        "is_active": False,
        "file_position": 0,
    },
    "display_status": {"message": "", "progress": 0.0},
    "pause_resume": {"is_paused": False},
    "fan": {"speed": 0},
    "extruder": {"temperature": 22.0, "target": 0.0},
    "heater_bed": {"temperature": 20.0, "target": 0.0},
}

INFO = {
    "server": "moonraker-mock",
    "version": "v0.12.0",
    "klippy_connected": True,
    "klippy_state": "ready",
    "failed_components": [],
}

# ── HTTP endpoint map ─────────────────────────────────────────────────────────

HTTP_RESPONSES = {
    "/server/info": {"result": INFO},
    "/printer/info": {"result": {"state": "ready"}},
    "/printer/objects/list": {"result": {"objects": list(state.keys())}},
    "/server/database/list": {"result": {"namespaces": ["mainsail", "webcams", "maintenance"]}},
    "/server/database/item": {
        "result": {
            "namespace": "mainsail",
            "key": "uiSettings",
            "value": {"theme": "e3cnc", "logo": "#D41216", "primary": "#00FF00"},
        }
    },
    "/server/files/list": {"result": []},
    "/access/login": {"result": {"token": "mock", "username": "mock", "action": "user_logged_in"}},
    "/access/oneshot_token": {"result": "mock"},
    "/machine/info": {"result": {"system_stats": {"sysload": 0.5, "memavail": 1024000, "uptime": 360000}}},
}


# ── WebSocket frame helpers ──────────────────────────────────────────────────

def make_frame(data: bytes) -> bytes:
    frame = bytearray([0x81])  # FIN + text
    if len(data) < 126:
        frame.append(len(data))
    elif len(data) < 65536:
        frame.extend([126, *struct.pack(">H", len(data))])
    else:
        frame.extend([127, *struct.pack(">Q", len(data))])
    frame.extend(data)
    return bytes(frame)


def unmask_payload(data: bytes) -> bytes:
    """Unmask a WebSocket text frame payload."""
    if len(data) < 2:
        return b""
    moff, plen = 2, data[1] & 0x7F
    if plen == 126:
        moff, plen = 4, struct.unpack(">H", data[2:4])[0]
    elif plen == 127:
        moff, plen = 10, struct.unpack(">Q", data[2:10])[0]
    mask = data[moff : moff + 4]
    return bytes(b ^ mask[i % 4] for i, b in enumerate(data[moff + 4 : moff + 4 + plen]))


# ── Connection handler ────────────────────────────────────────────────────────

async def handle_connection(reader, writer):
    try:
        peek = await asyncio.wait_for(reader.read(8192), timeout=10)
    except (asyncio.TimeoutError, ConnectionError):
        writer.close()
        return

    # ── HTTP request (no websocket upgrade) ────────────────────────────────────
    if b"websocket" not in peek:
        path = peek.split(b" ")[1].decode()
        body = json.dumps(HTTP_RESPONSES.get(path, {"result": {}}))
        resp = (
            f"HTTP/1.1 200 OK\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(body)}\r\n"
            f"Access-Control-Allow-Origin: *\r\n"
            f"\r\n{body}"
        )
        writer.write(resp.encode())
        await writer.drain()
        writer.close()
        return

    # ── WebSocket upgrade ──────────────────────────────────────────────────────
    key = ""
    for line in peek.decode().split("\r\n"):
        if line.lower().startswith("sec-websocket-key:"):
            key = line.split(":", 1)[1].strip()
    accept = base64.b64encode(
        hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()
    ).decode()
    writer.write(
        f"HTTP/1.1 101 Switching Protocols\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n"
        f"Access-Control-Allow-Origin: *\r\n"
        f"\r\n".encode()
    )
    await writer.drain()

    print(f"  WS client connected ({writer.get_extra_info('peername')})")

    # ── WebSocket message loop ────────────────────────────────────────────────
    while True:
        try:
            data = await asyncio.wait_for(reader.read(4096), timeout=300)
        except (asyncio.TimeoutError, ConnectionError, BrokenPipeError):
            break
        if not data or data[0] == 0x88:  # Close frame
            break
        if data[0] & 0x0F != 1:  # Not text
            continue

        payload = unmask_payload(data)
        try:
            msg = json.loads(payload.decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue

        method = msg.get("method", "")
        params = msg.get("params", {})
        req_id = msg.get("id", 1)

        if method in ("printer.objects.query", "printer.objects.subscribe"):
            objs = params.get("objects", {})
            status = {k: state.get(k, {}) for k in objs}
            resp = {"jsonrpc": "2.0", "result": {"status": status}, "id": req_id}
        elif method == "server.info":
            resp = {"jsonrpc": "2.0", "result": INFO, "id": req_id}
        elif method == "server.connection.identify":
            resp = {"jsonrpc": "2.0", "result": {"connection_id": 1}, "id": req_id}
        elif method == "printer.info":
            resp = {"jsonrpc": "2.0", "result": {"state": "ready"}, "id": req_id}
        elif method == "machine.info":
            resp = {
                "jsonrpc": "2.0",
                "result": {"system_stats": {"sysload": 0.5, "memavail": 1024000, "uptime": 360000}},
                "id": req_id,
            }
        elif method == "server.database.get_item":
            resp = {
                "jsonrpc": "2.0",
                "result": {
                    "namespace": "mainsail",
                    "key": "uiSettings",
                    "value": {"theme": "e3cnc", "logo": "#D41216", "primary": "#00FF00"},
                },
                "id": req_id,
            }
        elif method == "server.database.list":
            resp = {
                "jsonrpc": "2.0",
                "result": {"namespaces": ["mainsail", "webcams", "maintenance"]},
                "id": req_id,
            }
        else:
            resp = {"jsonrpc": "2.0", "result": {}, "id": req_id}

        try:
            writer.write(make_frame(json.dumps(resp).encode()))
            await writer.drain()
        except (ConnectionError, BrokenPipeError):
            break

    writer.close()
    print(f"  WS client disconnected")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print(f"Moonraker mock starting on {HOST}:{PORT}")
    print(f"  HTTP API:  http://localhost:{PORT}/server/info")
    print(f"  WS:        ws://localhost:{PORT}/websocket")
    print(f"  Point E3CNC dev server's VITE_DEV_PROXY_TARGET to this address")
    print()

    srv = await asyncio.start_server(handle_connection, HOST, PORT)
    async with srv:
        await srv.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutdown.")