"""
routers/stock.py
─────────────────
Endpoints pour la gestion du stock de pièces.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from database import get_db
from models.stock import PieceStock, ComposanteStock, ReservationPiece, StatutReservation
from models.equipement import Equipement
from models.user import Utilisateur, RoleEnum
from services.notification_service import manager as _notif_manager

router = APIRouter(prefix="/stock", tags=["Stock"])


# ─────────────────────────────────────────────────────────────────────
# GET /stock/search?q=MOTEUR ELECTRIQUE
# GET /stock/search?q=STK-0001
# Recherche par désignation (ILIKE) OU code_stock exact
# ─────────────────────────────────────────────────────────────────────
@router.get("/search")
def search_piece(q: str, db: Session = Depends(get_db)):
    """
    Recherche une pièce par :
      - code_stock   : STK-0001  (exact, insensible casse)
      - designation  : MOTEUR    (ILIKE %query%)
    Retourne la liste des pièces avec leurs composantes liées.
    """
    q_clean = q.strip().upper()

    pieces = db.query(PieceStock).filter(
        or_(
            func.upper(PieceStock.code_stock)  == q_clean,
            func.upper(PieceStock.designation).contains(q_clean),
        )
    ).order_by(PieceStock.designation).limit(20).all()

    return [_serialize_piece(p) for p in pieces]


# ─────────────────────────────────────────────────────────────────────
# GET /stock/by-composante?equipment_code=B4313R2003-01
# Recherche par code SAP de la composante
# ─────────────────────────────────────────────────────────────────────
@router.get("/by-composante")
def get_piece_by_composante(equipment_code: str, db: Session = Depends(get_db)):
    """
    Trouve la pièce en stock associée à un code composante SAP.
    Un mécanicien saisit le code qu'il lit sur la machine.
    """
    lien = (
        db.query(ComposanteStock)
        .join(Equipement, Equipement.id_equipement == ComposanteStock.id_equipement)
        .filter(func.upper(Equipement.equipment_code) == equipment_code.strip().upper())
        .first()
    )

    if not lien:
        return None  # Frontend affiche "introuvable"

    return _serialize_piece(lien.piece)


# ─────────────────────────────────────────────────────────────────────
# GET /stock/liste?page=1&limit=20&search=&emplacement=
# Liste paginée de toutes les pièces en stock
# ─────────────────────────────────────────────────────────────────────
@router.get("/liste")
def list_pieces(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    emplacement: str = "",
    db: Session = Depends(get_db)
):
    """
    Liste paginée des pièces en stock avec filtres.
    """
    query = db.query(PieceStock)

    if search:
        search_clean = search.strip().upper()
        query = query.filter(
            or_(
                func.upper(PieceStock.code_stock).contains(search_clean),
                func.upper(PieceStock.designation).contains(search_clean),
            )
        )

    if emplacement:
        query = query.filter(
            func.upper(PieceStock.emplacement) == emplacement.strip().upper()
        )

    total = query.count()
    pieces = query.order_by(PieceStock.code_stock).offset((page - 1) * limit).limit(limit).all()

    return {
        "data": [_serialize_piece(p) for p in pieces],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


# ─────────────────────────────────────────────────────────────────────
# RÉSERVATIONS
# ─────────────────────────────────────────────────────────────────────

# POST /stock/reservation
# Créer une réservation
# ─────────────────────────────────────────────────────────────────────
@router.post("/reservation")
async def create_reservation(
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Crée une réservation de pièce.
    Body: { id_piece, id_ot, id_intervention, id_mecanicien, quantite_demandee, notes_mecanicien }
    """
    reservation = ReservationPiece(
        id_piece          = data.get("id_piece"),
        id_ot             = data.get("id_ot"),
        id_intervention   = data.get("id_intervention"),
        id_mecanicien     = data.get("id_mecanicien"),
        quantite_demandee = data.get("quantite_demandee", 1),
        notes_mecanicien  = data.get("notes_mecanicien"),
        statut            = StatutReservation.EN_ATTENTE,
    )

    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    # ── Notification → Gestionnaire(s) de stock ──────────────────────
    piece = db.get(PieceStock, reservation.id_piece)
    gestionnaires = db.query(Utilisateur).filter(
        Utilisateur.role == RoleEnum.GESTIONNAIRE_STOCK
    ).all()
    notif = {
        "type"         : "RESERVATION_PIECE",
        "id_reservation": reservation.id_reservation,
        "id_ot"        : reservation.id_ot,
        "code_piece"   : piece.code_stock if piece else None,
        "designation"  : piece.designation if piece else None,
        "quantite"     : reservation.quantite_demandee,
        "message"      : f"Nouvelle réservation de pièce en attente (OT #{reservation.id_ot})",
    }
    for g in gestionnaires:
        await _notif_manager.send_personal_message(g.id_user, notif)

    return {"message": "Réservation créée", "id_reservation": reservation.id_reservation}


