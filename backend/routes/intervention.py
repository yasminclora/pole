from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date as date_type
import traceback

from database              import get_db
from models.intervention   import Intervention, TypeTravail, StatutValidation
from models.ot             import OrdreTravail, StatutOT
from models.stock          import PieceStock, ComposanteStock, ReservationPiece, StatutReservation
from models.equipement     import Equipement
from models.pole           import Pole
from models.user           import Utilisateur, RoleEnum
from services.notification_service import manager as _notif_manager

# ── Import du modèle d'archivage opérationnel (interventions_archivees) ──
from models.historique_intervention import InterventionArchivee, SourceHistorique

# NOTE : models.historique_interventions (avec s) = données CSV/SAP pour ML
#        Ce fichier N'en a PAS besoin — il gère uniquement le workflow opérationnel.

router = APIRouter()


# ── Serializers ───────────────────────────────────────────────────────

def equip_info(id_equip: int, db: Session) -> dict:
    from models.zone import Zone
    e = db.get(Equipement, id_equip)
    if not e:
        return {}
    
    # Get parent (L2)
    parent = db.get(Equipement, e.id_parent) if e.id_parent else None
    
    # Get machine racine (L1)
    racine = db.get(Equipement, e.id_machine_racine) if e.id_machine_racine else None
    
    # Get zone from equip, fallback to racine
    zone_nom = None
    zone_code = None
    if e.id_zone:
        z = db.get(Zone, e.id_zone)
        if z:
            zone_nom = z.nom_zone
            zone_code = z.code_zone
    
    if not zone_nom and racine and racine.id_zone:
        z = db.get(Zone, racine.id_zone)
        if z:
            zone_nom = z.nom_zone
            zone_code = z.code_zone
    
    return {
        "id_equipement": e.id_equipement,
        "equipment_code": e.equipment_code,
        "description": e.description,
        "hierarchy_level": e.hierarchy_level,
        "id_zone": e.id_zone or (racine.id_zone if racine else None),
        "nom_zone": zone_nom,
        "code_zone": zone_code,
        "machine_racine_id": racine.id_equipement if racine else None,
        "machine_racine_code": racine.equipment_code if racine else None,
        "machine_racine_desc": racine.description if racine else None,
        "parent_id": parent.id_equipement if parent else None,
        "parent_code": parent.equipment_code if parent else None,
        "parent_desc": parent.description if parent else None,
    }


def intervention_to_dict(i: Intervention, db: Session) -> dict:
    realisateur = db.get(Utilisateur, i.id_realisateur)
    equip       = db.get(Equipement,  i.id_equipement)

    duree_reelle = None
    if i.date_debut and i.date_fin:
        delta = i.date_fin - i.date_debut
        duree_reelle = int(delta.total_seconds() / 60)

    return {
        "id_intervention"    : i.id_intervention,
        "id_ot"              : i.id_ot,
        "type_travail"       : i.type_travail,
        "description_travail": i.description_travail,
        "observations"       : i.observations,
        "date_debut"         : str(i.date_debut) if i.date_debut else None,
        "date_fin"           : str(i.date_fin)   if i.date_fin   else None,
        "duree_reelle"       : duree_reelle,
        "statut_validation"  : i.statut_validation,
        "motif_rejet"        : i.motif_rejet,
        "realisateur"        : {
            "id"   : realisateur.id_user,
            "nom"  : f"{realisateur.prenom} {realisateur.nom}",
            "email": realisateur.email,
        } if realisateur else None,
        "equipement"         : equip_info(i.id_equipement, db),
        "composante_remplacee": i.composante_remplacee,
        "created_at"         : str(i.created_at) if i.created_at else None,
    }


def piece_to_dict(p: PieceStock, db: Session) -> dict:
    if not p:
        return {}
    if p.quantite == 0:
        alerte = "RUPTURE"
    elif p.quantite <= p.seuil_alerte:
        alerte = "FAIBLE"
    else:
        alerte = "OK"

    return {
        "id_piece"    : p.id_piece,
        "code_stock"  : p.code_stock,
        "designation" : p.designation,
        "quantite"    : p.quantite,
        "seuil_alerte": p.seuil_alerte,
        "emplacement" : p.emplacement,
        "unite"       : p.unite,
        "alerte"      : alerte,
    }


# ── GET — Pièce liée à une composante ────────────────────────────────

