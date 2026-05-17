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
# GET /stock/search?q=B4313R2003-01
# Recherche par designation, code_stock OU code equipement (composante)
# ─────────────────────────────────────────────────────────────────────
@router.get("/search")
def search_piece(q: str, db: Session = Depends(get_db)):
    """
    Recherche une piece par :
      - code_stock   : STK-0001  (contient)
      - designation  : MOTEUR    (contient)
    """
    if not q or not q.strip():
        return []
    
    q_clean = q.strip().upper()
    print(f"[Stock Search] Query: {q_clean}")

    pieces = db.query(PieceStock).filter(
        or_(
            PieceStock.code_stock.contains(q_clean),
            PieceStock.designation.contains(q_clean),
        )
    ).order_by(PieceStock.designation).limit(20).all()

    print(f"[Stock Search] Found: {len(pieces)} pieces")
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
# Liste paginee de toutes les pieces en stock
# Recherche par code_stock, designation OU code equipement (composante)
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
    Liste paginee des pieces en stock avec filtres.
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
    print(f"[Stock] Reservation created: {reservation.id_reservation}, Gestionnaires trouves: {len(gestionnaires)}")
    
    notif = {
        "type"         : "RESERVATION_PIECE",
        "id_reservation": reservation.id_reservation,
        "id_ot"        : reservation.id_ot,
        "code_piece"   : piece.code_stock if piece else None,
        "designation"  : piece.designation if piece else None,
        "quantite"     : reservation.quantite_demandee,
        "message"      : f"Nouvelle reservation de piece en attente (OT #{reservation.id_ot})",
    }
    for g in gestionnaires:
        print(f"[Stock] Sending notif to gestionnaire: {g.id_user} - {g.email}")
        await _notif_manager.send_personal_message(user_id=g.id_user, message=notif)

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
        "data": [_serialize_reservation(r, db) for r in reservations],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


