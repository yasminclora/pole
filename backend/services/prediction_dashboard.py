"""
Logique du Dashboard Prédictif (nouvelle interface pro).

Réutilise la simulation RUL existante de prediction_service.py mais :
- applique le RBAC (admin = tous pôles, méthodiste = son pôle uniquement)
- enrichit avec zone & stock via join Equipement / ComposanteStock / PieceStock
- ajoute filtres zone, machine, criticite, dates, search
"""

from datetime import date, datetime
from typing import Optional
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from models.historique_interventions import HistoriqueIntervention, TypeTravailHistorique
from models.equipement import Equipement
from models.pole       import Pole
from models.zone       import Zone
from models.stock      import ComposanteStock, PieceStock
from models.user       import Utilisateur

from services.prediction_service import _get_ref_date, _calc_mtbf, _calculate_rul


# ── Helpers RBAC ───────────────────────────────────────────────────────

def _normalize_role(raw: str | None) -> str:
    if not raw:
        return ""
    return raw.split(".")[-1] if "." in raw else raw


def _resolve_pole_filter(
    db: Session,
    current_user: dict,
    pole_param: Optional[str],
) -> Optional[str]:
    """
    Retourne le nom du pôle à filtrer (texte action_entity dans historique).
    - ADMIN : peut filtrer par pole_param (ou None pour tout voir)
    - METHODISTE : forcé à son pôle (CHEF_POLE deprecated, géré via METHODISTE)
    - Autres : exception (403)
    """
    role = _normalize_role(current_user.get("role"))

    if role == "ADMIN":
        return pole_param.strip() if pole_param else None

    if role in ("METHODISTE", "CHEF_POLE"):   # CHEF_POLE legacy compat
        id_pole = current_user.get("id_pole")
        if not id_pole:
            return None
        pole = db.get(Pole, id_pole)
        return pole.nom_pole if pole else None

    raise PermissionError("Accès refusé au dashboard prédictif.")


# ── Helpers d'enrichissement ───────────────────────────────────────────

def _build_zone_map(db: Session, codes: list[str]) -> dict[str, dict]:
    """
    Pour chaque equipment_code, retourne {zone, machine, id_equipement}
    via la table Equipement (+ Zone).
    """
    if not codes:
        return {}
    rows = (
        db.query(
            Equipement.equipment_code,
            Equipement.id_equipement,
            Zone.code_zone,
            Equipement.id_machine_racine,
        )
        .outerjoin(Zone, Equipement.id_zone == Zone.id_zone)
        .filter(Equipement.equipment_code.in_(codes))
        .all()
    )
    zone_map: dict[str, dict] = {}
    racines_ids = {r.id_machine_racine for r in rows if r.id_machine_racine}
    # Résoudre les codes des machines racines en un coup
    racines = (
        db.query(Equipement.id_equipement, Equipement.equipment_code, Equipement.description)
        .filter(Equipement.id_equipement.in_(racines_ids))
        .all()
    ) if racines_ids else []
    racine_map = {r.id_equipement: (r.equipment_code, r.description) for r in racines}

    for r in rows:
        machine_code, machine_desc = racine_map.get(r.id_machine_racine, (None, None))
        zone_map[r.equipment_code] = {
            "id_equipement"  : r.id_equipement,
            "zone"           : r.code_zone or "—",
            "machine"        : machine_code or "—",
            "machine_desc"   : machine_desc or "",
        }
    return zone_map


def _build_stock_map(db: Session, ids_equipement: list[int]) -> dict[int, dict]:
    """
    Pour chaque id_equipement, retourne le stock disponible et le seuil.
    Prend la première pièce liée (cas typique : 1 composante = 1 pièce).
    """
    if not ids_equipement:
        return {}
    rows = (
        db.query(
            ComposanteStock.id_equipement,
            PieceStock.id_piece,
            PieceStock.code_stock,
            PieceStock.designation,
            PieceStock.quantite,
            PieceStock.seuil_alerte,
        )
        .join(PieceStock, PieceStock.id_piece == ComposanteStock.id_piece)
        .filter(ComposanteStock.id_equipement.in_(ids_equipement))
        .all()
    )
    stock_map: dict[int, dict] = {}
    for r in rows:
        if r.id_equipement in stock_map:
            continue  # garder la première occurrence
        stock_map[r.id_equipement] = {
            "code_stock"        : r.code_stock,
            "designation"       : r.designation,
            "stock_disponible"  : int(r.quantite or 0),
            "stock_seuil_alerte": int(r.seuil_alerte or 0),
            "stock_ok"          : (r.quantite or 0) > (r.seuil_alerte or 0),
        }
    return stock_map


# ── Classification criticité (4 niveaux) ───────────────────────────────

def _classifier(rul: int) -> str:
    if rul < 7:   return "CRITIQUE"
    if rul < 15:  return "ELEVE"
    if rul < 31:  return "MODERE"
    return "STABLE"


# ── Cœur du dashboard ──────────────────────────────────────────────────

