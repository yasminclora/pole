"""
services/ml_inference.py
Pipeline d'inférence RUL — reproduction EXACTE du notebook
Pipeline_PFE_Cevital_CHAMPION.ipynb

Flux :
  BDD (historique_interventions CORR)
    → panel journalier (failure=date_declaration, maintenance=date_fin)
    → 9 features avec shift(1).rolling() + DSLF + DSLM
    → séquence (lookback=30, 9 features)
    → scaler_x.transform() → (1, 30, 9)
    → model.predict([comp_idx, seq])
    → scaler_y.inverse_transform() → RUL jours
"""

from __future__ import annotations

import json
import pickle
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.historique_interventions import HistoriqueIntervention, TypeTravailHistorique


def _load_scaler(path: Path):
    """
    Charge un scaler sklearn en essayant joblib puis pickle.
    Les scalers du notebook sont enregistrés avec joblib.dump().
    """
    try:
        return joblib.load(str(path))
    except Exception as e_joblib:
        try:
            with open(path, "rb") as f:
                return pickle.load(f)
        except Exception as e_pickle:
            raise RuntimeError(
                f"Impossible de charger le scaler {path.name} "
                f"(joblib: {type(e_joblib).__name__}: {e_joblib} | "
                f"pickle: {type(e_pickle).__name__}: {e_pickle})"
            )

_BACKEND_DIR = Path(__file__).resolve().parent.parent

# Features exactes dans l'ordre du notebook (= ordre du scaler_x)
FEATURES = [
    "comp_level",
    "pannes_7j", "pannes_30j", "pannes_90j",
    "maint_7j",  "maint_30j",  "maint_90j",
    "DSLF", "DSLM",
]

# ── Lazy import TF (évite le temps de chargement au démarrage) ───────────────
_tf = None

def _get_tf():
    global _tf
    if _tf is None:
        import tensorflow as tf  # noqa: PLC0415
        _tf = tf
    return _tf


# ════════════════════════════════════════════════════════════════════════════
#  Cache singleton — recharge seulement si id_modele change
# ════════════════════════════════════════════════════════════════════════════

class _Cache:
    id:       Optional[int] = None
    model:    object        = None
    scaler_x: object        = None
    scaler_y: object        = None
    metadata: dict          = {}
    comp_map: dict          = {}


def load_active_model(db: Session) -> tuple:
    """
    Charge depuis BDD le modèle is_active=True.
    Utilise le cache si même id_modele.
    Lève ValueError si aucun modèle actif.
    """
    from models.modele_ml import ModeleML

    actif = db.query(ModeleML).filter(ModeleML.is_active.is_(True)).first()
    if actif is None:
        raise ValueError(
            "Aucun modèle ML actif. "
            "Allez dans Administration > Modèles IA pour activer un modèle."
        )

    if _Cache.id == actif.id_modele:
        return _Cache.model, _Cache.scaler_x, _Cache.scaler_y, _Cache.metadata, _Cache.comp_map

    tf = _get_tf()

    keras_path    = _BACKEND_DIR / actif.path_keras
    scaler_x_path = _BACKEND_DIR / actif.path_scaler_x
    scaler_y_path = _BACKEND_DIR / actif.path_scaler_y
    version_dir   = keras_path.parent

    if not keras_path.exists():
        raise FileNotFoundError(f"Modèle introuvable : {keras_path}")

    model    = tf.keras.models.load_model(str(keras_path))
    scaler_x = _load_scaler(scaler_x_path)
    scaler_y = _load_scaler(scaler_y_path)

    metadata = {}
    comp_map = {}
    if (version_dir / "metadata.json").exists():
        metadata = json.loads((version_dir / "metadata.json").read_text(encoding="utf-8"))
    if (version_dir / "comp_mapping.json").exists():
        comp_map = json.loads((version_dir / "comp_mapping.json").read_text(encoding="utf-8"))

    _Cache.id       = actif.id_modele
    _Cache.model    = model
    _Cache.scaler_x = scaler_x
    _Cache.scaler_y = scaler_y
    _Cache.metadata = metadata
    _Cache.comp_map = comp_map

    return model, scaler_x, scaler_y, metadata, comp_map


def invalidate_cache():
    """Appelé après activation d'un nouveau modèle."""
    _Cache.id = None


# ════════════════════════════════════════════════════════════════════════════
#  Construction du panel journalier (Cell 29 + 31 + 35 du notebook)
# ════════════════════════════════════════════════════════════════════════════

