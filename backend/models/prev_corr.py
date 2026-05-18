"""
models/prev_corr.py
Table contenant TOUTES les interventions (préventives + correctives)
issues du fichier maintenance.csv.

Utilisée par le dashboard historique pour les statistiques globales.
À ne pas confondre avec `historique_interventions` qui contient
uniquement les interventions CORR (utilisées pour la prédiction).
"""

from sqlalchemy import (
    Column, Integer, String, Date, Float,
    Enum as SAEnum, DateTime
)
from sqlalchemy.sql import func
from database import Base
import enum


class TypeTravailPrevCorr(str, enum.Enum):
    PREV = "PREV"
    CORR = "CORR"


class JobClassPrevCorr(str, enum.Enum):
    PREVEN = "PREVEN"
    MECA   = "MECA"
    ELEC   = "ELEC"


class PrevCorr(Base):
    __tablename__ = "prev_corr"

    id = Column(Integer, primary_key=True, index=True)

    # ── Équipement ────────────────────────────────────────────────
    system_equipment      = Column(String(100), nullable=False, index=True)
    equipment_description = Column(String(255), nullable=False)
    equipment_code        = Column(String(100), nullable=True, index=True)
    equipment_level       = Column(Integer, nullable=True)

    parent_code           = Column(String(100), nullable=True)
    parent_level          = Column(Float, nullable=True)

    # ── Type d'intervention ───────────────────────────────────────
    type_travail          = Column(
        SAEnum(TypeTravailPrevCorr, name="typetravailprevcorr"),
        nullable=False, index=True,
    )
    job_class             = Column(
        SAEnum(JobClassPrevCorr, name="jobclassprevcorr"),
        nullable=True, index=True,
    )

    # ── Localisation / responsable ────────────────────────────────
    action_entity         = Column(String(100), nullable=True, index=True)

    # ── Dates ─────────────────────────────────────────────────────
    date_declaration      = Column(Date, nullable=False, index=True)
    date_fin              = Column(Date, nullable=True)
    date_creation         = Column(Date, nullable=False)

    # ── Coûts ─────────────────────────────────────────────────────
    cout_total            = Column(Float, nullable=False, default=0.0)

    # ── Métadonnées ───────────────────────────────────────────────
    source                = Column(String(50), nullable=False)
    label_quality         = Column(String(20), nullable=True)

    created_at            = Column(DateTime, server_default=func.now())
