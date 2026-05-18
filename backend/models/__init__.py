from models.user         import Utilisateur, RoleEnum
from models.pole         import Pole
from models.zone         import Zone
from models.equipe       import Equipe
from models.quart        import Quart
from models.planing      import ConfigPlanning, EchangeQuart, DemandeEchange
from models.equipement   import Equipement
from models.di           import DemandeIntervention, StatutDI, UrgenceDI
from models.ot           import OrdreTravail, TypeOT, ClasseOT, PrioriteOT, StatutOT
from models.intervention import Intervention, TypeTravail, StatutValidation
from models.stock        import PieceStock, ComposanteStock, ReservationPiece, StatutReservation
from models.prediction   import Prediction, StatutPrediction

# ── Historique SAP/CSV (données CORR uniquement, pour le ML) ──────────
from models.historique_interventions import (
    HistoriqueIntervention,
    TypeTravailHistorique,
)

# ── Historique complet PREV + CORR (pour le dashboard historique) ─────
from models.prev_corr import (
    PrevCorr,
    TypeTravailPrevCorr,
    JobClassPrevCorr,
)

# ── Archives opérationnelles (interventions validées par le méthodiste) ──
from models.historique_intervention import InterventionArchivee