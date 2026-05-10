from sqlalchemy import Column, Integer, String
from database import Base

class Quart(Base):
    __tablename__ = "quarts"

    id_quart    = Column(Integer, primary_key=True, index=True)
    nom_quart   = Column(String(50), nullable=False)
    heure_debut = Column(String(5),  nullable=False)
    heure_fin   = Column(String(5),  nullable=False)