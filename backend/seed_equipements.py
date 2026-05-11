import sys
import argparse
from datetime import date as date_type
from pathlib import Path
import pandas as pd
from database import SessionLocal
from models.equipement import Equipement
from models.pole import Pole
from models.zone import Zone

def run(csv_path: str, dry_run: bool = False):
    db = SessionLocal()
    try:
        # 1. Chargement du CSV avec les BONS noms de colonnes
        # On utilise les noms détectés dans ton fichier : equipment_code, hierarchy_level, etc.
        df = pd.read_csv(csv_path, dtype=str)
        df["hierarchy_level"] = pd.to_numeric(df["hierarchy_level"], errors='coerce').fillna(0).astype(int)
        
        # 2. Préparation des mappings
        poles_map = {p.code_pole.upper(): p.id_pole for p in db.query(Pole).all() if p.code_pole}
        zones_map = {z.code_zone.upper(): z.id_zone for z in db.query(Zone).all() if z.code_zone}
        
        # Charger ce qui existe déjà pour éviter les doublons
        code_to_id = {str(c).upper(): i for c, i in db.query(Equipement.equipment_code, Equipement.id_equipement).all()}
        
        total_inseres = 0

        # 3. Insertion par niveau (Important pour les parents)
        for niveau in sorted(df["hierarchy_level"].unique()):
            df_niv = df[df["hierarchy_level"] == niveau]
            print(f"Traitement Niveau {niveau}...")
            
            for _, row in df_niv.iterrows():
                code = str(row["equipment_code"]).strip().upper()
                if code in code_to_id: continue

                # Résolution Parent
                id_parent = code_to_id.get(str(row.get("parent_code")).strip().upper()) if row.get("parent_code") else None
                
                # Résolution Racine (Machine)
                id_machine_racine = code_to_id.get(str(row.get("system_root_code")).strip().upper()) if row.get("system_root_code") else None

                # Pole et Zone
                id_pole = poles_map.get(str(row.get("entity")).strip().upper())
                id_zone = zones_map.get(str(row.get("zone")).strip().upper())

                equip = Equipement(
                    equipment_code=code,
                    description=row.get("description") or code,
                    hierarchy_level=int(niveau),
                    id_parent=id_parent,
                    id_machine_racine=id_machine_racine,
                    id_pole=id_pole,
                    id_zone=id_zone,
                    status="NORMAL"
                )

                db.add(equip)
                if not dry_run:
                    db.flush() # Nécessaire pour que le niveau suivant voit l'ID parent
                    code_to_id[code] = equip.id_equipement
                
                total_inseres += 1
                if total_inseres % 100 == 0:
                    print(f"  {total_inseres} insérés...")

        if not dry_run:
            db.commit()
            print("Succès !")
        else:
            db.rollback()
            print("Dry-run fini.")

    except Exception as e:
        db.rollback()
        print(f"Erreur : {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run("equipment_clean.csv")