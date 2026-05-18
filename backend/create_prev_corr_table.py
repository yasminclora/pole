"""
create_prev_corr_table.py
Crée la table `prev_corr` dans la base de donnees.

Usage :
    python create_prev_corr_table.py
"""

from database import engine, Base
from models.prev_corr import PrevCorr  # noqa: F401 (force import)


def main():
    print("[migration] Creation de la table prev_corr...")
    PrevCorr.__table__.create(bind=engine, checkfirst=True)
    print("[migration] OK - Table prev_corr creee (ou deja existante).")


if __name__ == "__main__":
    main()
