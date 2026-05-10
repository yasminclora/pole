from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from services.dashboard_service import (
    get_kpis,
    get_interventions_par_mois,
    get_distribution_job_class,
    get_cout_par_mois,
    get_pannes_par_semaine,
    get_top_equipements,
    get_mtbf_equipements,
    get_composantes_critiques,
    get_interventions_par_pole,
    get_cout_par_zone,
    get_zones_critiques,
    get_ratio_prev_corr,
    get_tendance_annuelle,
    get_journal,
    get_features_ml,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/kpis")
def route_kpis(
    annee: Optional[int] = Query(None),
    type_travail: Optional[str] = Query(None),
    pole: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return get_kpis(db, annee=annee, type_travail=type_travail, pole=pole)


@router.get("/interventions-par-mois")
def route_interventions_par_mois(
    annee: Optional[int] = Query(None),
    pole: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return get_interventions_par_mois(db, annee=annee, pole=pole)


@router.get("/distribution-job-class")
def route_distribution_job_class(
    annee: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_distribution_job_class(db, annee=annee)


@router.get("/cout-par-mois")
def route_cout_par_mois(
    annee: Optional[int] = Query(None),
    pole: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return get_cout_par_mois(db, annee=annee, pole=pole)


@router.get("/pannes-par-semaine")
def route_pannes_par_semaine(
    annee: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_pannes_par_semaine(db, annee=annee)


@router.get("/top-equipements")
def route_top_equipements(
    limit: int = Query(10, ge=1, le=50),
    type_travail: str = Query("CORR"),
    pole: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return get_top_equipements(db, limit=limit, type_travail=type_travail, pole=pole)


@router.get("/mtbf-equipements")
def route_mtbf(
    limit: int = Query(10),
    pole: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return get_mtbf_equipements(db, limit=limit, pole=pole)


@router.get("/composantes-critiques")
def route_composantes_critiques(
    limit: int = Query(10),
    pole: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return get_composantes_critiques(db, limit=limit, pole=pole)


@router.get("/interventions-par-pole")
def route_par_pole(
    annee: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_interventions_par_pole(db, annee=annee)


@router.get("/cout-par-zone")
def route_cout_par_zone(db: Session = Depends(get_db)):
    return get_cout_par_zone(db)


@router.get("/zones-critiques")
def route_zones_critiques(db: Session = Depends(get_db)):
    return get_zones_critiques(db)


@router.get("/ratio-prev-corr")
def route_ratio(
    annee: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_ratio_prev_corr(db, annee=annee)


@router.get("/tendance-annuelle")
def route_tendance(db: Session = Depends(get_db)):
    return get_tendance_annuelle(db)


@router.get("/journal")
def route_journal(
    limit: int = Query(50),
    pole: Optional[str] = Query(None),
    type_travail: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return get_journal(db, limit=limit, pole=pole, type_travail=type_travail)


@router.get("/features-ml")
def route_features_ml(db: Session = Depends(get_db)):
    return get_features_ml(db)