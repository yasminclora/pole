from sqlalchemy import (
    Column, Integer, String, DateTime,
    ForeignKey, Text, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class StatutReservation(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    VALIDEE    = "VALIDEE"
    LIVREE     = "LIVREE"
    ANNULEE    = "ANNULEE"


class PieceStock(Base):
    """
    Une ligne = une pièce physique générique.
    Identifiée par code_stock (ex: STK-0001).
    Peut être montée sur N machines différentes → via ComposanteStock.
    """
    __tablename__ = "pieces_stock"

    id_piece     = Column(Integer, primary_key=True, index=True)

    # Identifiant universel de la pièce (généré à l'import)
    code_stock   = Column(String(50), unique=True, nullable=False, index=True)
    # ex: STK-0001, STK-0042

    designation  = Column(String(300), nullable=False)
    # ex: MOTEUR ELECTRIQUE  (normalisé UPPER)

    description  = Column(Text, nullable=True)
    # Notes complémentaires, références constructeur, etc.

    # Stock
    quantite        = Column(Integer, default=0, nullable=False)
    seuil_alerte    = Column(Integer, default=2, nullable=False)
    # 🔴 quantite == 0
    # 🟠 0 < quantite <= seuil_alerte
    # 🟢 quantite > seuil_alerte

    emplacement  = Column(String(200), nullable=True)
    # "Rayon A - Étagère 3 - Bac 12"

    unite        = Column(String(20), default="pcs")
    # pcs, m, L, kg...

    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, onupdate=func.now())

    # Relations
    composantes  = relationship("ComposanteStock", back_populates="piece")
    reservations = relationship("ReservationPiece", back_populates="piece")


class ComposanteStock(Base):
    """
    Lien entre une composante SAP (Level 3/4/5) et une pièce en stock.
    Plusieurs composantes → même pièce physique.

    La composante reçoit aussi un code_stock directement
    pour recherche rapide sans jointure.
    """
    __tablename__ = "composante_stock"

    id            = Column(Integer, primary_key=True)

    id_equipement = Column(Integer,
                           ForeignKey("equipements.id_equipement"),
                           nullable=False)
    id_piece      = Column(Integer,
                           ForeignKey("pieces_stock.id_piece"),
                           nullable=False)

    # Copié depuis pieces_stock.code_stock pour accès direct
    code_stock    = Column(String(50), nullable=False, index=True)

    # Nb pièces nécessaires pour un remplacement standard
    quantite_type = Column(Integer, default=1)

    created_at    = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("id_equipement", "id_piece", name="uq_compo_piece"),
    )

    # Relations
    equipement = relationship("Equipement")
    piece      = relationship("PieceStock", back_populates="composantes")


class ReservationPiece(Base):
    """
    Réservation d'une pièce par un mécanicien pour un OT.
    """
    __tablename__ = "reservations_pieces"

    id_reservation = Column(Integer, primary_key=True, index=True)

    id_piece       = Column(Integer,
                            ForeignKey("pieces_stock.id_piece"),
                            nullable=False)
    id_ot          = Column(Integer,
                            ForeignKey("ordres_travail.id_ot"),
                            nullable=False)
    id_intervention = Column(Integer,
                             ForeignKey("interventions.id_intervention"),
                             nullable=True)
    id_mecanicien  = Column(Integer,
                            ForeignKey("utilisateurs.id_user"),
                            nullable=False)
    id_gestionnaire = Column(Integer,
                             ForeignKey("utilisateurs.id_user"),
                             nullable=True)

    quantite_demandee = Column(Integer, default=1, nullable=False)
    quantite_livree   = Column(Integer, nullable=True)

    statut = Column(SAEnum(StatutReservation),
                    default=StatutReservation.EN_ATTENTE)

    notes_mecanicien   = Column(Text, nullable=True)
    notes_gestionnaire = Column(Text, nullable=True)

    date_demande    = Column(DateTime, server_default=func.now())
    date_validation = Column(DateTime, nullable=True)
    date_livraison  = Column(DateTime, nullable=True)

    # Relations
    piece        = relationship("PieceStock", back_populates="reservations")
    ot           = relationship("OrdreTravail")
    intervention = relationship("Intervention",
                                back_populates="pieces_utilisees")
    mecanicien   = relationship("Utilisateur", foreign_keys=[id_mecanicien])
    gestionnaire = relationship("Utilisateur", foreign_keys=[id_gestionnaire])