def get_dashboard(
    db           : Session,
    current_user : dict,
    pole         : Optional[str] = None,
    zone         : Optional[str] = None,
    machine      : Optional[str] = None,
    criticite    : Optional[str] = None,
    search       : Optional[str] = None,
    date_from    : Optional[date] = None,
    date_to      : Optional[date] = None,
) -> dict:
    pole_filter = _resolve_pole_filter(db, current_user, pole)
    ref_date    = _get_ref_date(db)

    # ── 1. Requête historique groupée par composant
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
        HistoriqueIntervention.equipment_level.in_([3, 4, 5]),
        HistoriqueIntervention.equipment_code.isnot(None),
    )

    if pole_filter:
        q = q.filter(HistoriqueIntervention.action_entity == pole_filter)
    if date_from:
        q = q.filter(HistoriqueIntervention.date_declaration >= date_from)
    if date_to:
        q = q.filter(HistoriqueIntervention.date_declaration <= date_to)
    if search:
        t = f"%{search}%"
        q = q.filter(
            HistoriqueIntervention.equipment_code.ilike(t) |
            HistoriqueIntervention.equipment_description.ilike(t)
        )

    rows = q.group_by(
        HistoriqueIntervention.equipment_code,
        HistoriqueIntervention.equipment_description,
        HistoriqueIntervention.equipment_level,
        HistoriqueIntervention.system_equipment,
        HistoriqueIntervention.action_entity,
    ).having(func.count() >= 2).all()

    codes = [r.equipment_code for r in rows]
    zone_map = _build_zone_map(db, codes)
    ids_eq   = [v["id_equipement"] for v in zone_map.values() if v.get("id_equipement")]
    stock_map = _build_stock_map(db, ids_eq)

    # ── 2. Calcul RUL + assemblage
    composants = []
    for r in rows:
        mtbf     = _calc_mtbf(r.premiere_date, r.derniere_date, r.nb_pannes)
        rul_data = _calculate_rul(mtbf, r.derniere_date, ref_date, r.equipment_code, r.nb_pannes)

        zinfo = zone_map.get(r.equipment_code, {})
        stk   = stock_map.get(zinfo.get("id_equipement"), {
            "code_stock": None, "designation": None,
            "stock_disponible": 0, "stock_seuil_alerte": 0, "stock_ok": False,
        })

        crit = _classifier(rul_data["rul_jours"])

        composant = {
            "equipment_code"        : r.equipment_code,
            "description"           : r.equipment_description or "—",
            "niveau_hierarchie"     : r.equipment_level or 3,
            "machine"               : r.system_equipment or zinfo.get("machine", "—"),
            "zone"                  : zinfo.get("zone", "—"),
            "pole"                  : r.action_entity or "—",
            "rul_jours"             : rul_data["rul_jours"],
            "criticite"             : crit,
            "confiance_pct"         : rul_data["confiance_pct"],
            "date_panne_prevue"     : rul_data["date_panne_prevue"],
            "derniere_intervention" : str(r.derniere_date) if r.derniere_date else None,
            "nb_pannes"             : r.nb_pannes,
            "mtbf_jours"            : round(mtbf, 1),
            "cout_moyen"            : round(float(r.cout_total or 0) / max(r.nb_pannes, 1), 2),
            **stk,
        }
        composants.append(composant)

    # ── 3. Filtres post-calcul (zone, machine, criticité)
    if zone:
        composants = [c for c in composants if c["zone"] == zone]
    if machine:
        composants = [c for c in composants if c["machine"] == machine]
    if criticite and criticite != "TOUS":
        composants = [c for c in composants if c["criticite"] == criticite]

    composants.sort(key=lambda c: c["rul_jours"])

    # ── 4. KPIs (sur la liste filtrée)
    kpis = {
        "critique": sum(1 for c in composants if c["criticite"] == "CRITIQUE"),
        "eleve"   : sum(1 for c in composants if c["criticite"] == "ELEVE"),
        "modere"  : sum(1 for c in composants if c["criticite"] == "MODERE"),
        "stable"  : sum(1 for c in composants if c["criticite"] == "STABLE"),
        "total"   : len(composants),
    }

    return {
        "kpis"          : kpis,
        "composants"    : composants,
        "scanned_at"    : datetime.now().isoformat(),
        "pole_effectif" : pole_filter,
        "ref_date"      : ref_date.isoformat() if ref_date else None,
    }


# ── Détail composant ──────────────────────────────────────────────────

