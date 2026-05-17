"""
Routes ADMIN pour la gestion des modèles ML (LSTM/GRU) et leurs scalers.

Endpoints :
    POST   /modeles-ml/upload          → uploader un nouveau modèle + 2 scalers
    GET    /modeles-ml                 → lister tous les modèles
    GET    /modeles-ml/comparer        → comparer les métriques de tous les modèles
    POST   /modeles-ml/{id}/activer    → activer un modèle (désactive l'ancien)
    DELETE /modeles-ml/{id}            → supprimer un modèle inactif
"""

from pathlib import Path
import json
import shutil

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from database import get_db
from core.dependencies import require_roles
from models.modele_ml import ModeleML, TypeModeleEnum
from schemas.modele_ml import ModeleMLRead
from services.ml_inference import invalidate_cache


router = APIRouter()

# Racine du stockage des modèles : <backend>/storage/models/
_BACKEND_DIR = Path(__file__).resolve().parent.parent
STORAGE_ROOT = _BACKEND_DIR / "storage" / "models"
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

MAX_FILE_BYTES = 200 * 1024 * 1024   # 200 Mo


def _save_upload(upload: UploadFile, dest: Path) -> None:
    """Écrit le fichier uploadé sur disque en streaming avec contrôle de taille."""
    size = 0
    with dest.open("wb") as out:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Fichier '{upload.filename}' dépasse 200 Mo.",
                )
            out.write(chunk)


@router.post("/upload", response_model=ModeleMLRead, status_code=201)
def upload_modele(
    version       : str        = Form(...),
    type_modele   : str        = Form(...),
    nom           : str        = Form(...),
    description   : str | None = Form(None),
    model_keras   : UploadFile = File(...),
    scaler_x      : UploadFile = File(...),
    scaler_y      : UploadFile = File(...),
    db            : Session    = Depends(get_db),
    current_user  : dict       = Depends(require_roles("ADMIN")),
):
    # Validation type_modele
    try:
        type_enum = TypeModeleEnum(type_modele.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail="type_modele doit être 'LSTM' ou 'GRU'.")

    # Validation extensions
    if not (model_keras.filename or "").lower().endswith(".keras"):
        raise HTTPException(status_code=400, detail="Le fichier modèle doit avoir l'extension .keras")
    if not (scaler_x.filename or "").lower().endswith(".pkl"):
        raise HTTPException(status_code=400, detail="scaler_x doit avoir l'extension .pkl")
    if not (scaler_y.filename or "").lower().endswith(".pkl"):
        raise HTTPException(status_code=400, detail="scaler_y doit avoir l'extension .pkl")

    # Version unique
    if db.query(ModeleML).filter(ModeleML.version == version).first():
        raise HTTPException(status_code=409, detail=f"La version '{version}' existe déjà.")

    # Dossier de stockage versionné
    version_dir = STORAGE_ROOT / version
    if version_dir.exists():
        raise HTTPException(status_code=409, detail=f"Le dossier de la version '{version}' existe déjà sur disque.")
    version_dir.mkdir(parents=True)

    try:
        keras_path    = version_dir / "model.keras"
        scaler_x_path = version_dir / "scaler_x.pkl"
        scaler_y_path = version_dir / "scaler_y.pkl"

        _save_upload(model_keras, keras_path)
        _save_upload(scaler_x,    scaler_x_path)
        _save_upload(scaler_y,    scaler_y_path)
    except Exception:
        shutil.rmtree(version_dir, ignore_errors=True)
        raise

    # Chemins relatifs au backend pour portabilité
    rel = lambda p: str(p.relative_to(_BACKEND_DIR)).replace("\\", "/")

    modele = ModeleML(
        version       = version,
        type_modele   = type_enum,
        nom           = nom,
        description   = description,
        path_keras    = rel(keras_path),
        path_scaler_x = rel(scaler_x_path),
        path_scaler_y = rel(scaler_y_path),
        is_active     = False,
        uploaded_by   = current_user["id_user"],
    )
    db.add(modele)
    db.commit()
    db.refresh(modele)
    return modele


@router.get("", response_model=list[ModeleMLRead])
def lister_modeles(
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(require_roles("ADMIN")),
):
    return db.query(ModeleML).order_by(ModeleML.uploaded_at.desc()).all()


@router.get("/comparer")
def comparer_modeles(
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(require_roles("ADMIN")),
):
    """
    Retourne les métriques de tous les modèles pour comparaison.
    Lit metadata.json de chaque modèle si disponible.
    """
    modeles = db.query(ModeleML).order_by(ModeleML.uploaded_at.desc()).all()
    result  = []

    for m in modeles:
        version_dir = (_BACKEND_DIR / m.path_keras).parent
        metadata    = {}
        if (version_dir / "metadata.json").exists():
            try:
                metadata = json.loads(
                    (version_dir / "metadata.json").read_text(encoding="utf-8")
                )
            except Exception:
                pass

        result.append({
            "id_modele":      m.id_modele,
            "version":        m.version,
            "type_modele":    m.type_modele,
            "nom":            m.nom,
            "description":    m.description,
            "is_active":      m.is_active,
            "uploaded_at":    m.uploaded_at.isoformat() if m.uploaded_at else None,
            "metrics":        metadata.get("metrics_test", {}),
            "lookback":       metadata.get("lookback", 30),
            "max_rul":        metadata.get("max_rul",  30),
            "num_composants": metadata.get("num_composants", 0),
        })

    return result


@router.post("/{id_modele}/activer", response_model=ModeleMLRead)
def activer_modele(
    id_modele    : int,
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(require_roles("ADMIN")),
):
    modele = db.get(ModeleML, id_modele)
    if not modele:
        raise HTTPException(status_code=404, detail="Modèle introuvable.")

    # Désactive l'actif courant
    actif = db.query(ModeleML).filter(ModeleML.is_active.is_(True)).first()
    if actif and actif.id_modele != id_modele:
        actif.is_active = False

    modele.is_active = True
    db.commit()
    db.refresh(modele)

    # Invalide le cache singleton pour forcer le rechargement au prochain /run
    invalidate_cache()

    return modele


@router.delete("/{id_modele}", status_code=204)
def supprimer_modele(
    id_modele    : int,
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(require_roles("ADMIN")),
):
    modele = db.get(ModeleML, id_modele)
    if not modele:
        raise HTTPException(status_code=404, detail="Modèle introuvable.")
    if modele.is_active:
        raise HTTPException(status_code=400, detail="Impossible de supprimer un modèle actif. Désactivez-le d'abord.")

    # Suppression des fichiers
    version_dir = (_BACKEND_DIR / modele.path_keras).parent
    if version_dir.exists() and version_dir.is_relative_to(STORAGE_ROOT):
        shutil.rmtree(version_dir, ignore_errors=True)

    db.delete(modele)
    db.commit()
    return None
