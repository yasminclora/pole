"""
routes/predictions.py — VERSION V2 (ML réel + historique + détail composant)
"""

import time
import traceback
from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session

from database import get_db
from core.dependencies import get_current_user, require_roles
from services.ml_inference import (
    run_full_prediction,
    run_monthly_predictions,
    has_active_model,
    get_active_model_info,
    invalidate_cache,
)
from services.prediction_service import (
    get_poles,
    get_stats_globales,
    get_machines_critiques,
    get_composantes_avec_rul,
    get_rul_trend,
    create_ot_predictif,
)
from services.prediction_dashboard import (
    get_dashboard as dashboard_get,
    get_composant_detail,
    get_filtres_meta,
)
from models.prediction_run import (
    PredictionRun, PredictionResultat,
    StatutRun, StatutRUL, SourcePrediction,
)
from models.historique_interventions import HistoriqueIntervention, TypeTravailHistorique
from models.modele_ml import ModeleML
from schemas.prediction_run import (
    PredictionRunRead, PredictionRunSummary,
    PredictionResultatRead, LancerPredictionRequest,
)

router = APIRouter(prefix="/predictions", tags=["Prédictions"])


# ════════════════════════════════════════════════════════════════════════════
#  POST /predictions/run  — Lance la prédiction ML complète
# ════════════════════════════════════════════════════════════════════════════

