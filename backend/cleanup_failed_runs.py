"""
Nettoie les runs en erreur et les prédictions orphelines.
À lancer si des transactions cassées ont laissé la BDD dans un état incohérent.

Usage :
    python cleanup_failed_runs.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal
from models.prediction_run import PredictionRun, PredictionResultat, StatutRun


def run():
    db = SessionLocal()
    try:
        # 1. Liste les runs en EN_COURS ou ERREUR
        runs_a_marquer = (
            db.query(PredictionRun)
            .filter(PredictionRun.statut.in_([StatutRun.EN_COURS, StatutRun.ERREUR]))
            .all()
        )
        print(f"[INFO] {len(runs_a_marquer)} run(s) en EN_COURS ou ERREUR.")

        for r in runs_a_marquer:
            # Compte les résultats associés
            nb = (
                db.query(PredictionResultat)
                .filter(PredictionResultat.id_run == r.id_run)
                .count()
            )
            print(f"  - Run #{r.id_run} ({r.statut.value if hasattr(r.statut, 'value') else r.statut}) : {nb} résultats")

        # 2. Confirme avec l'utilisateur
        reponse = input("\nVoulez-vous SUPPRIMER ces runs et leurs résultats ? (oui/non) : ").strip().lower()
        if reponse not in ("oui", "o", "yes", "y"):
            print("[ANNULÉ] Aucune modification.")
            return

        for r in runs_a_marquer:
            db.query(PredictionResultat).filter(PredictionResultat.id_run == r.id_run).delete()
            db.delete(r)

        db.commit()
        print(f"[OK] {len(runs_a_marquer)} run(s) supprimé(s).")
    except Exception as e:
        db.rollback()
        print(f"[ERREUR] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
