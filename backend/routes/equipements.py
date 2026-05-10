from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date as date_type
import traceback

from database          import get_db
from models.equipement import Equipement
from models.pole       import Pole
from models.zone       import Zone

router = APIRouter()

# ── Serializer ──────────────────────────────────────────────────────

def equip_to_dict(e: Equipement, db: Session) -> dict:
    pole = db.get(Pole, e.id_pole) if e.id_pole else None
    zone = db.get(Zone, e.id_zone) if e.id_zone else None
    return {
        "id_equipement"   : e.id_equipement,
        "equipment_code"  : e.equipment_code,
        "description"     : e.description,
        "hierarchy_level" : e.hierarchy_level,
        "id_parent"       : e.id_parent,
        "id_machine_racine": e.id_machine_racine,
        "id_pole"         : e.id_pole,
        "nom_pole"        : pole.nom_pole if pole else None,
        "id_zone"         : e.id_zone,
        "nom_zone"        : zone.nom_zone if zone else None,
        "code_zone"        : zone.code_zone if zone else None,
        "install_date"    : str(e.install_date) if e.install_date else None,
        "status"          : e.status,
        "categorie"       : e.categorie,
        "nb_enfants"      : len(e.enfants),
        "created_at"      : str(e.created_at) if e.created_at else None,
    }


# ── GET machines racines (Level 1) ──────────────────────────────────────

