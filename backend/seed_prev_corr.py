"""
seed_prev_corr.py
Importe TOUTES les lignes du fichier maintenance.csv dans la table `prev_corr`.

Usage :
    python seed_prev_corr.py [chemin_csv]
    (par defaut : maintenance.csv dans le repertoire courant)
"""

import sys
import os
import csv
from datetime import datetime

from database import engine, Base, SessionLocal
from models.prev_corr import PrevCorr, TypeTravailPrevCorr, JobClassPrevCorr


# ── Parsing helpers ────────────────────────────────────────────────────
def _parse_int(val):
    try:
        return int(val) if val not in (None, "") else None
    except (ValueError, TypeError):
        return None


def _parse_float(val):
    try:
        return float(val) if val not in (None, "") else None
    except (ValueError, TypeError):
        return None


def _parse_date(val):
    try:
        return datetime.strptime(val, "%Y-%m-%d").date() if val else None
    except (ValueError, TypeError):
        return None


def _parse_type_travail(val):
    """PREV / CORR -> enum, sinon None."""
    if not val:
        return None
    v = val.strip().upper()
    if v in ("PREV", "CORR"):
        return TypeTravailPrevCorr(v)
    return None


def _parse_job_class(val):
    """PREVEN / MECA / ELEC -> enum, sinon None."""
    if not val:
        return None
    v = val.strip().upper()
    if v in ("PREVEN", "MECA", "ELEC"):
        return JobClassPrevCorr(v)
    return None


# ── Seed principal ─────────────────────────────────────────────────────
def seed(csv_path: str, batch_size: int = 1000):
    Base.metadata.create_all(bind=engine)

    if not os.path.exists(csv_path):
        print(f"[seed] ERREUR - Fichier introuvable : {csv_path}")
        return

    db = SessionLocal()
    count = 0
    erreurs = 0
    skipped = 0

    # On vide la table avant de re-seed pour eviter les doublons
    existing = db.query(PrevCorr).count()
    if existing > 0:
        print(f"[seed] {existing} lignes deja presentes - on vide la table avant import.")
        db.query(PrevCorr).delete()
        db.commit()

    try:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)

            for row in reader:
                try:
                    system_equip = row.get("WOWO_SYSTEM_EQUIPMENT")
                    type_travail_str = row.get("WOWO_JOB_TYPE")
                    date_decl = _parse_date(row.get("WOWO_DECLARATION_DATE"))
                    date_creat = _parse_date(row.get("WOWO_CREATION_DATE"))

                    # On exige : equipement, type, dates obligatoires
                    if not system_equip or not type_travail_str:
                        skipped += 1
                        continue
                    if not date_decl or not date_creat:
                        skipped += 1
                        continue

                    type_travail = _parse_type_travail(type_travail_str)
                    if type_travail is None:
                        skipped += 1
                        continue

                    interv = PrevCorr(
                        system_equipment      = system_equip,
                        equipment_description = row.get("WOWO_EQUIPMENT_DESCRIPTION") or "",
                        equipment_code        = row.get("WOWO_EQUIPMENT") or None,
                        equipment_level       = _parse_int(row.get("WOWO_EQUIPMENT_LEVEL")),
                        parent_code           = row.get("maintenance_parent_code") or None,
                        parent_level          = _parse_float(row.get("maintenance_parent_level")),
                        type_travail          = type_travail,
                        job_class             = _parse_job_class(row.get("WOWO_JOB_CLASS")),
                        action_entity         = row.get("WOWO_ACTION_ENTITY") or None,
                        date_declaration      = date_decl,
                        date_fin              = _parse_date(row.get("WOWO_END_DATE")),
                        date_creation         = date_creat,
                        cout_total            = _parse_float(row.get("WOWO_TOTAL_COST")) or 0.0,
                        source                = row.get("source") or "CSV_IMPORT",
                        label_quality         = row.get("label_quality") or None,
                    )
                    db.add(interv)
                    count += 1

                    if count % batch_size == 0:
                        db.commit()
                        print(f"[seed] {count} lignes inserees...")

                except Exception as e:
                    erreurs += 1
                    db.rollback()
                    if erreurs <= 10:
                        print(f"  ligne {count + erreurs}: {e}")

        db.commit()
        print()
        print(f"[seed] OK - {count} lignes inserees avec succes.")
        if skipped:
            print(f"[seed] {skipped} lignes ignorees (donnees manquantes/invalides).")
        if erreurs:
            print(f"[seed] {erreurs} erreurs.")

        # Statistiques de la table apres insertion
        total = db.query(PrevCorr).count()
        nb_prev = db.query(PrevCorr).filter(PrevCorr.type_travail == TypeTravailPrevCorr.PREV).count()
        nb_corr = db.query(PrevCorr).filter(PrevCorr.type_travail == TypeTravailPrevCorr.CORR).count()
        print()
        print(f"[seed] Total en base : {total}")
        print(f"[seed]   - PREV : {nb_prev}")
        print(f"[seed]   - CORR : {nb_corr}")

    except Exception as e:
        db.rollback()
        print(f"[seed] ERREUR globale : {e}")
    finally:
        db.close()


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "maintenance.csv"
    print(f"[seed] Import depuis : {csv_path}")
    print()
    seed(csv_path)
