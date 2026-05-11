from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
import traceback
from database import get_db
from models.user import Utilisateur, RoleEnum
from models.pole import Pole
from models.equipe import Equipe
from schemas.user import UserCreate, UserUpdate
from core.security import hash_password, verify_password
from services.notification_service import manager

router = APIRouter()

def generer_email(prenom: str, nom: str) -> str:
    p = prenom.lower().strip().replace(" ", "")
    n = nom.lower().strip().replace(" ", "")
    return f"{p}.{n}@optima.dz"

def generer_identifiant(prenom: str, nom: str, db: Session) -> str:
    base = f"{prenom[0].lower()}{nom.lower().replace(' ', '')}"
    identifiant = base
    compteur = 1
    while db.query(Utilisateur).filter_by(identifiant=identifiant).first():
        identifiant = f"{base}{compteur}"
        compteur += 1
    return identifiant

def generer_mot_de_passe(date_embauche: date) -> str:
    return f"Optima@{date_embauche.strftime('%d%m%Y')}"

def user_to_dict(u: Utilisateur, db: Session) -> dict:
    pole   = db.get(Pole,   u.id_pole)   if u.id_pole   else None
    equipe = db.get(Equipe, u.id_equipe) if u.id_equipe else None
    return {
        "id_user"        : u.id_user,
        "nom"            : u.nom,
        "prenom"         : u.prenom,
        "email"          : u.email,
        "identifiant"    : u.identifiant,
        "role"           : u.role.value,
        "genre"          : u.genre.value,
        "date_naissance" : str(u.date_naissance),
        "date_embauche"  : str(u.date_embauche),
        "telephone"      : u.telephone,
        "id_pole"        : u.id_pole,
        "id_equipe"      : u.id_equipe,
        "nom_pole"       : pole.nom_pole     if pole   else None,
        "nom_equipe"     : equipe.nom_equipe if equipe else None,
    }

