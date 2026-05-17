"""
services/data_export_service.py

Détecte les nouvelles lignes de historique_interventions ajoutées depuis
le dernier export, et génère un CSV au format exact du fichier d'entraînement
(identique à failure1.csv / maintenance1.csv) pour le réentraînement externe.

Logique :
  - Un fichier de marqueur JSON (storage/exports/watermark.json) stocke
    la date/heure du dernier export.
  - Seules les lignes dont created_at > last_export_at sont exportées.
  - Le CSV produit est enregistré dans storage/exports/<timestamp>_export.csv.
"""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from models.historique_interventions import HistoriqueIntervention

_BACKEND_DIR  = Path(__file__).resolve().parent.parent
_EXPORTS_DIR  = _BACKEND_DIR / "storage" / "exports"
_WATERMARK    = _EXPORTS_DIR / "watermark.json"

# Colonnes dans l'ordre du fichier d'entraînement
_CSV_COLUMNS = [
    "system_equipment",
    "equipment_description",
    "equipment_code",
    "equipment_level",
    "parent_code",
    "parent_level",
    "type_travail",
    "action_entity",
    "date_declaration",
    "date_fin",
    "date_creation",
    "cout_total",
    "source",
]


def _ensure_dir() -> None:
    _EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


# ── Watermark ────────────────────────────────────────────────────────────────

def get_watermark() -> Optional[datetime]:
    """Retourne la date du dernier export, ou None si jamais exporté."""
    if not _WATERMARK.exists():
        return None
    data = json.loads(_WATERMARK.read_text(encoding="utf-8"))
    ts = data.get("last_export_at")
    if ts:
        return datetime.fromisoformat(ts)
    return None


def _save_watermark(dt: datetime) -> None:
    _ensure_dir()
    _WATERMARK.write_text(
        json.dumps({
            "last_export_at": dt.isoformat(),
            "updated_at":     datetime.utcnow().isoformat(),
        }, ensure_ascii=False),
        encoding="utf-8",
    )


# ── Comptage ─────────────────────────────────────────────────────────────────

def count_new_rows(db: Session) -> dict:
    """
    Retourne le nombre de nouvelles lignes depuis le dernier export.
    Distingue CORR (pannes) et PREV (maintenances).
    """
    watermark = get_watermark()

    q = db.query(HistoriqueIntervention)
    if watermark:
        q = q.filter(HistoriqueIntervention.created_at > watermark)

    rows = q.all()
    nb_corr = sum(1 for r in rows if r.type_travail.value == "CORR")
    nb_prev = sum(1 for r in rows if r.type_travail.value == "PREV")

    return {
        "nb_total":       len(rows),
        "nb_corr":        nb_corr,
        "nb_prev":        nb_prev,
        "last_export_at": watermark.isoformat() if watermark else None,
    }


# ── Export CSV ───────────────────────────────────────────────────────────────

def _row_to_dict(row: HistoriqueIntervention) -> dict:
    return {
        "system_equipment":    row.system_equipment or "",
        "equipment_description": row.equipment_description or "",
        "equipment_code":      row.equipment_code or "",
        "equipment_level":     row.equipment_level if row.equipment_level is not None else "",
        "parent_code":         row.parent_code or "",
        "parent_level":        row.parent_level if row.parent_level is not None else "",
        "type_travail":        row.type_travail.value,
        "action_entity":       row.action_entity or "",
        "date_declaration":    row.date_declaration.isoformat() if row.date_declaration else "",
        "date_fin":            row.date_fin.isoformat() if row.date_fin else "",
        "date_creation":       row.date_creation.isoformat() if row.date_creation else "",
        "cout_total":          row.cout_total if row.cout_total is not None else 0.0,
        "source":              row.source or "",
    }


def export_new_data(
    db: Session,
    save_to_disk: bool = True,
) -> dict:
    """
    Exporte les nouvelles lignes depuis le dernier watermark.

    Retourne :
    {
        "nb_lignes":  int,
        "nb_corr":    int,
        "nb_prev":    int,
        "csv_content": str,          # contenu CSV brut (UTF-8 BOM pour Excel)
        "filename":   str,           # nom suggéré pour le téléchargement
        "filepath":   str | None,    # chemin sur disque si save_to_disk=True
        "exported_at": str,          # ISO datetime
    }
    Lève ValueError si aucune nouvelle donnée.
    """
    watermark = get_watermark()

    q = db.query(HistoriqueIntervention)
    if watermark:
        q = q.filter(HistoriqueIntervention.created_at > watermark)
    q = q.order_by(HistoriqueIntervention.date_declaration)

    rows = q.all()
    if not rows:
        raise ValueError(
            "Aucune nouvelle donnée depuis le dernier export"
            + (f" ({watermark.strftime('%d/%m/%Y %H:%M')})" if watermark else "") + "."
        )

    # Génération CSV en mémoire (UTF-8 avec BOM pour compatibilité Excel)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=_CSV_COLUMNS, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow(_row_to_dict(row))

    csv_content = "﻿" + buf.getvalue()   # BOM UTF-8

    now       = datetime.utcnow()
    filename  = f"{now.strftime('%Y%m%d_%H%M%S')}_nouvelles_interventions.csv"
    filepath  = None

    if save_to_disk:
        _ensure_dir()
        dest = _EXPORTS_DIR / filename
        dest.write_text(csv_content, encoding="utf-8")
        filepath = str(dest)

    # Mise à jour du watermark uniquement si pas d'erreur
    _save_watermark(now)

    nb_corr = sum(1 for r in rows if r.type_travail.value == "CORR")
    nb_prev = sum(1 for r in rows if r.type_travail.value == "PREV")

    return {
        "nb_lignes":   len(rows),
        "nb_corr":     nb_corr,
        "nb_prev":     nb_prev,
        "csv_content": csv_content,
        "filename":    filename,
        "filepath":    filepath,
        "exported_at": now.isoformat(),
    }


# ── Historique des exports ───────────────────────────────────────────────────

def list_exports() -> list[dict]:
    """
    Liste les fichiers CSV déjà exportés dans storage/exports/.
    Retourne une liste triée par date décroissante.
    """
    _ensure_dir()
    files = sorted(
        _EXPORTS_DIR.glob("*_nouvelles_interventions.csv"),
        reverse=True,
    )
    result = []
    for f in files:
        stat = f.stat()
        result.append({
            "filename":    f.name,
            "size_kb":     round(stat.st_size / 1024, 1),
            "created_at":  datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return result


def get_export_bytes(filename: str) -> bytes:
    """
    Retourne le contenu binaire d'un export déjà sauvegardé.
    Lève FileNotFoundError si introuvable ou chemin invalide.
    """
    _ensure_dir()
    # Sécurité: empêche path traversal
    safe_name = Path(filename).name
    path = _EXPORTS_DIR / safe_name
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Fichier export introuvable : {safe_name}")
    return path.read_bytes()
