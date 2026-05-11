"""
services/dashboard_service.py
──────────────────────────────
Toute la logique métier / requêtes SQLAlchemy pour le dashboard.
Appelé uniquement depuis routers/dashboard.py.
"""

from sqlalchemy import func, extract, case, text
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from models.historique_interventions import (
    HistoriqueIntervention,
    TypeTravailHistorique,
    
)
from models.ot   import OrdreTravail, StatutOT
from models.di   import DemandeIntervention, StatutDI
from models.intervention import Intervention, StatutValidation
from models.equipement import Equipement
from models.zone import Zone


# ══════════════════════════════════════════════════════════════════════
# DASHBOARD LIVE — OT & DI
# ══════════════════════════════════════════════════════════════════════

def get_live_kpi(db: Session, id_pole: Optional[int] = None):
    q_ot = db.query(OrdreTravail)
    q_di = db.query(DemandeIntervention)
    if id_pole:
        q_ot = q_ot.filter(OrdreTravail.id_pole == id_pole)
        q_di = q_di.filter(DemandeIntervention.id_pole == id_pole)

    total_ot       = q_ot.count()
    en_cours       = q_ot.filter(OrdreTravail.statut == StatutOT.EN_COURS).count()
    termine        = q_ot.filter(OrdreTravail.statut == StatutOT.TERMINE).count()
    di_en_attente  = q_di.filter(DemandeIntervention.statut == StatutDI.EN_ATTENTE).count()
    di_verifie     = q_di.filter(DemandeIntervention.statut == StatutDI.VERIFIE).count()
    non_archives   = q_ot.filter(OrdreTravail.statut != StatutOT.ARCHIVE).count()

    return {
        "total_ot": total_ot,
        "ot_non_archives": non_archives,
        "ot_en_cours": en_cours,
        "ot_termine": termine,
        "taux_completion": round(termine / total_ot * 100, 1) if total_ot else 0,
        "di_en_attente": di_en_attente,
        "di_verifie": di_verifie,
        "di_total": q_di.count(),
    }


def get_ot_by_status(db: Session, id_pole: Optional[int] = None):
    from sqlalchemy import text as sa_text
    q = db.query(
        OrdreTravail.statut,
        func.count().label('count'),
    )
    if id_pole:
        q = q.filter(OrdreTravail.id_pole == id_pole)
    rows = q.group_by(OrdreTravail.statut).order_by(sa_text('count desc')).all()
    return [{"statut": r.statut.value, "count": r.count} for r in rows]


def get_di_by_status(db: Session, id_pole: Optional[int] = None):
    from sqlalchemy import text as sa_text
    q = db.query(
        DemandeIntervention.statut,
        func.count().label('count'),
    )
    if id_pole:
        q = q.filter(DemandeIntervention.id_pole == id_pole)
    rows = q.group_by(DemandeIntervention.statut).order_by(sa_text('count desc')).all()
    return [{"statut": r.statut, "count": r.count} for r in rows]


def get_ot_by_zone(db: Session, id_pole: Optional[int] = None):
    q = db.query(
        Zone.nom_zone,
        func.count(OrdreTravail.id_ot).label('count'),
    ).join(Equipement, OrdreTravail.id_equipement == Equipement.id_equipement
    ).join(Zone, Equipement.id_zone == Zone.id_zone)

    if id_pole:
        q = q.filter(OrdreTravail.id_pole == id_pole)

    rows = q.group_by(Zone.nom_zone).order_by(func.count(OrdreTravail.id_ot).desc()).all()
    return [{"zone": r.nom_zone, "count": r.count} for r in rows]


def get_ot_by_pole(db: Session):
    from models.pole import Pole
    q = db.query(
        Pole.nom_pole,
        func.count(OrdreTravail.id_ot).label('count'),
    ).join(Pole, OrdreTravail.id_pole == Pole.id_pole
    ).group_by(Pole.nom_pole
    ).order_by(func.count(OrdreTravail.id_ot).desc()).all()
    return [{"pole": r.nom_pole, "count": r.count} for r in rows]


def get_di_by_pole(db: Session):
    from models.pole import Pole
    q = db.query(
        Pole.nom_pole,
        func.count(DemandeIntervention.id_di).label('count'),
    ).join(Pole, DemandeIntervention.id_pole == Pole.id_pole
    ).group_by(Pole.nom_pole
    ).order_by(func.count(DemandeIntervention.id_di).desc()).all()
    return [{"pole": r.nom_pole, "count": r.count} for r in rows]


