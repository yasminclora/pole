"""
services/prediction_service.py  — VERSION FINALE
"""

import math
from datetime import date, timedelta, datetime
from typing import Optional
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from models.historique_interventions import (
    HistoriqueIntervention,
    TypeTravailHistorique,
)


def _get_ref_date(db: Session) -> date:
    result = db.query(func.max(HistoriqueIntervention.date_declaration)).scalar()
    return result if result else date(2024, 12, 31)


def _calc_mtbf(premiere_date, derniere_date, nb_pannes: int) -> float:
    if nb_pannes >= 2 and premiere_date and derniere_date:
        jours = (derniere_date - premiere_date).days
        if jours > 0:
            return jours / (nb_pannes - 1)
    return 30.0


def _calculate_rul(mtbf, derniere_date, ref_date, equipment_code, nb_pannes) -> dict:
    jours_ecoules = max(0, (ref_date - derniere_date).days) if derniere_date else int(mtbf * 0.6)
    seed          = abs(hash(str(equipment_code))) % 1009
    factor        = math.sin(seed * 0.613) * mtbf * 0.20
    rul           = max(0, min(round(mtbf - jours_ecoules + factor), round(mtbf * 1.8)))
    delta         = round(rul - mtbf)
    confiance     = min(94, max(70, round(70 + (min(nb_pannes,30)/30)*20 + math.cos(seed*0.27)*4)))
    date_prevue   = (ref_date + timedelta(days=rul)).isoformat() if rul > 0 else ref_date.isoformat()
    statut        = "CRITIQUE" if rul<=3 else "URGENT" if rul<=10 else "SURVEILLANCE" if rul<=25 else "OK"
    return { "rul_jours":rul, "delta_jours":delta, "confiance_pct":confiance, "statut":statut, "date_panne_prevue":date_prevue }


# ── PÔLES ──────────────────────────────────────────────────────────────
def get_poles(db: Session) -> list:
    rows = db.query(distinct(HistoriqueIntervention.action_entity)).filter(
        HistoriqueIntervention.action_entity.isnot(None),
        HistoriqueIntervention.action_entity != "",
    ).order_by(HistoriqueIntervention.action_entity).all()
    return [r[0] for r in rows]


# ── STATS ───────────────────────────────────────────────────────────────
def get_stats_globales(db: Session, pole: Optional[str] = None) -> dict:
    q = db.query(HistoriqueIntervention).filter(
        HistoriqueIntervention.equipment_level.in_([3,4,5]),
        HistoriqueIntervention.equipment_code.isnot(None),
    )
    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)

    return {
        "nb_composantes": q.with_entities(func.count(distinct(HistoriqueIntervention.equipment_code))).scalar() or 0,
        "nb_machines":    q.with_entities(func.count(distinct(HistoriqueIntervention.system_equipment))).scalar() or 0,
        "cout_moyen":     round(float(q.with_entities(func.avg(HistoriqueIntervention.cout_total)).scalar() or 0), 2),
    }


# ── MACHINES CRITIQUES ──────────────────────────────────────────────────
def get_machines_critiques(db: Session, pole: Optional[str] = None, limit: int = 6) -> list:
    q = db.query(
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.equipment_description,
        HistoriqueIntervention.action_entity,
        func.count(distinct(HistoriqueIntervention.equipment_code)).label("nb_composantes"),
        func.count().label("nb_pannes"),
        func.sum(HistoriqueIntervention.cout_total).label("cout_total"),
    ).filter(
        HistoriqueIntervention.type_travail == TypeTravailHistorique.CORR,
        HistoriqueIntervention.equipment_level.in_([3,4,5]),
        HistoriqueIntervention.equipment_code.isnot(None),
        HistoriqueIntervention.system_equipment.isnot(None),
    )
    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)

    rows = q.group_by(
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.equipment_description,
        HistoriqueIntervention.action_entity,
    ).order_by(func.count().desc()).limit(limit).all()

    return [{"system_equipment":r.system_equipment,"description":r.equipment_description or "—","pole":r.action_entity or "—","nb_composantes":r.nb_composantes,"nb_pannes":r.nb_pannes,"cout_total":round(float(r.cout_total or 0),2)} for r in rows]


