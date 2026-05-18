"""
migrate_statutot_to_varchar.py
Convertit la colonne `ordres_travail.statut` de l'enum PostgreSQL
`statutot` (qui n'accepte pas REWORK et que l'utilisateur ne peut pas
ALTER faute de privileges) en VARCHAR(20).

L'enum PostgreSQL `statutot` est conserve (encore reference ailleurs
potentiellement) mais la colonne devient un VARCHAR libre.
"""

from sqlalchemy import text
from database import engine


def main():
    print("[migration] Conversion de ordres_travail.statut ENUM -> VARCHAR(20)...")
    with engine.connect() as conn:
        with conn.begin():
            res = conn.execute(text("""
                SELECT data_type, udt_name
                FROM information_schema.columns
                WHERE table_name = 'ordres_travail'
                  AND column_name = 'statut'
            """)).fetchone()
            if res is None:
                print("[migration] ERREUR - Colonne ordres_travail.statut introuvable.")
                return
            print(f"[migration] Type actuel : data_type={res[0]}, udt_name={res[1]}")

            if res[0] == "character varying":
                print("[migration] OK - Colonne deja en VARCHAR, rien a faire.")
                return

            # Drop le default (qui reference l'enum), convertir, remettre un default texte
            conn.execute(text("ALTER TABLE ordres_travail ALTER COLUMN statut DROP DEFAULT"))
            conn.execute(text("""
                ALTER TABLE ordres_travail
                ALTER COLUMN statut TYPE VARCHAR(20)
                USING statut::text
            """))
            conn.execute(text("ALTER TABLE ordres_travail ALTER COLUMN statut SET DEFAULT 'CREE'"))
            print("[migration] OK - Colonne convertie en VARCHAR(20).")

            res = conn.execute(text("""
                SELECT data_type, character_maximum_length, column_default
                FROM information_schema.columns
                WHERE table_name = 'ordres_travail'
                  AND column_name = 'statut'
            """)).fetchone()
            print(f"[migration] Type final : {res[0]}({res[1]}), default = {res[2]}")


if __name__ == "__main__":
    main()
