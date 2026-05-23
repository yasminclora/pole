"""
migrate_classeot_to_varchar.py
Convertit ordres_travail.classe (enum PostgreSQL classeot) en VARCHAR(20)
afin de permettre la suppression de la valeur GLOBALE de l'enum Python
sans avoir besoin d'ALTER TYPE (privileges insuffisants).
"""
from sqlalchemy import text
from database import engine


def main():
    print("[migration] Conversion ordres_travail.classe ENUM -> VARCHAR(20)...")
    with engine.connect() as conn:
        with conn.begin():
            res = conn.execute(text("""
                SELECT data_type, udt_name
                FROM information_schema.columns
                WHERE table_name='ordres_travail' AND column_name='classe'
            """)).fetchone()
            if res is None:
                print("[migration] Colonne introuvable.")
                return
            print(f"[migration] Type actuel : {res[0]} (udt={res[1]})")

            if res[0] == "character varying":
                print("[migration] OK - Deja en VARCHAR.")
                return

            conn.execute(text("ALTER TABLE ordres_travail ALTER COLUMN classe DROP DEFAULT"))
            conn.execute(text("""
                ALTER TABLE ordres_travail
                ALTER COLUMN classe TYPE VARCHAR(20)
                USING classe::text
            """))
            print("[migration] OK - Colonne convertie en VARCHAR(20).")


if __name__ == "__main__":
    main()
