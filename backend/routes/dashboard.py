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


@router.get("/live/evolution-mois")
def route_evolution_mois(
    id_pole: Optional[int] = Query(None),
    mois: int = Query(12, ge=3, le=24),
    db: Session = Depends(get_db),
):
    """
    Évolution mensuelle RÉELLE des OT/DI/Interventions créés (depuis BDD).
    Compte par mois sur les N derniers mois.
    """
    from models.ot import OrdreTravail
    from models.di import DemandeIntervention
    from models.intervention import Intervention
    from sqlalchemy import func as sa_func

    rows = []
    # On génère les N derniers mois (YYYY-MM)
    from datetime import date as date_type
    today = date_type.today()
    months: list[str] = []
    y, m = today.year, today.month
    for _ in range(mois):
        months.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12; y -= 1
    months.reverse()

    def count_by_month(model, date_col, id_pole_col):
        q = db.query(
            sa_func.to_char(date_col, "YYYY-MM").label("mois"),
            sa_func.count().label("cnt"),
        ).filter(date_col.isnot(None))
        if id_pole and id_pole_col is not None:
            q = q.filter(id_pole_col == id_pole)
        q = q.group_by(sa_func.to_char(date_col, "YYYY-MM"))
        return {r.mois: int(r.cnt) for r in q.all()}

    ot_map     = count_by_month(OrdreTravail,        OrdreTravail.created_at,        OrdreTravail.id_pole)
    di_map     = count_by_month(DemandeIntervention, DemandeIntervention.created_at, DemandeIntervention.id_pole)
    interv_map = count_by_month(Intervention,        Intervention.created_at,        Intervention.id_pole)

    # On ne garde que les mois a partir du PREMIER mois avec des donnees
    # (evite de retourner des mois entiers vides au debut)
    first_data_idx = None
    for i, mlbl in enumerate(months):
        if ot_map.get(mlbl, 0) > 0 or di_map.get(mlbl, 0) > 0 or interv_map.get(mlbl, 0) > 0:
            first_data_idx = i
            break

    # Si aucune donnee du tout, on garde les 3 derniers mois pour avoir un graphe non vide
    if first_data_idx is None:
        first_data_idx = max(0, len(months) - 3)

    for mlbl in months[first_data_idx:]:
        rows.append({
            "mois": mlbl,
            "ot":            ot_map.get(mlbl, 0),
            "di":            di_map.get(mlbl, 0),
            "interventions": interv_map.get(mlbl, 0),
        })
    return rows


@router.get("/live/tendance-jours")
def route_tendance_jours(
    id_pole: Optional[int] = Query(None),
    jours: int = Query(7, ge=3, le=30),
    db: Session = Depends(get_db),
):
    """Tendance quotidienne OT/DI créés sur les N derniers jours."""
    from models.ot import OrdreTravail
    from models.di import DemandeIntervention
    from sqlalchemy import func as sa_func
    from datetime import date as date_type, timedelta

    today = date_type.today()
    days  = [(today - timedelta(days=i)) for i in range(jours)]
    days.reverse()

    def count_by_day(model, date_col, id_pole_col):
        q = db.query(
            sa_func.to_char(date_col, "YYYY-MM-DD").label("jour"),
            sa_func.count().label("cnt"),
        ).filter(date_col >= (today - timedelta(days=jours)))
        if id_pole and id_pole_col is not None:
            q = q.filter(id_pole_col == id_pole)
        q = q.group_by(sa_func.to_char(date_col, "YYYY-MM-DD"))
        return {r.jour: int(r.cnt) for r in q.all()}

    ot_map = count_by_day(OrdreTravail,        OrdreTravail.created_at,        OrdreTravail.id_pole)
    di_map = count_by_day(DemandeIntervention, DemandeIntervention.created_at, DemandeIntervention.id_pole)

    return [{
        "jour": d.isoformat(),
        "ot": ot_map.get(d.isoformat(), 0),
        "di": di_map.get(d.isoformat(), 0),
    } for d in days]


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