def _build_daily_panel(
    corr_rows: list,   # [(date_declaration, date_fin), ...]
    ref_date:  date,
    comp_level: int,
    lookback:  int,
) -> Optional[np.ndarray]:
    """
    Reproduit exactement le pipeline du notebook :

    Cell 29 : maintenance_date = WOWO_END_DATE (date_fin)
    Cell 31 : failure[day]=1 si date_declaration==day
              maintenance[day]=1 si date_fin==day
    Cell 35 : shift(1).rolling(w).sum() pour pannes/maint
              DSLF / DSLM cumulatifs

    Retourne array (lookback, 9) ou None si données insuffisantes.
    """
    if len(corr_rows) < 2:
        return None

    # Fenêtre large pour avoir assez d'historique pour les rolling 90j
    window = lookback + 90 + 30
    start  = ref_date - timedelta(days=window)

    # Sets de dates pour lookup O(1)
    fail_dates  = set()
    maint_dates = set()
    for decl, fin in corr_rows:
        if decl:
            fail_dates.add(pd.Timestamp(decl))
        if fin:
            maint_dates.add(pd.Timestamp(fin))

    # Panel journalier
    timeline = pd.date_range(start=start, end=ref_date, freq="D")
    df = pd.DataFrame({"date": timeline})
    df["failure"]     = df["date"].isin(fail_dates).astype(int)
    df["maintenance"] = df["date"].isin(maint_dates).astype(int)
    df["comp_level"]  = float(comp_level)

    # ── Fenêtres roulantes avec shift(1) — Cell 35 notebook ─────────────
    # shift(1) = le jour J exclut la valeur du jour J (uniquement le passé)
    for w in [7, 30, 90]:
        df[f"pannes_{w}j"] = (
            df["failure"]
            .shift(1)
            .rolling(w, min_periods=0)
            .sum()
            .fillna(0)
            .astype(float)
        )
        df[f"maint_{w}j"] = (
            df["maintenance"]
            .shift(1)
            .rolling(w, min_periods=0)
            .sum()
            .fillna(0)
            .astype(float)
        )

    # ── DSLF — Days Since Last Failure ─────────────────────────────────
    # Notebook : last_fail = pd.Timestamp(f'{YEAR-1}-12-31')
    # On initialise à start - 1 an (même logique)
    last_fail = df["date"].iloc[0] - timedelta(days=365)
    dslf = []
    for _, row in df.iterrows():
        if row["failure"] == 1:
            last_fail = row["date"]
        dslf.append((row["date"] - last_fail).days)
    df["DSLF"] = dslf

    # ── DSLM — Days Since Last Maintenance ────────────────────────────
    last_maint = df["date"].iloc[0] - timedelta(days=365)
    dslm = []
    for _, row in df.iterrows():
        if row["maintenance"] == 1:
            last_maint = row["date"]
        dslm.append((row["date"] - last_maint).days)
    df["DSLM"] = dslm

    # ── Extraction des `lookback` derniers jours ──────────────────────
    seq = df[FEATURES].tail(lookback)
    if len(seq) < lookback:
        return None

    return seq.values.astype(np.float32)   # shape (30, 9)


# ════════════════════════════════════════════════════════════════════════════
#  Prédiction RUL pour UN composant
# ════════════════════════════════════════════════════════════════════════════

