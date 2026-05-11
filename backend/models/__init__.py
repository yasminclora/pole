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

# ── Historique SAP/CSV (données pour le ML et le dashboard) ──────────
from models.historique_interventions import (
    HistoriqueIntervention,
    TypeTravailHistorique,
)

# ── Archives opérationnelles (interventions validées par le méthodiste) ──
from models.historique_intervention import InterventionArchivee