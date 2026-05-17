"""
Migration : ajoute prediction_resultats.ref_date (DATE) si elle n'existe pas.

Usage :
    python migrate_add_ref_date.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from database import engine


def run():
    with engine.begin() as conn:
        # PostgreSQL : ADD COLUMN IF NOT EXISTS
        conn.execute(text("""
            ALTER TABLE prediction_resultats
            ADD COLUMN IF NOT EXISTS ref_date DATE
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_prediction_resultats_ref_date
            ON prediction_resultats (ref_date)
        """))
        # Colonne zone pour comparaisons machines/zones dans la page prédictions
        conn.execute(text("""
            ALTER TABLE prediction_resultats
            ADD COLUMN IF NOT EXISTS zone VARCHAR(200)
        """))
        print("[OK] Colonnes prediction_resultats.ref_date et .zone présentes.")


if __name__ == "__main__":
    run()