def predict_one(
    db:             Session,
    equipment_code: str,
    comp_level:     int,
    model,
    scaler_x,
    scaler_y,
    metadata:       dict,
    comp_map:       dict,
    ref_date:       date,
) -> Optional[dict]:
    """
    Retourne le dict RUL ou None si impossible (pas dans mapping, pas assez de données).
    """
    if equipment_code not in comp_map:
        return None

    comp_idx = comp_map[equipment_code]
    lookback = metadata.get("lookback", 30)
    max_rul  = metadata.get("max_rul",  30)

    # Récupère historique CORR : (date_declaration, date_fin)
    cutoff = ref_date - timedelta(days=lookback + 90 + 30)
    rows = (
        db.query(
            HistoriqueIntervention.date_declaration,
            HistoriqueIntervention.date_fin,
        )
        .filter(
            HistoriqueIntervention.equipment_code  == equipment_code,
            HistoriqueIntervention.type_travail    == TypeTravailHistorique.CORR,
            HistoriqueIntervention.date_declaration >= cutoff,
        )
        .all()
    )

    seq = _build_daily_panel(rows, ref_date, comp_level, lookback)
    if seq is None:
        return None

    # ── Normalisation : scaler_x est fit sur (n_rows, 9) 2D ────────────
    seq_scaled = scaler_x.transform(seq)            # (30, 9)
    seq_3d     = seq_scaled.reshape(1, lookback, len(FEATURES))  # (1, 30, 9)

    # ── Inférence : model([feature_seq, comp_input]) ────────────────────
    # Ordre confirmé par le modèle Keras : input_0 = séquence (None,30,9),
    # input_1 = index composant (None,).
    comp_input  = np.array([comp_idx])              # shape (1,)
    pred_scaled = model.predict([seq_3d, comp_input], verbose=0)

    # ── Dénormalisation ──────────────────────────────────────────────────
    rul_raw = float(scaler_y.inverse_transform(pred_scaled.reshape(-1, 1))[0, 0])
    rul     = int(round(max(0.0, min(rul_raw, float(max_rul)))))

    nb_pannes  = sum(1 for r in rows if r[0] is not None)
    confiance  = min(94, max(70, round(70 + (min(nb_pannes, 30) / 30) * 20)))

    # Statut sur 3 niveaux (ROUGE/ORANGE/VERT, gardé en enum compat CRITIQUE/URGENT/OK)
    statut = (
        "CRITIQUE" if rul <= 5  else   # ROUGE
        "URGENT"   if rul <= 15 else   # ORANGE
        "OK"                           # VERT
    )

    # date_panne_prevue = dernière panne CORR du composant + RUL
    dates_corr = [r[0] for r in rows if r[0] is not None]
    if dates_corr:
        derniere_panne    = max(dates_corr)
        date_panne_prevue = derniere_panne + timedelta(days=rul)
    else:
        derniere_panne    = None
        date_panne_prevue = ref_date + timedelta(days=rul)

    return {
        "equipment_code":    equipment_code,
        "rul_jours":         rul,
        "statut":            statut,
        "date_panne_prevue": date_panne_prevue.isoformat(),
        "derniere_panne":    derniere_panne.isoformat() if derniere_panne else None,
        "confiance_pct":     confiance,
        "source":            "ML",
    }


# ════════════════════════════════════════════════════════════════════════════
#  Prédiction pour TOUS les composants du mapping
# ════════════════════════════════════════════════════════════════════════════

def run_full_prediction(db: Session) -> dict:
    """
    Lance la prédiction ML sur tous les composants du comp_mapping.
    Retourne :
    {
        "resultats": [...],       liste de dicts par composant
        "nb_total": int,
        "nb_critiques": int,
        "nb_urgents": int,
        "nb_surveillance": int,
        "nb_ok": int,
        "model_info": {...},
    }
    Lève ValueError si aucun modèle actif.
    """
    model, scaler_x, scaler_y, metadata, comp_map = load_active_model(db)

    ref_date = _get_ref_date(db)

    # Charge comp_level depuis l'historique pour chaque code du mapping
    level_map = dict(
        db.query(
            HistoriqueIntervention.equipment_code,
            HistoriqueIntervention.equipment_level,
        )
        .filter(
            HistoriqueIntervention.equipment_code.in_(list(comp_map.keys())),
            HistoriqueIntervention.equipment_level.in_(
                metadata.get("levels_modelises", [3, 4])
            ),
        )
        .distinct()
        .all()
    )

    resultats = []
    for code in comp_map:
        level = level_map.get(code)
        if level is None:
            continue
        pred = predict_one(
            db, code, int(level),
            model, scaler_x, scaler_y, metadata, comp_map, ref_date,
        )
        if pred is not None:
            resultats.append(pred)

    # Tri par RUL croissant (plus critique en premier)
    resultats.sort(key=lambda x: x["rul_jours"])

    return {
        "resultats":      resultats,
        "nb_total":       len(resultats),
        "nb_critiques":   sum(1 for r in resultats if r["statut"] == "CRITIQUE"),
        "nb_urgents":     sum(1 for r in resultats if r["statut"] == "URGENT"),
        "nb_surveillance":sum(1 for r in resultats if r["statut"] == "SURVEILLANCE"),
        "nb_ok":          sum(1 for r in resultats if r["statut"] == "OK"),
        "ref_date":       ref_date.isoformat(),
        "model_info": {
            "type":     metadata.get("model_type", "?"),
            "lookback": metadata.get("lookback", 30),
            "max_rul":  metadata.get("max_rul",  30),
            "metrics":  metadata.get("metrics_test", {}),
        },
    }


