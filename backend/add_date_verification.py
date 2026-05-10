from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL_SYNC", "postgresql://cevital:password@localhost:5432/Cevitalnew")
engine = create_engine(DATABASE_URL, connect_args={"client_encoding": "UTF8"})

def drop_and_recreate_di():
    with engine.connect() as conn:
        # Drop table
        conn.execute(text("DROP TABLE IF EXISTS demandes_intervention CASCADE"))
        conn.commit()
        print("Dropped table")
        
        # Create table
        conn.execute(text("""
            CREATE TABLE demandes_intervention (
                id_di SERIAL PRIMARY KEY,
                numero_di VARCHAR(30) UNIQUE NOT NULL,
                id_equipement INTEGER NOT NULL,
                id_pole INTEGER NOT NULL,
                id_declarant INTEGER NOT NULL,
                id_methodiste INTEGER,
                description_panne TEXT NOT NULL,
                urgencia VARCHAR(20) NOT NULL DEFAULT 'NORMALE',
                statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',
                motif_rejet TEXT,
                id_ot_genere INTEGER,
                date_verification TIMESTAMP,
                date_traitement TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
        """))
        conn.commit()
        print("Created table demandes_intervention")

if __name__ == "__main__":
    drop_and_recreate_di()