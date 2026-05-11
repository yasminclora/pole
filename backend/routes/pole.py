from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.pole import Pole
from models.equipe import Equipe
import traceback

router = APIRouter()

@router.get("/")
def liste_poles(db: Session = Depends(get_db)):
    try:
        poles = db.query(Pole).all()
        return [
            {
                "id_pole"     : p.id_pole,
                "nom_pole"    : p.nom_pole,
                "code_pole"   : p.code_pole   if hasattr(p, 'code_pole')   else None,
                "description" : p.description if hasattr(p, 'description') else None,
            }
            for p in poles
        ]
    except Exception as e:
        print("ERREUR liste poles:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.post("/")
def creer_pole(data: dict, db: Session = Depends(get_db)):
    try:
        # Vérifier doublon
        existant = db.query(Pole).filter(
            Pole.nom_pole == data.get("nom_pole", "").strip()
        ).first()
        if existant:
            raise HTTPException(
                status_code=400,
                detail="Un pôle avec ce nom existe déjà"
            )

        pole = Pole(
            nom_pole    = data.get("nom_pole", "").strip(),
            code_pole   = data.get("code_pole", "").strip().upper() if data.get("code_pole") else None,
            description = data.get("description", "").strip() or None,
        )
        db.add(pole)
        db.commit()
        db.refresh(pole)

        # Créer les 4 équipes automatiquement
        for nom in ["Équipe Alpha", "Équipe Bravo", "Équipe Charlie", "Équipe Delta"]:
            equipe = Equipe(nom_equipe=nom, id_pole=pole.id_pole)
            db.add(equipe)
        db.commit()

        return {
            "id_pole"     : pole.id_pole,
            "nom_pole"    : pole.nom_pole,
            "code_pole"   : pole.code_pole,
            "description" : pole.description,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR création pole:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.get("/{id_pole}")
def get_pole(id_pole: int, db: Session = Depends(get_db)):
    try:
        pole = db.get(Pole, id_pole)
        if not pole:
            raise HTTPException(status_code=404, detail="Pôle introuvable")
        return {
            "id_pole"     : pole.id_pole,
            "nom_pole"    : pole.nom_pole,
            "code_pole"   : pole.code_pole   if hasattr(pole, 'code_pole')   else None,
            "description" : pole.description if hasattr(pole, 'description') else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.delete("/{id_pole}")
def supprimer_pole(id_pole: int, db: Session = Depends(get_db)):
    try:
        pole = db.get(Pole, id_pole)
        if not pole:
            raise HTTPException(status_code=404, detail="Pôle introuvable")
        db.delete(pole)
        db.commit()
        return {"message": "Pôle supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur serveur interne")