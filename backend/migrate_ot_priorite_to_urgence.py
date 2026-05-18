"""
Migration : ordres_travail.priorite to ordres_travail.urgence

Mapping des valeurs existantes :
  FAIBLE   to NIVEAU_1
  NORMALE  to NIVEAU_1
  HAUTE    to NIVEAU_2
  CRITIQUE to NIVEAU_3

Étapes :
  1. Ajoute la colonne `urgence` (VARCHAR(20))
  2. UPDATE pour copier `priorite` to `urgence` avec mapping
  3. DROP `priorite`

Idempotent : peut être relancé sans casser.

Usage :
    python migrate_ot_priorite_to_urgence.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from database import engine


def run():
    with engine.begin() as conn:
        # 1. Vérifier l'état actuel
        cols = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
             WHERE table_name='ordres_travail' AND column_name IN ('priorite','urgence')
        """)).all()
        col_names = [c[0] for c in cols]
        has_priorite = "priorite" in col_names
        has_urgence  = "urgence"  in col_names

        print(f"[INFO] priorite présente : {has_priorite}")
        print(f"[INFO] urgence  présente : {has_urgence}")

        # 2. Ajouter la colonne urgence si absente
        if not has_urgence:
            conn.execute(text("""
                ALTER TABLE ordres_travail ADD COLUMN urgence VARCHAR(20)
            """))
            print("[OK] Colonne 'urgence' ajoutée.")
        else:
            print("[SKIP] Colonne 'urgence' déjà présente.")

        # 3. Copier priorite to urgence avec mapping (cast::text car priorite est un ENUM PG natif)
        if has_priorite:
            conn.execute(text("""
                UPDATE ordres_travail
                   SET urgence = CASE priorite::text
                       WHEN 'FAIBLE'   THEN 'NIVEAU_1'
                       WHEN 'NORMALE'  THEN 'NIVEAU_1'
                       WHEN 'HAUTE'    THEN 'NIVEAU_2'
                       WHEN 'CRITIQUE' THEN 'NIVEAU_3'
                       ELSE 'NIVEAU_1'
                   END
                 WHERE urgence IS NULL OR urgence = ''
            """))
            print("[OK] Valeurs migrées : FAIBLE/NORMALEtoNIVEAU_1, HAUTEtoNIVEAU_2, CRITIQUEtoNIVEAU_3.")

            # 4. Drop la colonne priorite
            conn.execute(text("ALTER TABLE ordres_travail DROP COLUMN priorite"))
            print("[OK] Colonne 'priorite' supprimee.")
            print("[NOTE] L'enum PG 'prioriteot' reste defini mais inutilise (pas de droits pour dropper).")
        else:
            print("[SKIP] Pas de colonne 'priorite' à migrer.")

        # 5. Vérification finale
        sample = conn.execute(text("""
            SELECT urgence, COUNT(*) FROM ordres_travail
             GROUP BY urgence ORDER BY urgence
        """)).all()
        print("\n[STATS] Répartition par urgence :")
        for u, n in sample:
            print(f"  {u}: {n}")


if __name__ == "__main__":
    run()