@router.post("/run")
def lancer_prediction(
    body:         LancerPredictionRequest,
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(require_roles("METHODISTE", "ADMIN")),
):
    """
    Lance le pipeline ML complet :
    1. Charge le modèle actif (GRU ou LSTM selon body.model_type)
    2. Prédit le RUL de tous les composants du comp_mapping
    3. Vérifie le stock pour les composants CRITIQUE/URGENT
    4. Sauvegarde dans prediction_runs + prediction_resultats
    5. Retourne les résultats complets
    """
    # Si model_type fourni, activer ce modèle avant le run
    if body.model_type:
        _activer_modele_par_type(db, body.model_type.upper())
        invalidate_cache()

    if not has_active_model(db):
        raise HTTPException(
            status_code=400,
            detail="Aucun modèle ML actif. Activez un modèle dans Administration > Modèles IA."
        )

    modele_actif = db.query(ModeleML).filter(ModeleML.is_active.is_(True)).first()
    pole_user    = _get_pole_user(current_user, db)
    id_pole_user = _get_id_pole_user(current_user, db)

    # Crée le run en BDD (statut EN_COURS)
    run = PredictionRun(
        id_modele  = modele_actif.id_modele,
        id_user    = current_user["id_user"],
        pole       = pole_user,
        statut     = StatutRun.EN_COURS,
        launched_at= datetime.now(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    start_ms = time.time()

    try:
        # ── Pipeline ML : prédictions MENSUELLES sur les 33 composants test ────
        # Une prédiction tous les 30 jours sur toute la période historique,
        # filtrée par pôle pour les méthodistes.
        prediction_data = run_monthly_predictions(
            db,
            freq_days        = 30,
            test_codes_only  = True,
            pole_filter      = pole_user,
            id_pole_filter   = id_pole_user,    # priorité à la FK
        )
        preds_par_code = prediction_data["predictions_par_composant"]

        # ── Enrichissement + sauvegarde de TOUTES les prédictions ────────────
        dernieres_enrichies = []   # une entrée par composant (la dernière prédiction)
        for code, preds_list in preds_par_code.items():
            info       = _get_composant_info(db, code)
            stock_info = _check_stock(db, code)     # dict ou None
            stock_qty  = stock_info["total_quantite"] if stock_info else None
            alerte_glob = _alerte_stock_from_dict(stock_info)

            for p in preds_list:
                db.add(PredictionResultat(
                    id_run            = run.id_run,
                    ref_date          = date.fromisoformat(p["ref_date"]),
                    equipment_code    = code,
                    equipment_desc    = info.get("description"),
                    system_equipment  = info.get("system_equipment"),
                    pole              = info.get("pole"),
                    zone              = info.get("zone"),
                    comp_level        = info.get("comp_level"),
                    rul_jours         = p["rul_jours"],
                    statut            = StatutRUL(p["statut"]),
                    date_panne_prevue = date.fromisoformat(p["date_panne_prevue"]) if p.get("date_panne_prevue") else None,
                    confiance_pct     = p.get("confiance_pct"),
                    source            = SourcePrediction.ML,
                    stock_disponible  = stock_qty,
                    alerte_stock      = alerte_glob,
                ))

            # Dernière prédiction (la plus récente) pour le live view
            last = preds_list[-1]
            dernieres_enrichies.append({
                **last,
                **info,
                "equipment_code":   code,
                "stock_disponible": stock_qty,
                "alerte_stock":     alerte_glob,
            })

        duree_ms = int((time.time() - start_ms) * 1000)

        # Mise à jour du run (stats = sur les DERNIÈRES prédictions par composant)
        run.statut          = StatutRun.TERMINE
        run.nb_composants   = prediction_data["nb_total"]
        run.nb_critiques    = prediction_data["nb_critiques"]
        run.nb_urgents      = prediction_data["nb_urgents"]
        run.nb_surveillance = prediction_data["nb_surveillance"]
        run.nb_ok           = prediction_data["nb_ok"]
        run.duree_ms        = duree_ms
        run.finished_at     = datetime.now()
        db.commit()

        return {
            "id_run":           run.id_run,
            "statut":           "TERMINE",
            "duree_ms":         duree_ms,
            "nb_composants":    prediction_data["nb_total"],
            "nb_predictions":   prediction_data["nb_predictions_total"],
            "nb_critiques":     prediction_data["nb_critiques"],
            "nb_urgents":       prediction_data["nb_urgents"],
            "nb_surveillance":  prediction_data["nb_surveillance"],
            "nb_ok":            prediction_data["nb_ok"],
            "ref_date_latest":  prediction_data["ref_date_latest"],
            "date_min":         prediction_data["date_min"],
            "date_max":         prediction_data["date_max"],
            "freq_days":        prediction_data["freq_days"],
            "test_codes_source": prediction_data["test_codes_source"],
            "model_info":       prediction_data["model_info"],
            "resultats":        dernieres_enrichies,
            "alertes_stock":    [r for r in dernieres_enrichies if r.get("alerte_stock") in ("FAIBLE", "ABSENT")],
        }

    except Exception as e:
        tb = traceback.format_exc()
        print(f"\n{'='*60}\n[PREDICTION ERROR]\n{tb}\n{'='*60}\n", flush=True)
        run.statut          = StatutRun.ERREUR
        run.erreur_message  = f"{type(e).__name__}: {e}"
        run.finished_at     = datetime.now()
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur prédiction : {type(e).__name__} — {e}",
        )


# ════════════════════════════════════════════════════════════════════════════
#  GET /predictions/historique
# ════════════════════════════════════════════════════════════════════════════

@router.get("/historique", response_model=List[PredictionRunSummary])
def historique_runs(
    limit:        int     = Query(20, ge=1, le=100),
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    """Liste des runs passés (filtrés par pôle pour méthodiste)."""
    q = db.query(PredictionRun).order_by(PredictionRun.launched_at.desc())
    pole = _get_pole_user(current_user, db)
    if pole:
        q = q.filter(PredictionRun.pole == pole)
    return q.limit(limit).all()


# ════════════════════════════════════════════════════════════════════════════
#  GET /predictions/runs/{id_run}
# ════════════════════════════════════════════════════════════════════════════

@router.get("/runs/{id_run}", response_model=PredictionRunRead)
def detail_run(
    id_run:       int,
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    run = db.get(PredictionRun, id_run)
    if not run:
        raise HTTPException(status_code=404, detail="Run introuvable.")
    return run


# ════════════════════════════════════════════════════════════════════════════
#  GET /predictions/composant/{equipment_code}/detail
# ════════════════════════════════════════════════════════════════════════════

@router.get("/composant/{equipment_code}/detail")
def detail_composant(
    equipment_code: str,
    db:             Session = Depends(get_db),
    current_user:   dict    = Depends(get_current_user),
):
    """
    Fiche complète du composant :
    - Infos de base (niveau, machine, pôle)
    - Historique des pannes (CORR)
    - Dernière prédiction RUL
    - KPIs : MTBF, MTTR, nb_pannes, coût total, disponibilité
    - Courbe RUL trend
    - OT associés
    """
    # ── Historique pannes ────────────────────────────────────────────────
    pannes = (
        db.query(HistoriqueIntervention)
        .filter(
            HistoriqueIntervention.equipment_code == equipment_code,
            HistoriqueIntervention.type_travail   == TypeTravailHistorique.CORR,
        )
        .order_by(HistoriqueIntervention.date_declaration.desc())
        .limit(50)
        .all()
    )

    if not pannes:
        raise HTTPException(status_code=404, detail=f"Composant '{equipment_code}' introuvable.")

    ref = pannes[0]

    # ── KPIs ─────────────────────────────────────────────────────────────
    nb_pannes  = len(pannes)
    cout_total = sum(float(p.cout_total or 0) for p in pannes)

    dates = sorted([p.date_declaration for p in pannes if p.date_declaration])
    if len(dates) >= 2:
        mtbf = (dates[-1] - dates[0]).days / (len(dates) - 1)
    else:
        mtbf = None

    durees = [
        (p.date_fin - p.date_declaration).days
        for p in pannes
        if p.date_fin and p.date_declaration and p.date_fin >= p.date_declaration
    ]
    mttr = round(sum(durees) / len(durees), 1) if durees else None

    # ── Dernière prédiction ──────────────────────────────────────────────
    last_pred = (
        db.query(PredictionResultat)
        .filter(PredictionResultat.equipment_code == equipment_code)
        .order_by(PredictionResultat.id_resultat.desc())
        .first()
    )

    # ── RUL trend ────────────────────────────────────────────────────────
    rul_trend = get_rul_trend(db, equipment_code)

    # ── DERNIÈRE prédiction uniquement (volontairement limité : voir spec UX) ─
    # On affiche seulement la prédiction la plus récente pour éviter de
    # noyer l'utilisateur dans des prédictions intermédiaires (potentiellement fausses).
    hist_preds = (
        db.query(PredictionResultat)
        .filter(PredictionResultat.equipment_code == equipment_code)
        .order_by(PredictionResultat.ref_date.desc().nullslast(),
                  PredictionResultat.id_resultat.desc())
        .limit(1)
        .all()
    )

    # ── Stock disponible via les VRAIES relations Equipement→ComposanteStock→PieceStock
    stock_info = _check_stock(db, equipment_code)

    # ── Machine racine via Equipement.id_machine_racine (fallback historique) ────
    machine_racine_eq = _get_machine_racine(db, equipment_code)
    if machine_racine_eq:
        machine_racine = {
            "system_equipment":   machine_racine_eq["description"] or ref.system_equipment or "—",
            "racine_code":        machine_racine_eq["code"],
            "racine_description": machine_racine_eq["description"],
            "racine_level":       machine_racine_eq["level"],
            "parent_code":        machine_racine_eq["parent"]["code"]        if machine_racine_eq["parent"] else None,
            "parent_description": machine_racine_eq["parent"]["description"] if machine_racine_eq["parent"] else None,
            "parent_level":       machine_racine_eq["parent"]["level"]       if machine_racine_eq["parent"] else None,
            "action_entity":      ref.action_entity or "—",
        }
    else:
        machine_racine = {
            "system_equipment":   ref.system_equipment or "—",
            "racine_code":        None,
            "racine_description": None,
            "racine_level":       None,
            "parent_code":        ref.parent_code,
            "parent_level":       ref.parent_level,
            "parent_description": None,
            "action_entity":      ref.action_entity or "—",
        }
        if ref.parent_code:
            parent_row = (
                db.query(HistoriqueIntervention.equipment_description)
                .filter(HistoriqueIntervention.equipment_code == ref.parent_code)
                .first()
            )
            machine_racine["parent_description"] = parent_row[0] if parent_row else None

    return {
        "equipment_code":   equipment_code,
        "description":      ref.equipment_description or "—",
        "system_equipment": ref.system_equipment or "—",
        "pole":             ref.action_entity or "—",
        "comp_level":       ref.equipment_level,
        "machine_racine":   machine_racine,
        "stock":            stock_info,
        "kpis": {
            "nb_pannes":    nb_pannes,
            "cout_total":   round(cout_total, 2),
            "mtbf_jours":   round(mtbf, 1) if mtbf else None,
            "mttr_jours":   mttr,
            "disponibilite": round((1 - (mttr or 0) / (mtbf or 1)) * 100, 1) if mtbf else None,
        },
        "derniere_prediction": {
            "rul_jours":         last_pred.rul_jours         if last_pred else None,
            "statut":            (last_pred.statut.value if hasattr(last_pred.statut, "value") else last_pred.statut) if last_pred else None,
            "date_panne_prevue": str(last_pred.date_panne_prevue) if last_pred and last_pred.date_panne_prevue else None,
            "ref_date":          str(last_pred.ref_date) if last_pred and last_pred.ref_date else None,
            "confiance_pct":     last_pred.confiance_pct     if last_pred else None,
        },
        "historique_pannes": [
            {
                "date_declaration": str(p.date_declaration),
                "date_fin":         str(p.date_fin) if p.date_fin else None,
                "cout":             float(p.cout_total or 0),
                "source":           p.source,
            }
            for p in pannes
        ],
        "historique_predictions": [
            {
                "ref_date":          str(p.ref_date) if p.ref_date else None,
                "rul_jours":         p.rul_jours,
                "statut":            p.statut.value if hasattr(p.statut, "value") else p.statut,
                "date_panne_prevue": str(p.date_panne_prevue) if p.date_panne_prevue else None,
                "confiance_pct":     p.confiance_pct,
                "alerte_stock":      p.alerte_stock,
            }
            for p in hist_preds
        ],
        "rul_trend": rul_trend,
    }


# ════════════════════════════════════════════════════════════════════════════
#  GET /predictions/modele-actif
# ════════════════════════════════════════════════════════════════════════════

@router.get("/modele-actif")
def get_modele_actif(
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    info = get_active_model_info(db)
    if not info:
        return {"actif": False}
    return {"actif": True, **info}


# ════════════════════════════════════════════════════════════════════════════
#  GET /predictions/comparaison-modeles
#  Compare le dernier run LSTM avec le dernier run GRU pour le pôle de l'utilisateur
# ════════════════════════════════════════════════════════════════════════════

@router.get("/comparaison-modeles")
def comparaison_modeles(
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    """
    Retourne la comparaison entre le dernier run LSTM et le dernier run GRU
    pour le pôle de l'utilisateur (tous les pôles si ADMIN).

    Pour chaque composant test, on prend la prédiction la plus récente
    (max ref_date) de chaque run et on les met en regard.
    """
    from models.modele_ml import ModeleML, TypeModeleEnum
    from sqlalchemy.orm import aliased
    from sqlalchemy import and_

    pole_user = _get_pole_user(current_user, db)

    def _last_run_for_type(type_modele: TypeModeleEnum):
        q = (
            db.query(PredictionRun)
            .join(ModeleML, ModeleML.id_modele == PredictionRun.id_modele)
            .filter(
                ModeleML.type_modele == type_modele,
                PredictionRun.statut == StatutRun.TERMINE,
            )
        )
        if pole_user:
            q = q.filter(PredictionRun.pole == pole_user)
        return q.order_by(PredictionRun.launched_at.desc()).first()

    run_lstm = _last_run_for_type(TypeModeleEnum.LSTM)
    run_gru  = _last_run_for_type(TypeModeleEnum.GRU)

    def _serialize_run(r):
        if not r: return None
        return {
            "id_run":          r.id_run,
            "id_modele":       r.id_modele,
            "launched_at":     r.launched_at.isoformat() if r.launched_at else None,
            "duree_ms":        r.duree_ms,
            "nb_composants":   r.nb_composants,
            "nb_critiques":    r.nb_critiques,
            "nb_urgents":      r.nb_urgents,
            "nb_surveillance": r.nb_surveillance,
            "nb_ok":           r.nb_ok,
        }

    if not run_lstm and not run_gru:
        return {
            "lstm_run":     None,
            "gru_run":      None,
            "comparaison": [],
            "stats":       None,
            "message":     "Aucun run terminé pour ce pôle. Lancez d'abord une prédiction LSTM et une prédiction GRU.",
        }

    def _latest_per_component(id_run: int) -> dict:
        """Retourne { equipment_code: PredictionResultat }, prend la max ref_date par composant."""
        if not id_run:
            return {}
        sub = (
            db.query(
                PredictionResultat.equipment_code,
                func.max(PredictionResultat.ref_date).label("max_ref"),
            )
            .filter(PredictionResultat.id_run == id_run)
            .group_by(PredictionResultat.equipment_code)
            .subquery()
        )
        rows = (
            db.query(PredictionResultat)
            .join(sub, and_(
                PredictionResultat.equipment_code == sub.c.equipment_code,
                (PredictionResultat.ref_date == sub.c.max_ref) |
                (sub.c.max_ref.is_(None) & PredictionResultat.ref_date.is_(None)),
            ))
            .filter(PredictionResultat.id_run == id_run)
            .all()
        )
        # Dédoublonner par equipment_code (au cas où plusieurs lignes avec même ref_date)
        out: dict = {}
        for r in rows:
            out.setdefault(r.equipment_code, r)
        return out

    lstm_preds = _latest_per_component(run_lstm.id_run) if run_lstm else {}
    gru_preds  = _latest_per_component(run_gru.id_run)  if run_gru  else {}

    all_codes = sorted(set(lstm_preds.keys()) | set(gru_preds.keys()))

    def _statut_to_str(s):
        return s.value if hasattr(s, "value") else s

    comparaison = []
    for code in all_codes:
        pl = lstm_preds.get(code)
        pg = gru_preds.get(code)

        info = pl or pg  # pour les méta-données (equipment_desc, etc.)
        ecart = None
        meme_statut = None
        plus_critique = None
        if pl and pg:
            ecart       = abs(pl.rul_jours - pg.rul_jours)
            meme_statut = _statut_to_str(pl.statut) == _statut_to_str(pg.statut)
            if pl.rul_jours < pg.rul_jours:    plus_critique = "LSTM"
            elif pg.rul_jours < pl.rul_jours:  plus_critique = "GRU"
            else:                              plus_critique = "EGAL"

        comparaison.append({
            "equipment_code":   code,
            "equipment_desc":   info.equipment_desc if info else None,
            "system_equipment": info.system_equipment if info else None,
            "pole":             info.pole if info else None,
            "zone":             info.zone if info else None,
            "lstm": {
                "rul_jours":         pl.rul_jours                            if pl else None,
                "statut":            _statut_to_str(pl.statut)               if pl else None,
                "date_panne_prevue": pl.date_panne_prevue.isoformat()        if pl and pl.date_panne_prevue else None,
                "confiance_pct":     pl.confiance_pct                        if pl else None,
                "ref_date":          pl.ref_date.isoformat()                 if pl and pl.ref_date else None,
            } if pl else None,
            "gru": {
                "rul_jours":         pg.rul_jours                            if pg else None,
                "statut":            _statut_to_str(pg.statut)               if pg else None,
                "date_panne_prevue": pg.date_panne_prevue.isoformat()        if pg and pg.date_panne_prevue else None,
                "confiance_pct":     pg.confiance_pct                        if pg else None,
                "ref_date":          pg.ref_date.isoformat()                 if pg and pg.ref_date else None,
            } if pg else None,
            "ecart_rul":     ecart,
            "meme_statut":   meme_statut,
            "plus_critique": plus_critique,
        })

    # Stats globales
    paires_complets = [c for c in comparaison if c["lstm"] and c["gru"]]
    nb_pairs        = len(paires_complets)
    if nb_pairs:
        ecart_moyen      = round(sum(c["ecart_rul"] for c in paires_complets) / nb_pairs, 2)
        nb_meme_statut   = sum(1 for c in paires_complets if c["meme_statut"])
        taux_accord_pct  = round(nb_meme_statut / nb_pairs * 100, 1)
        nb_lstm_critique = sum(1 for c in paires_complets if c["plus_critique"] == "LSTM")
        nb_gru_critique  = sum(1 for c in paires_complets if c["plus_critique"] == "GRU")
        nb_egal          = sum(1 for c in paires_complets if c["plus_critique"] == "EGAL")
    else:
        ecart_moyen = None
        nb_meme_statut = None
        taux_accord_pct = None
        nb_lstm_critique = nb_gru_critique = nb_egal = 0

    return {
        "lstm_run":     _serialize_run(run_lstm),
        "gru_run":      _serialize_run(run_gru),
        "pole_filtre":  pole_user,
        "nb_composants_communs": nb_pairs,
        "nb_lstm_seul":          sum(1 for c in comparaison if c["lstm"] and not c["gru"]),
        "nb_gru_seul":           sum(1 for c in comparaison if c["gru"] and not c["lstm"]),
        "comparaison": comparaison,
        "stats": {
            "ecart_moyen_rul":   ecart_moyen,
            "nb_meme_statut":    nb_meme_statut,
            "taux_accord_pct":   taux_accord_pct,
            "nb_lstm_plus_critique": nb_lstm_critique,
            "nb_gru_plus_critique":  nb_gru_critique,
            "nb_egal":               nb_egal,
        },
    }


# ════════════════════════════════════════════════════════════════════════════
#  Routes existantes conservées
# ════════════════════════════════════════════════════════════════════════════

@router.get("/poles")
def route_poles(db: Session = Depends(get_db)):
    return get_poles(db)


@router.get("/stats")
def route_stats(
    pole: Optional[str] = Query(None),
    db:   Session       = Depends(get_db),
):
    return get_stats_globales(db, pole=pole or None)


@router.get("/machines-critiques")
def route_machines_critiques(
    pole:  Optional[str] = Query(None),
    limit: int           = Query(6, ge=1, le=20),
    db:    Session       = Depends(get_db),
):
    return get_machines_critiques(db, pole=pole or None, limit=limit)


@router.get("/composantes")
def route_composantes(
    pole:    Optional[str] = Query(None),
    search:  Optional[str] = Query(None),
    rul_max: Optional[int] = Query(None),
    model:   str           = Query("AUTO"),
    db:      Session       = Depends(get_db),
):
    return get_composantes_avec_rul(
        db, pole=pole or None, search=search or None,
        rul_max=rul_max, model=model,
    )


@router.get("/rul-trend/{equipment_code}")
def route_rul_trend(equipment_code: str, db: Session = Depends(get_db)):
    return get_rul_trend(db, equipment_code=equipment_code)


@router.post("/composant/{equipment_code}/generer-ot")
def route_generer_ot(
    equipment_code: str,
    data:           dict,
    db:             Session = Depends(get_db),
    current_user:   dict    = Depends(require_roles("METHODISTE", "ADMIN")),
):
    payload = {**data, "equipment_code": equipment_code, "id_methodiste": current_user["id_user"]}
    try:
        return create_ot_predictif(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur création OT : {e}")


@router.get("/dashboard")
def route_dashboard(
    pole:        Optional[str]  = Query(None),
    zone:        Optional[str]  = Query(None),
    machine:     Optional[str]  = Query(None),
    criticite:   Optional[str]  = Query(None),
    search:      Optional[str]  = Query(None),
    date_from:   Optional[date] = Query(None),
    date_to:     Optional[date] = Query(None),
    db:          Session        = Depends(get_db),
    current_user: dict          = Depends(get_current_user),
):
    try:
        return dashboard_get(
            db, current_user,
            pole=pole, zone=zone, machine=machine,
            criticite=criticite, search=search,
            date_from=date_from, date_to=date_to,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/filtres-meta")
def route_filtres_meta(
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    try:
        return get_filtres_meta(db, current_user)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ════════════════════════════════════════════════════════════════════════════
#  Helpers privés
# ════════════════════════════════════════════════════════════════════════════

def _activer_modele_par_type(db: Session, model_type: str):
    """Active le dernier modèle uploadé du type demandé."""
    modele = (
        db.query(ModeleML)
        .filter(ModeleML.type_modele == model_type)
        .order_by(ModeleML.uploaded_at.desc())
        .first()
    )
    if not modele:
        raise HTTPException(status_code=404, detail=f"Aucun modèle de type {model_type} trouvé.")
    # Désactive l'actif courant
    db.query(ModeleML).filter(ModeleML.is_active.is_(True)).update({"is_active": False})
    modele.is_active = True
    db.commit()


def _get_pole_user(current_user: dict, db: Session) -> Optional[str]:
    """Retourne le nom_pole du méthodiste connecté, None pour ADMIN."""
    if current_user.get("role") == "ADMIN":
        return None
    from models.pole import Pole
    from models.user import Utilisateur
    user = db.get(Utilisateur, current_user["id_user"])
    if user and user.id_pole:
        pole = db.get(Pole, user.id_pole)
        return pole.nom_pole if pole else None
    return None


def _get_id_pole_user(current_user: dict, db: Session) -> Optional[int]:
    """Retourne l'id_pole du méthodiste connecté, None pour ADMIN."""
    if current_user.get("role") == "ADMIN":
        return None
    from models.user import Utilisateur
    user = db.get(Utilisateur, current_user["id_user"])
    return user.id_pole if user and user.id_pole else None


def _get_pole_composant(db: Session, equipment_code: str) -> Optional[str]:
    row = (
        db.query(HistoriqueIntervention.action_entity)
        .filter(HistoriqueIntervention.equipment_code == equipment_code)
        .first()
    )
    return row[0] if row else None


def _get_composant_info(db: Session, equipment_code: str) -> dict:
    """
    Récupère les infos d'un composant avec ENRICHISSEMENT via Equipement (pour zone).
    Fallback sur HistoriqueIntervention.
    """
    row = (
        db.query(
            HistoriqueIntervention.equipment_description,
            HistoriqueIntervention.system_equipment,
            HistoriqueIntervention.action_entity,
            HistoriqueIntervention.equipment_level,
        )
        .filter(HistoriqueIntervention.equipment_code == equipment_code)
        .first()
    )

    info: dict = {}
    if row:
        info = {
            "description":     row.equipment_description or "—",
            "system_equipment":row.system_equipment or "—",
            "pole":            row.action_entity or "—",
            "comp_level":      row.equipment_level,
            "zone":            None,
        }

    # Enrichissement zone depuis Equipement
    try:
        from models.equipement import Equipement
        from models.zone       import Zone
        equip = (
            db.query(Equipement)
            .filter(Equipement.equipment_code == equipment_code)
            .first()
        )
        if equip and equip.id_zone:
            zone = db.get(Zone, equip.id_zone)
            if zone:
                info["zone"] = zone.nom_zone
    except Exception:
        pass

    return info


def _check_stock(db: Session, equipment_code: str) -> Optional[dict]:
    """
    Vérifie le stock via les VRAIES relations :
        Equipement(equipment_code) → ComposanteStock(id_equipement) → PieceStock

    Retourne :
    {
        "total_pieces":    int,                    # nb pièces différentes liées
        "total_quantite":  int,                    # somme des quantités
        "alerte_globale":  "OK" | "FAIBLE" | "ABSENT",
        "disponible":      bool,                   # True si au moins 1 pièce dispo
        "pieces": [
            {code_stock, designation, quantite, seuil_alerte, alerte, emplacement, unite, quantite_type},
            ...
        ]
    }
    Ou None si l'équipement n'existe pas dans Equipement (pas géré au stock).
    """
    try:
        from models.equipement import Equipement
        from models.stock      import ComposanteStock

        equip = (
            db.query(Equipement)
            .filter(Equipement.equipment_code == equipment_code)
            .first()
        )
        if not equip:
            return None

        composantes = (
            db.query(ComposanteStock)
            .filter(ComposanteStock.id_equipement == equip.id_equipement)
            .all()
        )

        if not composantes:
            # Équipement présent mais aucune pièce liée → stock absent
            return {
                "total_pieces":   0,
                "total_quantite": 0,
                "alerte_globale": "ABSENT",
                "disponible":     False,
                "pieces":         [],
            }

        pieces_list = []
        total_q     = 0
        has_absent  = False
        has_faible  = False
        for cs in composantes:
            piece = cs.piece
            if piece is None:
                continue
            if piece.quantite == 0:
                alerte = "ABSENT"; has_absent = True
            elif piece.quantite <= (piece.seuil_alerte or 0):
                alerte = "FAIBLE"; has_faible = True
            else:
                alerte = "OK"
            total_q += int(piece.quantite or 0)
            pieces_list.append({
                "code_stock":     piece.code_stock,
                "designation":    piece.designation,
                "quantite":       int(piece.quantite or 0),
                "seuil_alerte":   int(piece.seuil_alerte or 0),
                "alerte":         alerte,
                "emplacement":    piece.emplacement,
                "unite":          piece.unite,
                "quantite_type":  int(cs.quantite_type or 1),
            })

        if not pieces_list:
            return {
                "total_pieces":   0,
                "total_quantite": 0,
                "alerte_globale": "ABSENT",
                "disponible":     False,
                "pieces":         [],
            }

        alerte_glob = "ABSENT" if has_absent else ("FAIBLE" if has_faible else "OK")
        return {
            "total_pieces":   len(pieces_list),
            "total_quantite": total_q,
            "alerte_globale": alerte_glob,
            "disponible":     total_q > 0,
            "pieces":         pieces_list,
        }
    except Exception:
        return None


def _alerte_stock_from_dict(stock_info: Optional[dict]) -> Optional[str]:
    """Pour stocker dans PredictionResultat.alerte_stock (string court)."""
    if not stock_info:
        return None
    return stock_info.get("alerte_globale")


def _get_machine_racine(db: Session, equipment_code: str) -> Optional[dict]:
    """
    Retourne les infos de la machine racine via Equipement.id_machine_racine.
    Fallback sur HistoriqueIntervention.system_equipment si pas dans Equipement.
    """
    try:
        from models.equipement import Equipement
        equip = (
            db.query(Equipement)
            .filter(Equipement.equipment_code == equipment_code)
            .first()
        )
        if equip:
            racine = equip
            if equip.id_machine_racine and equip.id_machine_racine != equip.id_equipement:
                r = db.get(Equipement, equip.id_machine_racine)
                if r:
                    racine = r

            parent = None
            if equip.id_parent:
                parent_eq = db.get(Equipement, equip.id_parent)
                if parent_eq:
                    parent = {
                        "code":        parent_eq.equipment_code,
                        "description": parent_eq.description,
                        "level":       parent_eq.hierarchy_level,
                    }

            return {
                "code":        racine.equipment_code,
                "description": racine.description,
                "level":       racine.hierarchy_level,
                "parent":      parent,
            }
    except Exception:
        pass
    return None
