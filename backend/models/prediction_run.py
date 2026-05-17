from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime,
    ForeignKey, Enum as SAEnum, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class StatutRun(str, enum.Enum):
    EN_COURS = "EN_COURS"
    TERMINE  = "TERMINE"
    ERREUR   = "ERREUR"


class StatutRUL(str, enum.Enum):
    CRITIQUE     = "CRITIQUE"
    URGENT       = "URGENT"
    SURVEILLANCE = "SURVEILLANCE"
    OK           = "OK"


class SourcePrediction(str, enum.Enum):
    ML         = "ML"
    SIMULATION = "SIMULATION"


class PredictionRun(Base):
    __tablename__ = "prediction_runs"

    id_run          = Column(Integer, primary_key=True, index=True)
    id_modele       = Column(Integer, ForeignKey("modeles_ml.id_modele"), nullable=False)
    id_user         = Column(Integer, ForeignKey("utilisateurs.id_user"), nullable=False)
    pole            = Column(String(100), nullable=True)   # None = tous les pôles (ADMIN)

    statut          = Column(SAEnum(StatutRun), nullable=False, default=StatutRun.EN_COURS)
    nb_composants   = Column(Integer, nullable=True)
    nb_critiques    = Column(Integer, nullable=True)
    nb_urgents      = Column(Integer, nullable=True)
    nb_surveillance = Column(Integer, nullable=True)
    nb_ok           = Column(Integer, nullable=True)
    duree_ms        = Column(Integer, nullable=True)       # durée d'exécution en ms
    erreur_message  = Column(Text, nullable=True)

    launched_at     = Column(DateTime, server_default=func.now(), nullable=False)
    finished_at     = Column(DateTime, nullable=True)

    resultats       = relationship("PredictionResultat", back_populates="run", cascade="all, delete-orphan")


class PredictionResultat(Base):
    __tablename__ = "prediction_resultats"

    id_resultat       = Column(Integer, primary_key=True, index=True)
    id_run            = Column(Integer, ForeignKey("prediction_runs.id_run"), nullable=False)

    # Date à laquelle le modèle a été interrogé (= ref_date du panel journalier).
    # Permet de stocker plusieurs prédictions mensuelles par composant par run.
    ref_date          = Column(Date, nullable=True, index=True)

    equipment_code    = Column(String(100), nullable=False, index=True)
    equipment_desc    = Column(String(255), nullable=True)
    system_equipment  = Column(String(100), nullable=True)
    pole              = Column(String(100), nullable=True)
    zone              = Column(String(200), nullable=True)
    comp_level        = Column(Integer,     nullable=True)

    rul_jours         = Column(Integer,     nullable=False)
    statut            = Column(SAEnum(StatutRUL), nullable=False)
    date_panne_prevue = Column(Date,        nullable=True)
    confiance_pct     = Column(Integer,     nullable=True)
    source            = Column(SAEnum(SourcePrediction), nullable=False, default=SourcePrediction.ML)

    # Infos stock au moment de la prédiction
    stock_disponible  = Column(Integer,     nullable=True)
    alerte_stock      = Column(String(10),  nullable=True)  # "OK" | "FAIBLE" | "ABSENT"

    run               = relationship("PredictionRun", back_populates="resultats")
