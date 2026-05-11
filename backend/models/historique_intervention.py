from sqlalchemy import (
    Column, Integer, String, Float, Date, Enum as SAEnum, DateTime
)
from sqlalchemy.sql import func
from database import Base
from models.historique_interventions import TypeTravailHistorique


class InterventionArchivee(Base):
    """
    Archive miroir de historique_interventions (pour ML/dashboard).
    Table : interventions_archivees
    MEMES COLONNES que historique_interventions.
    """
    __tablename__ = "interventions_archivees"

    id                     = Column(Integer, primary_key=True, index=True)

    system_equipment       = Column(String(100), nullable=False, index=True)
    equipment_description  = Column(String(255), nullable=False)

    equipment_code         = Column(String(100), nullable=True, index=True)
    equipment_level        = Column(Integer, nullable=True)

    parent_code            = Column(String(100), nullable=True)
    parent_level           = Column(Float, nullable=True)

    type_travail           = Column(
        SAEnum(TypeTravailHistorique), nullable=False, index=True
    )

    action_entity = Column(String(100), nullable=True)

    date_declaration       = Column(Date, nullable=False)
    date_fin               = Column(Date, nullable=True)
    date_creation          = Column(Date, nullable=False)

    cout_total             = Column(Float, nullable=False, default=0.0)

    source                 = Column(String(50), nullable=False)

    created_at             = Column(DateTime, server_default=func.now())