import sys
import csv
from pathlib import Path
from database import SessionLocal
from models.stock import PieceStock, ComposanteStock
from models.equipement import Equipement

DIR         = Path(__file__).parent
CSV_PIECES  = DIR / "pieces_stock_final.csv"
CSV_MAPPING = DIR / "composante_stock_mapping_final.csv"
BATCH_SIZE  = 500


def read_csv(path):
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            with open(path, encoding=enc, newline="") as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise RuntimeError("Impossible de lire : " + str(path))


def run():
    for path in [CSV_PIECES, CSV_MAPPING]:
        if not path.exists():
            print("ERREUR : fichier introuvable : " + str(path))
            sys.exit(1)

    db = SessionLocal()
    try:

        # ETAPE 1 : pieces_stock
        rows_pieces = read_csv(CSV_PIECES)
        print("[1/3] Insertion pieces_stock (" + str(len(rows_pieces)) + " lignes)...")

        existing = {p.code_stock for p in db.query(PieceStock.code_stock).all()}

        inserted = 0
        skipped  = 0

        for i, row in enumerate(rows_pieces, 1):
            if i % 500 == 0:
                print("  " + str(i) + "/" + str(len(rows_pieces)) + "...")

            if row["code_stock"] in existing:
                skipped += 1
                continue

            piece = PieceStock(
                code_stock   = row["code_stock"],
                designation  = row["designation"],
                quantite     = int(row.get("quantite")     or 0),
                seuil_alerte = int(row.get("seuil_alerte") or 2),
                unite        = row.get("unite")             or "pcs",
                emplacement  = row.get("emplacement")       or None,
                description  = row.get("description")       or None,
            )
            db.add(piece)
            inserted += 1

            if inserted % BATCH_SIZE == 0:
                db.flush()

        db.flush()
        print("  OK : " + str(inserted) + " inserees | " + str(skipped) + " deja existantes")

        piece_map = {p.code_stock: p.id_piece for p in db.query(PieceStock).all()}
        print("  piece_map charge : " + str(len(piece_map)) + " entrees")

        # ETAPE 2 : composante_stock
        rows_mapping = read_csv(CSV_MAPPING)
        print("[2/3] Creation liens composante -> piece (" + str(len(rows_mapping)) + " lignes)...")

        print("  -> Chargement equipements depuis la BDD...")
        eq_map = {
            str(e.equipment_code).upper(): e.id_equipement
            for e in db.query(Equipement).all()
            if e.equipment_code
        }
        print("  -> " + str(len(eq_map)) + " equipements trouves en base")

        existing_liens = {
            (cs.id_equipement, cs.id_piece)
            for cs in db.query(ComposanteStock.id_equipement, ComposanteStock.id_piece).all()
        }

        inserted_liens = 0
        not_found      = 0
        not_found_ex   = []

        for i, row in enumerate(rows_mapping, 1):
            if i % 1000 == 0:
                print("  " + str(i) + "/" + str(len(rows_mapping)) + "...")

            eq_code    = str(row["equipment_code"]).strip().upper()
            code_stock = row["code_stock"]

            id_equipement = eq_map.get(eq_code)
            id_piece      = piece_map.get(code_stock)

            if id_equipement is None or id_piece is None:
                not_found += 1
                if len(not_found_ex) < 5:
                    not_found_ex.append(row["equipment_code"])
                continue

            if (id_equipement, id_piece) in existing_liens:
                continue

            lien = ComposanteStock(
                id_equipement = id_equipement,
                id_piece      = id_piece,
                code_stock    = code_stock,
                quantite_type = 1,
            )
            db.add(lien)
            existing_liens.add((id_equipement, id_piece))
            inserted_liens += 1

            if inserted_liens % BATCH_SIZE == 0:
                db.flush()

        db.flush()
        print("  OK : " + str(inserted_liens) + " liens crees")
        if not_found:
            print("  Attention : " + str(not_found) + " codes SAP introuvables")
            print("  Exemples  : " + str(not_found_ex))

        # ETAPE 3 : verification
        print("[3/3] Verification finale...")
        total_pieces = db.query(PieceStock).count()
        total_liens  = db.query(ComposanteStock).count()

        db.commit()
        print("")
        print("  pieces_stock     : " + str(total_pieces) + " pieces")
        print("  composante_stock : " + str(total_liens) + " liens")
        print("")
        print("Seed termine avec succes.")

    except Exception as e:
        db.rollback()
        import traceback
        print("Erreur : " + str(e))
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run()