"""
Table notifications — persistance des messages temps-réel.
Chaque envoi WS est aussi enregistré ici pour que les notifs survivent
à une déconnexion (un user reconnecté récupère ses non-lues).
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    ForeignKey, Text, JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id_notification = Column(Integer, primary_key=True, index=True)

    # Destinataire
    id_user      = Column(Integer, ForeignKey("utilisateurs.id_user"),
                          nullable=False, index=True)

    # Type d'événement (OT_ASSIGNE, RESERVATION_PIECE, etc.)
    type         = Column(String(50), nullable=False)

    # Titre court + message lisible
    titre        = Column(String(200), nullable=True)
    message      = Column(Text,         nullable=False)

    # Payload complet (id_ot, numero_ot, etc.) sérialisé en JSON
    payload      = Column(JSON, nullable=True)

    # Liens optionnels (pour requêtes rapides)
    id_ot          = Column(Integer, nullable=True, index=True)
    id_reservation = Column(Integer, nullable=True, index=True)
    id_di          = Column(Integer, nullable=True, index=True)

    # Lu / non lu
    lu           = Column(Boolean, default=False, nullable=False, index=True)
    date_lecture = Column(DateTime, nullable=True)

    created_at   = Column(DateTime, server_default=func.now(), index=True)

    # Relation
    user = relationship("Utilisateur", foreign_keys=[id_user])
