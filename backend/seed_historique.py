import sys
import csv
from datetime import datetime
from database import engine, Base, SessionLocal
from models.historique_interventions import HistoriqueIntervention, TypeTravailHistorique

def seed(csv_path: str):
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        count = 0
        erreurs = 0
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                try:
                    system_equip = row.get("WOWO_SYSTEM_EQUIPMENT")
                    if not system_equip:
                        erreurs += 1
                        if erreurs <= 10:
                            print(f"  ligne {count+1}: system_equipment vide, ignorée")
                        count += 1
                        continue
                    
                    interv = HistoriqueIntervention(
                        system_equipment=system_equip,
                        equipment_description=row.get("WOWO_EQUIPMENT_DESCRIPTION"),
                        equipment_code=row.get("WOWO_EQUIPMENT"),
                        equipment_level=_parse_int(row.get("WOWO_EQUIPMENT_LEVEL")),
                        parent_code=row.get("maintenance_parent_code"),
                        parent_level=_parse_float(row.get("maintenance_parent_level")),
                        type_travail=TypeTravailHistorique(row.get("WOWO_JOB_TYPE")),
                        action_entity=row.get("WOWO_ACTION_ENTITY"),
                        cout_total=_parse_float(row.get("WOWO_TOTAL_COST")),
                        date_declaration=_parse_date(row.get("WOWO_DECLARATION_DATE")),
                        date_fin=_parse_date(row.get("WOWO_END_DATE")),
                        date_creation=_parse_date(row.get("WOWO_CREATION_DATE")),
                        source=row.get("source", "CSV_IMPORT"),
                    )
                    db.add(interv)
                    count += 1
                    
                    if count % 1000 == 0:
                        db.commit()
                        print(f"[seed] {count} lignes importées...")
                        
                except Exception as e:
                    erreurs += 1
                    if erreurs <= 10:
                        print(f"  ligne {count}: {e}")
        
        db.commit()
        print(f"[seed] ✓ {count} lignes importées avec succès.")
        if erreurs:
            print(f"[seed] ✗ {erreurs} erreurs.")
            
    except Exception as e:
        db.rollback()
        print(f"[seed] Erreur: {e}")
    finally:
        db.close()


def _parse_int(val: str) -> int | None:
    try:
        return int(val) if val else None
    except:
        return None


def _parse_float(val: str) -> float | None:
    try:
        return float(val) if val else None
    except:
        return None


def _parse_date(val: str):
    try:
        return datetime.strptime(val, "%Y-%m-%d").date() if val else None
    except:
        return None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python seed_historique.py <chemin_csv>")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    print(f"[seed] Import depuis {csv_path}...")
    seed(csv_path)