@router.get("/composante/{id_equipement}/piece")
def piece_composante(id_equipement: int, db: Session = Depends(get_db)):
    try:
        lien = db.query(ComposanteStock)\
                 .filter(ComposanteStock.id_equipement == id_equipement)\
                 .first()
        if not lien:
            return {"piece": None, "message": "Aucune pièce liée à cette composante"}

        piece = db.get(PieceStock, lien.id_piece)
        if not piece:
            return {"piece": None, "message": "Pièce introuvable"}

        return {
            "piece"        : piece_to_dict(piece, db),
            "quantite_type": lien.quantite_type,
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET — Intervention d'un OT ────────────────────────────────────────

@router.get("/ot/{id_ot}")
def get_intervention_ot(id_ot: int, db: Session = Depends(get_db)):
    try:
        intervention = db.query(Intervention)\
                         .filter(Intervention.id_ot == id_ot)\
                         .first()
        if not intervention:
            return None
        return intervention_to_dict(intervention, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Soumettre feedback ─────────────────────────────────────────

@router.post("/ot/{id_ot}/feedback")
async def soumettre_feedback(id_ot: int, data: dict, db: Session = Depends(get_db)):
    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")
        if ot.statut != StatutOT.EN_COURS:
            raise HTTPException(status_code=400, detail="L'OT doit être EN_COURS")

        intervention = db.query(Intervention)\
                         .filter(Intervention.id_ot == id_ot).first()
        now = datetime.now()

        if not intervention:
            intervention = Intervention(
                id_ot               = id_ot,
                id_realisateur      = data["id_realisateur"],
                id_pole             = ot.id_pole,
                id_equipement       = ot.id_equipement,
                type_travail        = data["type_travail"],
                description_travail = data["description_travail"].strip(),
                observations        = data.get("observations", "").strip() or None,
                date_debut          = ot.date_debut_reelle,
                date_fin            = now,
                composante_remplacee= data.get("composante_remplacee"),
                statut_validation   = StatutValidation.EN_ATTENTE,
                date_soumission     = now,
            )
            db.add(intervention)
        else:
            intervention.type_travail        = data["type_travail"]
            intervention.description_travail = data["description_travail"].strip()
            intervention.observations        = data.get("observations", "").strip() or None
            intervention.date_fin            = now
            intervention.composante_remplacee= data.get("composante_remplacee")
            intervention.statut_validation   = StatutValidation.EN_ATTENTE
            intervention.date_soumission     = now

        ot.statut          = StatutOT.TERMINE
        ot.date_fin_reelle = now

        db.commit()
        db.refresh(intervention)

        # ── Notification → Chef(s) d'équipe du pôle ──────────────────
        chefs = db.query(Utilisateur).filter(
            Utilisateur.role    == RoleEnum.CHEF_EQUIPE,
            Utilisateur.id_pole == ot.id_pole,
        ).all()
        for chef in chefs:
            await _notif_manager.send_personal_message(chef.id_user, {
                "type"     : "OT_TERMINE",
                "id_ot"    : id_ot,
                "numero_ot": ot.numero_ot,
                "message"  : f"L'OT {ot.numero_ot} est terminé et attend votre validation.",
            })

        return intervention_to_dict(intervention, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Valider intervention ───────────────────────────────────────

@router.post("/ot/{id_ot}/valider")
async def valider_intervention(id_ot: int, data: dict, db: Session = Depends(get_db)):
    try:
        intervention = db.query(Intervention)\
                         .filter(Intervention.id_ot == id_ot).first()
        if not intervention:
            raise HTTPException(status_code=404, detail="Intervention introuvable")

        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")

        now  = datetime.now()
        role = data.get("role", "")

        if role == "HSE":
            intervention.statut_validation   = StatutValidation.VALIDE_HSE
            intervention.id_validateur_hse   = data["id_validateur"]
            intervention.date_validation_hse = now
            ot.statut                        = StatutOT.VALIDE_HSE
            ot.date_validation_hse           = now

        elif role == "METHODISTE":
            intervention.statut_validation     = StatutValidation.ARCHIVE
            intervention.date_archive          = now
            intervention.id_validateur_methode = data["id_validateur"]
            intervention.date_validation_met   = now
            ot.statut                          = StatutOT.ARCHIVE
            ot.date_archive                    = now

            # ── Archiver dans interventions_archivees ──────────────────
            archive = InterventionArchivee(
                id_equipement          = ot.id_equipement,
                code_equipement        = _get_code(ot.id_equipement, db),
                description_equipement = _get_desc(ot.id_equipement, db),
                id_pole                = ot.id_pole,
                type_travail           = intervention.type_travail,
                date_panne             = ot.date_prevue or date_type.today(),
                date_debut             = intervention.date_debut,
                date_fin               = intervention.date_fin,
                duree_reelle           = _calc_duree(intervention.date_debut, intervention.date_fin),
                observations           = intervention.observations,
                composante_remplacee   = intervention.composante_remplacee,
                source                 = SourceHistorique.SYSTEME,
                id_ot                  = id_ot,
            )
            db.add(archive)

        else:
            # Chef équipe → notifie HSE
            intervention.statut_validation     = StatutValidation.VALIDE
            intervention.id_validateur_methode = data["id_validateur"]
            intervention.date_validation_met   = now
            ot.statut                          = StatutOT.VALIDE_CE
            ot.date_validation_ce              = now

        db.commit()
        db.refresh(intervention)

        # ── Notifications post-commit ─────────────────────────────────
        if role not in ("HSE", "METHODISTE"):
            # CE vient de valider → notifier les HSE du pôle
            hse_users = db.query(Utilisateur).filter(
                Utilisateur.role    == RoleEnum.HSE,
                Utilisateur.id_pole == ot.id_pole,
            ).all()
            for h in hse_users:
                await _notif_manager.send_personal_message(h.id_user, {
                    "type"     : "OT_VALIDE_CE",
                    "id_ot"    : id_ot,
                    "numero_ot": ot.numero_ot,
                    "message"  : f"L'OT {ot.numero_ot} a été validé par le chef d'équipe. Votre validation HSE est requise.",
                })
        elif role == "HSE":
            # HSE vient de valider → notifier le(s) Méthodiste(s) du pôle
            methodistes = db.query(Utilisateur).filter(
                Utilisateur.role    == RoleEnum.METHODISTE,
                Utilisateur.id_pole == ot.id_pole,
            ).all()
            for m in methodistes:
                await _notif_manager.send_personal_message(m.id_user, {
                    "type"     : "OT_VALIDE_HSE",
                    "id_ot"    : id_ot,
                    "numero_ot": ot.numero_ot,
                    "message"  : f"L'OT {ot.numero_ot} a été validé par HSE. Vous pouvez l'archiver.",
                })

        return intervention_to_dict(intervention, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Rejeter intervention ───────────────────────────────────────

@router.post("/ot/{id_ot}/rejeter")
async def rejeter_intervention(id_ot: int, data: dict, db: Session = Depends(get_db)):
    try:
        intervention = db.query(Intervention)\
                         .filter(Intervention.id_ot == id_ot).first()
        if not intervention:
            raise HTTPException(status_code=404, detail="Intervention introuvable")

        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")

        motif = data.get("motif_rejet", "").strip()
        intervention.statut_validation = StatutValidation.REJETE
        intervention.motif_rejet       = motif
        ot.statut                      = StatutOT.REJETE
        ot.motif_rejet                 = motif
        ot.id_rejecteur                = data.get("id_rejecteur")

        db.commit()
        db.refresh(intervention)
        return intervention_to_dict(intervention, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Réserver une pièce ─────────────────────────────────────────

@router.post("/ot/{id_ot}/reserver-piece")
async def reserver_piece(id_ot: int, data: dict, db: Session = Depends(get_db)):
    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")

        piece = db.get(PieceStock, data["id_piece"])
        if not piece:
            raise HTTPException(status_code=404, detail="Pièce introuvable")

        quantite = int(data.get("quantite_demandee", 1))
        if quantite <= 0:
            raise HTTPException(status_code=400, detail="Quantité invalide")

        existante = db.query(ReservationPiece).filter(
            ReservationPiece.id_ot    == id_ot,
            ReservationPiece.id_piece == data["id_piece"],
            ReservationPiece.statut.in_([
                StatutReservation.EN_ATTENTE,
                StatutReservation.VALIDEE,
            ])
        ).first()
        if existante:
            raise HTTPException(status_code=400, detail="Réservation déjà existante")

        reservation = ReservationPiece(
            id_piece          = data["id_piece"],
            id_ot             = id_ot,
            id_mecanicien     = data["id_mecanicien"],
            quantite_demandee = quantite,
            statut            = StatutReservation.EN_ATTENTE,
            notes_mecanicien  = data.get("notes", "").strip() or None,
            date_demande      = datetime.now(),
        )
        db.add(reservation)
        db.commit()
        db.refresh(reservation)

        return {
            "id_reservation"   : reservation.id_reservation,
            "statut"           : reservation.statut,
            "quantite_demandee": reservation.quantite_demandee,
            "piece"            : piece_to_dict(piece, db),
            "message"          : "Réservation soumise — en attente du gestionnaire",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── Helpers privés ────────────────────────────────────────────────────

def _get_code(id_equip: int, db: Session) -> str:
    e = db.get(Equipement, id_equip)
    return e.equipment_code if e else ""

def _get_desc(id_equip: int, db: Session) -> str:
    e = db.get(Equipement, id_equip)
    return e.description if e else ""

def _calc_duree(debut, fin) -> int | None:
    if not debut or not fin:
        return None
    return int((fin - debut).total_seconds() / 60)