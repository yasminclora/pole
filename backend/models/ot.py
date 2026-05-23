from sqlalchemy import (
    Column, Integer, String, Date, DateTime,
    ForeignKey, Float, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class TypeOT(str, enum.Enum):
    CORRECTIF  = "CORRECTIF"   # depuis DI
    PREDICTIF  = "PREDICTIF"   # depuis ML


class ClasseOT(str, enum.Enum):
    MECANIQUE  = "MECANIQUE"   # → mécanicien
    ELECTRIQUE = "ELECTRIQUE"  # → technicien


class UrgenceOT(str, enum.Enum):
    """Niveau d'urgence d'un OT (cohérent avec UrgenceDI)."""
    NIVEAU_1 = "NIVEAU_1"   # peu urgent
    NIVEAU_2 = "NIVEAU_2"   # moyen
    NIVEAU_3 = "NIVEAU_3"   # élevé


# Alias legacy pour ne pas casser les imports existants (deprecated)
class PrioriteOT(str, enum.Enum):
    FAIBLE    = "FAIBLE"
    NORMALE   = "NORMALE"
    HAUTE     = "HAUTE"
    CRITIQUE  = "CRITIQUE"


class StatutOT(str, enum.Enum):
    CREE        = "CREE"        # créé par méthodiste
    ASSIGNE     = "ASSIGNE"     # assigné au mécanicien
    EN_COURS    = "EN_COURS"    # mécanicien a démarré
    TERMINE     = "TERMINE"     # feedback soumis
    REWORK      = "REWORK"      # rejet CE/HSE → mécanicien doit re-saisir
    VALIDE_CE   = "VALIDE_CE"   # validé chef équipe
    VALIDE_HSE  = "VALIDE_HSE"  # validé HSE
    ARCHIVE     = "ARCHIVE"     # archivé méthodiste
    REJETE      = "REJETE"      # rejeté définitivement


class OrdreTravail(Base):
    __tablename__ = "ordres_travail"

    id_ot           = Column(Integer, primary_key=True, index=True)

    # Numéro lisible
    # Format : OT-CORRECTIF-2026-001 ou OT-PREDICTIF-2026-001
    numero_ot       = Column(String(60), unique=True, nullable=False)

    # Type et classe
    type_ot         = Column(SAEnum(TypeOT),     nullable=False)
    # Stocke MECANIQUE / ELECTRIQUE (varchar pour eviter ALTER TYPE)
    classe          = Column(String(20),         nullable=False, default=ClasseOT.MECANIQUE.value)
    # urgence = NIVEAU_1 / NIVEAU_2 / NIVEAU_3 (cohérent avec DI.urgence)
    urgence         = Column(String(20),         default="NIVEAU_1")
    # Stocke CREE / ASSIGNE / EN_COURS / TERMINE / REWORK / VALIDE_CE / VALIDE_HSE / ARCHIVE / REJETE
    statut          = Column(String(20),         default=StatutOT.CREE.value)

    # Équipement concerné (Level 3 ou 4 uniquement)
    id_equipement   = Column(Integer,
                             ForeignKey("equipements.id_equipement"),
                             nullable=False)

    # Pôle (chaque pôle gère ses propres OT)
    id_pole         = Column(Integer,
                             ForeignKey("poles.id_pole"),
                             nullable=False)

    # Acteurs
    id_methodiste   = Column(Integer,
                             ForeignKey("utilisateurs.id_user"),
                             nullable=False)
    id_assigne      = Column(Integer,
                             ForeignKey("utilisateurs.id_user"),
                             nullable=True)  # mécanicien/technicien assigné
    id_assigne_2    = Column(Integer,
                             ForeignKey("utilisateurs.id_user"),
                             nullable=True)  # deuxième assigné (témoin/super)

    # Description
    description     = Column(Text, nullable=False)
    observations    = Column(Text, nullable=True)  # notes du méthodiste

    # Dates planifiées
    date_prevue     = Column(DateTime,    nullable=True)  # date ET heure prévue début
    duree_estimee   = Column(Integer, nullable=True)  # en minutes

    # Dates réelles (remplies par le mécanicien)
    date_debut_reelle = Column(DateTime, nullable=True)  # quand il démarre
    date_fin_reelle   = Column(DateTime, nullable=True)  # quand il termine
    # duree_reelle = date_fin_reelle - date_debut_reelle (calculé)

    # Source de l'OT
    id_di           = Column(Integer,
                             ForeignKey("demandes_intervention.id_di"),
                             nullable=True)   # si vient d'une DI
    id_prediction   = Column(Integer,
                             ForeignKey("predictions.id_prediction"),
                             nullable=True)   # si vient du ML

    # Motif rejet (si rejeté)
    motif_rejet     = Column(Text, nullable=True)
    id_rejecteur    = Column(Integer,
                             ForeignKey("utilisateurs.id_user"),
                             nullable=True)

    # Dates de validation
    date_assignation  = Column(DateTime, nullable=True)
    date_validation_ce= Column(DateTime, nullable=True)
    date_validation_hse=Column(DateTime, nullable=True)
    date_archive      = Column(DateTime, nullable=True)

    # Timestamps
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, onupdate=func.now())

    # ── Relations ──────────────────────────────────────────
    equipement  = relationship("Equipement",    foreign_keys=[id_equipement])
    pole        = relationship("Pole",          foreign_keys=[id_pole])
    methodiste  = relationship("Utilisateur",   foreign_keys=[id_methodiste])
    assigne     = relationship("Utilisateur",   foreign_keys=[id_assigne])
    assigne_2   = relationship("Utilisateur",   foreign_keys=[id_assigne_2])
    rejecteur   = relationship("Utilisateur",   foreign_keys=[id_rejecteur])
    di          = relationship("DemandeIntervention", foreign_keys=[id_di])
    prediction  = relationship("Prediction",    foreign_keys=[id_prediction])
    intervention= relationship("Intervention",  back_populates="ot",
                               uselist=False)