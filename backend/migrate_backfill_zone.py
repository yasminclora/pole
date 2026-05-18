"""
Migration : remplit la colonne `prediction_resultats.zone` avec le code_zone
de l'équipement, pour les lignes où zone est NULL.

Usage :
    python migrate_backfill_zone.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import update
from database import SessionLocal
from models.prediction_run import PredictionResultat
from models.equipement     import Equipement
from models.zone           import Zone


def run():
    db = SessionLocal()
    try:
        # Récupère un mapping equipment_code → code_zone
        rows = (
            db.query(Equipement.equipment_code, Zone.code_zone)
            .join(Zone, Zone.id_zone == Equipement.id_zone)
            .filter(Zone.code_zone.isnot(None))
            .all()
        )
        code_to_zone = {ec: cz for ec, cz in rows if cz}
        print(f"[INFO] {len(code_to_zone)} équipements ont un code_zone.")

        # Lignes prediction_resultats avec zone NULL ou nom_zone (legacy)
        preds = (
            db.query(PredictionResultat)
            .filter(PredictionResultat.equipment_code.in_(list(code_to_zone.keys())))
            .all()
        )

        nb_updated = 0
        for p in preds:
            target = code_to_zone.get(p.equipment_code)
            if target and p.zone != target:
                p.zone = target
                nb_updated += 1

        db.commit()
        print(f"[OK] {nb_updated} ligne(s) mises à jour avec code_zone.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