def get_intervention_by_status(db: Session, id_pole: Optional[int] = None):
    from sqlalchemy import text as sa_text
    q = db.query(
        Intervention.statut_validation,
        func.count().label('count'),
    )
    if id_pole:
        q = q.filter(Intervention.id_pole == id_pole)
    rows = q.group_by(Intervention.statut_validation).order_by(sa_text('count desc')).all()
    return [{"statut": r.statut_validation.value, "count": r.count} for r in rows]


def get_recent_activity(db: Session, id_pole: Optional[int] = None, limit: int = 10):
    """Dernières activités (OT + DI) triées par created_at"""
    from sqlalchemy import text as sa_text

    q_ot = db.query(
        OrdreTravail.numero_ot.label('ref'),
        sa_text("ordres_travail.type_ot::VARCHAR").label('sous_type'),
        sa_text("ordres_travail.statut::VARCHAR").label('statut'),
        OrdreTravail.created_at.label('date'),
        sa_text("'OT'").label('type'),
        OrdreTravail.id_ot.label('id'),
    )
    q_di = db.query(
        DemandeIntervention.numero_di.label('ref'),
        DemandeIntervention.urgence.label('sous_type'),
        DemandeIntervention.statut.label('statut'),
        DemandeIntervention.created_at.label('date'),
        sa_text("'DI'").label('type'),
        DemandeIntervention.id_di.label('id'),
    )
    q_di = db.query(
        DemandeIntervention.numero_di.label('ref'),
        DemandeIntervention.urgence.label('sous_type'),
        DemandeIntervention.statut.label('statut'),
        DemandeIntervention.created_at.label('date'),
        sa_text(f"'DI'").label('type'),
        DemandeIntervention.id_di.label('id'),
    )
    if id_pole:
        q_ot = q_ot.filter(OrdreTravail.id_pole == id_pole)
        q_di = q_di.filter(DemandeIntervention.id_pole == id_pole)

    union = q_ot.union(q_di).order_by(sa_text('date desc')).limit(limit).all()
    return [
        {
            "ref": r.ref,
            "type": r.type,
            "sous_type": r.sous_type,
            "statut": r.statut,
            "date": str(r.date) if r.date else None,
            "id": r.id,
        }
        for r in union
    ]


# ══════════════════════════════════════════════════════════════════════
# VUE D'ENSEMBLE
# ══════════════════════════════════════════════════════════════════════

def get_kpis(db: Session, annee: Optional[int] = None, type_travail: Optional[str] = None, pole: Optional[str] = None):
    q = db.query(HistoriqueIntervention)
    if annee:
        q = q.filter(extract('year', HistoriqueIntervention.date_declaration) == annee)
    if type_travail:
        q = q.filter(HistoriqueIntervention.type_travail == type_travail)
    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)

    total = q.count()
    prev  = q.filter(HistoriqueIntervention.type_travail == TypeTravailHistorique.PREV).count()
    corr  = q.filter(HistoriqueIntervention.type_travail == TypeTravailHistorique.CORR).count()

    cout_res = q.with_entities(func.sum(HistoriqueIntervention.cout_total)).scalar() or 0
    equip_count = q.with_entities(
        func.count(func.distinct(HistoriqueIntervention.system_equipment))
    ).scalar() or 0

    return {
        "total_interventions": total,
        "preventif": prev,
        "correctif": corr,
        "ratio_prev_pct": round(prev / total * 100, 1) if total else 0,
        "ratio_corr_pct": round(corr / total * 100, 1) if total else 0,
        "cout_total_da": round(cout_res, 2),
        "cout_moyen_da": round(cout_res / total, 2) if total else 0,
        "nb_equipements": equip_count,
    }


def get_interventions_par_mois(db: Session, annee: Optional[int] = None, pole: Optional[str] = None):
    q = db.query(
        extract('year',  HistoriqueIntervention.date_declaration).label('annee'),
        extract('month', HistoriqueIntervention.date_declaration).label('mois'),
        HistoriqueIntervention.type_travail,
        func.count().label('count'),
    ).filter(HistoriqueIntervention.date_declaration.isnot(None))

    if annee:
        q = q.filter(extract('year', HistoriqueIntervention.date_declaration) == annee)
    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)

    rows = q.group_by('annee', 'mois', HistoriqueIntervention.type_travail).order_by('annee', 'mois').all()

    # Pivot : {annee-mois : {prev: N, corr: N}}
    result = {}
    for r in rows:
        key = f"{int(r.annee)}-{int(r.mois):02d}"
        if key not in result:
            result[key] = {"periode": key, "annee": int(r.annee), "mois": int(r.mois), "prev": 0, "corr": 0}
        if r.type_travail == TypeTravailHistorique.PREV:
            result[key]["prev"] = r.count
        else:
            result[key]["corr"] = r.count

    return list(result.values())