# ============================================================================
# DASHBOARD HISTORIQUE (table prev_corr) — pour la nouvelle page Dashboard
# ============================================================================
# Filtre strict : equipment_level IN (3, 4)
# Source : prev_corr (PREV + CORR)
# ----------------------------------------------------------------------------

from sqlalchemy import func, distinct, case, extract
from models.prev_corr import PrevCorr, TypeTravailPrevCorr


def _resolve_levels(niveau: Optional[str]) -> list[int]:
    """
    Convertit le param 'niveau' en liste de niveaux d'equipement :
      - 'machines'   -> [1, 2]
      - 'composantes'-> [3, 4]
      - 'tous' / None-> [1, 2, 3, 4, 5]
    """
    if niveau == "machines":
        return [1, 2]
    if niveau == "composantes":
        return [3, 4]
    return [1, 2, 3, 4, 5]


def _prev_corr_base_query(
    db: Session,
    pole: Optional[str] = None,
    niveau: Optional[str] = None,
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
):
    """Base query filtree selon niveau + pole + plage de dates (YYYY-MM-DD)."""
    levels = _resolve_levels(niveau)
    q = db.query(PrevCorr).filter(PrevCorr.equipment_level.in_(levels))
    if pole:
        q = q.filter(PrevCorr.action_entity == pole)
    if date_debut:
        q = q.filter(PrevCorr.date_declaration >= date_debut)
    if date_fin:
        q = q.filter(PrevCorr.date_declaration <= date_fin)
    return q


@router.get("/historique/poles")
def historique_poles_disponibles(db: Session = Depends(get_db)):
    """Liste tous les action_entity (= 'poles') distincts dans prev_corr."""
    rows = (
        db.query(distinct(PrevCorr.action_entity))
          .filter(PrevCorr.action_entity.isnot(None))
          .filter(PrevCorr.action_entity != "")
          .order_by(PrevCorr.action_entity)
          .all()
    )
    return [r[0] for r in rows]


