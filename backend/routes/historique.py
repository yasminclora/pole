import io
import csv
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.historique_interventions import HistoriqueIntervention, TypeTravailHistorique

router = APIRouter(prefix="/historique", tags=["Historique Interventions"])


@router.get("/liste")
def list_historique(
    page: int = 1,
    limit: int = 20,
    system_equipment: str = "",
    type_travail: str = "",
    source: str = "",
    db: Session = Depends(get_db)
):
    query = db.query(HistoriqueIntervention)

    if system_equipment:
        query = query.filter(
            HistoriqueIntervention.system_equipment.ilike(f"%{system_equipment}%")
        )
    if type_travail:
        query = query.filter(
            HistoriqueIntervention.type_travail == TypeTravailHistorique(type_travail)
        )
    if source:
        query = query.filter(HistoriqueIntervention.source.ilike(f"%{source}%"))

    total = query.count()
    interventions = query.order_by(HistoriqueIntervention.date_declaration.desc())\
                         .offset((page - 1) * limit).limit(limit).all()

    return {
        "data":        [_serialize(interv) for interv in interventions],
        "total":       total,
        "page":        page,
        "limit":       limit,
        "total_pages": (total + limit - 1) // limit,
    }


@router.post("/ajouter")
def ajouter_historique(data: dict, db: Session = Depends(get_db)):
    try:
        interv = HistoriqueIntervention(
            system_equipment      = data.get("system_equipment"),
            equipment_description = data.get("equipment_description"),
            equipment_code        = data.get("equipment_code"),
            equipment_level       = data.get("equipment_level"),
            parent_code           = data.get("parent_code"),
            parent_level          = data.get("parent_level"),
            type_travail          = TypeTravailHistorique(data.get("type_travail")),
            action_entity         = data.get("action_entity"),
            cout_total            = data.get("cout_total", 0.0),
            date_declaration      = data.get("date_declaration"),
            date_fin              = data.get("date_fin"),
            date_creation         = data.get("date_creation"),
            source                = data.get("source", "MANUAL"),
        )
        db.add(interv)
        db.commit()
        db.refresh(interv)
        return {"message": "Intervention ajoutee", "id": interv.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Erreur serveur interne")


@router.post("/import-csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content     = await file.read()
        # Essaye utf-8 puis latin-1 pour les fichiers Windows
        for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
            try:
                text = content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(400, "Encodage du fichier non reconnu")

        csv_content = io.StringIO(text)
        reader      = csv.DictReader(csv_content)

        count = 0
        for row in reader:
            interv = HistoriqueIntervention(
                system_equipment      = row.get("WOWO_SYSTEM_EQUIPMENT"),
                equipment_description = row.get("WOWO_EQUIPMENT_DESCRIPTION"),
                equipment_code        = row.get("WOWO_EQUIPMENT"),
                equipment_level       = _parse_int(row.get("WOWO_EQUIPMENT_LEVEL")),
                parent_code           = row.get("maintenance_parent_code"),
                parent_level          = _parse_float(row.get("maintenance_parent_level")),
                type_travail          = TypeTravailHistorique(row.get("WOWO_JOB_TYPE")),
                action_entity         = row.get("WOWO_ACTION_ENTITY"),
                cout_total            = _parse_float(row.get("WOWO_TOTAL_COST")),
                date_declaration      = _parse_date(row.get("WOWO_DECLARATION_DATE")),
                date_fin              = _parse_date(row.get("WOWO_END_DATE")),
                date_creation         = _parse_date(row.get("WOWO_CREATION_DATE")),
                source                = row.get("source", "CSV_IMPORT"),
            )
            db.add(interv)
            count += 1

        db.commit()
        return {"message": f"{count} interventions importees avec succes"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Erreur serveur interne")


# ── Helpers ───────────────────────────────────────────────────────────

def _serialize(interv: HistoriqueIntervention) -> dict:
    return {
        "id":                    interv.id,
        "system_equipment":      interv.system_equipment,
        "equipment_description": interv.equipment_description,
        "equipment_code":        interv.equipment_code,
        "equipment_level":       interv.equipment_level,
        "parent_code":           interv.parent_code,
        "parent_level":          interv.parent_level,
        "type_travail":          interv.type_travail.value if interv.type_travail else None,
        "action_entity":         interv.action_entity,
        "cout_total":            interv.cout_total,
        "date_declaration":      interv.date_declaration.isoformat() if interv.date_declaration else None,
        "date_fin":              interv.date_fin.isoformat()          if interv.date_fin          else None,
        "date_creation":         interv.date_creation.isoformat()     if interv.date_creation     else None,
        "source":                interv.source,
    }


def _parse_int(val) -> int | None:
    try:
        return int(val) if val else None
    except Exception:
        return None


def _parse_float(val) -> float | None:
    try:
        return float(val) if val else None
    except Exception:
        return None


def _parse_date(val):
    try:
        from datetime import datetime
        return datetime.strptime(val, "%Y-%m-%d").date() if val else None
    except Exception:
        return None          # ← None sans parentheses