from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from typing import List

app = FastAPI()

# Path to the test HTML file
TEST_HTML_PATH = Path(__file__).parent / "test.html"


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept and track a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection from tracking."""
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific client."""
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        """Broadcast a message to all connected clients."""
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()


@app.get("/")
async def read_root():
    return {"service": "a-tree-server", "status": "ok"}


@app.get("/test")
async def test_page():
    """Serve the WebSocket test page."""
    return HTMLResponse(content=TEST_HTML_PATH.read_text(), status_code=200)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo the message back for now
            await manager.send_personal_message(f"Message received: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
