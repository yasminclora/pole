from sqlalchemy import (
    Column, Integer, String, DateTime,
    ForeignKey, Text, Float, Date,
    Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class SourceHistorique(str, enum.Enum):
    SYSTEME = "SYSTEME"   # créé par le système lors de l'archivage
    IMPORT  = "IMPORT"    # importé manuellement


class InterventionArchivee(Base):
    """
    Archive des interventions opérationnelles validées par le méthodiste.
    Table : interventions_archivees
    
    DIFFÉRENT de historique_interventions (données CSV/SAP pour le ML).
    Cette table archive les interventions saisies dans le système.
    """
    __tablename__ = "interventions_archivees"

    id_historique          = Column(Integer, primary_key=True, index=True)

    # Équipement (FK vers la table equipements)
    id_equipement          = Column(Integer, ForeignKey("equipements.id_equipement"), nullable=False)
    code_equipement        = Column(String(100), nullable=False)
    description_equipement = Column(String(500), nullable=True)

    # Pôle
    id_pole                = Column(Integer, ForeignKey("poles.id_pole"), nullable=True)

    # Type et détails
    type_travail           = Column(String(50), nullable=False)
    date_panne             = Column(Date,     nullable=False)
    date_debut             = Column(DateTime, nullable=True)
    date_fin               = Column(DateTime, nullable=True)
    duree_reelle           = Column(Integer,  nullable=True)  # en minutes
    observations           = Column(Text,     nullable=True)
    composante_remplacee   = Column(Integer, ForeignKey("equipements.id_equipement"), nullable=True)

    # Colonnes enrichies (pour le ML)
    job_class              = Column(String(20), nullable=True)
    cout_total             = Column(Float,      nullable=True)
    action_entity          = Column(String(50), nullable=True)
    equipment_level        = Column(Integer,    nullable=True)
    label_quality          = Column(String(30), nullable=True)

    # Métadonnées
    source                 = Column(SAEnum(SourceHistorique), default=SourceHistorique.SYSTEME)
    id_ot                  = Column(Integer, ForeignKey("ordres_travail.id_ot"), nullable=True)
    created_at             = Column(DateTime, server_default=func.now())

    # Relations
    equipement   = relationship("Equipement", foreign_keys=[id_equipement])
    pole         = relationship("Pole")
    ot           = relationship("OrdreTravail", foreign_keys=[id_ot])