@router.get("/")
def liste_utilisateurs(db: Session = Depends(get_db)):
    try:
        users = db.query(Utilisateur).all()
        return [user_to_dict(u, db) for u in users]
    except Exception as e:
        print("ERREUR liste:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.get("/{id_user}")
def get_utilisateur(id_user: int, db: Session = Depends(get_db)):
    try:
        u = db.get(Utilisateur, id_user)
        if not u:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        return user_to_dict(u, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.post("/")
async def creer_utilisateur(data: UserCreate, db: Session = Depends(get_db)):
    try:
        # Vérifier chef équipe unique
        if data.role == RoleEnum.CHEF_EQUIPE and data.id_equipe:
            existant = db.query(Utilisateur).filter_by(
                role=RoleEnum.CHEF_EQUIPE,
                id_equipe=data.id_equipe
            ).first()
            if existant:
                raise HTTPException(
                    status_code=400,
                    detail="Cette équipe a déjà un chef d'équipe"
                )

        # Vérifier chef pole unique
        if data.role == RoleEnum.CHEF_POLE and data.id_pole:
            existant = db.query(Utilisateur).filter_by(
                role=RoleEnum.CHEF_POLE,
                id_pole=data.id_pole
            ).first()
            if existant:
                raise HTTPException(
                    status_code=400,
                    detail="Ce pôle a déjà un chef de pôle"
                )

        email       = generer_email(data.prenom, data.nom)
        identifiant = generer_identifiant(data.prenom, data.nom, db)
        mdp_initial = generer_mot_de_passe(data.date_embauche)

        if db.query(Utilisateur).filter_by(email=email).first():
            raise HTTPException(status_code=400, detail="Email déjà utilisé")

        user = Utilisateur(
            nom            = data.nom,
            prenom         = data.prenom,
            genre          = data.genre,
            date_naissance = data.date_naissance,
            date_embauche  = data.date_embauche,
            telephone      = data.telephone,
            email          = email,
            identifiant    = identifiant,
            mot_de_passe   = hash_password(mdp_initial),
            role           = data.role,
            id_pole        = data.id_pole,
            id_equipe      = data.id_equipe,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        pole = db.get(Pole, user.id_pole) if user.id_pole else None

        await manager.broadcast({
            "type"    : "NOUVEL_UTILISATEUR",
            "message" : f"Nouvel utilisateur : {data.prenom} {data.nom}",
            "payload" : {
                "id_user"  : user.id_user,
                "prenom"   : user.prenom,
                "nom"      : user.nom,
                "role"     : user.role.value,
                "id_pole"  : user.id_pole,
                "nom_pole" : pole.nom_pole if pole else None,
            }
        })

        return user_to_dict(user, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR création:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

# Route pour l'admin (rôle + équipe)
@router.put("/{id_user}/affectation")
async def modifier_affectation(
    id_user: int, data: dict, db: Session = Depends(get_db)
):
    try:
        user = db.get(Utilisateur, id_user)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        nouveau_role   = data.get("role")
        nouveau_equipe = data.get("id_equipe")

        # Vérifier chef équipe unique
        if nouveau_role == "CHEF_EQUIPE" and nouveau_equipe:
            existant = db.query(Utilisateur).filter(
                Utilisateur.role     == RoleEnum.CHEF_EQUIPE,
                Utilisateur.id_equipe == nouveau_equipe,
                Utilisateur.id_user  != id_user
            ).first()
            if existant:
                raise HTTPException(
                    status_code=400,
                    detail="Cette équipe a déjà un chef d'équipe"
                )

        # Vérifier chef pôle unique
        if nouveau_role == "CHEF_POLE":
            existant = db.query(Utilisateur).filter(
                Utilisateur.role    == RoleEnum.CHEF_POLE,
                Utilisateur.id_pole == user.id_pole,
                Utilisateur.id_user != id_user
            ).first()
            if existant:
                raise HTTPException(
                    status_code=400,
                    detail="Ce pôle a déjà un chef de pôle"
                )

        if nouveau_role:
            user.role = RoleEnum(nouveau_role)
        if "id_equipe" in data:
            user.id_equipe = nouveau_equipe

        db.commit()
        db.refresh(user)

        pole   = db.get(Pole,   user.id_pole)   if user.id_pole   else None
        equipe = db.get(Equipe, user.id_equipe) if user.id_equipe else None

        await manager.broadcast({
            "type"    : "UTILISATEUR_MODIFIE",
            "message" : f"Utilisateur modifié : {user.prenom} {user.nom}",
            "payload" : {
                "id_user"    : user.id_user,
                "id_pole"    : user.id_pole,
                "nom_pole"   : pole.nom_pole     if pole   else None,
                "nom_equipe" : equipe.nom_equipe if equipe else None,
                "nom"        : user.nom,
                "prenom"     : user.prenom,
                "role"       : user.role.value,
                "telephone"  : user.telephone,
                "date_naissance": str(user.date_naissance),
            }
        })

        return user_to_dict(user, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR affectation:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# Route pour le profil (téléphone + date naissance)
@router.put("/{id_user}/infos-personnelles")
async def modifier_infos_perso(
    id_user: int, data: dict, db: Session = Depends(get_db)
):
    try:
        user = db.get(Utilisateur, id_user)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        if "telephone"      in data: user.telephone      = data["telephone"]
        if "date_naissance" in data: user.date_naissance = data["date_naissance"]

        db.commit()
        db.refresh(user)

        await manager.broadcast({
            "type"    : "UTILISATEUR_MODIFIE",
            "message" : f"Utilisateur modifié : {user.prenom} {user.nom}",
            "payload" : {
                "id_user"        : user.id_user,
                "id_pole"        : user.id_pole,
                "nom"            : user.nom,
                "prenom"         : user.prenom,
                "telephone"      : user.telephone,
                "date_naissance" : str(user.date_naissance),
            }
        })

        return user_to_dict(user, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur serveur interne")
    

    
@router.delete("/{id_user}")
async def supprimer_utilisateur(id_user: int, db: Session = Depends(get_db)):
    try:
        user = db.get(Utilisateur, id_user)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        id_pole = user.id_pole
        prenom  = user.prenom
        nom     = user.nom
        pole    = db.get(Pole, id_pole) if id_pole else None

        db.delete(user)
        db.commit()

        await manager.broadcast({
            "type"    : "UTILISATEUR_SUPPRIME",
            "message" : f"Utilisateur supprimé : {prenom} {nom}",
            "payload" : {
                "id_user" : id_user,
                "id_pole" : id_pole,
            }
        })

        return {"message": "Utilisateur supprimé"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.post("/{id_user}/reinit-mdp")
def reinitialiser_mdp(id_user: int, db: Session = Depends(get_db)):
    user = db.get(Utilisateur, id_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    mdp_temp = generer_mot_de_passe(user.date_embauche)
    user.mot_de_passe = hash_password(mdp_temp)
    db.commit()
    # NE PAS retourner le mdp dans la réponse
    return {"message": "Mot de passe réinitialisé. L'utilisateur doit se connecter avec son mdp temporaire."}

@router.put("/{id_user}/changer-mdp")
def changer_mdp(id_user: int, data: dict, db: Session = Depends(get_db)):
    user = db.get(Utilisateur, id_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    ancien  = data.get("ancien_mdp",  "")
    nouveau = data.get("nouveau_mdp", "")
    if not verify_password(ancien, user.mot_de_passe):
        raise HTTPException(status_code=400, detail="Ancien mot de passe incorrect")
    if len(nouveau) < 6:
        raise HTTPException(status_code=400, detail="Minimum 6 caractères")
    user.mot_de_passe = hash_password(nouveau)
    db.commit()
    return {"message": "Mot de passe modifié avec succès"}