# ════════════════════════════════════════════════════════════════════════════
#  Helpers
# ════════════════════════════════════════════════════════════════════════════

def _get_ref_date(db: Session) -> date:
    """Date de référence = dernière date dans l'historique."""
    result = db.query(func.max(HistoriqueIntervention.date_declaration)).scalar()
    return result if result else date(2024, 12, 31)


def has_active_model(db: Session) -> bool:
    from models.modele_ml import ModeleML
    return db.query(ModeleML).filter(ModeleML.is_active.is_(True)).count() > 0


# ════════════════════════════════════════════════════════════════════════════
#  Liste des composants TEST (33 composants)
# ════════════════════════════════════════════════════════════════════════════

def get_test_codes(db: Session) -> tuple[list[str], str]:
    """
    Retourne (codes, source).
      1. test_codes.json à côté du modèle actif → source="file"
      2. Fallback : 33 derniers codes du comp_mapping (tri alphabétique) → source="fallback_last33"
    """
    from models.modele_ml import ModeleML

    actif = db.query(ModeleML).filter(ModeleML.is_active.is_(True)).first()
    if actif:
        version_dir = (_BACKEND_DIR / actif.path_keras).parent
        test_file   = version_dir / "test_codes.json"
        if test_file.exists():
            try:
                codes = json.loads(test_file.read_text(encoding="utf-8"))
                if isinstance(codes, list) and codes:
                    return [str(c) for c in codes], "file"
            except Exception:
                pass

    try:
        _, _, _, _, comp_map = load_active_model(db)
        sorted_codes = sorted(comp_map.keys())
        return sorted_codes[-33:], "fallback_last33"
    except Exception:
        return [], "no_model"


# ════════════════════════════════════════════════════════════════════════════
#  Prédictions MENSUELLES sur la période historique (1 prédiction / composant / mois)
# ════════════════════════════════════════════════════════════════════════════

