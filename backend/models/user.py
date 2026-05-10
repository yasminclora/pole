from sqlalchemy import Column, Integer, String, Date, Enum, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import enum

class RoleEnum(str, enum.Enum):
    ADMIN       = "ADMIN"
    METHODISTE  = "METHODISTE"
    CHEF_POLE   = "CHEF_POLE"
    CHEF_EQUIPE = "CHEF_EQUIPE"
    MECANICIEN  = "MECANICIEN"
    TECHNICIEN  = "TECHNICIEN"
    HSE         = "HSE"
    GESTIONNAIRE_STOCK = "GESTIONNAIRE_STOCK"

class GenreEnum(str, enum.Enum):
    HOMME = "HOMME"
    FEMME = "FEMME"

class ShiftEnum(str, enum.Enum):
    MATIN = "MATIN"
    APRES_MIDI = "APRES_MIDI"
    NUIT = "NUIT"

class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id_user        = Column(Integer, primary_key=True, index=True)
    nom            = Column(String(100), nullable=False)
    prenom         = Column(String(100), nullable=False)
    genre          = Column(Enum(GenreEnum), nullable=False)
    date_naissance = Column(Date, nullable=False)
    date_embauche  = Column(Date, nullable=False)
    telephone      = Column(String(20),  nullable=True)
    email          = Column(String(255), unique=True, nullable=False)
    identifiant    = Column(String(100), unique=True, nullable=False)
    mot_de_passe   = Column(String(255), nullable=False)
    role           = Column(Enum(RoleEnum), nullable=False)
    id_pole        = Column(Integer, ForeignKey("poles.id_pole"),    nullable=True)
    id_equipe      = Column(Integer, ForeignKey("equipes.id_equipe"), nullable=True)
    shift          = Column(Enum(ShiftEnum), nullable=True)  # Schedule shift

    pole   = relationship("Pole",   back_populates="utilisateurs")
    equipe = relationship("Equipe", back_populates="utilisateurs")