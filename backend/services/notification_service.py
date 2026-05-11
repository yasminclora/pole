import json
import logging
from fastapi import WebSocket

logger = logging.getLogger("notification")

class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.connections[user_id] = websocket
        logger.info(f"[Notification] Connexion: user_id={user_id}, total connections: {len(self.connections)}")

    def disconnect(self, user_id: int):
        self.connections.pop(user_id, None)
        logger.info(f"[Notification] Déconnexion: user_id={user_id}, remaining: {len(self.connections)}")

    async def send_personal_message(self, user_id: int, message: dict):
        """Envoie un message à un utilisateur spécifique (s'il est connecté)."""
        try:
            user_id = int(user_id)  # Ensure it's an int
        except (TypeError, ValueError) as e:
            logger.error(f"[Notification] Invalid user_id: {user_id} ({type(user_id).__name__}): {e}")
            return
            
        ws = self.connections.get(user_id)
        logger.info(f"[Notification] Tentative envoi à user_id={user_id}, connecté={ws is not None}, msg={message.get('type')}")
        if ws:
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False))
                logger.info(f"[Notification] Message envoyé à user_id={user_id}")
            except Exception as e:
                logger.error(f"[Notification] Erreur envoi: {e}")
                self.disconnect(user_id)

    async def send_to_role(self, role: str, message: dict, db=None):
        """
        Envoie un message à tous les utilisateurs connectés ayant un rôle donné.
        Nécessite une session DB pour résoudre les user_id par rôle.
        Si db est fourni, filtre par rôle ; sinon broadcast à tous.
        """
        if db is None:
            await self.broadcast(message)
            return
        from models.user import Utilisateur
        users = db.query(Utilisateur).filter(
            Utilisateur.role == role,
            Utilisateur.id_user.in_(list(self.connections.keys()))
        ).all()
        for u in users:
            await self.send_personal_message(u.id_user, message)

    async def broadcast(self, message: dict, exclure: int | None = None):
        """Envoie un message à tous les utilisateurs connectés."""
        for uid, ws in list(self.connections.items()):
            if uid == exclure:
                continue
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False))
            except Exception:
                self.disconnect(uid)

manager = ConnectionManager()