def run_monthly_predictions(
    db:             Session,
    freq_days:      int  = 30,
    test_codes_only: bool = True,
    pole_filter:    Optional[str] = None,
    id_pole_filter: Optional[int] = None,
) -> dict:
    """
    Pour chaque composant test (33), génère 1 prédiction tous les `freq_days` jours
    sur toute la période historique.

    Filtre par pôle si pole_filter est fourni.

    Retourne :
    {
        "test_codes_source": str,
        "freq_days": int,
        "date_min": str,
        "date_max": str,
        "predictions_par_composant": { code: [ {ref_date, rul_jours, statut, ...}, ... ] },
        "dernieres_predictions":     [ ... ],   # latest pred par composant
        "nb_total":      int,                   # composants analysés
        "nb_predictions_total": int,
        "nb_critiques":    int,                 # sur les dernières
        "nb_urgents":      int,
        "nb_surveillance": int,
        "nb_ok":           int,
        "model_info":      { ... },
        "ref_date_latest": str,
    }
    """
    model, scaler_x, scaler_y, metadata, comp_map = load_active_model(db)

    # 1. Liste de composants à analyser
    if test_codes_only:
        codes_test, source = get_test_codes(db)
    else:
        codes_test = list(comp_map.keys())
        source     = "all_mapping"

    # 2. Filtre par pôle — STRATEGIE ROBUSTE :
    #    a) Priorité : id_pole_filter via la table Equipement (relation FK fiable)
    #    b) Fallback : pole_filter (string action_entity, case-insensitive avec normalisation)
    if id_pole_filter is not None:
        from models.equipement import Equipement
        rows = (
            db.query(Equipement.equipment_code)
            .filter(
                Equipement.equipment_code.in_(codes_test),
                Equipement.id_pole == id_pole_filter,
            )
            .distinct()
            .all()
        )
        codes_test = [r[0] for r in rows]
    elif pole_filter:
        rows = (
            db.query(
                HistoriqueIntervention.equipment_code,
                HistoriqueIntervention.action_entity,
            )
            .filter(HistoriqueIntervention.equipment_code.in_(codes_test))
            .distinct()
            .all()
        )
        # Normalisation : strip + upper pour résoudre les variations de casse
        cible = pole_filter.strip().upper()
        codes_test = [c for c, pole in rows if pole and pole.strip().upper() == cible]

    # 3. Plage de dates
    range_row = db.query(
        func.min(HistoriqueIntervention.date_declaration),
        func.max(HistoriqueIntervention.date_declaration),
    ).first()
    date_min, date_max = range_row
    if not date_min or not date_max:
        raise ValueError("Pas d'historique d'interventions en BDD.")

    lookback   = metadata.get("lookback", 30)
    levels_modelises = metadata.get("levels_modelises", [3, 4])
    window_min = lookback + 90 + 30
    start_date = date_min + timedelta(days=window_min)
    if start_date > date_max:
        raise ValueError(
            f"Historique trop court : besoin de {window_min} jours minimum."
        )

    # 4. comp_level pour chaque code
    level_map = dict(
        db.query(
            HistoriqueIntervention.equipment_code,
            HistoriqueIntervention.equipment_level,
        )
        .filter(
            HistoriqueIntervention.equipment_code.in_(codes_test),
            HistoriqueIntervention.equipment_level.in_(levels_modelises),
        )
        .distinct()
        .all()
    )

    # 5. Itération mensuelle
    predictions_par_composant: dict[str, list[dict]] = {}

    for code in codes_test:
        level = level_map.get(code)
        if level is None or code not in comp_map:
            continue

        preds = []
        current = start_date
        while current <= date_max:
            try:
                pred = predict_one(
                    db, code, int(level),
                    model, scaler_x, scaler_y, metadata, comp_map,
                    ref_date=current,
                )
                if pred is not None:
                    pred["ref_date"]   = current.isoformat()
                    pred["comp_level"] = int(level)
                    preds.append(pred)
            except Exception:
                pass
            current += timedelta(days=freq_days)

        if preds:
            predictions_par_composant[code] = preds

    # 6. Dernière prédiction par composant (pour le live view)
    dernieres = [preds[-1] for preds in predictions_par_composant.values() if preds]

    # 7. Stats agrégées (sur les dernières)
    def _count(statut: str) -> int:
        return sum(1 for p in dernieres if p["statut"] == statut)

    nb_predictions_total = sum(len(v) for v in predictions_par_composant.values())

    return {
        "test_codes_source":         source,
        "freq_days":                 freq_days,
        "date_min":                  date_min.isoformat(),
        "date_max":                  date_max.isoformat(),
        "predictions_par_composant": predictions_par_composant,
        "dernieres_predictions":     dernieres,
        "nb_total":                  len(predictions_par_composant),
        "nb_predictions_total":      nb_predictions_total,
        "nb_critiques":              _count("CRITIQUE"),
        "nb_urgents":                _count("URGENT"),
        "nb_surveillance":           _count("SURVEILLANCE"),
        "nb_ok":                     _count("OK"),
        "ref_date_latest":           max((p["ref_date"] for p in dernieres), default=None),
        "model_info": {
            "type":     metadata.get("model_type", "?"),
            "lookback": lookback,
            "max_rul":  metadata.get("max_rul", 30),
            "metrics":  metadata.get("metrics_test", {}),
        },
    }


def predict_rul_for_component(
    db:              Session,
    equipment_code:  str,
    comp_level:      int,
    ref_date:        Optional[date] = None,
) -> Optional[dict]:
    """
    Wrapper de compatibilité pour services.prediction_service.

    Charge le modèle actif (avec cache), prédit le RUL pour UN composant
    et retourne le dict attendu par l'ancien pipeline simulation, ou None
    si le composant n'est pas dans le mapping (le caller fera fallback).
    """
    try:
        model, scaler_x, scaler_y, metadata, comp_map = load_active_model(db)
    except (ValueError, FileNotFoundError):
        return None

    if ref_date is None:
        ref_date = _get_ref_date(db)

    return predict_one(
        db, equipment_code, int(comp_level),
        model, scaler_x, scaler_y, metadata, comp_map, ref_date,
    )


def get_active_model_info(db: Session) -> Optional[dict]:
    from models.modele_ml import ModeleML
    actif = db.query(ModeleML).filter(ModeleML.is_active.is_(True)).first()
    if not actif:
        return None
    version_dir = (_BACKEND_DIR / actif.path_keras).parent
    metadata = {}
    if (version_dir / "metadata.json").exists():
        metadata = json.loads((version_dir / "metadata.json").read_text(encoding="utf-8"))
    return {
        "id_modele":   actif.id_modele,
        "version":     actif.version,
        "type_modele": actif.type_modele,
        "nom":         actif.nom,
        "metrics":     metadata.get("metrics_test", {}),
        "lookback":    metadata.get("lookback", 30),
        "max_rul":     metadata.get("max_rul",  30),
        "num_composants": metadata.get("num_composants", 0),
    }


