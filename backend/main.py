from dotenv import load_dotenv
load_dotenv()   # charge .env AVANT tout import qui lit os.environ

import logging
import traceback
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("optima")

# ── CORS middleware en PREMIER ───────────────────────────────────────
_origins_env = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")

# Gérer le cas "*" pour allow_credentials=false, sinon liste d'origines
if _origins_env.strip() == "*":
    ALLOWED_ORIGINS = ["*"]
    _allow_credentials = False
else:
    ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]
    _allow_credentials = True

print(f"🚀 CORS Config: origins={ALLOWED_ORIGINS}, credentials={_allow_credentials}", flush=True)

app = FastAPI(title="Optima Maintenance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ALLOWED_ORIGINS,
    allow_credentials = _allow_credentials,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# Route explicite pour OPTIONS preflight - sert à tout le monde
@app.options("/{full_path:path}")
async def preflight_handler(full_path: str):
    print(f"🔃 OPTIONS preflight pour: {full_path}")
    from fastapi.responses import Response
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )

# ── Handler global pour les erreurs 500 ─────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    tb = traceback.format_exc()
    print(f"\n{'='*60}\n[ERREUR] {request.method} {request.url.path}\n{tb}\n{'='*60}\n", flush=True)
    logger.error("Exception non gérée sur %s %s : %s", request.method, request.url.path, exc)

    return JSONResponse(
        status_code=500,
        content={"detail": f"Erreur serveur : {type(exc).__name__} — {exc}"},
    )

# ── Auth middleware ────────────────────────────────────────────────────
from fastapi import Depends
from core.dependencies import get_current_user

_auth = [Depends(get_current_user)]   # alias pratique

# ── Routes existantes ─────────────────────────────────────────────────
from routes.auth         import router as auth_router        # PUBLIC : login + reset mdp
from routes.users        import router as users_router
from routes.pole         import router as poles_router
from routes.zones        import router as zones_router
from routes.equipes      import router as equipes_router
from routes.planning     import router as planning_router
from routes.equipements  import router as equipements_router
from routes.di           import router as di_router
from routes.ot           import router as ot_router
from routes.intervention import router as intervention_router
from routes.stock        import router as stock_router
from routes.historique   import router as historique_router

# ── Dashboard & Predictions ──────────────────────────────────
from routes.dashboard    import router as dashboard_router
from routes.predictions  import router as predictions_router

# ── Disponibilite ──────────────────────────────────────────────
from routes.disponibilite import router as disponibilite_router


# /auth  → PUBLIC (login, reset mdp) — pas de _auth ici
app.include_router(auth_router,         prefix="/auth",          tags=["Auth"])

# Toutes les autres routes exigent un JWT valide
app.include_router(users_router,        prefix="/users",         tags=["Users"],         dependencies=_auth)
app.include_router(poles_router,        prefix="/poles",         tags=["Poles"],         dependencies=_auth)
app.include_router(zones_router,        prefix="/zones",         tags=["Zones"],         dependencies=_auth)
app.include_router(equipes_router,      prefix="/equipes",       tags=["Equipes"],       dependencies=_auth)
app.include_router(planning_router,     prefix="/planning",      tags=["Planning"],      dependencies=_auth)
app.include_router(equipements_router,  prefix="/equipements",   tags=["Equipements"],   dependencies=_auth)
app.include_router(di_router,           prefix="/di",            tags=["DI"],            dependencies=_auth)
app.include_router(ot_router,           prefix="/ot",            tags=["OT"],            dependencies=_auth)
app.include_router(intervention_router, prefix="/interventions", tags=["Interventions"], dependencies=_auth)
app.include_router(dashboard_router,    dependencies=_auth)     # préfixe /dashboard défini dans le router
app.include_router(stock_router,        dependencies=_auth)     # préfixe /stock défini dans le router
app.include_router(historique_router,   dependencies=_auth)     # préfixe /historique défini dans le router
app.include_router(predictions_router,  dependencies=_auth)
app.include_router(disponibilite_router, prefix="/disponibilite", tags=["Disponibilite"], dependencies=_auth)

# ── WebSocket ─────────────────────────────────────────────────────────
from services.notification_service import manager
from core.security import decode_token
from jose import JWTError

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    token: str = Query(..., description="JWT token pour authentifier la connexion WS"),
):
    """
    Connexion WebSocket sécurisée.
    Le client doit passer le token JWT en query param :
        ws://host/ws/42?token=eyJ...
    """
    try:
        payload = decode_token(token)
        token_user_id = int(payload.get("sub", -1))
        if token_user_id != user_id:
            await websocket.close(code=4003, reason="Token ne correspond pas à l'user_id")
            return
    except JWTError:
        await websocket.close(code=4001, reason="Token invalide ou expiré")
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)

@app.get("/")
def root():
    return {"status": "ok", "message": "Optima Maintenance API"}

# Endpoint test pour vérifier que le backend répond
@app.get("/test")
def test():
    return {"test": "ok", "message": "Backend fonctionne!"}