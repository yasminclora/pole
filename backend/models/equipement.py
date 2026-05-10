from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Equipement(Base):
    __tablename__ = "equipements"

    id_equipement     = Column(Integer, primary_key=True, index=True)
    equipment_code    = Column(String(100), unique=True, nullable=False, index=True)
    description       = Column(String(500), nullable=False)

    # Hiérarchie
    hierarchy_level   = Column(Integer, nullable=False, default=1)
    id_parent         = Column(Integer, ForeignKey("equipements.id_equipement"), nullable=True)
    id_machine_racine = Column(Integer, ForeignKey("equipements.id_equipement"), nullable=True)

    # Localisation
    id_pole = Column(Integer, ForeignKey("poles.id_pole"), nullable=True)
    id_zone = Column(Integer, ForeignKey("zones.id_zone"), nullable=True)

    # Infos
    install_date = Column(Date,    nullable=True)
    status       = Column(String(50), nullable=True, default="NORMAL")
    categorie    = Column(String(100), nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    # Relations
    parent = relationship(
        "Equipement",
        foreign_keys=[id_parent],
        remote_side="Equipement.id_equipement",
        back_populates="enfants"
    )
    enfants = relationship(
        "Equipement",
        foreign_keys=[id_parent],
        back_populates="parent"
    )
    machine_racine = relationship(
        "Equipement",
        foreign_keys=[id_machine_racine],
        remote_side="Equipement.id_equipement",
        back_populates="tous_descendants"
    )
    tous_descendants = relationship(
        "Equipement",
        foreign_keys=[id_machine_racine],
        back_populates="machine_racine"
    )

    pole = relationship("Pole", foreign_keys=[id_pole])
    zone = relationship("Zone", foreign_keys=[id_zone])