# ── COMPOSANTES AVEC RUL ────────────────────────────────────────────────
def get_composantes_avec_rul(db: Session, pole: Optional[str]=None, search: Optional[str]=None, rul_max: Optional[int]=None, model: str="SIMULATION") -> list:
    ref_date = _get_ref_date(db)

    q = db.query(
        HistoriqueIntervention.equipment_code,
        HistoriqueIntervention.equipment_description,
        HistoriqueIntervention.equipment_level,
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.action_entity,
        func.count().label("nb_pannes"),
        func.max(HistoriqueIntervention.date_declaration).label("derniere_date"),
        func.min(HistoriqueIntervention.date_declaration).label("premiere_date"),
        func.sum(HistoriqueIntervention.cout_total).label("cout_total"),
    ).filter(
        HistoriqueIntervention.type_travail == TypeTravailHistorique.CORR,
        HistoriqueIntervention.equipment_level.in_([3,4,5]),
        HistoriqueIntervention.equipment_code.isnot(None),
    )

    if pole:
        q = q.filter(HistoriqueIntervention.action_entity == pole)
    if search:
        t = f"%{search}%"
        q = q.filter(HistoriqueIntervention.equipment_code.ilike(t) | HistoriqueIntervention.equipment_description.ilike(t))

    rows = q.group_by(
        HistoriqueIntervention.equipment_code,
        HistoriqueIntervention.equipment_description,
        HistoriqueIntervention.equipment_level,
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.action_entity,
    ).having(func.count() >= 2).all()

    results = []
    for r in rows:
        mtbf     = _calc_mtbf(r.premiere_date, r.derniere_date, r.nb_pannes)
        rul_data = _calculate_rul(mtbf, r.derniere_date, ref_date, r.equipment_code, r.nb_pannes)
        if rul_max is not None and rul_data["rul_jours"] > rul_max:
            continue
        results.append({
            "equipment_code":        r.equipment_code,
            "description":           r.equipment_description or "—",
            "equipment_level":       r.equipment_level,
            "system_equipment":      r.system_equipment or "—",
            "pole":                  r.action_entity or "—",
            "job_class":             "—",
            "nb_pannes":             r.nb_pannes,
            "mtbf_jours":            round(mtbf, 1),
            "derniere_intervention": str(r.derniere_date) if r.derniere_date else None,
            "cout_total":            round(float(r.cout_total or 0), 2),
            **rul_data,
        })

    return sorted(results, key=lambda x: x["rul_jours"])


# ── TREND RUL ───────────────────────────────────────────────────────────
def get_rul_trend(db: Session, equipment_code: str) -> list:
    rows = db.query(
        HistoriqueIntervention.date_declaration,
        HistoriqueIntervention.cout_total,
    ).filter(
        HistoriqueIntervention.equipment_code == equipment_code,
        HistoriqueIntervention.type_travail   == TypeTravailHistorique.CORR,
        HistoriqueIntervention.date_declaration.isnot(None),
    ).order_by(HistoriqueIntervention.date_declaration.asc()).limit(15).all()

    if not rows:
        return []

    dates = [r.date_declaration for r in rows]
    nb    = len(dates)
    mtbf  = (dates[-1] - dates[0]).days / (nb-1) if nb >= 2 else 30.0

    trend = []
    for i, r in enumerate(rows):
        j   = int(mtbf*0.5) if i==0 else (dates[i]-dates[i-1]).days
        rul = max(0, round(mtbf - j))
        trend.append({"date":str(r.date_declaration),"rul":rul,"cout":round(float(r.cout_total or 0),2),"seuil":10})
    return trend


# ── CRÉATION OT PRÉDICTIF ───────────────────────────────────────────────
def create_ot_predictif(db: Session, data: dict) -> dict:
    from models.equipement import Equipement
    from models.ot import OrdreTravail, TypeOT, ClasseOT, PrioriteOT, StatutOT

    equip = db.query(Equipement).filter(Equipement.equipment_code == data["equipment_code"]).first()
    if not equip:
        raise ValueError(f"Équipement '{data['equipment_code']}' introuvable dans la table equipements.")

    # Génération du numéro OT
    annee  = datetime.now().year
    count  = db.query(func.count(OrdreTravail.id_ot)).filter(
        OrdreTravail.type_ot == TypeOT.PREDICTIF,
        func.extract("year", OrdreTravail.created_at) == annee,
    ).scalar() or 0
    numero_ot = f"OT-PREDICTIF-{annee}-{count+1:04d}"

    priorite_map = {"CRITIQUE":PrioriteOT.CRITIQUE,"HAUTE":PrioriteOT.HAUTE,"NORMALE":PrioriteOT.NORMALE,"FAIBLE":PrioriteOT.FAIBLE}
    classe_map   = {"MECANIQUE":ClasseOT.MECANIQUE,"ELECTRIQUE":ClasseOT.ELECTRIQUE,"GLOBALE":ClasseOT.GLOBALE}

    date_prevue = None
    if data.get("date_prevue"):
        try: date_prevue = datetime.strptime(data["date_prevue"], "%Y-%m-%d").date()
        except: pass

    id_assigne = data.get("id_assigne") or None
    statut     = StatutOT.ASSIGNE if id_assigne else StatutOT.CREE

    ot = OrdreTravail(
        numero_ot        = numero_ot,
        type_ot          = TypeOT.PREDICTIF,
        classe           = classe_map.get(data.get("classe","MECANIQUE"), ClasseOT.MECANIQUE),
        priorite         = priorite_map.get(data.get("priorite","NORMALE"), PrioriteOT.NORMALE),
        statut           = statut,
        id_equipement    = equip.id_equipement,
        id_pole          = equip.id_pole,
        id_methodiste    = data["id_methodiste"],
        id_assigne       = id_assigne,
        description      = data.get("description", f"OT prédictif — {data['equipment_code']}"),
        observations     = data.get("observations") or None,
        date_prevue      = date_prevue,
        duree_estimee    = int(data.get("duree_estimee", 120)),
        date_assignation = datetime.now() if id_assigne else None,
        id_prediction    = data.get("id_prediction"),
    )
    db.add(ot)
    db.commit()
    db.refresh(ot)

    return {
        "id_ot":      ot.id_ot,
        "numero_ot":  ot.numero_ot,
        "statut":     ot.statut,
        "priorite":   ot.priorite,
        "date_prevue":str(ot.date_prevue) if ot.date_prevue else None,
        "id_assigne": ot.id_assigne,
    }