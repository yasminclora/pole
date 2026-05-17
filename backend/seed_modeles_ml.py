"""
seed_modeles_ml.py
Enregistre les modèles GRU et LSTM pré-existants dans la table modeles_ml
et active le GRU (meilleur R²).

Usage :
    python seed_modeles_ml.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal
from models.modele_ml import ModeleML, TypeModeleEnum


def seed():
    db = SessionLocal()
    try:
        modeles = [
            {
                "version":      "v1-GRU",
                "type_modele":  TypeModeleEnum.GRU,
                "nom":          "GRU Champion — R²=0.74 MAE=3.45j",
                "description":  "Modèle GRU entraîné sur 164 composants, lookback=30j, max_rul=30j. Meilleur modèle.",
                "path_keras":   "storage/models/v1-GRU/model.keras",
                "path_scaler_x":"storage/models/v1-GRU/scaler_x.pkl",
                "path_scaler_y":"storage/models/v1-GRU/scaler_y.pkl",
                "is_active":    True,
                "uploaded_by":  1,
            },
            {
                "version":      "v2-LSTM",
                "type_modele":  TypeModeleEnum.LSTM,
                "nom":          "LSTM PFE Champion — R²=0.72 MAE=3.76j",
                "description":  "Modèle LSTM entraîné sur 164 composants, lookback=30j, max_rul=30j.",
                "path_keras":   "storage/models/v2-LSTM/model.keras",
                "path_scaler_x":"storage/models/v2-LSTM/scaler_x.pkl",
                "path_scaler_y":"storage/models/v2-LSTM/scaler_y.pkl",
                "is_active":    False,
                "uploaded_by":  1,
            },
        ]

        for m in modeles:
            existing = db.query(ModeleML).filter(ModeleML.version == m["version"]).first()
            if existing:
                print(f"[SKIP] {m['version']} déjà en base.")
                continue
            db.add(ModeleML(**m))
            print(f"[OK]   {m['version']} ajouté.")

        db.commit()
        print("\nSeed terminé. Modèle actif : v1-GRU")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