@router.get("/historique/kpis")
def historique_kpis(
    pole: Optional[str] = Query(None),
    niveau: Optional[str] = Query(None),
    date_debut: Optional[str] = Query(None),
    date_fin: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """KPI cards : composantes, interventions, corr, prev, couts."""
    base = _prev_corr_base_query(db, pole, niveau, date_debut, date_fin)

    nb_composantes = (
        base.with_entities(func.count(distinct(PrevCorr.equipment_code)))
            .filter(PrevCorr.equipment_code.isnot(None))
            .scalar() or 0
    )
    nb_interventions = base.count()
    nb_corr = base.filter(PrevCorr.type_travail == TypeTravailPrevCorr.CORR).count()
    nb_prev = base.filter(PrevCorr.type_travail == TypeTravailPrevCorr.PREV).count()

    cout_total = (
        base.with_entities(func.coalesce(func.sum(PrevCorr.cout_total), 0.0)).scalar() or 0.0
    )
    cout_corr = (
        base.filter(PrevCorr.type_travail == TypeTravailPrevCorr.CORR)
            .with_entities(func.coalesce(func.sum(PrevCorr.cout_total), 0.0)).scalar() or 0.0
    )
    cout_prev = (
        base.filter(PrevCorr.type_travail == TypeTravailPrevCorr.PREV)
            .with_entities(func.coalesce(func.sum(PrevCorr.cout_total), 0.0)).scalar() or 0.0
    )

    return {
        "nb_composantes":   int(nb_composantes),
        "nb_interventions": int(nb_interventions),
        "nb_corr":          int(nb_corr),
        "nb_prev":          int(nb_prev),
        "cout_total":       round(float(cout_total), 2),
        "cout_corr":        round(float(cout_corr), 2),
        "cout_prev":        round(float(cout_prev), 2),
    }


@router.get("/historique/evolution-mensuelle")
def historique_evolution_mensuelle(
    pole: Optional[str] = Query(None),
    niveau: Optional[str] = Query(None),
    date_debut: Optional[str] = Query(None),
    date_fin: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Evolution mensuelle PREV vs CORR (groupement par YYYY-MM)
    + couts separes CORR / PREV pour le spline chart."""
    rows = (
        _prev_corr_base_query(db, pole, niveau, date_debut, date_fin)
        .with_entities(
            func.to_char(PrevCorr.date_declaration, "YYYY-MM").label("mois"),
            func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.CORR, 1), else_=0)).label("nb_corr"),
            func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.PREV, 1), else_=0)).label("nb_prev"),
            func.coalesce(func.sum(PrevCorr.cout_total), 0.0).label("cout_total"),
            func.coalesce(
                func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.CORR, PrevCorr.cout_total), else_=0.0)),
                0.0,
            ).label("cout_corr"),
            func.coalesce(
                func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.PREV, PrevCorr.cout_total), else_=0.0)),
                0.0,
            ).label("cout_prev"),
        )
        .group_by(func.to_char(PrevCorr.date_declaration, "YYYY-MM"))
        .order_by(func.to_char(PrevCorr.date_declaration, "YYYY-MM"))
        .all()
    )
    return [
        {
            "mois":      r.mois,
            "corr":      int(r.nb_corr or 0),
            "prev":      int(r.nb_prev or 0),
            "total":     int((r.nb_corr or 0) + (r.nb_prev or 0)),
            "cout":      round(float(r.cout_total or 0.0), 2),
            "cout_corr": round(float(r.cout_corr  or 0.0), 2),
            "cout_prev": round(float(r.cout_prev  or 0.0), 2),
        }
        for r in rows
    ]


@router.get("/historique/zones-critiques")
def historique_zones_critiques(
    pole: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Top zones (= action_entity) par nb de pannes CORRECTIVES L3+L4."""
    q = (
        db.query(
            PrevCorr.action_entity.label("zone"),
            func.count().label("nb_corr"),
            func.coalesce(func.sum(PrevCorr.cout_total), 0.0).label("cout"),
        )
        .filter(PrevCorr.equipment_level.in_([3, 4]))
        .filter(PrevCorr.type_travail == TypeTravailPrevCorr.CORR)
        .filter(PrevCorr.action_entity.isnot(None))
        .filter(PrevCorr.action_entity != "")
    )
    if pole:
        # Si un pole est selectionne, on affiche les sous-zones... mais comme
        # action_entity = pole dans nos donnees, on retournera juste 1 entree.
        # On laisse tel quel : le bar chart aura 1 barre quand un pole est filtre.
        q = q.filter(PrevCorr.action_entity == pole)

    rows = (
        q.group_by(PrevCorr.action_entity)
         .order_by(func.count().desc())
         .limit(limit)
         .all()
    )
    return [
        {
            "zone":    r.zone,
            "nb_corr": int(r.nb_corr or 0),
            "cout":    round(float(r.cout or 0.0), 2),
        }
        for r in rows
    ]


@router.get("/historique/repartition")
def historique_repartition(
    pole: Optional[str] = Query(None),
    niveau: Optional[str] = Query(None),
    date_debut: Optional[str] = Query(None),
    date_fin: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Donut PREV vs CORR (% global)."""
    base = _prev_corr_base_query(db, pole, niveau, date_debut, date_fin)
    nb_corr = base.filter(PrevCorr.type_travail == TypeTravailPrevCorr.CORR).count()
    nb_prev = base.filter(PrevCorr.type_travail == TypeTravailPrevCorr.PREV).count()
    total = nb_corr + nb_prev
    return {
        "corr": nb_corr,
        "prev": nb_prev,
        "pct_corr": round(nb_corr / total * 100, 1) if total > 0 else 0.0,
        "pct_prev": round(nb_prev / total * 100, 1) if total > 0 else 0.0,
    }


@router.get("/historique/composantes-critiques")
def historique_composantes_critiques(
    pole: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Top composantes les plus critiques (TOUJOURS L3+L4 — pas de filtre niveau ici
    car cette section est dediee aux composantes predites par le ML).
    """
    q = (
        db.query(
            PrevCorr.equipment_code.label("code"),
            PrevCorr.equipment_description.label("description"),
            PrevCorr.equipment_level.label("level"),
            PrevCorr.action_entity.label("pole"),
            func.count().label("nb_interventions"),
            func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.CORR, 1), else_=0)).label("nb_corr"),
            func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.PREV, 1), else_=0)).label("nb_prev"),
            func.coalesce(func.sum(PrevCorr.cout_total), 0.0).label("cout"),
        )
        .filter(PrevCorr.equipment_level.in_([3, 4]))
        .filter(PrevCorr.equipment_code.isnot(None))
    )
    if pole:
        q = q.filter(PrevCorr.action_entity == pole)

    rows = (
        q.group_by(
            PrevCorr.equipment_code,
            PrevCorr.equipment_description,
            PrevCorr.equipment_level,
            PrevCorr.action_entity,
        )
        .order_by(func.count().desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "code":             r.code,
            "description":      r.description or "—",
            "level":            r.level,
            "pole":             r.pole or "—",
            "nb_interventions": int(r.nb_interventions or 0),
            "nb_corr":          int(r.nb_corr or 0),
            "nb_prev":          int(r.nb_prev or 0),
            "cout":             round(float(r.cout or 0.0), 2),
        }
        for r in rows
    ]


