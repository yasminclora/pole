"""
Routes pour gérer les notifications côté client.
- GET    /notifications/me              → liste paginée (toutes ou non-lues)
- GET    /notifications/me/non-lues     → non lues uniquement (pour rattrapage WS)
- GET    /notifications/me/count-non-lues
- PUT    /notifications/{id}/lu         → marquer une notif comme lue
- POST   /notifications/me/tout-marquer-lu
- DELETE /notifications/{id}            → supprimer une notif
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime

from database import get_db
from core.dependencies import get_current_user
from models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _serialize(n: Notification) -> dict:
    return {
        "id_notification": n.id_notification,
        "type"           : n.type,
        "titre"          : n.titre,
        "message"        : n.message,
        "payload"        : n.payload or {},
        "id_ot"          : n.id_ot,
        "id_reservation" : n.id_reservation,
        "id_di"          : n.id_di,
        "lu"             : bool(n.lu),
        "date_lecture"   : n.date_lecture.isoformat() if n.date_lecture else None,
        "created_at"     : n.created_at.isoformat()   if n.created_at   else None,
    }


@router.get("/me")
def liste_mes_notifications(
    limit       : int  = 50,
    only_unread : bool = False,
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    """Liste des notifications du user connecté, triées par date desc."""
    user_id = current_user["id_user"]
    q = db.query(Notification).filter(Notification.id_user == user_id)
    if only_unread:
        q = q.filter(Notification.lu == False)  # noqa: E712
    notifs = q.order_by(desc(Notification.created_at)).limit(limit).all()
    return [_serialize(n) for n in notifs]


@router.get("/me/non-lues")
def mes_non_lues(
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    """Rattrapage : appelée par le client à la (re)connexion WS."""
    user_id = current_user["id_user"]
    notifs = db.query(Notification).filter(
        Notification.id_user == user_id,
        Notification.lu      == False,        # noqa: E712
    ).order_by(desc(Notification.created_at)).all()
    return [_serialize(n) for n in notifs]


@router.get("/me/count-non-lues")
def compte_non_lues(
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    user_id = current_user["id_user"]
    count = db.query(Notification).filter(
        Notification.id_user == user_id,
        Notification.lu      == False,        # noqa: E712
    ).count()
    return {"count": count}


@router.put("/{id_notification}/lu")
def marquer_lu(
    id_notification: int,
    db             : Session = Depends(get_db),
    current_user   : dict    = Depends(get_current_user),
):
    notif = db.get(Notification, id_notification)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    if notif.id_user != current_user["id_user"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    notif.lu           = True
    notif.date_lecture = datetime.now()
    db.commit()
    return {"ok": True}


@router.post("/me/tout-marquer-lu")
def tout_marquer_lu(
    db          : Session = Depends(get_db),
    current_user: dict    = Depends(get_current_user),
):
    user_id = current_user["id_user"]
    now     = datetime.now()
    db.query(Notification).filter(
        Notification.id_user == user_id,
        Notification.lu      == False,        # noqa: E712
    ).update({"lu": True, "date_lecture": now}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.delete("/{id_notification}")
def supprimer_notif(
    id_notification: int,
    db             : Session = Depends(get_db),
    current_user   : dict    = Depends(get_current_user),
):
    notif = db.get(Notification, id_notification)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    if notif.id_user != current_user["id_user"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    db.delete(notif)
    db.commit()
    return {"ok": True}
