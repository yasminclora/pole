"""
routes/predictions.py  — VERSION FINALE
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from services.prediction_service import (
    get_poles,
    get_stats_globales,
    get_machines_critiques,
    get_composantes_avec_rul,
    get_rul_trend,
    create_ot_predictif,
)

router = APIRouter(prefix="/predictions", tags=["Prédictions"])


@router.get("/poles")
def route_poles(db: Session = Depends(get_db)):
    return get_poles(db)


@router.get("/stats")
def route_stats(pole: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return get_stats_globales(db, pole=pole or None)


@router.get("/machines-critiques")
def route_machines_critiques(
    pole:  Optional[str] = Query(None),
    limit: int           = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
):
    return get_machines_critiques(db, pole=pole or None, limit=limit)


@router.get("/composantes")
def route_composantes(
    pole:    Optional[str] = Query(None),
    search:  Optional[str] = Query(None),
    rul_max: Optional[int] = Query(None),
    model:   str           = Query("SIMULATION"),
    db: Session = Depends(get_db),
):
    return get_composantes_avec_rul(db, pole=pole or None, search=search or None, rul_max=rul_max, model=model)


@router.get("/rul-trend/{equipment_code}")
def route_rul_trend(equipment_code: str, db: Session = Depends(get_db)):
    return get_rul_trend(db, equipment_code=equipment_code)


@router.post("/ot")
def route_create_ot(data: dict, db: Session = Depends(get_db)):
    try:
        return create_ot_predictif(db, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail="Erreur serveur interne")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur serveur interne")