@router.get("/historique/machines-critiques")
def historique_machines_critiques(
    pole: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Top machines les plus critiques (agregation par system_equipment).
    Compte TOUTES les interventions sur la machine (toutes ses composantes).
    """
    q = db.query(
        PrevCorr.system_equipment.label("machine"),
        func.count().label("nb_interventions"),
        func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.CORR, 1), else_=0)).label("nb_corr"),
        func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.PREV, 1), else_=0)).label("nb_prev"),
        func.count(distinct(PrevCorr.equipment_code)).label("nb_composantes"),
        func.coalesce(func.sum(PrevCorr.cout_total), 0.0).label("cout"),
    ).filter(PrevCorr.system_equipment.isnot(None))

    if pole:
        q = q.filter(PrevCorr.action_entity == pole)

    rows = (
        q.group_by(PrevCorr.system_equipment)
         .order_by(func.count().desc())
         .limit(limit)
         .all()
    )

    # Recuperer la description de la machine (de la ligne L1 si dispo, sinon n'importe)
    result = []
    for r in rows:
        desc_row = (
            db.query(PrevCorr.equipment_description)
              .filter(PrevCorr.system_equipment == r.machine)
              .order_by(PrevCorr.equipment_level.asc())  # L1 en premier
              .first()
        )
        description = desc_row[0] if desc_row else "—"
        result.append({
            "machine":          r.machine,
            "description":      description,
            "nb_interventions": int(r.nb_interventions or 0),
            "nb_corr":          int(r.nb_corr or 0),
            "nb_prev":          int(r.nb_prev or 0),
            "nb_composantes":   int(r.nb_composantes or 0),
            "cout":             round(float(r.cout or 0.0), 2),
        })
    return result


@router.get("/historique/pareto-composantes")
def historique_pareto_composantes(
    pole: Optional[str] = Query(None),
    limit: int = Query(20, ge=5, le=50),
    db: Session = Depends(get_db),
):
    """
    Pareto 80/20 : top composantes L3+L4 par nb de pannes CORR + pourcentage cumule.
    Retourne :
      - code, description
      - nb_pannes (CORR)
      - pct (% du total)
      - cumul_pct (% cumule)
    """
    # Total des pannes correctives L3+L4
    total_q = db.query(func.count()).select_from(PrevCorr).filter(
        PrevCorr.equipment_level.in_([3, 4]),
        PrevCorr.type_travail == TypeTravailPrevCorr.CORR,
        PrevCorr.equipment_code.isnot(None),
    )
    if pole:
        total_q = total_q.filter(PrevCorr.action_entity == pole)
    total = total_q.scalar() or 1

    # Top composantes
    q = db.query(
        PrevCorr.equipment_code.label("code"),
        PrevCorr.equipment_description.label("description"),
        func.count().label("nb_pannes"),
    ).filter(
        PrevCorr.equipment_level.in_([3, 4]),
        PrevCorr.type_travail == TypeTravailPrevCorr.CORR,
        PrevCorr.equipment_code.isnot(None),
    )
    if pole:
        q = q.filter(PrevCorr.action_entity == pole)

    rows = (
        q.group_by(PrevCorr.equipment_code, PrevCorr.equipment_description)
         .order_by(func.count().desc())
         .limit(limit)
         .all()
    )

    # Calcul cumul
    result = []
    cum = 0
    for r in rows:
        nb = int(r.nb_pannes or 0)
        cum += nb
        result.append({
            "code":        r.code,
            "description": r.description or "—",
            "nb_pannes":   nb,
            "pct":         round(nb / total * 100, 2),
            "cumul_pct":   round(cum / total * 100, 2),
        })
    return {
        "total_pannes": int(total),
        "data":         result,
    }


@router.get("/historique/machine/{machine_code}/composantes")
def historique_machine_composantes(
    machine_code: str,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Drill-down : top composantes (L3+L4) d'une machine donnee (system_equipment).
    """
    rows = (
        db.query(
            PrevCorr.equipment_code.label("code"),
            PrevCorr.equipment_description.label("description"),
            PrevCorr.equipment_level.label("level"),
            func.count().label("nb_interventions"),
            func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.CORR, 1), else_=0)).label("nb_corr"),
            func.sum(case((PrevCorr.type_travail == TypeTravailPrevCorr.PREV, 1), else_=0)).label("nb_prev"),
            func.coalesce(func.sum(PrevCorr.cout_total), 0.0).label("cout"),
        )
        .filter(PrevCorr.system_equipment == machine_code)
        .filter(PrevCorr.equipment_level.in_([3, 4]))
        .filter(PrevCorr.equipment_code.isnot(None))
        .group_by(
            PrevCorr.equipment_code,
            PrevCorr.equipment_description,
            PrevCorr.equipment_level,
        )
        .order_by(func.count().desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "code":             r.code,
            "description":      r.description or "—",
            "level":            r.level,
            "nb_interventions": int(r.nb_interventions or 0),
            "nb_corr":          int(r.nb_corr or 0),
            "nb_prev":          int(r.nb_prev or 0),
            "cout":             round(float(r.cout or 0.0), 2),
        }
        for r in rows
    ]


