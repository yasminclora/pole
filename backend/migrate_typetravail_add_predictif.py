"""
migrate_typetravail_add_predictif.py
Convertit la colonne `interventions.type_travail` de l'enum PostgreSQL
`typetravail` (qui n'accepte pas PREDICTIF et que l'utilisateur ne peut pas
ALTER) en VARCHAR(30), afin d'accepter PREDICTIF, CORRECTIF, etc.

L'enum PostgreSQL `typetravail` est conserve (utilise potentiellement
ailleurs) mais la colonne devient un VARCHAR libre.
"""

from sqlalchemy import text
from database import engine


def main():
    print("[migration] Conversion de type_travail ENUM -> VARCHAR(30)...")
    with engine.connect() as conn:
        with conn.begin():
            # Verifier le type actuel
            res = conn.execute(text("""
                SELECT data_type, udt_name
                FROM information_schema.columns
                WHERE table_name = 'interventions'
                  AND column_name = 'type_travail'
            """)).fetchone()
            if res is None:
                print("[migration] ERREUR - Colonne interventions.type_travail introuvable.")
                return
            print(f"[migration] Type actuel : data_type={res[0]}, udt_name={res[1]}")

            if res[0] == "character varying":
                print("[migration] OK - Colonne deja en VARCHAR, rien a faire.")
                return

            # Conversion : USING type_travail::text
            conn.execute(text("""
                ALTER TABLE interventions
                ALTER COLUMN type_travail TYPE VARCHAR(30)
                USING type_travail::text
            """))
            print("[migration] OK - Colonne convertie en VARCHAR(30).")

            # Verification finale
            res = conn.execute(text("""
                SELECT data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'interventions'
                  AND column_name = 'type_travail'
            """)).fetchone()
            print(f"[migration] Type final : {res[0]}({res[1]})")


if __name__ == "__main__":
    main()
