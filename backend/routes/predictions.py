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
    run_predictions_test_set,
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
    current_user: dict    = Depends(require_roles("METHODISTE")),
):
    """
    Pipeline ML : 1 prédiction / composant test (33), model_type OBLIGATOIRE.
    """
    # ── 1. Validation model_type ──────────────────────────────────────────
    if not body.model_type:
        raise HTTPException(400, detail="Vous devez choisir un modèle : 'LSTM' ou 'GRU'.")
    model_type = body.model_type.upper()
    if model_type not in ("LSTM", "GRU"):
        raise HTTPException(400, detail=f"Type invalide : '{body.model_type}'. Utilisez 'LSTM' ou 'GRU'.")

    # ── 2. Activation modèle de ce type ───────────────────────────────────
    try:
        _activer_modele_par_type(db, model_type)
        invalidate_cache()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Impossible d'activer le modèle {model_type} : {e}")

    modele_actif = db.query(ModeleML).filter(ModeleML.is_active.is_(True)).first()
    pole_user    = _get_pole_user(current_user, db)
    id_pole_user = _get_id_pole_user(current_user, db) if "_get_id_pole_user" in globals() else None

    run = PredictionRun(
        id_modele   = modele_actif.id_modele,
        id_user     = current_user["id_user"],
        pole        = pole_user,
        statut      = StatutRun.EN_COURS,
        launched_at = datetime.now(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    start_ms = time.time()

    try:
        # ── 3. Pipeline ML : 1 pred par composant test ────────────────────
        prediction_data = run_predictions_test_set(
            db,
            model_type     = model_type,
            pole_filter    = pole_user,
            id_pole_filter = id_pole_user,
            scope          = "test",
        )

        # Rollback défensif : repartir d'une transaction propre après le pipeline ML
        # (run_predictions_test_set fait des SELECTs qui peuvent laisser un état douteux)
        try:
            db.rollback()
        except Exception:
            pass

        # ── 4. Préchargement OTs prédictifs (1 requête) ───────────────────
        from models.ot import OrdreTravail, TypeOT
        from models.equipement import Equipement
        codes_run = [pred["equipment_code"] for pred in prediction_data["resultats"]]
        eq_map = {
            eq.equipment_code: eq.id_equipement
            for eq in db.query(Equipement).filter(Equipement.equipment_code.in_(codes_run)).all()
        }
        ots_by_id_eq: dict[int, list] = {}
        if eq_map:
            ot_rows = (
                db.query(OrdreTravail)
                .filter(
                    OrdreTravail.id_equipement.in_(list(eq_map.values())),
                    OrdreTravail.type_ot == TypeOT.PREDICTIF,
                )
                .order_by(OrdreTravail.created_at.desc())
                .all()
            )
            for ot in ot_rows:
                ots_by_id_eq.setdefault(ot.id_equipement, []).append(ot)

        # ── 5. PASS 1 : enrichir TOUS les résultats (SELECTs seulement, pas d'INSERT) ──
        # On construit la donnée à retourner au frontend EN PREMIER.
        # Le tableau s'affichera même si les INSERT en BDD échouent.
        resultats_enrichis = []
        rows_to_insert    = []   # rangées à insérer en BDD au second passage

        for pred in prediction_data["resultats"]:
            code        = pred["equipment_code"]
            info        = _get_composant_info(db, code)
            stock_info  = _check_stock(db, code)
            stock_qty   = stock_info["total_quantite"] if stock_info else None
            alerte_glob = _alerte_stock_from_dict(stock_info)

            ref_d = date.fromisoformat(pred["ref_date_used"]) if pred.get("ref_date_used") else None
            dpp   = date.fromisoformat(pred["date_panne_prevue"]) if pred.get("date_panne_prevue") else None

            # Tronquer pour respecter limites varchar
            desc_str = (info.get("description") or None)
            if desc_str and len(desc_str) > 255:  desc_str = desc_str[:255]
            sys_str  = (info.get("system_equipment") or None)
            if sys_str and len(sys_str) > 100:    sys_str  = sys_str[:100]
            pole_str = (info.get("pole") or None)
            if pole_str and len(pole_str) > 100:  pole_str = pole_str[:100]
            zone_str = (info.get("zone") or None)
            if zone_str and len(zone_str) > 200:  zone_str = zone_str[:200]

            # OT prédictif existant : si UN OT prédictif existe pour ce composant → considéré comme créé
            ot_existant_match = None
            id_eq = eq_map.get(code)
            if id_eq and id_eq in ots_by_id_eq and ots_by_id_eq[id_eq]:
                ot = ots_by_id_eq[id_eq][0]   # le plus récent (déjà trié desc)
                ot_existant_match = {
                    "id_ot":       ot.id_ot,
                    "numero_ot":   ot.numero_ot,
                    "statut":      ot.statut.value if hasattr(ot.statut, "value") else str(ot.statut),
                    "date_prevue": str(ot.date_prevue.date()) if ot.date_prevue else None,
                }

            resultats_enrichis.append({
                **pred,
                **info,
                "equipment_code":        code,
                "stock":                 stock_info,
                "stock_disponible":      stock_qty,
                "alerte_stock":          alerte_glob,
                "ot_predictif_existant": ot_existant_match,
            })

            rows_to_insert.append({
                "id_run":            run.id_run,
                "ref_date":          ref_d,
                "equipment_code":    code,
                "equipment_desc":    desc_str,
                "system_equipment":  sys_str,
                "pole":              pole_str,
                "zone":              zone_str,
                "comp_level":        pred.get("comp_level") or info.get("comp_level"),
                "rul_jours":         pred["rul_jours"],
                "statut":            StatutRUL(pred["statut"]),
                "date_panne_prevue": dpp,
                "confiance_pct":     pred.get("confiance_pct"),
                "source":            SourcePrediction.ML,
                "stock_disponible":  stock_qty,
                "alerte_stock":      alerte_glob,
            })

        # ── PASS 2 : insérer en BDD (séparé des SELECTs pour éviter autoflush bug) ──
        nb_save_errors = 0
        for row_data in rows_to_insert:
            try:
                db.add(PredictionResultat(**row_data))
                db.commit()
            except Exception as iter_err:
                db.rollback()
                nb_save_errors += 1
                print(f"[SAVE ERROR] {row_data['equipment_code']}: {type(iter_err).__name__}: {iter_err}", flush=True)

        duree_ms = int((time.time() - start_ms) * 1000)

        # Refetch run après les commits intermédiaires
        run = db.get(PredictionRun, run.id_run)
        run.statut          = StatutRun.TERMINE
        run.nb_composants   = prediction_data["nb_total"]
        run.nb_critiques    = prediction_data["nb_critiques"]
        run.nb_urgents      = prediction_data["nb_urgents"]
        run.nb_surveillance = 0
        run.nb_ok           = prediction_data["nb_ok"]
        run.duree_ms        = duree_ms
        run.finished_at     = datetime.now()
        db.commit()

        return {
            "id_run":             run.id_run,
            "statut":             "TERMINE",
            "duree_ms":           duree_ms,
            "model_type":         model_type,
            "model_version":      modele_actif.version,
            "metrics":            prediction_data["metrics"],
            "nb_composants":      prediction_data["nb_total"],
            "nb_sans_prediction": prediction_data["nb_sans_prediction"],
            "nb_critiques":       prediction_data["nb_critiques"],
            "nb_urgents":         prediction_data["nb_urgents"],
            "nb_ok":              prediction_data["nb_ok"],
            "ref_date_global":    prediction_data["ref_date_global"],
            "scope":              prediction_data["scope"],
            "resultats":          resultats_enrichis,
            "alertes_stock":      [r for r in resultats_enrichis if r.get("alerte_stock") in ("FAIBLE", "ABSENT")],
        }

    except Exception as e:
        tb = traceback.format_exc()
        print(f"\n{'='*60}\n[PREDICTION ERROR]\n{tb}\n{'='*60}\n", flush=True)
        try:
            db.rollback()
            run = db.get(PredictionRun, run.id_run)
            if run:
                run.statut         = StatutRun.ERREUR
                run.erreur_message = f"{type(e).__name__}: {e}"
                run.finished_at    = datetime.now()
                db.commit()
        except Exception:
            pass
        raise HTTPException(500, detail=f"Erreur prédiction : {type(e).__name__} — {e}")


# ════════════════════════════════════════════════════════════════════════════
#  GET /predictions/historique
# ════════════════════════════════════════════════════════════════════════════

@router.get("/historique")
def historique_runs(
    limit:        int     = Query(50, ge=1, le=200),
    model_type:   Optional[str] = Query(None, description="LSTM, GRU ou None"),
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    """
    Liste des runs passés enrichis avec :
      - model_type (LSTM/GRU)
      - model_version
      - filtrage par pôle (METHODISTE) et par type modèle
    """
    q = (
        db.query(PredictionRun, ModeleML)
        .join(ModeleML, ModeleML.id_modele == PredictionRun.id_modele)
        .order_by(PredictionRun.launched_at.desc())
    )

    pole = _get_pole_user(current_user, db)
    if pole:
        q = q.filter(PredictionRun.pole == pole)
    if model_type and model_type.upper() in ("LSTM", "GRU"):
        q = q.filter(ModeleML.type_modele == model_type.upper())

    rows = q.limit(limit).all()

    # Mapping nom_pole → code_pole (pour afficher le CODE)
    from models.pole import Pole
    pole_codes = {p.nom_pole: p.code_pole for p in db.query(Pole).all() if p.code_pole}

    result = []
    for run, modele in rows:
        result.append({
            "id_run":          run.id_run,
            "id_modele":       run.id_modele,
            "model_type":      modele.type_modele.value if hasattr(modele.type_modele, "value") else str(modele.type_modele),
            "model_version":   modele.version,
            "pole":            run.pole,
            "pole_code":       pole_codes.get(run.pole, run.pole),
            "statut":          run.statut.value if hasattr(run.statut, "value") else str(run.statut),
            "nb_composants":   run.nb_composants,
            "nb_critiques":    run.nb_critiques,
            "nb_urgents":      run.nb_urgents,
            "nb_surveillance": run.nb_surveillance,
            "nb_ok":           run.nb_ok,
            "duree_ms":        run.duree_ms,
            "launched_at":     run.launched_at.isoformat() if run.launched_at else None,
            "finished_at":     run.finished_at.isoformat() if run.finished_at else None,
        })
    return result


# ════════════════════════════════════════════════════════════════════════════
#  GET /predictions/runs/{id_run}
# ════════════════════════════════════════════════════════════════════════════

@router.get("/runs/{id_run}")
def detail_run(
    id_run:       int,
    db:           Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    """
    Détail d'un run enrichi à la volée :
      - infos modèle (type, version)
      - pour chaque resultat : zone (depuis Equipement), ot_predictif_existant
    """
    from models.equipement import Equipement
    from models.zone        import Zone
    from models.ot          import OrdreTravail, TypeOT
    from models.pole        import Pole

    run = db.get(PredictionRun, id_run)
    if not run:
        raise HTTPException(status_code=404, detail="Run introuvable.")

    modele = db.get(ModeleML, run.id_modele)

    # Mapping pole nom → code
    pole_codes = {p.nom_pole: p.code_pole for p in db.query(Pole).all() if p.code_pole}

    # Codes uniques du run
    codes = list({r.equipment_code for r in run.resultats if r.equipment_code})

    # Zone code par equipment_code
    code_to_zone: dict[str, str] = {}
    if codes:
        rows = (
            db.query(Equipement.equipment_code, Zone.code_zone)
            .join(Zone, Zone.id_zone == Equipement.id_zone)
            .filter(Equipement.equipment_code.in_(codes))
            .all()
        )
        code_to_zone = {ec: cz for ec, cz in rows if cz}

    # OTs prédictifs par equipment_code (1 requête pour tous)
    ots_par_code: dict[str, dict] = {}
    if codes:
        eq_rows = (
            db.query(Equipement.id_equipement, Equipement.equipment_code)
            .filter(Equipement.equipment_code.in_(codes))
            .all()
        )
        id_to_code = {eid: c for eid, c in eq_rows}
        if id_to_code:
            ot_rows = (
                db.query(OrdreTravail)
                .filter(
                    OrdreTravail.id_equipement.in_(list(id_to_code.keys())),
                    OrdreTravail.type_ot == TypeOT.PREDICTIF,
                )
                .order_by(OrdreTravail.created_at.desc())
                .all()
            )
            for ot in ot_rows:
                code = id_to_code.get(ot.id_equipement)
                if not code or code in ots_par_code:
                    continue   # on garde le plus récent uniquement (1er rencontré)
                ots_par_code[code] = {
                    "id_ot":       ot.id_ot,
                    "numero_ot":   ot.numero_ot,
                    "statut":      ot.statut.value if hasattr(ot.statut, "value") else str(ot.statut),
                    "date_prevue": str(ot.date_prevue.date()) if ot.date_prevue else None,
                }

    resultats = []
    for r in run.resultats:
        zone_eff = code_to_zone.get(r.equipment_code) or r.zone
        resultats.append({
            "id_resultat":       r.id_resultat,
            "ref_date":          str(r.ref_date) if r.ref_date else None,
            "derniere_panne":    str(r.ref_date) if r.ref_date else None,   # = ref_date pour le frontend
            "equipment_code":    r.equipment_code,
            "equipment_desc":    r.equipment_desc,
            "system_equipment":  r.system_equipment,
            "pole":              r.pole,
            "zone":              zone_eff,
            "comp_level":        r.comp_level,
            "rul_jours":         r.rul_jours,
            "statut":            r.statut.value if hasattr(r.statut, "value") else str(r.statut),
            "date_panne_prevue": str(r.date_panne_prevue) if r.date_panne_prevue else None,
            "confiance_pct":     r.confiance_pct,
            "source":            r.source.value if hasattr(r.source, "value") else str(r.source),
            "stock_disponible":  r.stock_disponible,
            "alerte_stock":      r.alerte_stock,
            "ot_predictif_existant": ots_par_code.get(r.equipment_code),
        })

    return {
        "id_run":          run.id_run,
        "id_modele":       run.id_modele,
        "model_type":      modele.type_modele.value if (modele and hasattr(modele.type_modele, "value")) else (str(modele.type_modele) if modele else None),
        "model_version":   modele.version if modele else None,
        "pole":            run.pole,
        "pole_code":       pole_codes.get(run.pole, run.pole),
        "statut":          run.statut.value if hasattr(run.statut, "value") else str(run.statut),
        "nb_composants":   run.nb_composants,
        "nb_critiques":    run.nb_critiques,
        "nb_urgents":      run.nb_urgents,
        "nb_surveillance": run.nb_surveillance,
        "nb_ok":           run.nb_ok,
        "duree_ms":        run.duree_ms,
        "launched_at":     run.launched_at.isoformat() if run.launched_at else None,
        "finished_at":     run.finished_at.isoformat() if run.finished_at else None,
        "resultats":       resultats,
    }


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

    # ── Prédictions historiques DÉDUPLIQUÉES par (date_panne_prevue, rul_jours) ──
    all_hist_preds = (
        db.query(PredictionResultat)
        .filter(PredictionResultat.equipment_code == equipment_code)
        .order_by(PredictionResultat.id_resultat.desc())
        .all()
    )
    seen_keys = set()
    hist_preds = []
    for p in all_hist_preds:
        st = p.statut.value if hasattr(p.statut, "value") else str(p.statut)
        key = (p.date_panne_prevue.isoformat() if p.date_panne_prevue else None, p.rul_jours, st)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        hist_preds.append(p)

    # ── Stock disponible via les VRAIES relations Equipement→ComposanteStock→PieceStock
    stock_info = _check_stock(db, equipment_code)

    # ── Hiérarchie complète via Equipement.id_parent récursif ───────────
    hierarchie = _get_hierarchie_complete(db, equipment_code)

    # ── Zone code via Equipement → Zone ─────────────────────────────────
    zone_code = None
    try:
        from models.equipement import Equipement
        from models.zone        import Zone
        eq = db.query(Equipement).filter(Equipement.equipment_code == equipment_code).first()
        if eq and eq.id_zone:
            z = db.get(Zone, eq.id_zone)
            if z:
                zone_code = z.code_zone
    except Exception:
        try: db.rollback()
        except Exception: pass

    # ── OTs prédictifs + correctifs pour ce composant ───────────────────
    ots_predictifs = _get_ots_predictifs(db, equipment_code)
    ots_correctifs = _get_ots_correctifs(db, equipment_code)

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
        "zone_code":        zone_code,
        "comp_level":       ref.equipment_level,
        "machine_racine":   machine_racine,
        "hierarchie":       hierarchie,
        "ots_predictifs":   ots_predictifs,
        "ots_correctifs":   ots_correctifs,
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
            "derniere_panne":    str(last_pred.ref_date) if last_pred and last_pred.ref_date else None,   # = ref_date (= dernière panne du composant)
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

    # Enrichissement zone depuis Equipement — DOIT rollback en cas d'erreur
    # sinon la transaction PostgreSQL reste cassée pour tout le reste de la requête.
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
                info["zone"] = zone.code_zone
    except Exception:
        # CRITIQUE : rollback obligatoire sinon InFailedSqlTransaction cascade
        try:
            db.rollback()
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
        # CRITIQUE : rollback obligatoire sinon InFailedSqlTransaction cascade
        try:
            db.rollback()
        except Exception:
            pass
        return None


def _alerte_stock_from_dict(stock_info: Optional[dict]) -> Optional[str]:
    """Pour stocker dans PredictionResultat.alerte_stock (string court)."""
    if not stock_info:
        return None
    return stock_info.get("alerte_globale")


def _get_hierarchie_complete(db: Session, equipment_code: str) -> list[dict]:
    """
    Remonte la hiérarchie complète depuis le composant jusqu'à la machine racine.
    Retourne [composant, parent, grand-parent, ..., racine].
    """
    try:
        from models.equipement import Equipement
        hierarchie = []
        eq = (
            db.query(Equipement)
            .filter(Equipement.equipment_code == equipment_code)
            .first()
        )
        if not eq:
            return []

        visited = set()
        current = eq
        while current and current.id_equipement not in visited:
            visited.add(current.id_equipement)
            hierarchie.append({
                "code":        current.equipment_code,
                "description": current.description,
                "level":       current.hierarchy_level,
                "is_racine":   current.id_parent is None,
            })
            if current.id_parent:
                current = db.get(Equipement, current.id_parent)
            else:
                break
        return hierarchie
    except Exception:
        try: db.rollback()
        except Exception: pass
        return []


def _get_ots_predictifs(db: Session, equipment_code: str) -> list[dict]:
    """OTs prédictifs créés pour ce composant."""
    try:
        from models.ot import OrdreTravail, TypeOT
        from models.equipement import Equipement
        eq = (
            db.query(Equipement)
            .filter(Equipement.equipment_code == equipment_code)
            .first()
        )
        if not eq:
            return []
        ots = (
            db.query(OrdreTravail)
            .filter(
                OrdreTravail.id_equipement == eq.id_equipement,
                OrdreTravail.type_ot == TypeOT.PREDICTIF,
            )
            .order_by(OrdreTravail.created_at.desc())
            .all()
        )
        return [
            {
                "id_ot":       ot.id_ot,
                "numero_ot":   ot.numero_ot,
                "statut":      ot.statut.value if hasattr(ot.statut, "value") else str(ot.statut),
                "date_prevue": str(ot.date_prevue.date()) if ot.date_prevue else None,
                "created_at":  ot.created_at.isoformat() if ot.created_at else None,
            }
            for ot in ots
        ]
    except Exception:
        try: db.rollback()
        except Exception: pass
        return []


def _get_ots_correctifs(db: Session, equipment_code: str) -> list[dict]:
    """OTs correctifs liés à ce composant."""
    try:
        from models.ot import OrdreTravail, TypeOT
        from models.equipement import Equipement
        eq = (
            db.query(Equipement)
            .filter(Equipement.equipment_code == equipment_code)
            .first()
        )
        if not eq:
            return []
        ots = (
            db.query(OrdreTravail)
            .filter(
                OrdreTravail.id_equipement == eq.id_equipement,
                OrdreTravail.type_ot == TypeOT.CORRECTIF,
            )
            .order_by(OrdreTravail.created_at.desc())
            .all()
        )
        return [
            {
                "id_ot":              ot.id_ot,
                "numero_ot":          ot.numero_ot,
                "statut":             ot.statut.value if hasattr(ot.statut, "value") else str(ot.statut),
                "date_prevue":        str(ot.date_prevue.date()) if ot.date_prevue else None,
                "date_panne_associee": str(ot.created_at.date()) if ot.created_at else None,
                "created_at":         ot.created_at.isoformat() if ot.created_at else None,
            }
            for ot in ots
        ]
    except Exception:
        try: db.rollback()
        except Exception: pass
        return []


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