# PUT /stock/reservation/{id_reservation}/valider
# Valider une réservation (gestionnaire)
# ─────────────────────────────────────────────────────────────────────
@router.put("/reservation/{id_reservation}/valider")
async def valider_reservation(
    id_reservation: int,
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Valide une réservation (passe de EN_ATTENTE à VALIDEE).
    Body: { id_gestionnaire, notes_gestionnaire }
    Notifie le mécanicien que sa demande est validée.
    """
    from datetime import datetime
    reservation = db.query(ReservationPiece).filter(ReservationPiece.id_reservation == id_reservation).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    reservation.statut = StatutReservation.VALIDEE
    reservation.id_gestionnaire = data.get("id_gestionnaire")
    reservation.notes_gestionnaire = data.get("notes_gestionnaire")
    reservation.date_validation = datetime.now()

    db.commit()
    db.refresh(reservation)

    # ── Notification au mécanicien : sa demande est validée ──────────
    if reservation.id_mecanicien:
        piece = db.get(PieceStock, reservation.id_piece)
        await _notif_manager.send_personal_message(
            user_id=reservation.id_mecanicien,
            message={
                "type"          : "RESERVATION_VALIDEE",
                "id_reservation": reservation.id_reservation,
                "id_ot"         : reservation.id_ot,
                "code_piece"    : piece.code_stock if piece else None,
                "designation"   : piece.designation if piece else None,
                "titre"         : "Réservation validée",
                "message"       : f"Votre demande de pièce {piece.designation if piece else ''} a été validée. Le magasinier prépare la livraison.",
            }, db=db
        )

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
    La livraison n'est possible que si la date_prevue de l'OT est atteinte.
    """
    from datetime import datetime
    from models.ot import OrdreTravail
    
    reservation = db.query(ReservationPiece).filter(ReservationPiece.id_reservation == id_reservation).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    
    # Vérifier que la date_prevue de l'OT est atteinte
    ot = db.query(OrdreTravail).filter(OrdreTravail.id_ot == reservation.id_ot).first()
    if ot and ot.date_prevue:
        now = datetime.now()
        if now < ot.date_prevue:
            raise HTTPException(
                status_code=400,
                detail=f"La livraison n'est possible qu'à partir du {ot.date_prevue.strftime('%d/%m/%Y à %H:%M')}"
            )

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


# HELPER : serialisation reservation enrichie
# ─────────────────────────────────────────────────────────────────────
def _serialize_reservation(res: ReservationPiece, db: Session = None) -> dict:
    # ── Détails OT
    date_prevue            = None
    numero_ot              = None
    equipement_code        = None
    equipement_description = None
    ot_statut              = None
    ot_priorite            = None
    machine_racine_code    = None
    nom_zone               = None

    if db and res.id_ot:
        from models.ot import OrdreTravail
        from models.zone import Zone
        ot = db.query(OrdreTravail).filter(OrdreTravail.id_ot == res.id_ot).first()
        if ot:
            if ot.date_prevue:
                date_prevue = ot.date_prevue.isoformat()
            numero_ot   = ot.numero_ot
            ot_statut   = ot.statut.value if ot.statut else None
            ot_priorite = ot.priorite.value if ot.priorite else None
            if ot.equipement:
                equipement_code        = ot.equipement.equipment_code
                equipement_description = ot.equipement.description
                if ot.equipement.machine_racine:
                    machine_racine_code = ot.equipement.machine_racine.equipment_code
                if ot.equipement.id_zone:
                    z = db.get(Zone, ot.equipement.id_zone)
                    if z:
                        nom_zone = z.nom_zone

    # ── Détails complets du demandeur ──────────────────────────────
    demandeur = None
    if res.mecanicien:
        m = res.mecanicien
        nom_equipe  = None
        nom_pole    = None
        if db:
            if m.id_equipe:
                from models.equipe import Equipe
                eq = db.get(Equipe, m.id_equipe)
                if eq:
                    nom_equipe = eq.nom_equipe
            if m.id_pole:
                from models.pole import Pole
                p = db.get(Pole, m.id_pole)
                if p:
                    nom_pole = p.nom_pole

        # Initiales pour l'avatar
        initiales = (
            (m.prenom[:1] if m.prenom else "") + (m.nom[:1] if m.nom else "")
        ).upper() or "?"

        demandeur = {
            "id_user"   : m.id_user,
            "nom"       : m.nom,
            "prenom"    : m.prenom,
            "nom_complet": f"{m.prenom} {m.nom}",
            "email"     : m.email,
            "telephone" : m.telephone,
            "role"      : m.role.value if m.role else None,
            "id_equipe" : m.id_equipe,
            "nom_equipe": nom_equipe,
            "id_pole"   : m.id_pole,
            "nom_pole"  : nom_pole,
            "initiales" : initiales,
        }

    return {
        "id_reservation"        : res.id_reservation,
        "id_piece"              : res.id_piece,
        "code_stock"            : res.piece.code_stock if res.piece else None,
        "designation"           : res.piece.designation if res.piece else None,
        "description"           : res.piece.description if res.piece else None,
        "quantite_stock"        : res.piece.quantite if res.piece else None,
        "emplacement"           : res.piece.emplacement if res.piece else None,
        "id_ot"                 : res.id_ot,
        "numero_ot"             : numero_ot,
        "ot_statut"             : ot_statut,
        "ot_priorite"           : ot_priorite,
        "date_prevue"           : date_prevue,
        "equipement_code"       : equipement_code,
        "equipement_description": equipement_description,
        "machine_racine_code"   : machine_racine_code,
        "nom_zone"              : nom_zone,
        "id_intervention"       : res.id_intervention,
        # — Demandeur (rétrocompat anciens champs + nouveau bloc complet)
        "id_mecanicien"         : res.id_mecanicien,
        "mecanicien_nom"        : res.mecanicien.nom if res.mecanicien else None,
        "mecanicien_role"       : res.mecanicien.role.value if res.mecanicien and res.mecanicien.role else None,
        "demandeur"             : demandeur,
        # — Quantités & statut
        "quantite_demandee"     : res.quantite_demandee,
        "quantite_livree"       : res.quantite_livree,
        "statut"                : res.statut.value if res.statut else None,
        "notes_mecanicien"      : res.notes_mecanicien,
        "notes_gestionnaire"    : res.notes_gestionnaire,
        "date_demande"          : res.date_demande.isoformat() if res.date_demande else None,
        "date_validation"       : res.date_validation.isoformat() if res.date_validation else None,
        "date_livraison"        : res.date_livraison.isoformat() if res.date_livraison else None,
    }


# ─────────────────────────────────────────────────────────────────────
# HELPER : sérialisation pièce + composantes liées
# ─────────────────────────────────────────────────────────────────────
def _serialize_piece(piece: PieceStock) -> dict:
    composantes = []
    for cs in piece.composantes:
        if not cs.equipement:
            continue
        mr = cs.equipement.machine_racine
        composantes.append({
            "equipment_code":     cs.equipement.equipment_code,
            "description":        cs.equipement.description,
            "level":              cs.equipement.hierarchy_level,
            "machine_racine_code": mr.equipment_code if mr else None,
            "machine_racine_desc": mr.description if mr else None,
        })
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


# ═════════════════════════════════════════════════════════════════════
# CRUD PIÈCES (ajout, modification, liaison composantes)
# ═════════════════════════════════════════════════════════════════════

from pydantic import BaseModel, Field
from typing import Optional, List
from core.dependencies import require_roles


class PieceCreate(BaseModel):
    code_stock:       Optional[str] = None   # auto-généré si vide
    designation:      str           = Field(..., min_length=2, max_length=300)
    description:      Optional[str] = None
    quantite:         int           = Field(default=0, ge=0)
    seuil_alerte:     int           = Field(default=2, ge=0)
    emplacement:      Optional[str] = None
    unite:            str           = "pcs"
    equipment_codes:  List[str]     = []      # équipements à lier
    quantite_type:    int           = 1       # qté nécessaire / remplacement


class PieceUpdate(BaseModel):
    designation:  Optional[str] = None
    description:  Optional[str] = None
    quantite:     Optional[int] = None
    seuil_alerte: Optional[int] = None
    emplacement:  Optional[str] = None
    unite:        Optional[str] = None


def _generate_code_stock(db: Session) -> str:
    """Génère STK-NNNN incrémental."""
    last = db.query(PieceStock).order_by(PieceStock.id_piece.desc()).first()
    next_num = (last.id_piece + 1) if last else 1
    return f"STK-{next_num:04d}"


@router.post("/pieces/nouvelle", status_code=201)
def creer_piece(
    data: PieceCreate,
    db:   Session = Depends(get_db),
    _:    dict    = Depends(require_roles("ADMIN", "GESTIONNAIRE_STOCK")),
):
    """
    Crée une nouvelle pièce + lie aux équipements donnés.
    Si code_stock vide → généré automatiquement (STK-NNNN).
    """
    code = (data.code_stock or "").strip().upper() or _generate_code_stock(db)

    if db.query(PieceStock).filter(func.upper(PieceStock.code_stock) == code).first():
        raise HTTPException(409, detail=f"Le code_stock '{code}' existe déjà.")

    piece = PieceStock(
        code_stock   = code,
        designation  = data.designation.strip().upper(),
        description  = data.description,
        quantite     = data.quantite,
        seuil_alerte = data.seuil_alerte,
        emplacement  = data.emplacement,
        unite        = data.unite or "pcs",
    )
    db.add(piece)
    db.flush()   # pour récupérer id_piece

    # Liaisons aux équipements
    erreurs_codes = []
    for eq_code in data.equipment_codes:
        eq_clean = eq_code.strip().upper()
        if not eq_clean:
            continue
        equip = (
            db.query(Equipement)
            .filter(func.upper(Equipement.equipment_code) == eq_clean)
            .first()
        )
        if not equip:
            erreurs_codes.append(eq_code)
            continue
        # Évite les doublons
        existing = (
            db.query(ComposanteStock)
            .filter(
                ComposanteStock.id_equipement == equip.id_equipement,
                ComposanteStock.id_piece      == piece.id_piece,
            )
            .first()
        )
        if existing:
            continue
        db.add(ComposanteStock(
            id_equipement = equip.id_equipement,
            id_piece      = piece.id_piece,
            code_stock    = code,
            quantite_type = data.quantite_type or 1,
        ))

    db.commit()
    db.refresh(piece)

    return {
        **_serialize_piece(piece),
        "equipment_codes_introuvables": erreurs_codes,
    }


@router.put("/pieces/{id_piece}")
def modifier_piece(
    id_piece: int,
    data:     PieceUpdate,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(require_roles("ADMIN", "GESTIONNAIRE_STOCK")),
):
    piece = db.get(PieceStock, id_piece)
    if not piece:
        raise HTTPException(404, detail="Pièce introuvable")

    if data.designation  is not None: piece.designation  = data.designation.strip().upper()
    if data.description  is not None: piece.description  = data.description
    if data.quantite     is not None: piece.quantite     = max(0, data.quantite)
    if data.seuil_alerte is not None: piece.seuil_alerte = max(0, data.seuil_alerte)
    if data.emplacement  is not None: piece.emplacement  = data.emplacement
    if data.unite        is not None: piece.unite        = data.unite

    db.commit()
    db.refresh(piece)
    return _serialize_piece(piece)


@router.post("/pieces/{id_piece}/lier")
def lier_composante(
    id_piece: int,
    body: dict,   # { equipment_code: str, quantite_type?: int }
    db:   Session = Depends(get_db),
    _:    dict    = Depends(require_roles("ADMIN", "GESTIONNAIRE_STOCK")),
):
    piece = db.get(PieceStock, id_piece)
    if not piece:
        raise HTTPException(404, detail="Pièce introuvable")

    eq_code = (body.get("equipment_code") or "").strip().upper()
    if not eq_code:
        raise HTTPException(400, detail="equipment_code requis")

    equip = (
        db.query(Equipement)
        .filter(func.upper(Equipement.equipment_code) == eq_code)
        .first()
    )
    if not equip:
        raise HTTPException(404, detail=f"Équipement '{eq_code}' introuvable")

    existing = (
        db.query(ComposanteStock)
        .filter(
            ComposanteStock.id_equipement == equip.id_equipement,
            ComposanteStock.id_piece      == piece.id_piece,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, detail="Liaison déjà existante")

    db.add(ComposanteStock(
        id_equipement = equip.id_equipement,
        id_piece      = piece.id_piece,
        code_stock    = piece.code_stock,
        quantite_type = int(body.get("quantite_type") or 1),
    ))
    db.commit()
    return {"ok": True}


@router.delete("/pieces/{id_piece}/lier/{id_compo}", status_code=204)
def delier_composante(
    id_piece: int,
    id_compo: int,
    db:       Session = Depends(get_db),
    _:        dict    = Depends(require_roles("ADMIN", "GESTIONNAIRE_STOCK")),
):
    link = (
        db.query(ComposanteStock)
        .filter(
            ComposanteStock.id          == id_compo,
            ComposanteStock.id_piece    == id_piece,
        )
        .first()
    )
    if not link:
        raise HTTPException(404, detail="Liaison introuvable")
    db.delete(link)
    db.commit()


# ─────────────────────────────────────────────────────────────────────
# GET /stock/stats — KPIs pour la page Stock
# ─────────────────────────────────────────────────────────────────────
@router.get("/stats/global")
def stats_stock(db: Session = Depends(get_db)):
    total      = db.query(func.count(PieceStock.id_piece)).scalar() or 0
    absentes   = db.query(func.count(PieceStock.id_piece)).filter(PieceStock.quantite == 0).scalar() or 0
    faibles    = db.query(func.count(PieceStock.id_piece)).filter(
        PieceStock.quantite > 0,
        PieceStock.quantite <= PieceStock.seuil_alerte,
    ).scalar() or 0
    qte_total  = db.query(func.coalesce(func.sum(PieceStock.quantite), 0)).scalar() or 0
    nb_liees   = db.query(func.count(func.distinct(ComposanteStock.id_piece))).scalar() or 0

    return {
        "nb_pieces_total":   int(total),
        "nb_absentes":       int(absentes),
        "nb_faibles":        int(faibles),
        "nb_ok":             int(total - absentes - faibles),
        "qte_totale":        int(qte_total),
        "nb_pieces_liees":   int(nb_liees),
        "nb_pieces_orphelines": int(total - nb_liees),
    }


# ─────────────────────────────────────────────────────────────────────
# GET /stock/{code_stock}  — Détail (placé à la fin pour priorité aux autres routes)
# ─────────────────────────────────────────────────────────────────────
@router.get("/{code_stock}")
def get_piece(code_stock: str, db: Session = Depends(get_db)):
    piece = db.query(PieceStock).filter(
        func.upper(PieceStock.code_stock) == code_stock.strip().upper()
    ).first()
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce introuvable")
    return _serialize_piece(piece)