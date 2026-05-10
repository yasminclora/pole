from sqlalchemy import (
    Column, Integer, String, DateTime,
    ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UrgenceDI(str, enum.Enum):
    NIVEAU_1 = "NIVEAU_1"
    NIVEAU_2 = "NIVEAU_2"
    NIVEAU_3 = "NIVEAU_3"
    # Compatibilité ancienne base
    FAIBLE   = "FAIBLE"
    NORMALE  = "NORMALE"
    HAUTE    = "HAUTE"
    CRITIQUE = "CRITIQUE"


class StatutDI(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    VERIFIE    = "VERIFIE"      # ← ajouté
    VALIDEE    = "VALIDEE"
    REJETEE    = "REJETEE"
    EN_COURS   = "EN_COURS"


class DemandeIntervention(Base):
    __tablename__ = "demandes_intervention"

    id_di             = Column(Integer, primary_key=True, index=True)
    numero_di         = Column(String(30), unique=True, nullable=False)
    id_equipement     = Column(Integer, ForeignKey("equipements.id_equipement"), nullable=False)
    id_pole           = Column(Integer, ForeignKey("poles.id_pole"),             nullable=False)
    id_declarant      = Column(Integer, ForeignKey("utilisateurs.id_user"),      nullable=False)
    id_methodiste     = Column(Integer, ForeignKey("utilisateurs.id_user"),      nullable=True)
    description_panne = Column(Text, nullable=False)
    urgence           = Column(String(20), nullable=True)
    statut            = Column(String(20), nullable=False, default="EN_ATTENTE")
    motif_rejet       = Column(Text, nullable=True)
    id_ot_genere      = Column(Integer, ForeignKey("ordres_travail.id_ot"), nullable=True)
    date_verification = Column(DateTime, nullable=True)
    date_traitement   = Column(DateTime, nullable=True)
    created_at        = Column(DateTime, server_default=func.now())
    updated_at        = Column(DateTime, onupdate=func.now())

    equipement  = relationship("Equipement",  foreign_keys=[id_equipement])
    pole        = relationship("Pole",        foreign_keys=[id_pole])
    declarant   = relationship("Utilisateur", foreign_keys=[id_declarant])
    methodiste  = relationship("Utilisateur", foreign_keys=[id_methodiste])
    ot_genere   = relationship("OrdreTravail",foreign_keys=[id_ot_genere])