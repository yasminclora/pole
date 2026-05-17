"""
Dépendances FastAPI centrales pour l'authentification et l'autorisation.

Usage dans les routes :
    from core.dependencies import get_current_user, require_roles

    @router.get("/ma-route")
    def ma_route(current_user: dict = Depends(get_current_user)):
        ...

    @router.delete("/admin-only")
    def admin_only(current_user: dict = Depends(require_roles("ADMIN"))):
        ...
"""

from functools import lru_cache
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from core.security import decode_token

# Schéma Bearer Token
_bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """
    Extrait et valide le JWT depuis le header Authorization: Bearer <token>.
    Retourne le payload du token (sub, email, role, nom, prenom, id_pole).
    Lève 401 si le token est absent, expiré ou invalide.
    """
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token mal formé : champ 'sub' manquant.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "id_user" : int(user_id),
        "email"   : payload.get("email"),
        "role"    : payload.get("role"),
        "nom"     : payload.get("nom"),
        "prenom"  : payload.get("prenom"),
        "id_pole" : payload.get("id_pole"),
    }


def require_roles(*roles: str):
    """
    Fabrique de dépendance : vérifie que l'utilisateur connecté a l'un des rôles donnés.

    Exemple :
        Depends(require_roles("ADMIN", "METHODISTE"))
    """
    def _check(current_user: dict = Depends(get_current_user)) -> dict:
        # Normaliser le rôle : le JWT peut contenir "RoleEnum.ADMIN" (str d'un Enum)
        # ou directement "ADMIN" — on accepte les deux formats.
        raw_role = current_user.get("role") or ""
        user_role = raw_role.split(".")[-1] if "." in raw_role else raw_role
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôle requis : {', '.join(roles)}.",
            )
        return current_user
    return _check