def get_distribution_job_class(db: Session, annee: Optional[int] = None):
    q = db.query(
        HistoriqueIntervention.job_class,
        func.count().label('count'),
        func.sum(HistoriqueIntervention.cout_total).label('cout_total'),
    ).filter(HistoriqueIntervention.job_class.isnot(None))

    if annee:
        q = q.filter(extract('year', HistoriqueIntervention.date_declaration) == annee)

    rows = q.group_by(HistoriqueIntervention.job_class).order_by(func.count().desc()).all()

    return [
        {"job_class": r.job_class, "count": r.count, "cout_total": round(r.cout_total or 0, 2)}
        for r in rows
    ]


def get_cout_par_mois(db: Session, annee: Optional[int] = None, pole: Optional[str] = None):
    q = db.query(
        extract('year',  HistoriqueIntervention.date_declaration).label('annee'),
        extract('month', HistoriqueIntervention.date_declaration).label('mois'),
        HistoriqueIntervention.type_travail,
        func.sum(HistoriqueIntervention.cout_total).label('cout'),
    ).filter(HistoriqueIntervention.date_declaration.isnot(None))

    if annee:
        q = q.filter(extract('year', HistoriqueIntervention.date_declaration) == annee)
    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)

    rows = q.group_by('annee', 'mois', HistoriqueIntervention.type_travail).order_by('annee', 'mois').all()

    result = {}
    for r in rows:
        key = f"{int(r.annee)}-{int(r.mois):02d}"
        if key not in result:
            result[key] = {"periode": key, "prev": 0, "corr": 0}
        if r.type_travail == TypeTravailHistorique.PREV:
            result[key]["prev"] = round(r.cout or 0, 2)
        else:
            result[key]["corr"] = round(r.cout or 0, 2)

    return list(result.values())


def get_pannes_par_semaine(db: Session, annee: Optional[int] = None):
    q = db.query(
        extract('year', HistoriqueIntervention.date_declaration).label('annee'),
        extract('week', HistoriqueIntervention.date_declaration).label('semaine'),
        func.count().label('pannes'),
    ).filter(
        HistoriqueIntervention.type_travail == TypeTravailHistorique.CORR,
        HistoriqueIntervention.date_declaration.isnot(None),
    )

    if annee:
        q = q.filter(extract('year', HistoriqueIntervention.date_declaration) == annee)

    rows = q.group_by('annee', 'semaine').order_by('annee', 'semaine').all()

    return [
        {"annee": int(r.annee), "semaine": int(r.semaine), "pannes": r.pannes,
         "label": f"S{int(r.semaine):02d}/{int(r.annee)}"}
        for r in rows
    ]


# ══════════════════════════════════════════════════════════════════════
# ÉQUIPEMENTS
# ══════════════════════════════════════════════════════════════════════

def get_top_equipements(db: Session, limit: int = 10, type_travail: str = "CORR", pole: Optional[str] = None):
    tt = TypeTravailHistorique.CORR if type_travail == "CORR" else TypeTravailHistorique.PREV

    q = db.query(
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.equipment_description,
        func.count().label('nb_pannes'),
        func.sum(HistoriqueIntervention.cout_total).label('cout_total'),
        func.avg(HistoriqueIntervention.duree_jours).label('duree_moyenne'),
    ).filter(
        HistoriqueIntervention.type_travail == tt
    )

    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)

    rows = q.group_by(
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.equipment_description,
    ).order_by(func.count().desc()).limit(limit).all()

    return [
        {
            "system_equipment": r.system_equipment,
            "description": r.equipment_description,
            "nb_pannes": r.nb_pannes,
            "cout_total": round(r.cout_total or 0, 2),
            "duree_moyenne_jours": round(r.duree_moyenne or 0, 1),
        }
        for r in rows
    ]


def get_mtbf_equipements(db: Session, limit: int = 10, pole: Optional[str] = None):
    """
    MTBF approximatif : durée moyenne entre deux pannes consécutives.
    Ici approché par : avg(duree_jours) sur les interventions CORR.
    """
    q = db.query(
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.equipment_description,
        func.count().label('nb_pannes'),
        func.avg(HistoriqueIntervention.duree_jours).label('mtbf'),
        func.sum(HistoriqueIntervention.cout_total).label('cout_total'),
    ).filter(
        HistoriqueIntervention.type_travail == TypeTravailHistorique.CORR,
        HistoriqueIntervention.duree_jours.isnot(None),
    )

    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)

    rows = q.group_by(
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.equipment_description,
    ).having(
        func.count() >= 3   # au moins 3 pannes pour être significatif
    ).order_by(
        func.avg(HistoriqueIntervention.duree_jours).asc()
    ).limit(limit).all()

    return [
        {
            "system_equipment": r.system_equipment,
            "description": r.equipment_description,
            "nb_pannes": r.nb_pannes,
            "mtbf_jours": round(r.mtbf or 0, 1),
            "cout_total": round(r.cout_total or 0, 2),
            "criticite": "CRITIQUE" if (r.mtbf or 999) < 20
                         else "ELEVE" if (r.mtbf or 999) < 40
                         else "MOYEN",
        }
        for r in rows
    ]


