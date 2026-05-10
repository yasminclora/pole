from sqlalchemy import (
    Column, Integer, String, DateTime,
    ForeignKey, Float, Date, Text,
    Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class StatutPrediction(str, enum.Enum):
    ACTIVE    = "ACTIVE"
    OT_CREE   = "OT_CREE"
    RESOLUE   = "RESOLUE"
    IGNOREE   = "IGNOREE"


class ModePrediction(str, enum.Enum):
    SIMULATION = "SIMULATION"
    MODEL      = "MODEL"


class ConfiancePrediction(str, enum.Enum):
    FAIBLE       = "FAIBLE"
    MOYENNE      = "MOYENNE"
    HAUTE        = "HAUTE"
    INSUFFISANT  = "INSUFFISANT"


class CriticitePrediction(str, enum.Enum):
    CRITIQUE  = "CRITIQUE"
    ATTENTION = "ATTENTION"
    SAIN      = "SAIN"


class Prediction(Base):
    __tablename__ = "predictions"

    id_prediction   = Column(Integer, primary_key=True, index=True)

    # Composante prédite
    equipment_code  = Column(String(100), nullable=False, index=True)
    description     = Column(String(500), nullable=True)
    equipment_level = Column(Integer, nullable=True)
    machine_racine  = Column(String(100), nullable=True)

    # Pôle
    id_pole         = Column(Integer, ForeignKey("poles.id_pole"), nullable=False)

    # Résultats
    rul_jours       = Column(Float, nullable=True)

    # Criticité dérivée du RUL
    criticite       = Column(SAEnum(CriticitePrediction), nullable=True)

    # Confiance du modèle
    confiance       = Column(SAEnum(ConfiancePrediction), nullable=True)

    # Mode de calcul
    mode            = Column(SAEnum(ModePrediction), default=ModePrediction.SIMULATION)

    probabilite     = Column(Float, nullable=True)
    date_prevue_panne = Column(Date, nullable=True)

    # Coût moyen des pannes historiques
    cout_moyen      = Column(Float, nullable=True)

    # MTBF moyen
    mtbf_moyen      = Column(Float, nullable=True)

    # Dernière panne connue
    derniere_panne  = Column(Date, nullable=True)

    # Contexte stock
    stock_disponible  = Column(Integer, nullable=True)
    alerte_stock      = Column(String(20), nullable=True)

    # Qui a lancé
    id_methodiste   = Column(Integer, ForeignKey("utilisateurs.id_user"), nullable=False)

    # Statut
    statut          = Column(SAEnum(StatutPrediction), default=StatutPrediction.ACTIVE)

    # OT créé
    id_ot_genere    = Column(Integer, ForeignKey("ordres_travail.id_ot"), nullable=True)

    notes           = Column(Text, nullable=True)
    date_prediction = Column(DateTime, server_default=func.now())
    created_at      = Column(DateTime, server_default=func.now())

    # Relations
    pole            = relationship("Pole", foreign_keys=[id_pole])
    methodiste      = relationship("Utilisateur", foreign_keys=[id_methodiste])
    ot_genere       = relationship("OrdreTravail", foreign_keys=[id_ot_genere])