@router.get("/machines")
def liste_machines(
    id_pole: int = None,
    id_zone: int = None,
    search : str = None,
    page   : int = Query(1, ge=1),
    limit  : int = Query(12, ge=1, le=100),
    db     : Session = Depends(get_db)
):
    """
    Liste paginée des machines racines (Level 1).
    Supporte le filtrage par pôle, zone et recherche.
    """
    try:
        q = db.query(Equipement)\
              .filter(Equipement.hierarchy_level == 1)
        
        if id_pole:
            q = q.filter(Equipement.id_pole == id_pole)
        if id_zone:
            q = q.filter(Equipement.id_zone == id_zone)
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            q = q.filter(
                Equipement.equipment_code.ilike(search_term) |
                Equipement.description.ilike(search_term)
            )
        
        total = q.count()
        machines = q.order_by(Equipement.equipment_code)\
                    .offset((page - 1) * limit)\
                    .limit(limit)\
                    .all()
        
        return {
            "data": [equip_to_dict(m, db) for m in machines],
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


@router.get("/composantes/recherche")
def recherche_composantes(
    id_pole: int = None,
    search : str = None,
    db     : Session = Depends(get_db)
):
    """
    Recherche composantes Level 3 et 4 uniquement
    Utilisé pour la création de DI
    """
    try:
        q = db.query(Equipement)\
              .filter(Equipement.hierarchy_level.in_([3, 4]))
        
        if id_pole:
            q = q.filter(Equipement.id_pole == id_pole)
        
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            q = q.filter(
                Equipement.equipment_code.ilike(search_term) |
                Equipement.description.ilike(search_term)
            )
        
        composantes = q.order_by(Equipement.equipment_code).limit(20).all()
        return [equip_to_dict(c, db) for c in composantes]
    
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")
    

# ── GET enfants directs ─────────────────────────────────────────────────

@router.get("/{id_equipement}/enfants")
def get_enfants(id_equipement: int, db: Session = Depends(get_db)):
    try:
        equip = db.get(Equipement, id_equipement)
        if not equip:
            raise HTTPException(status_code=404, detail="Equipement introuvable")
        enfants = db.query(Equipement)\
                    .filter(Equipement.id_parent == id_equipement)\
                    .order_by(Equipement.equipment_code).all()
        return [equip_to_dict(e, db) for e in enfants]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET arbre complet ─────────────────────────────────────────────────

@router.get("/{id_equipement}/arbre")
def get_arbre(id_equipement: int, db: Session = Depends(get_db)):
    try:
        racine = db.get(Equipement, id_equipement)
        if not racine:
            raise HTTPException(status_code=404, detail="Equipement introuvable")
        
        # Tous les descendants
        tous = db.query(Equipement)\
                 .filter(
                     Equipement.id_machine_racine == id_equipement
                 ).all()
        
        def build_node(equip: Equipement) -> dict:
            node = equip_to_dict(equip, db)
            enfants = sorted(
                [e for e in tous if e.id_parent == equip.id_equipement],
                key=lambda x: x.equipment_code
            )
            node["enfants"] = [build_node(c) for c in enfants]
            return node
        
        return build_node(racine)
    
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET détail ──────────────────────────────────────────────────────

@router.get("/{id_equipement}")
def get_equipement(id_equipement: int, db: Session = Depends(get_db)):
    try:
        equip = db.get(Equipement, id_equipement)
        if not equip:
            raise HTTPException(status_code=404, detail="Equipement introuvable")
        return equip_to_dict(equip, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST créer équipement ─────────────────────────────────────────────

@router.post("/")
async def creer_equipement(data: dict, db: Session = Depends(get_db)):
    try:
        # Code unique
        existant = db.query(Equipement)\
                     .filter(Equipement.equipment_code == data["equipment_code"].strip().upper())\
                     .first()
        if existant:
            raise HTTPException(
                status_code=400,
                detail=f"Code '{data['equipment_code']}' déjà existant"
            )
        
        id_parent         = data.get("id_parent")
        hierarchy_level   = 1
        id_machine_racine = None
        id_pole           = data.get("id_pole")
        id_zone           = data.get("id_zone") or None
        
        # Si parent → calculer level et root automatiquement
        if id_parent:
            parent = db.get(Equipement, id_parent)
            if not parent:
                raise HTTPException(status_code=404, detail="Parent introuvable")
            
            hierarchy_level = parent.hierarchy_level + 1
            
            # Machine racine
            if parent.hierarchy_level == 1:
                id_machine_racine = parent.id_equipement
            else:
                id_machine_racine = parent.id_machine_racine
            
            # Hériter pôle/zone si pas fournis
            if not id_pole:
                id_pole = parent.id_pole
            if not id_zone:
                id_zone = parent.id_zone
        
        # Parser date
        install_date = None
        if data.get("install_date"):
            try:
                install_date = date_type.fromisoformat(data["install_date"])
            except ValueError:
                pass
        
        equip = Equipement(
            equipment_code   = data["equipment_code"].strip().upper(),
            description      = data["description"].strip(),
            hierarchy_level  = hierarchy_level,
            id_parent        = id_parent,
            id_machine_racine= id_machine_racine,
            id_pole          = id_pole,
            id_zone          = id_zone,
            install_date     = install_date,
            status           = data.get("status", "NORMAL"),
            categorie        = data.get("categorie", "").strip() or None,
        )
        db.add(equip)
        db.commit()
        db.refresh(equip)
        return equip_to_dict(equip, db)
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── PUT modifier ──────────────────────────────────────────────────────

@router.put("/{id_equipement}")
async def modifier_equipement(
    id_equipement: int, data: dict, db: Session = Depends(get_db)
):
    try:
        equip = db.get(Equipement, id_equipement)
        if not equip:
            raise HTTPException(status_code=404, detail="Equipement introuvable")
        
        if "description" in data:
            equip.description = data["description"].strip()
        if "status" in data:
            equip.status = data["status"]
        if "categorie" in data:
            equip.categorie = data["categorie"] or None
        if "install_date" in data and data["install_date"]:
            try:
                equip.install_date = date_type.fromisoformat(data["install_date"])
            except ValueError:
                pass
        
        db.commit()
        db.refresh(equip)
        return equip_to_dict(equip, db)
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET roots (Level 1) ────────────────────────────────────────────────

@router.get("/roots")
def get_roots(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Toutes les machines racines (Level 1)"""
    try:
        roots = db.query(Equipement)\
              .filter(Equipement.hierarchy_level == 1)\
              .order_by(Equipement.equipment_code)\
              .limit(limit).all()
        return [equip_to_dict(r, db) for r in roots]
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── SEARCH autocomplete ──────────────────────────────────────────────

@router.get("/search")
def search_equipements(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Recherche par code ou description (tous levels)"""
    try:
        term = f"%{q.strip()}%"
        results = db.query(Equipement)\
                    .filter(
                        Equipement.equipment_code.ilike(term) |
                        Equipement.description.ilike(term)
                    )\
                    .order_by(Equipement.equipment_code)\
                    .limit(limit).all()
        return [{
            "id_equipement": e.id_equipement,
            "equipment_code": e.equipment_code,
            "description": e.description,
            "level": e.hierarchy_level,
            "has_children": len(e.enfants) > 0 if e.enfants else False
        } for e in results]
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET by code ────────────────────────────────────────────────────

@router.get("/by-code/{code}")
def get_by_code(code: str, db: Session = Depends(get_db)):
    """Recherche par code et retourne la chaîne complète vers la racine"""
    try:
        equip = db.query(Equipement)\
                  .filter(Equipement.equipment_code == code.strip().upper())\
                  .first()
        if not equip:
            return None
        
        # Construire la chaîne vers la racine
        chain = []
        current = equip
        while current:
            chain.insert(0, {
                "id_equipement": current.id_equipement,
                "equipment_code": current.equipment_code,
                "description": current.description,
                "level": current.hierarchy_level
            })
            if current.id_parent:
                current = db.get(Equipement, current.id_parent)
            else:
                break
        
        return {
            "equipement": {
                "id_equipement": equip.id_equipement,
                "equipment_code": equip.equipment_code,
                "description": equip.description,
                "level": equip.hierarchy_level,
                "id_parent": equip.id_parent
            },
            "chain": chain
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET children ────────────────────────────────────────────────────

@router.get("/children/{id_equipement}")
def get_children(id_equipement: int, db: Session = Depends(get_db)):
    """Enfants directs d'un équipement"""
    try:
        enfants = db.query(Equipement)\
                   .filter(Equipement.id_parent == id_equipement)\
                   .order_by(Equipement.equipment_code).all()
        return [{
            "id_equipement": e.id_equipement,
            "equipment_code": e.equipment_code,
            "description": e.description,
            "level": e.hierarchy_level,
            "has_children": len(e.enfants) > 0
        } for e in enfants]
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")