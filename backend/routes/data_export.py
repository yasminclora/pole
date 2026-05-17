"""
Routes pour l'export des nouvelles données vers le réentraînement ML.

Endpoints (tous ADMIN uniquement) :
    GET  /data-export/apercu          → nb nouvelles lignes depuis dernier export
    POST /data-export/exporter        → génère le CSV et le retourne en téléchargement
    GET  /data-export/historique      → liste des fichiers CSV déjà exportés
    GET  /data-export/telecharger/{filename} → re-télécharger un export passé
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import get_db
from core.dependencies import require_roles
from services.data_export_service import (
    count_new_rows,
    export_new_data,
    list_exports,
    get_export_bytes,
)

router = APIRouter(prefix="/data-export", tags=["Data Export ML"])


@router.get("/apercu")
def apercu_nouvelles_donnees(
    db: Session = Depends(get_db),
    _: dict     = Depends(require_roles("ADMIN")),
):
    """
    Retourne le nombre de nouvelles lignes disponibles pour export
    (ajoutées depuis le dernier export ou depuis le début si jamais exporté).
    """
    return count_new_rows(db)


@router.post("/exporter")
def exporter_nouvelles_donnees(
    db: Session = Depends(get_db),
    _: dict     = Depends(require_roles("ADMIN")),
):
    """
    Génère un CSV des nouvelles interventions depuis le dernier export
    et le retourne directement en téléchargement.
    Met à jour le marqueur de progression (watermark).
    """
    try:
        result = export_new_data(db, save_to_disk=True)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    csv_bytes = result["csv_content"].encode("utf-8")

    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{result["filename"]}"',
            "X-Nb-Lignes":  str(result["nb_lignes"]),
            "X-Nb-Corr":    str(result["nb_corr"]),
            "X-Nb-Prev":    str(result["nb_prev"]),
            "X-Exported-At": result["exported_at"],
        },
    )


@router.get("/historique")
def historique_exports(
    _: dict = Depends(require_roles("ADMIN")),
):
    """
    Liste les fichiers CSV d'export précédemment générés.
    """
    return list_exports()


@router.get("/telecharger/{filename}")
def telecharger_export(
    filename: str,
    _: dict  = Depends(require_roles("ADMIN")),
):
    """
    Re-télécharge un fichier CSV d'export déjà généré.
    """
    try:
        data = get_export_bytes(filename)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return Response(
        content=data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
