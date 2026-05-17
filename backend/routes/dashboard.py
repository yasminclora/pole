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
    # Live OT/DI/Intervention
    get_live_kpi,
    get_ot_by_status,
    get_di_by_status,
    get_intervention_by_status,
    get_ot_by_zone,
    get_ot_by_pole,
    get_di_by_pole,
    get_recent_activity,
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


# ── LIVE (OT / DI) ─────────────────────────────────────────────────

@router.get("/live/kpi")
def route_live_kpi(
    id_pole: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_live_kpi(db, id_pole=id_pole)


@router.get("/live/ot-by-status")
def route_ot_by_status(
    id_pole: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_ot_by_status(db, id_pole=id_pole)


@router.get("/live/di-by-status")
def route_di_by_status(
    id_pole: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_di_by_status(db, id_pole=id_pole)


@router.get("/live/intervention-by-status")
def route_intervention_by_status(
    id_pole: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_intervention_by_status(db, id_pole=id_pole)


@router.get("/live/ot-by-zone")
def route_ot_by_zone(
    id_pole: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_ot_by_zone(db, id_pole=id_pole)


@router.get("/live/ot-by-pole")
def route_ot_by_pole(db: Session = Depends(get_db)):
    return get_ot_by_pole(db)


@router.get("/live/di-by-pole")
def route_di_by_pole(db: Session = Depends(get_db)):
    return get_di_by_pole(db)


@router.get("/live/recent")
def route_recent(
    id_pole: Optional[int] = Query(None),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    return get_recent_activity(db, id_pole=id_pole, limit=limit)


@router.get("/live/predictions-summary")
def route_predictions_summary(
    id_pole: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Résumé du dernier run de prédiction ML pour le dashboard.

    Retourne :
        last_run: { id_run, launched_at, statut, nb_critiques, ... }
        top_critiques: [ ... 5 composants RUL le plus bas (CRITIQUE/URGENT) ]
        nb_alertes_stock: int  (composants critiques avec stock ABSENT/FAIBLE)
    """
    from models.prediction_run  import PredictionRun, PredictionResultat, StatutRun
    from models.pole            import Pole
    from sqlalchemy             import and_, or_

    # Filtre par nom_pole si id_pole donné
    pole_name = None
    if id_pole:
        p = db.get(Pole, id_pole)
        pole_name = p.nom_pole if p else None

    q = db.query(PredictionRun).filter(PredictionRun.statut == StatutRun.TERMINE)
    if pole_name:
        q = q.filter(or_(PredictionRun.pole == pole_name, PredictionRun.pole.is_(None)))
    last_run = q.order_by(PredictionRun.launched_at.desc()).first()

    if not last_run:
        return {
            "last_run":          None,
            "top_critiques":     [],
            "nb_alertes_stock":  0,
        }

    # Top 5 critiques (par run + RUL ascendant) — seulement les derniers ref_date par composant
    from sqlalchemy.orm import aliased
    sub = (
        db.query(
            PredictionResultat.equipment_code,
            func.max(PredictionResultat.ref_date).label("max_ref"),
        )
        .filter(PredictionResultat.id_run == last_run.id_run)
        .group_by(PredictionResultat.equipment_code)
        .subquery()
    )
    top = (
        db.query(PredictionResultat)
        .join(sub, and_(
            PredictionResultat.equipment_code == sub.c.equipment_code,
            (PredictionResultat.ref_date == sub.c.max_ref) | (sub.c.max_ref.is_(None) & PredictionResultat.ref_date.is_(None)),
        ))
        .filter(PredictionResultat.id_run == last_run.id_run)
        .filter(PredictionResultat.statut.in_(["CRITIQUE", "URGENT"]))
        .order_by(PredictionResultat.rul_jours.asc())
        .limit(5)
        .all()
    )

    nb_alertes_stock = (
        db.query(func.count(PredictionResultat.id_resultat))
        .filter(
            PredictionResultat.id_run == last_run.id_run,
            PredictionResultat.alerte_stock.in_(["ABSENT", "FAIBLE"]),
        )
        .scalar()
    )

    return {
        "last_run": {
            "id_run":          last_run.id_run,
            "launched_at":     last_run.launched_at.isoformat() if last_run.launched_at else None,
            "nb_composants":   last_run.nb_composants,
            "nb_critiques":    last_run.nb_critiques,
            "nb_urgents":      last_run.nb_urgents,
            "nb_surveillance": last_run.nb_surveillance,
            "nb_ok":           last_run.nb_ok,
            "pole":            last_run.pole,
        },
        "top_critiques": [
            {
                "equipment_code": r.equipment_code,
                "equipment_desc": r.equipment_desc,
                "system_equipment": r.system_equipment,
                "pole":           r.pole,
                "zone":           r.zone,
                "rul_jours":      r.rul_jours,
                "statut":         r.statut.value if hasattr(r.statut, "value") else r.statut,
                "alerte_stock":   r.alerte_stock,
                "stock_disponible": r.stock_disponible,
            }
            for r in top
        ],
        "nb_alertes_stock": int(nb_alertes_stock or 0),
    }