import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for conn in self.active_connections:
            try:
                await conn.send_text(json.dumps(payload, default=str))
            except Exception:  # noqa: BLE001
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)


ws_manager = ConnectionManager()

