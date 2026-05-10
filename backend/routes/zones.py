from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database    import get_db
from models.zone import Zone
from models.pole import Pole

router = APIRouter()

def zone_to_dict(z: Zone, db: Session) -> dict:
    pole = db.get(Pole, z.id_pole)
    return {
        "id_zone"  : z.id_zone,
        "code_zone": z.code_zone,
        "nom_zone" : z.nom_zone,
        "id_pole"  : z.id_pole,
        "nom_pole" : pole.nom_pole if pole else None,
    }

@router.get("/")
def liste_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    return [zone_to_dict(z, db) for z in zones]

@router.get("/pole/{id_pole}")
def zones_par_pole(id_pole: int, db: Session = Depends(get_db)):
    zones = db.query(Zone).filter_by(id_pole=id_pole).all()
    return [zone_to_dict(z, db) for z in zones]

@router.post("/")
def creer_zone(data: dict, db: Session = Depends(get_db)):
    try:
        pole = db.get(Pole, data["id_pole"])
        if not pole:
            raise HTTPException(status_code=404, detail="Pole introuvable")

        existante = db.query(Zone).filter_by(
            code_zone=data["code_zone"], id_pole=data["id_pole"]
        ).first()
        if existante:
            raise HTTPException(
                status_code=400,
                detail="Cette zone existe deja dans ce pole"
            )

        zone = Zone(
            code_zone = data["code_zone"].upper().strip(),
            nom_zone  = data["nom_zone"].strip(),
            id_pole   = data["id_pole"],
        )
        db.add(zone)
        db.commit()
        db.refresh(zone)
        return zone_to_dict(zone, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.delete("/{id_zone}")
def supprimer_zone(id_zone: int, db: Session = Depends(get_db)):
    try:
        zone = db.get(Zone, id_zone)
        if not zone:
            raise HTTPException(status_code=404, detail="Zone introuvable")

        db.delete(zone)
        db.commit()
        return {"message": "Zone supprimee"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur serveur interne")