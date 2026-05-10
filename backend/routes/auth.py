import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.user import Utilisateur
from models.pole import Pole
from models.equipe import Equipe
from schemas.auth import LoginRequest, TokenResponse
from core.security import verify_password, create_token, hash_password
from core.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    logger.info(f"🔐 Tentative de login pour: {data.email}")
    try:
        user = db.query(Utilisateur).filter(
            Utilisateur.email == data.email
        ).first()
        logger.info(f"👤 Utilisateur trouvé: {user}")
    except Exception as exc:
        logger.error("Erreur DB lors du login : %s", exc, exc_info=True)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur base de données: {exc}")

    if not user or not verify_password(data.mot_de_passe, user.mot_de_passe):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    pole   = db.get(Pole,   user.id_pole)   if user.id_pole   else None
    equipe = db.get(Equipe, user.id_equipe) if user.id_equipe else None

    try:
        role_val  = str(user.role)   if user.role  else ""
        genre_val = str(user.genre)  if user.genre else ""
    except Exception:
        role_val  = user.role  or ""
        genre_val = user.genre or ""

    token = create_token({
        "sub"     : str(user.id_user),
        "email"   : user.email,
        "role"    : role_val,
        "nom"     : user.nom,
        "prenom"  : user.prenom,
        "id_pole" : user.id_pole,
    })

    return {
        "access_token": token,
        "token_type"  : "bearer",
        "user": {
            "id_user"        : user.id_user,
            "nom"            : user.nom,
            "prenom"         : user.prenom,
            "role"           : role_val,
            "email"          : user.email,
            "identifiant"    : user.identifiant,
            "id_pole"        : user.id_pole,
            "nom_pole"       : pole.nom_pole       if pole   else None,
            "nom_equipe"     : equipe.nom_equipe   if equipe else None,
            "genre"          : genre_val,
            "date_embauche"  : str(user.date_embauche)  if user.date_embauche  else None,
            "date_naissance" : str(user.date_naissance) if user.date_naissance else None,
            "telephone"      : user.telephone,
            "id_equipe"      : user.id_equipe,
        }
    }

@router.get("/me")
def me(
    db           : Session = Depends(get_db),
    current_user : dict    = Depends(get_current_user),
):
    """
    Retourne les données complètes de l'utilisateur connecté.
    Nécessite : Authorization: Bearer <token>
    """
    user = db.get(Utilisateur, current_user["id_user"])
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    pole   = db.get(Pole,   user.id_pole)   if user.id_pole   else None
    equipe = db.get(Equipe, user.id_equipe) if user.id_equipe else None

    return {
        "id_user"        : user.id_user,
        "nom"            : user.nom,
        "prenom"         : user.prenom,
        "role"           : str(user.role)  if user.role  else "",
        "email"          : user.email,
        "identifiant"    : user.identifiant,
        "id_pole"        : user.id_pole,
        "nom_pole"       : pole.nom_pole       if pole   else None,
        "nom_equipe"     : equipe.nom_equipe   if equipe else None,
        "genre"          : str(user.genre) if user.genre else "",
        "date_embauche"  : str(user.date_embauche)  if user.date_embauche  else None,
        "date_naissance" : str(user.date_naissance) if user.date_naissance else None,
        "telephone"      : user.telephone,
        "id_equipe"      : user.id_equipe,
    }


@router.post("/reinitialiser-mdp")
def reinitialiser_mdp_public(data: dict, db: Session = Depends(get_db)):
    """
    Réinitialise le mot de passe.
    SÉCURITÉ : ne retourne JAMAIS le nouveau mot de passe.
    En production, envoyer un lien email avec token temporaire.
    """
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email requis")

    user = db.query(Utilisateur).filter(Utilisateur.email == email).first()

    # Toujours retourner le même message (pas d'énumération d'emails)
    if not user:
        return {"message": "Si cet email existe, le mot de passe a été réinitialisé."}

    # Mot de passe temporaire basé sur la date d'embauche
    # TODO : remplacer par envoi d'email avec token sécurisé (secrets.token_urlsafe)
    mdp_temp = f"Optima@{user.date_embauche.strftime('%d%m%Y')}"
    user.mot_de_passe = hash_password(mdp_temp)
    db.commit()

    # NE PAS retourner mdp_temp dans la réponse JSON
    return {"message": "Mot de passe réinitialisé. Connectez-vous avec votre mot de passe temporaire."}