def get_composantes_critiques(db: Session, limit: int = 10, pole: Optional[str] = None):
    """
    Composantes (level 2-4) les plus critiques.
    Score criticité = nb_pannes * 0.5 + (1/mtbf) * 0.3 + cout_normalise * 0.2
    """
    q = db.query(
        HistoriqueIntervention.equipment_code,
        HistoriqueIntervention.equipment_description,
        HistoriqueIntervention.equipment_level,
        HistoriqueIntervention.job_class,
        HistoriqueIntervention.system_equipment.label('niveau_1'),  # Machine mère racine
        HistoriqueIntervention.parent_code.label('niveau_2'),  # Parent direct
        func.count().label('nb_pannes'),
        func.avg(HistoriqueIntervention.duree_jours).label('mtbf'),
        func.sum(HistoriqueIntervention.cout_total).label('cout_total'),
    ).filter(
        HistoriqueIntervention.type_travail == TypeTravailHistorique.CORR,
        HistoriqueIntervention.equipment_code.isnot(None),
        HistoriqueIntervention.equipment_level >= 2,
    )

    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)

    rows = q.group_by(
        HistoriqueIntervention.equipment_code,
        HistoriqueIntervention.equipment_description,
        HistoriqueIntervention.equipment_level,
        HistoriqueIntervention.job_class,
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.parent_code,
    ).order_by(func.count().desc()).limit(limit).all()

    return [
        {
            "equipment_code": r.equipment_code,
            "description": r.equipment_description,
            "level": r.equipment_level,
            "job_class": r.job_class,
            "niveau_1": r.niveau_1,  # Machine mère niveau 1 (racine)
            "niveau_2": r.niveau_2,  # Machine mère niveau 2 (parent direct)
            "nb_pannes": r.nb_pannes,
            "mtbf_jours": round(r.mtbf or 0, 1),
            "cout_total": round(r.cout_total or 0, 2),
        }
        for r in rows
    ]


# ══════════════════════════════════════════════════════════════════════
# ZONES & PÔLES
# ══════════════════════════════════════════════════════════════════════

def get_interventions_par_pole(db: Session, annee: Optional[int] = None):
    q = db.query(
        HistoriqueIntervention.action_entity,
        HistoriqueIntervention.type_travail,
        func.count().label('count'),
        func.sum(HistoriqueIntervention.cout_total).label('cout'),
    ).filter(HistoriqueIntervention.action_entity.isnot(None))

    if annee:
        q = q.filter(extract('year', HistoriqueIntervention.date_declaration) == annee)

    rows = q.group_by(
        HistoriqueIntervention.action_entity,
        HistoriqueIntervention.type_travail,
    ).order_by(func.count().desc()).all()

    result = {}
    for r in rows:
        pole = r.action_entity
        if pole not in result:
            result[pole] = {"pole": pole, "prev": 0, "corr": 0, "cout_total": 0}
        if r.type_travail == TypeTravailHistorique.PREV:
            result[pole]["prev"] = r.count
        else:
            result[pole]["corr"] = r.count
        result[pole]["cout_total"] += round(r.cout or 0, 2)

    return list(result.values())


def get_cout_par_zone(db: Session):
    rows = db.query(
        HistoriqueIntervention.action_entity,
        func.sum(HistoriqueIntervention.cout_total).label('cout'),
        func.count().label('nb'),
    ).filter(
        HistoriqueIntervention.action_entity.isnot(None)
    ).group_by(
        HistoriqueIntervention.action_entity
    ).order_by(func.sum(HistoriqueIntervention.cout_total).desc()).all()

    return [
        {"zone": r.action_entity, "cout_total": round(r.cout or 0, 2), "nb_interventions": r.nb}
        for r in rows
    ]