@router.get("/historique/heatmap")
def historique_heatmap(
    pole: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Heatmap : nombre d'interventions correctives par (mois, niveau).
    Pivot en backend : retourne {mois, L1, L2, L3, L4, L5}.
    """
    q = (
        db.query(
            func.to_char(PrevCorr.date_declaration, "YYYY-MM").label("mois"),
            PrevCorr.equipment_level.label("level"),
            func.count().label("nb"),
        )
        .filter(PrevCorr.type_travail == TypeTravailPrevCorr.CORR)
        .filter(PrevCorr.equipment_level.in_([1, 2, 3, 4, 5]))
    )
    if pole:
        q = q.filter(PrevCorr.action_entity == pole)

    rows = (
        q.group_by(
            func.to_char(PrevCorr.date_declaration, "YYYY-MM"),
            PrevCorr.equipment_level,
         )
         .order_by(func.to_char(PrevCorr.date_declaration, "YYYY-MM"))
         .all()
    )

    # Pivot
    pivot: dict = {}
    for r in rows:
        if r.mois not in pivot:
            pivot[r.mois] = {"mois": r.mois, "L1": 0, "L2": 0, "L3": 0, "L4": 0, "L5": 0}
        if r.level in (1, 2, 3, 4, 5):
            pivot[r.mois][f"L{r.level}"] = int(r.nb or 0)

    return list(pivot.values())