# ════════════════════════════════════════════════════════════════════════════
#  Prédictions PONCTUELLES — 1 prédiction par composant test (33)
#  Version qui marchait : utilisée par /predictions/run avec model_type obligatoire
# ════════════════════════════════════════════════════════════════════════════

def run_predictions_test_set(
    db:             Session,
    model_type:     str,
    pole_filter:    Optional[str] = None,
    id_pole_filter: Optional[int] = None,
    scope:          str = "test",
) -> dict:
    """
    1 prédiction par composant test (33), à `ref_date = sa dernière panne CORR`.
    Statut 3 niveaux : CRITIQUE/URGENT/OK (ROUGE/ORANGE/VERT côté UI).
    """
    if model_type not in ("LSTM", "GRU"):
        raise ValueError(f"model_type doit être 'LSTM' ou 'GRU' (reçu : {model_type!r})")

    model, scaler_x, scaler_y, metadata, comp_map = load_active_model(db)

    if scope == "test":
        codes, source = get_test_codes(db)
    else:
        codes  = list(comp_map.keys())
        source = "all_mapping"

    # Filtre par pôle
    if id_pole_filter is not None:
        from models.equipement import Equipement
        rows = (
            db.query(Equipement.equipment_code)
            .filter(
                Equipement.equipment_code.in_(codes),
                Equipement.id_pole == id_pole_filter,
            )
            .distinct()
            .all()
        )
        codes = [r[0] for r in rows]
    elif pole_filter:
        rows = (
            db.query(HistoriqueIntervention.equipment_code,
                     HistoriqueIntervention.action_entity)
            .filter(HistoriqueIntervention.equipment_code.in_(codes))
            .distinct().all()
        )
        cible = pole_filter.strip().upper()
        codes = [c for c, p in rows if p and p.strip().upper() == cible]

    levels_modelises = metadata.get("levels_modelises", [3, 4])
    level_map = dict(
        db.query(HistoriqueIntervention.equipment_code,
                 HistoriqueIntervention.equipment_level)
        .filter(
            HistoriqueIntervention.equipment_code.in_(codes),
            HistoriqueIntervention.equipment_level.in_(levels_modelises),
        )
        .distinct().all()
    )

    # ref_date par composant = sa dernière panne CORR
    last_panne_par_code = dict(
        db.query(
            HistoriqueIntervention.equipment_code,
            func.max(HistoriqueIntervention.date_declaration),
        )
        .filter(
            HistoriqueIntervention.equipment_code.in_(codes),
            HistoriqueIntervention.type_travail == TypeTravailHistorique.CORR,
        )
        .group_by(HistoriqueIntervention.equipment_code)
        .all()
    )

    ref_date_globale = _get_ref_date(db)

    resultats = []
    nb_sans_pred = 0

    for code in codes:
        level = level_map.get(code)
        if level is None or code not in comp_map:
            nb_sans_pred += 1
            continue
        ref_date_comp = last_panne_par_code.get(code) or ref_date_globale
        try:
            pred = predict_one(
                db, code, int(level),
                model, scaler_x, scaler_y, metadata, comp_map,
                ref_date=ref_date_comp,
            )
            if pred is None:
                nb_sans_pred += 1
                continue
            pred["comp_level"]    = int(level)
            pred["ref_date_used"] = ref_date_comp.isoformat()
            resultats.append(pred)
        except Exception as e:
            print(f"[predict_one] erreur sur {code}: {e}", flush=True)
            nb_sans_pred += 1

    def _count(s: str) -> int:
        return sum(1 for r in resultats if r["statut"] == s)

    return {
        "model_type":         model_type,
        "metrics":            metadata.get("metrics_test", {}),
        "ref_date_global":    ref_date_globale.isoformat() if ref_date_globale else None,
        "lookback":           metadata.get("lookback", 30),
        "max_rul":            metadata.get("max_rul",  30),
        "scope":              scope,
        "nb_test_codes":      len(codes),
        "nb_total":           len(resultats),
        "nb_sans_prediction": nb_sans_pred,
        "nb_critiques":       _count("CRITIQUE"),
        "nb_urgents":         _count("URGENT"),
        "nb_ok":              _count("OK"),
        "resultats":          sorted(resultats, key=lambda r: r["rul_jours"]),
        "test_codes_source":  source,
    }
