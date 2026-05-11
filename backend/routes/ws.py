from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from services.notification_service import manager
import logging

router = APIRouter()
logger = logging.getLogger("ws")

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    user_id: int,
    token: str | None = Query(None)
):
    logger.info(f"[WS] Connexion user_id={user_id}, manager_id={id(manager)}, connections={list(manager.connections.keys())}")
    await manager.connect(websocket, user_id)
    logger.info(f"[WS] Connecté: user_id={user_id}, total connections: {len(manager.connections)}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info(f"[WS] Déconnecté: user_id={user_id}")
        manager.disconnect(user_id)