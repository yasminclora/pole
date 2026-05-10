from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Equipe(Base):
    __tablename__ = "equipes"

    id_equipe               = Column(Integer, primary_key=True, index=True)
    nom_equipe              = Column(String(100), nullable=False)
    id_pole                 = Column(Integer, ForeignKey("poles.id_pole"), nullable=False)
    date_reference_cycle    = Column(Date, nullable=True)
    position_initiale_cycle = Column(Integer, default=0)

    pole         = relationship("Pole",        back_populates="equipes")
    utilisateurs = relationship("Utilisateur", back_populates="equipe")