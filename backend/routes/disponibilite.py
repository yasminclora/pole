from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime
from database import get_db
from models.user import Utilisateur, RoleEnum
from models.equipe import Equipe
from models.planing import ConfigPlanning

router = APIRouter()

CYCLE = ["Matin", "Matin", "Apres-midi", "Apres-midi", "Nuit", "Nuit", "Repos", "Repos"]
ORDRE = ["Alpha", "Bravo", "Charlie", "Delta"]


def get_quart_simple(date_cible: date, config: ConfigPlanning | None, equipe: Equipe) -> str:
    """
    Calcule le quart de travail pour une équipe à une date donnée.
    Utilise la date_reference_cycle et position_initiale_cycle de l'équipe.
    """
    if not equipe:
        return "Matin"
    
    # Si pas de config, utiliser la date de référence de l'équipe
    ref_date = config.date_debut if config else equipe.date_reference_cycle
    if not ref_date:
        return "Matin"
    
    # Déterminer la position de l'équipe (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)
    nom_court = equipe.nom_equipe.strip().split(" ")[-1] if equipe.nom_equipe else "Alpha"
    if nom_court not in ORDRE:
        nom_court = "Alpha"
    
    team_index = ORDRE.index(nom_court)
    decalage = team_index * 2
    
    # Position initiale de l'équipe dans le cycle
    position_initiale = equipe.position_initiale_cycle if equipe.position_initiale_cycle is not None else 0
    
    # Calculer les jours écoulés
    try:
        ecart = (date_cible - ref_date).days
    except:
        ecart = 0
    
    # Position dans le cycle de 8 jours
    position = (position_initiale + decalage + ecart) % 8
    
    return CYCLE[position]


@router.get("/disponibilites-par-date")
def get_disponibilites_par_date(
    id_pole: int,
    date_cible: str,  # YYYY-MM-DD
    classe: str,
    db: Session = Depends(get_db)
):
    """
    Retourne les utilisateurs disponibles pour une date donnée et une classe.
    Un utilisateur est disponible s'il travaille en quart 'Matin' (06h-14h).
    """
    try:
        target_date = date.fromisoformat(date_cible)
    except:
        target_date = date.today()
    
    # Récupérer la config du pôle
    config = db.query(ConfigPlanning).filter_by(id_pole=id_pole).first()
    
    # Récupérer toutes les équipes du pôle
    equipes = db.query(Equipe).filter_by(id_pole=id_pole).all()
    
    result = []
    
    for equipe in equipes:
        # Calculer le quart pour cette équipe à cette date
        quart = get_quart_simple(target_date, config, equipe)
        
        # SiRepos, l'équipe ne travaille pas
        if quart == "Repos":
            continue
        
        # Si le quart est "Matin", les utilisateurs sont disponibles (06h-14h)
        # On peut aussi inclure Apres-midi si on veut, mais ici on filtre sur Matin
        if quart != "Matin":
            continue
        
        # Récupérer les utilisateurs de cette équipe
        users = db.query(Utilisateur).filter(
            Utilisateur.id_equipe == equipe.id_equipe,
            Utilisateur.role.in_([RoleEnum.MECANICIEN, RoleEnum.TECHNICIEN])
        ).all()
        
        for user in users:
            # Filtrer par classe
            if classe == "MECANIQUE" and user.role != RoleEnum.MECANICIEN:
                continue
            if classe == "ELECTRIQUE" and user.role != RoleEnum.TECHNICIEN:
                continue
            
            result.append({
                "id": user.id_user,
                "nom": user.nom,
                "prenom": user.prenom,
                "role": user.role.value,
                "id_equipe": equipe.id_equipe,
                "equipe": equipe.nom_equipe,
                "quart": quart,
                "disponible": True
            })
    
    return result


@router.get("/tous-par-pole")
def get_tous_utilisateurs_par_pole(
    id_pole: int,
    classe: str,
    db: Session = Depends(get_db)
):
    """
    Retourne tous les mécaniciens/techniciens du pôle (sans filtrer par date).
    Pour fallback si pas de planning configuré.
    """
    users = db.query(Utilisateur).join(Equipe).filter(
        Equipe.id_pole == id_pole,
        Utilisateur.role.in_([RoleEnum.MECANICIEN, RoleEnum.TECHNICIEN])
    ).all()
    
    result = []
    for user in users:
        if classe == "MECANIQUE" and user.role != RoleEnum.MECANICIEN:
            continue
        if classe == "ELECTRIQUE" and user.role != RoleEnum.TECHNICIEN:
            continue
        
        result.append({
            "id": user.id_user,
            "nom": user.nom,
            "prenom": user.prenom,
            "role": user.role.value,
            "id_equipe": user.id_equipe,
            "equipe": user.equipe.nom_equipe if user.equipe else "Sans équipe",
            "quart": "Matin",
            "disponible": True
        })
    
    return result


@router.get("/stock-par-code")
def get_stock_par_code(
    equipment_code: str,
    db: Session = Depends(get_db)
):
    """
    Retourne la pièce de stock liée à un équipement via equipment_code.
    """
    from models.stock import ComposanteStock, PieceStock
    from models.equipement import Equipement
    
    # Chercher le lien composante -> piece via equipment_code
    composante = db.query(ComposanteStock).join(
        Equipement, Equipement.id_equipement == ComposanteStock.id_equipement
    ).filter(
        Equipement.equipment_code == equipment_code.upper()
    ).first()
    
    if composante:
        piece = db.get(PieceStock, composante.id_piece)
        if piece:
            status = "ok"
            if piece.quantite == 0:
                status = "critical"
            elif piece.quantite <= piece.seuil_alerte:
                status = "warning"
            
            return {
                "has_stock": True,
                "piece": {
                    "id_piece": piece.id_piece,
                    "code_stock": piece.code_stock,
                    "designation": piece.designation,
                    "quantite": piece.quantite,
                    "seuil_alerte": piece.seuil_alerte,
                    "emplacement": piece.emplacement,
                    "unite": piece.unite,
                    "status": status
                }
            }
    
    return {
        "has_stock": False,
        "message": "Aucune pièce liée à cet équipement"
    }


@router.get("/equipes-par-pole")
def get_equipes_par_pole(
    id_pole: int,
    db: Session = Depends(get_db)
):
    """
    Retourne les équipes du pôle avec leur membres.
    """
    equipes = db.query(Equipe).filter_by(id_pole=id_pole).all()
    
    result = []
    for equipe in equipes:
        users = db.query(Utilisateur).filter(
            Utilisateur.id_equipe == equipe.id_equipe,
            Utilisateur.role.in_([RoleEnum.MECANICIEN, RoleEnum.TECHNICIEN])
        ).all()
        
        result.append({
            "id_equipe": equipe.id_equipe,
            "nom_equipe": equipe.nom_equipe,
            "date_reference_cycle": str(equipe.date_reference_cycle) if equipe.date_reference_cycle else None,
            "position_initiale_cycle": equipe.position_initiale_cycle,
            "membres": [
                {
                    "id": u.id_user,
                    "nom": u.nom,
                    "prenom": u.prenom,
                    "role": u.role.value
                }
                for u in users
            ]
        })
    
    return result