# -*- coding: utf-8 -*-
"""
Seed des 4 équipes (Alpha/Bravo/Charlie/Delta) pour chaque pôle existant.

Idempotent : ne recrée pas les équipes déjà présentes.

Usage :
    python seed_equipes.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database     import SessionLocal
from models.pole  import Pole
from models.equipe import Equipe


EQUIPES_STANDARD = ["Alpha", "Bravo", "Charlie", "Delta"]


def run():
    print("=" * 60)
    print("SEED - 4 Equipes par pole")
    print("=" * 60)

    db = SessionLocal()
    try:
        poles = db.query(Pole).order_by(Pole.id_pole).all()
        if not poles:
            print("[ERREUR] Aucun pole en base. Lancer d'abord seed_poles_zones.py.")
            return

        total_created = 0
        for pole in poles:
            existantes = {
                e.nom_equipe for e in
                db.query(Equipe).filter(Equipe.id_pole == pole.id_pole).all()
            }

            ajoutees = []
            for nom in EQUIPES_STANDARD:
                if nom in existantes:
                    continue
                db.add(Equipe(nom_equipe=nom, id_pole=pole.id_pole))
                ajoutees.append(nom)

            if ajoutees:
                db.commit()
                total_created += len(ajoutees)
                print(f"[OK]   [{pole.code_pole}] {pole.nom_pole}")
                print(f"       -> {len(ajoutees)} equipe(s) ajoutee(s) : {', '.join(ajoutees)}")
            else:
                print(f"[SKIP] [{pole.code_pole}] {pole.nom_pole} : 4 equipes deja presentes")

        print()
        print("=" * 60)
        print(f"TERMINE — {total_created} equipe(s) creee(s)")
        print(f"Total equipes en base : {db.query(Equipe).count()}")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        import traceback
        print("ERREUR : " + str(e))
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run()