def get_composant_detail(
    db: Session,
    current_user: dict,
    equipment_code: str,
) -> dict:
    pole_filter = _resolve_pole_filter(db, current_user, None)

    # On charge tous les historiques de ce composant (CORR + PREV pour interventions passées)
    historiques = (
        db.query(HistoriqueIntervention)
        .filter(HistoriqueIntervention.equipment_code == equipment_code)
        .order_by(HistoriqueIntervention.date_declaration.asc())
        .all()
    )
    if not historiques:
        raise ValueError(f"Aucun historique pour le composant {equipment_code}")

    # RBAC : si l'utilisateur n'est pas admin, vérifier que le composant est de son pôle
    if pole_filter:
        pole_compo = historiques[0].action_entity
        if pole_compo != pole_filter:
            raise PermissionError(
                f"Composant hors de votre pôle ({pole_compo} vs {pole_filter})."
            )

    corr_dates = [h.date_declaration for h in historiques if h.type_travail == TypeTravailHistorique.CORR]
    nb_pannes  = len(corr_dates)
    mtbf       = _calc_mtbf(corr_dates[0], corr_dates[-1], nb_pannes) if corr_dates else 30.0

    ref_date = _get_ref_date(db)
    rul_data = _calculate_rul(mtbf, corr_dates[-1] if corr_dates else None, ref_date, equipment_code, nb_pannes)
    crit     = _classifier(rul_data["rul_jours"])

    # Trend : on calcule un RUL "à l'époque" entre chaque intervention CORR
    trend = []
    for i, h in enumerate(historiques):
        if h.type_travail != TypeTravailHistorique.CORR:
            continue
        j_ecoules = (h.date_declaration - corr_dates[i-1]).days if i > 0 else int(mtbf * 0.5)
        rul       = max(0, round(mtbf - j_ecoules))
        trend.append({
            "date"         : str(h.date_declaration),
            "rul_predit"  : rul,
            "rul_reel"    : 0,            # intervention déclenchée
            "intervention": True,
        })

    interventions_passees = [
        {
            "date"        : str(h.date_declaration),
            "type"        : ("CORRECTIF" if h.type_travail == TypeTravailHistorique.CORR else "PREVENTIF"),
            "description" : h.equipment_description or "—",
            "cout"        : round(float(h.cout_total or 0), 2),
        }
        for h in historiques[-10:]   # 10 derniers
    ]

    # Zone & stock
    zone_map  = _build_zone_map(db, [equipment_code])
    zinfo     = zone_map.get(equipment_code, {})
    stock_map = _build_stock_map(db, [zinfo["id_equipement"]] if zinfo.get("id_equipement") else [])
    stk       = stock_map.get(zinfo.get("id_equipement"), {
        "code_stock": None, "designation": None,
        "stock_disponible": 0, "stock_seuil_alerte": 0, "stock_ok": False,
    })

    reco = (
        "⚠️ Intervention immédiate requise. Stock à vérifier avant déplacement."
        if crit == "CRITIQUE" else
        "Planifier intervention sous 7 jours. Préparer pièces de rechange."
        if crit == "ELEVE" else
        "Surveillance accrue. Intégrer au prochain planning hebdomadaire."
        if crit == "MODERE" else
        "État nominal. Aucune action immédiate."
    )

    h0 = historiques[0]
    cout_moyen = round(sum(float(h.cout_total or 0) for h in historiques) / max(len(historiques), 1), 2)

    return {
        "equipment_code"        : equipment_code,
        "description"           : h0.equipment_description or "—",
        "niveau_hierarchie"     : h0.equipment_level or 3,
        "machine"               : h0.system_equipment or zinfo.get("machine", "—"),
        "zone"                  : zinfo.get("zone", "—"),
        "pole"                  : h0.action_entity or "—",
        "rul_jours"             : rul_data["rul_jours"],
        "criticite"             : crit,
        "confiance_pct"         : rul_data["confiance_pct"],
        "date_panne_prevue"     : rul_data["date_panne_prevue"],
        "derniere_intervention" : str(corr_dates[-1]) if corr_dates else None,
        "nb_pannes"             : nb_pannes,
        "mtbf_jours"            : round(mtbf, 1),
        "cout_moyen"            : cout_moyen,
        **stk,
        "trend"                 : trend,
        "interventions_passees" : list(reversed(interventions_passees)),
        "recommandation"        : reco,
    }


# ── Métadonnées filtres ───────────────────────────────────────────────

def get_filtres_meta(db: Session, current_user: dict) -> dict:
    pole_filter = _resolve_pole_filter(db, current_user, None)

    # Pôles : tous pour admin, sinon uniquement le sien
    role = _normalize_role(current_user.get("role"))
    if role == "ADMIN":
        poles_rows = (
            db.query(distinct(HistoriqueIntervention.action_entity))
            .filter(HistoriqueIntervention.action_entity.isnot(None))
            .order_by(HistoriqueIntervention.action_entity)
            .all()
        )
        poles = [r[0] for r in poles_rows if r[0]]
    else:
        poles = [pole_filter] if pole_filter else []

    # Zones et machines : limitées au pôle si non-admin
    q_zone = db.query(distinct(Zone.code_zone)).filter(Zone.code_zone.isnot(None))
    if pole_filter:
        q_zone = q_zone.join(Pole, Zone.id_pole == Pole.id_pole).filter(Pole.nom_pole == pole_filter)
    zones = sorted({r[0] for r in q_zone.all() if r[0]})

    q_machine = db.query(distinct(HistoriqueIntervention.system_equipment)).filter(
        HistoriqueIntervention.system_equipment.isnot(None),
    )
    if pole_filter:
        q_machine = q_machine.filter(HistoriqueIntervention.action_entity == pole_filter)
    machines = sorted({r[0] for r in q_machine.all() if r[0]})

    return {"poles": poles, "zones": zones, "machines": machines}
