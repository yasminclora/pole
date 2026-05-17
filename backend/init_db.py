from database import engine, SessionLocal, Base

# ── Tous les modèles ──────────────────────────────────────────────
from models.pole       import Pole
from models.quart      import Quart
from models.equipe     import Equipe
from models.user       import Utilisateur, RoleEnum, GenreEnum
from models.planing    import ConfigPlanning, DemandeEchange, EchangeQuart
from models.zone       import Zone

from models.equipement import Equipement


from models.di                   import DemandeIntervention
from models.ot                   import OrdreTravail
from models.intervention         import Intervention
from models.stock                import PieceStock, ComposanteStock, ReservationPiece
from models.prediction           import Prediction
from models.historique_interventions import HistoriqueIntervention, TypeTravailHistorique
from models.modele_ml          import ModeleML, TypeModeleEnum
from models.prediction_run     import PredictionRun, PredictionResultat
from models.notification       import Notification



# Base.metadata.create_all(bind=engine) créera toutes les nouvelles tables

from core.security import hash_password
from datetime import date

def init():
    print("Creation des tables...")
    Base.metadata.create_all(bind=engine)
    print("Pret.")

    db = SessionLocal()
    try:
        # Quarts
        if db.query(Quart).count() == 0:
            quarts = [
                Quart(nom_quart="Matin",      heure_debut="06:00", heure_fin="14:00"),
                Quart(nom_quart="Apres-midi", heure_debut="14:00", heure_fin="22:00"),
                Quart(nom_quart="Nuit",       heure_debut="22:00", heure_fin="06:00"),
            ]
            db.add_all(quarts)
            db.commit()
            print("Quarts ajoutes.")
        else:
            print("Quarts deja existants.")

        # Admin
        if not db.query(Utilisateur).filter_by(identifiant="admin").first():
            admin = Utilisateur(
                nom            = "System",
                prenom         = "Admin",
                genre          = GenreEnum.HOMME,
                date_naissance = date(1990, 1, 1),
                date_embauche  = date(2020, 1, 1),
                email          = "admin@optima.dz",
                identifiant    = "admin",
                mot_de_passe   = hash_password("Admin@2026"),
                role           = RoleEnum.ADMIN,
            )
            db.add(admin)
            db.commit()
            print("Admin ajoute.")
        else:
            print("Admin deja existant.")

    except Exception as e:
        db.rollback()
        print(f"❌ Erreur : {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    init()