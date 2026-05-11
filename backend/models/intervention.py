from sqlalchemy import (
    Column, Integer, String, DateTime,
    ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class TypeTravail(str, enum.Enum):
    CORRECTIF     = "CORRECTIF"      # réparation corrective
    VERIFICATION  = "VERIFICATION"   # juste vérifier
    NETTOYAGE     = "NETTOYAGE"      # nettoyage
    REMPLACEMENT  = "REMPLACEMENT"   # remplacer la composante
    REPARATION    = "REPARATION"     # réparer sans remplacer
    REGLAGE       = "REGLAGE"        # réglage/calibration


class StatutValidation(str, enum.Enum):
    EN_ATTENTE    = "EN_ATTENTE"     # soumis, attend méthodiste
    VALIDE        = "VALIDE"         # validé par méthodiste
    REJETE        = "REJETE"         # rejeté → retour mécanicien
    VALIDE_HSE    = "VALIDE_HSE"     # validé HSE
    ARCHIVE       = "ARCHIVE"        # archivé définitivement


class Intervention(Base):
    __tablename__ = "interventions"

    id_intervention = Column(Integer, primary_key=True, index=True)

    # OT associé
    id_ot           = Column(Integer,
                             ForeignKey("ordres_travail.id_ot"),
                             nullable=False, unique=True)

    # Réalisateur (mécanicien ou technicien)
    id_realisateur  = Column(Integer,
                             ForeignKey("utilisateurs.id_user"),
                             nullable=False)

    # Pôle (isolation données)
    id_pole         = Column(Integer,
                             ForeignKey("poles.id_pole"),
                             nullable=False)

    # Équipement (copié depuis OT pour l'historique ML)
    id_equipement   = Column(Integer,
                             ForeignKey("equipements.id_equipement"),
                             nullable=False)

    # Détails du travail effectué
    type_travail    = Column(SAEnum(TypeTravail), nullable=True)
    description_travail = Column(Text, nullable=False)
    observations    = Column(Text, nullable=True)

    # Dates réelles
    date_debut      = Column(DateTime, nullable=True)  # quand il démarre
    date_fin        = Column(DateTime, nullable=True)  # quand il termine
    # duree_reelle (minutes) = calculé : (date_fin - date_debut)

    # Remplacement composante ?
    composante_remplacee = Column(Integer,
                                  ForeignKey("equipements.id_equipement"),
                                  nullable=True)
    # id de la composante remplacée (Level 3 ou 4)

    # Validation
    statut_validation = Column(SAEnum(StatutValidation),
                               default=StatutValidation.EN_ATTENTE)
    motif_rejet       = Column(Text, nullable=True)

    # Validateurs
    id_validateur_methode = Column(Integer,
                                   ForeignKey("utilisateurs.id_user"),
                                   nullable=True)
    id_validateur_hse     = Column(Integer,
                                   ForeignKey("utilisateurs.id_user"),
                                   nullable=True)

    # Dates validation
    date_soumission     = Column(DateTime, nullable=True)
    date_validation_met = Column(DateTime, nullable=True)
    date_validation_hse = Column(DateTime, nullable=True)
    date_archive        = Column(DateTime, nullable=True)

    # Timestamps
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, onupdate=func.now())

    # ── Relations ──────────────────────────────────────────
    ot              = relationship("OrdreTravail",
                                   back_populates="intervention")
    realisateur     = relationship("Utilisateur",
                                   foreign_keys=[id_realisateur])
    pole            = relationship("Pole",
                                   foreign_keys=[id_pole])
    equipement      = relationship("Equipement",
                                   foreign_keys=[id_equipement])
    composante_rempl= relationship("Equipement",
                                   foreign_keys=[composante_remplacee])
    validateur_met  = relationship("Utilisateur",
                                   foreign_keys=[id_validateur_methode])
    validateur_hse  = relationship("Utilisateur",
                                   foreign_keys=[id_validateur_hse])

    # Pièces utilisées
    pieces_utilisees = relationship("ReservationPiece",
                                    back_populates="intervention")