# GET /stock/reservation/liste
# Liste des réservations avec filtres
# ─────────────────────────────────────────────────────────────────────
@router.get("/reservation/liste")
def list_reservations(
    page: int = 1,
    limit: int = 20,
    statut: str = "",
    id_mecanicien: int = None,
    id_ot: int = None,
    db: Session = Depends(get_db)
):
    """
    Liste paginée des réservations avec filtres.
    """
    query = db.query(ReservationPiece)

    if statut:
        query = query.filter(ReservationPiece.statut == StatutReservation(statut))
    if id_mecanicien:
        query = query.filter(ReservationPiece.id_mecanicien == id_mecanicien)
    if id_ot:
        query = query.filter(ReservationPiece.id_ot == id_ot)

    total = query.count()
    reservations = query.order_by(ReservationPiece.date_demande.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "data": [_serialize_reservation(r) for r in reservations],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


# PUT /stock/reservation/{id_reservation}/valider
# Valider une réservation (gestionnaire)
# ─────────────────────────────────────────────────────────────────────
@router.put("/reservation/{id_reservation}/valider")
def valider_reservation(
    id_reservation: int,
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Valide une réservation (passe de EN_ATTENTE à VALIDEE).
    Body: { id_gestionnaire, notes_gestionnaire }
    """
    reservation = db.query(ReservationPiece).filter(ReservationPiece.id_reservation == id_reservation).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    reservation.statut = StatutReservation.VALIDEE
    reservation.id_gestionnaire = data.get("id_gestionnaire")
    reservation.notes_gestionnaire = data.get("notes_gestionnaire")
    reservation.date_validation = func.now()

    db.commit()

    return {"message": "Réservation validée"}


# PUT /stock/reservation/{id_reservation}/livrer
# Marquer comme livrée
# ─────────────────────────────────────────────────────────────────────
@router.put("/reservation/{id_reservation}/livrer")
async def livrer_reservation(
    id_reservation: int,
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Marque une réservation comme livrée (passe de VALIDEE à LIVREE).
    Body: { quantite_livree }
    """
    reservation = db.query(ReservationPiece).filter(ReservationPiece.id_reservation == id_reservation).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    reservation.statut          = StatutReservation.LIVREE
    reservation.quantite_livree = data.get("quantite_livree", reservation.quantite_demandee)
    reservation.date_livraison  = func.now()

    # Décrémenter le stock
    piece = db.query(PieceStock).filter(PieceStock.id_piece == reservation.id_piece).first()
    if piece:
        piece.quantite -= reservation.quantite_livree

    db.commit()

    # ── Notification → Maintenancier (pièce disponible) ──────────────
    if reservation.id_mecanicien:
        await _notif_manager.send_personal_message(
            reservation.id_mecanicien,
            {
                "type"          : "PIECE_LIVREE",
                "id_reservation": reservation.id_reservation,
                "id_ot"         : reservation.id_ot,
                "code_piece"    : piece.code_stock  if piece else None,
                "designation"   : piece.designation if piece else None,
                "quantite"      : reservation.quantite_livree,
                "message"       : f"Votre pièce a été livrée et est disponible (OT #{reservation.id_ot})",
            }
        )

    return {"message": "Réservation livrée"}


# PUT /stock/reservation/{id_reservation}/annuler
# Annuler une réservation
# ─────────────────────────────────────────────────────────────────────
@router.put("/reservation/{id_reservation}/annuler")
def annuler_reservation(
    id_reservation: int,
    db: Session = Depends(get_db)
):
    """
    Annule une réservation (passe à ANNULEE).
    """
    reservation = db.query(ReservationPiece).filter(ReservationPiece.id_reservation == id_reservation).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    
    if reservation.statut == StatutReservation.LIVREE:
        raise HTTPException(status_code=400, detail="Impossible d'annuler une réservation déjà livrée")
    
    reservation.statut = StatutReservation.ANNULEE
    
    db.commit()
    
    return {"message": "Réservation annulée"}


# HELPER : sérialisation réservation
# ─────────────────────────────────────────────────────────────────────
def _serialize_reservation(res: ReservationPiece) -> dict:
    return {
        "id_reservation": res.id_reservation,
        "id_piece": res.id_piece,
        "code_stock": res.piece.code_stock if res.piece else None,
        "designation": res.piece.designation if res.piece else None,
        "id_ot": res.id_ot,
        "id_intervention": res.id_intervention,
        "id_mecanicien": res.id_mecanicien,
        "mecanicien_nom": res.mecanicien.nom if res.mecanicien else None,
        "quantite_demandee": res.quantite_demandee,
        "quantite_livree": res.quantite_livree,
        "statut": res.statut.value if res.statut else None,
        "notes_mecanicien": res.notes_mecanicien,
        "notes_gestionnaire": res.notes_gestionnaire,
        "date_demande": res.date_demande.isoformat() if res.date_demande else None,
        "date_validation": res.date_validation.isoformat() if res.date_validation else None,
        "date_livraison": res.date_livraison.isoformat() if res.date_livraison else None,
    }


# ─────────────────────────────────────────────────────────────────────
# HELPER : sérialisation pièce + composantes liées
# ─────────────────────────────────────────────────────────────────────
def _serialize_piece(piece: PieceStock) -> dict:
    composantes = [
        {
            "equipment_code": cs.equipement.equipment_code,
            "description":    cs.equipement.description,
            "level":          cs.equipement.hierarchy_level,
        }
        for cs in piece.composantes
        if cs.equipement
    ]
    return {
        "id_piece":         piece.id_piece,
        "code_stock":       piece.code_stock,
        "designation":      piece.designation,
        "description":      piece.description,
        "quantite":         piece.quantite,
        "seuil_alerte":     piece.seuil_alerte,
        "emplacement":      piece.emplacement,
        "unite":            piece.unite,
        "nb_composantes":   len(composantes),
        "composantes_liees": composantes,
    }


# ─────────────────────────────────────────────────────────────────────
# GET /stock/{code_stock}
# Détail complet d'une pièce
# (placé à la fin pour éviter les conflits avec les autres routes)
# ─────────────────────────────────────────────────────────────────────
@router.get("/{code_stock}")
def get_piece(code_stock: str, db: Session = Depends(get_db)):
    piece = db.query(PieceStock).filter(
        func.upper(PieceStock.code_stock) == code_stock.strip().upper()
    ).first()
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce introuvable")
    return _serialize_piece(piece)