def get_zones_critiques(db: Session):
    """
    Zones classées par criticité :
    - Nb de pannes correctives
    - Coût total
    - MTBF moyen
    """
    rows = db.query(
        HistoriqueIntervention.action_entity,
        func.count().label('nb_pannes'),
        func.sum(HistoriqueIntervention.cout_total).label('cout_total'),
        func.avg(HistoriqueIntervention.duree_jours).label('mtbf_moyen'),
    ).filter(
        HistoriqueIntervention.type_travail == TypeTravailHistorique.CORR,
        HistoriqueIntervention.action_entity.isnot(None),
    ).group_by(
        HistoriqueIntervention.action_entity
    ).order_by(func.count().desc()).all()

    return [
        {
            "zone": r.action_entity,
            "nb_pannes": r.nb_pannes,
            "cout_total": round(r.cout_total or 0, 2),
            "mtbf_moyen_jours": round(r.mtbf_moyen or 0, 1),
            "criticite": "CRITIQUE" if r.nb_pannes > 500
                         else "ELEVE" if r.nb_pannes > 200
                         else "MOYEN",
        }
        for r in rows
    ]


# ══════════════════════════════════════════════════════════════════════
# INTERVENTIONS
# ══════════════════════════════════════════════════════════════════════

def get_ratio_prev_corr(db: Session, annee: Optional[int] = None):
    q = db.query(
        HistoriqueIntervention.type_travail,
        func.count().label('count'),
    )
    if annee:
        q = q.filter(extract('year', HistoriqueIntervention.date_declaration) == annee)

    rows = q.group_by(HistoriqueIntervention.type_travail).all()
    total = sum(r.count for r in rows)

    result = {"total": total, "annee": annee}
    for r in rows:
        key = r.type_travail.value.lower()
        result[key] = r.count
        result[f"{key}_pct"] = round(r.count / total * 100, 1) if total else 0

    return result


def get_tendance_annuelle(db: Session):
    rows = db.query(
        extract('year',    HistoriqueIntervention.date_declaration).label('annee'),
        extract('quarter', HistoriqueIntervention.date_declaration).label('trimestre'),
        HistoriqueIntervention.type_travail,
        func.count().label('count'),
    ).filter(
        HistoriqueIntervention.date_declaration.isnot(None)
    ).group_by(
        'annee', 'trimestre', HistoriqueIntervention.type_travail
    ).order_by('annee', 'trimestre').all()

    result = {}
    for r in rows:
        key = f"{int(r.annee)} Q{int(r.trimestre)}"
        if key not in result:
            result[key] = {"periode": key, "prev": 0, "corr": 0}
        if r.type_travail == TypeTravailHistorique.PREV:
            result[key]["prev"] = r.count
        else:
            result[key]["corr"] = r.count

    return list(result.values())


def get_journal(
    db: Session,
    limit: int = 50,
    pole: Optional[str] = None,
    type_travail: Optional[str] = None,
):
    q = db.query(HistoriqueIntervention)

    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)
    if type_travail:
        q = q.filter(HistoriqueIntervention.type_travail == type_travail)

    rows = q.order_by(HistoriqueIntervention.date_declaration.desc()).limit(limit).all()

    return [
        {
            "id": r.id,
            "system_equipment": r.system_equipment,
            "equipment_code": r.equipment_code,
            "description": r.equipment_description,
            "type_travail": r.type_travail.value,
            "job_class": r.job_class,
            "action_entity": r.action_entity,
            "date_declaration": str(r.date_declaration) if r.date_declaration else None,
            "date_fin": str(r.date_fin) if r.date_fin else None,
            "duree_jours": r.duree_jours,
            "cout_total": r.cout_total,
            "source": r.source,
            "label_qualite": r.label_qualite.value,
        }
        for r in rows
    ]


# ══════════════════════════════════════════════════════════════════════
# ML FEATURES
# ══════════════════════════════════════════════════════════════════════

def get_features_ml(db: Session):
    """
    Export des features pour entraîner le modèle prédictif.
    Uniquement lignes HIGH quality avec equipment_code renseigné.
    """
    rows = db.query(HistoriqueIntervention).filter(
        HistoriqueIntervention.equipment_code.isnot(None),
        HistoriqueIntervention.date_declaration.isnot(None),
    ).all()

    return [
        {
            "equipment_code":    r.equipment_code,
            "system_equipment":  r.system_equipment,
            "equipment_level":   r.equipment_level,
            "parent_code":       r.parent_code,
            "job_class":         r.job_class,
            "type_travail":      r.type_travail.value,  # label cible pour ML
            "duree_jours":       r.duree_jours,
            "cout_total":        r.cout_total,
            "mois":              r.date_declaration.month,
            "annee":             r.date_declaration.year,
            "trimestre":         (r.date_declaration.month - 1) // 3 + 1,
        }
        for r in rows
    ]