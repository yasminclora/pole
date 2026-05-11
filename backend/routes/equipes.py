from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.equipe import Equipe
from models.user   import Utilisateur, RoleEnum
from services.notification_service import manager
import traceback

router = APIRouter()

def equipe_to_dict(eq: Equipe, db: Session) -> dict:
    membres = db.query(Utilisateur).filter_by(id_equipe=eq.id_equipe).all()
    chef    = db.query(Utilisateur).filter_by(
        id_equipe = eq.id_equipe,
        role      = RoleEnum.CHEF_EQUIPE
    ).first()
    return {
        "id_equipe"               : eq.id_equipe,
        "nom_equipe"              : eq.nom_equipe,
        "id_pole"                 : eq.id_pole,
        "date_reference_cycle"    : str(eq.date_reference_cycle) if eq.date_reference_cycle else None,
        "position_initiale_cycle" : eq.position_initiale_cycle if eq.position_initiale_cycle is not None else 0,
        "a_chef"                  : chef is not None,
        "nb_membres"              : len(membres),
        "membres"                 : [
            {
                "id_user" : m.id_user,
                "nom"     : m.nom,
                "prenom"  : m.prenom,
                "role"    : m.role.value,
                "genre"   : m.genre.value,
                "email"   : m.email,
            }
            for m in membres
        ],
    }

@router.get("/")
def liste_equipes(db: Session = Depends(get_db)):
    try:
        equipes = db.query(Equipe).all()
        return [equipe_to_dict(eq, db) for eq in equipes]
    except Exception as e:
        print("ERREUR liste equipes:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.get("/pole/{id_pole}")
def equipes_par_pole(id_pole: int, db: Session = Depends(get_db)):
    try:
        equipes = db.query(Equipe).filter_by(id_pole=id_pole).all()
        return [equipe_to_dict(eq, db) for eq in equipes]
    except Exception as e:
        print("ERREUR equipes pole:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.get("/{id_equipe}")
def get_equipe(id_equipe: int, db: Session = Depends(get_db)):
    try:
        eq = db.get(Equipe, id_equipe)
        if not eq:
            raise HTTPException(status_code=404, detail="Équipe introuvable")
        return equipe_to_dict(eq, db)
    except HTTPException:
        raise
    except Exception as e:
        print("ERREUR get equipe:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")