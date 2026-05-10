from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class StatutDemande(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    ACCEPTE    = "ACCEPTE"
    REFUSE     = "REFUSE"

class QuartEnum(str, enum.Enum):
    MATIN      = "Matin"
    APRES_MIDI = "Après-midi"
    NUIT       = "Nuit"
    REPOS      = "Repos"

class ConfigPlanning(Base):
    __tablename__ = "configurations_planning"

    id             = Column(Integer, primary_key=True, index=True)
    id_pole        = Column(Integer, ForeignKey("poles.id_pole"), unique=True, nullable=False)
    date_debut     = Column(Date, nullable=False)
    position_alpha = Column(Integer, nullable=False, default=0)  # 0/2/4/6
    cree_par       = Column(Integer, ForeignKey("utilisateurs.id_user"), nullable=True)
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, onupdate=func.now())

    pole    = relationship("Pole")
    createur= relationship("Utilisateur", foreign_keys=[cree_par])

class DemandeEchange(Base):
    __tablename__ = "demandes_echange"

    id                  = Column(Integer, primary_key=True, index=True)
    id_pole             = Column(Integer, ForeignKey("poles.id_pole"), nullable=False)
    id_equipe_demandeur = Column(Integer, ForeignKey("equipes.id_equipe"), nullable=False)
    date_echange        = Column(Date, nullable=False)
    quart_souhaite      = Column(SAEnum(QuartEnum), nullable=False)
    motif               = Column(Text, nullable=True)
    statut              = Column(SAEnum(StatutDemande), default=StatutDemande.EN_ATTENTE)
    motif_refus         = Column(Text, nullable=True)
    id_equipe_cible     = Column(Integer, ForeignKey("equipes.id_equipe"), nullable=True)
    traite_par          = Column(Integer, ForeignKey("utilisateurs.id_user"), nullable=True)
    created_at          = Column(DateTime, server_default=func.now())
    traite_at           = Column(DateTime, nullable=True)

    pole              = relationship("Pole")
    equipe_demandeur  = relationship("Equipe", foreign_keys=[id_equipe_demandeur])
    equipe_cible      = relationship("Equipe", foreign_keys=[id_equipe_cible])
    traiteur          = relationship("Utilisateur", foreign_keys=[traite_par])

class EchangeQuart(Base):
    __tablename__ = "echanges_quart"

    id           = Column(Integer, primary_key=True, index=True)
    id_pole      = Column(Integer, ForeignKey("poles.id_pole"), nullable=False)
    date_echange = Column(Date, nullable=False)
    id_equipe_1  = Column(Integer, ForeignKey("equipes.id_equipe"), nullable=False)
    id_equipe_2  = Column(Integer, ForeignKey("equipes.id_equipe"), nullable=False)
    motif        = Column(Text, nullable=True)
    id_demande   = Column(Integer, ForeignKey("demandes_echange.id"), nullable=True)
    cree_par     = Column(Integer, ForeignKey("utilisateurs.id_user"), nullable=True)
    created_at   = Column(DateTime, server_default=func.now())

    pole      = relationship("Pole")
    equipe_1  = relationship("Equipe", foreign_keys=[id_equipe_1])
    equipe_2  = relationship("Equipe", foreign_keys=[id_equipe_2])
    demande   = relationship("DemandeEchange")
    createur  = relationship("Utilisateur", foreign_keys=[cree_par])