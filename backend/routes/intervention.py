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
from models.historique_intervention import InterventionArchivee
from models.historique_interventions import TypeTravailHistorique

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
            await _notif_manager.send_personal_message(user_id=chef.id_user, message={
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

            # ── Archiver dans interventions_archivees (comme historique_interventions) ──
            equip     = db.get(Equipement, ot.id_equipement)
            equip_code = equip.equipment_code if equip else ""
            equip_desc = equip.description if equip else ""
            equip_level = equip.hierarchy_level if equip else None

            parent_code = None
            parent_level = None
            if equip and equip.id_parent:
                p = db.get(Equipement, equip.id_parent)
                if p:
                    parent_code = p.equipment_code
                    parent_level = p.hierarchy_level

            # Machine L1 (machine racine)
            code_machine_l1 = None
            if equip and equip.id_machine_racine:
                racine = db.get(Equipement, equip.id_machine_racine)
                if racine:
                    code_machine_l1 = racine.equipment_code

            # Mapper TypeTravail → TypeTravailHistorique
            tt = intervention.type_travail
            if tt in (TypeTravail.CORRECTIF, TypeTravail.REPARATION, TypeTravail.REMPLACEMENT):
                tt_hist = TypeTravailHistorique.CORR
            else:
                tt_hist = TypeTravailHistorique.PREV

            realisateur = db.get(Utilisateur, intervention.id_realisateur)
            pole_realisateur = None
            if realisateur and realisateur.id_pole:
                pole_obj = db.get(Pole, realisateur.id_pole)
                if pole_obj:
                    pole_realisateur = pole_obj.code_pole

            archive = InterventionArchivee(
                system_equipment       = code_machine_l1 or "",
                equipment_description  = equip_desc or "",
                equipment_code         = equip_code or "",
                equipment_level        = equip_level,
                parent_code            = parent_code,
                parent_level           = parent_level,
                type_travail           = tt_hist,
                action_entity          = pole_realisateur,
                date_declaration       = (intervention.date_soumission or ot.date_prevue or date_type.today()).date(),
                date_fin               = intervention.date_fin.date() if intervention.date_fin else None,
                date_creation          = (ot.date_prevue or date_type.today()),
                cout_total             = 0.0,
                source                 = "SYSTEME",
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
                await _notif_manager.send_personal_message(user_id=h.id_user, message={
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
                await _notif_manager.send_personal_message(user_id=m.id_user, message={
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

        # ── Notification au maintenancier ───────────────────────────────
        if intervention.id_realisateur:
            await _notif_manager.send_personal_message(
                user_id=intervention.id_realisateur,
                message={
                    "type"     : "OT_REJETE",
                    "id_ot"    : id_ot,
                    "numero_ot": ot.numero_ot,
                    "motif"    : motif,
                    "message"  : f"Votre OT {ot.numero_ot} a été rejeté. Motif: {motif}",
                }
            )

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