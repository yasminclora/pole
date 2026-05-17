"""
Service de notifications temps-réel.
Chaque notif est :
  1. Persistée en BDD (table notifications)  → survie à la déconnexion
  2. Envoyée via WebSocket si le user est connecté (best-effort)

À la reconnexion, le frontend fait GET /notifications/me/non-lues pour
rattraper ce qu'il a manqué.
"""

import json
import logging
from typing import Optional
from fastapi import WebSocket

from database import SessionLocal
from models.notification import Notification

logger = logging.getLogger("notification")


class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.connections[user_id] = websocket
        logger.info(f"[Notification] Connexion: user_id={user_id} | total={len(self.connections)}")

    def disconnect(self, user_id: int):
        self.connections.pop(user_id, None)
        logger.info(f"[Notification] Déconnexion: user_id={user_id} | restants={len(self.connections)}")

    # ───────────────────────────────────────────────────────────────
    #  Envoi d'une notif à un user spécifique
    # ───────────────────────────────────────────────────────────────
    async def send_personal_message(
        self,
        user_id: int,
        message: dict,
        db=None,
        persist: bool = True,
    ):
        """
        Persiste la notification en BDD puis tente l'envoi WS.
        - user_id : destinataire
        - message : dict avec au minimum 'type' et 'message'
                    + champs optionnels : titre, id_ot, id_reservation, id_di
        - db      : Session SQLAlchemy (si None, on en crée une éphémère)
        - persist : False pour des messages non importants (heartbeat, etc.)
        """
        try:
            user_id = int(user_id)
        except (TypeError, ValueError) as e:
            logger.error(f"[Notification] user_id invalide ({user_id}): {e}")
            return

        # ── 1. Persistance en BDD ───────────────────────────────────
        notif_db = None
        if persist:
            owns_db = db is None
            if owns_db:
                db = SessionLocal()
            try:
                notif_db = Notification(
                    id_user        = user_id,
                    type           = str(message.get("type", "INFO"))[:50],
                    titre          = (message.get("titre") or message.get("type", "Notification"))[:200],
                    message        = str(message.get("message", "")),
                    payload        = message,
                    id_ot          = message.get("id_ot"),
                    id_reservation = message.get("id_reservation"),
                    id_di          = message.get("id_di"),
                )
                db.add(notif_db)
                db.commit()
                db.refresh(notif_db)
                # Ajoute l'id de la notif dans le message envoyé en WS
                message = {**message, "id_notification": notif_db.id_notification}
            except Exception as e:
                logger.error(f"[Notification] persist KO user={user_id}: {e}")
                db.rollback()
            finally:
                if owns_db:
                    db.close()

        # ── 2. Envoi WebSocket (best-effort) ───────────────────────
        ws = self.connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False, default=str))
                logger.info(f"[Notification] WS OK user={user_id} type={message.get('type')}")
            except Exception as e:
                logger.warning(f"[Notification] WS KO user={user_id}: {e}")
                self.disconnect(user_id)
        else:
            logger.info(f"[Notification] persistée seulement (user={user_id} hors ligne) type={message.get('type')}")

    # ───────────────────────────────────────────────────────────────
    #  Envoi à plusieurs users à la fois
    # ───────────────────────────────────────────────────────────────
    async def send_to_users(self, user_ids: list[int], message: dict, db=None):
        for uid in user_ids:
            await self.send_personal_message(uid, message, db=db)

    # ───────────────────────────────────────────────────────────────
    #  Envoi par rôle (uniquement aux connectés)
    # ───────────────────────────────────────────────────────────────
    async def send_to_role(self, role: str, message: dict, db=None):
        if db is None:
            await self.broadcast(message)
            return
        from models.user import Utilisateur
        users = db.query(Utilisateur).filter(Utilisateur.role == role).all()
        for u in users:
            await self.send_personal_message(u.id_user, message, db=db)

    # ───────────────────────────────────────────────────────────────
    #  Broadcast (utilisé rarement, sans persistance par défaut)
    # ───────────────────────────────────────────────────────────────
    async def broadcast(self, message: dict, exclure: Optional[int] = None):
        for uid, ws in list(self.connections.items()):
            if uid == exclure:
                continue
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False, default=str))
            except Exception:
                self.disconnect(uid)


manager = ConnectionManager()
