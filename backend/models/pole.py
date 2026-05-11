from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from database import Base

class Pole(Base):
    __tablename__ = "poles"

    id_pole   = Column(Integer, primary_key=True, index=True)
    code_pole = Column(String(50), nullable=True, unique=True)  # nouveau
    nom_pole  = Column(String(200), nullable=False)
    description = Column(String(300), nullable=True)            # gardé optionnel

    equipes  = relationship("Equipe",  back_populates="pole")
    zones    = relationship("Zone",    back_populates="pole")
    utilisateurs = relationship("Utilisateur", back_populates="pole")