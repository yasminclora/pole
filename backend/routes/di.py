from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date
import traceback

from database          import get_db
from models.di         import DemandeIntervention
from models.ot         import OrdreTravail, TypeOT, ClasseOT, StatutOT, PrioriteOT
from models.equipement import Equipement
from models.pole       import Pole
from models.user       import Utilisateur
from models.stock      import ComposanteStock, PieceStock
from models.zone       import Zone

router = APIRouter()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# HELPERS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def get_next_numero_di(db: Session) -> str:
    annee = datetime.now().year
    count = db.query(DemandeIntervention)\
               .filter(DemandeIntervention.numero_di.like(f"DI-{annee}-%")).count()
    return f"DI-{annee}-{str(count + 1).zfill(3)}"


def get_next_numero_ot(db: Session, type_ot: str) -> str:
    annee = datetime.now().year
    count = db.query(OrdreTravail)\
              .filter(OrdreTravail.numero_ot.like(f"OT-{type_ot}-{annee}-%")).count()
    return f"OT-{type_ot}-{annee}-{str(count + 1).zfill(3)}"


def equip_info(id_equip: int, db: Session) -> dict:
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
        # Zone info
        "id_zone": e.id_zone or (racine.id_zone if racine else None),
        "nom_zone": zone_nom,
        "code_zone": zone_code,
        # L1 - Machine racine
        "machine_racine_id": racine.id_equipement if racine else None,
        "machine_racine_code": racine.equipment_code if racine else None,
        "machine_racine_desc": racine.description if racine else None,
        # L2 - Parent
        "parent_id": parent.id_equipement if parent else None,
        "parent_code": parent.equipment_code if parent else None,
        "parent_desc": parent.description if parent else None,
        # Alias for compatibility
        "machine_niveau2_code": parent.equipment_code if parent else None,
        "machine_niveau2_desc": parent.description if parent else None,
    }


def di_to_dict(di: DemandeIntervention, db: Session) -> dict:
    declarant  = db.get(Utilisateur, di.id_declarant)
    methodiste = db.get(Utilisateur, di.id_methodiste) if di.id_methodiste else None
    pole       = db.get(Pole, di.id_pole)

    # Get OT info if exists
    ot_info = None
    if di.id_ot_genere:
        ot = db.get(OrdreTravail, di.id_ot_genere)
        if ot:
            ot_info = {
                "numero_ot": ot.numero_ot,
                "date_prevue": str(ot.date_prevue) if ot.date_prevue else None,
                "date_validation_ce": str(ot.date_validation_ce) if ot.date_validation_ce else None,
                "date_validation_hse": str(ot.date_validation_hse) if ot.date_validation_hse else None,
                "date_archive": str(ot.date_archive) if ot.date_archive else None,
            }

    # CompatibilitÃ© : certains modÃ¨les Pole ont "nom", d'autres "nom_pole"
    pole_nom = None
    if pole:
        pole_nom = getattr(pole, "nom", None) or getattr(pole, "nom_pole", None)

    return {
        "id_di"            : di.id_di,
        "numero_di"        : di.numero_di,
        "statut"           : di.statut,
        "urgence"          : getattr(di, 'urgence', 'NORMALE') if hasattr(di, 'urgence') else 'NORMALE',
        "description_panne": di.description_panne,
        "motif_rejet"      : di.motif_rejet,
        "id_pole"          : di.id_pole,
        "nom_pole"         : pole_nom,
        "equipement"       : equip_info(di.id_equipement, db),
        "declarant"        : {
            "id"  : declarant.id_user,
            "nom" : f"{declarant.prenom} {declarant.nom}",
            "role": declarant.role,
        } if declarant else None,
        "methodiste"       : {
            "id" : methodiste.id_user,
            "nom": f"{methodiste.prenom} {methodiste.nom}",
        } if methodiste else None,
        "id_ot_genere"     : di.id_ot_genere,
        "ot"               : ot_info,
        "date_verification": str(di.date_verification) if di.date_verification else None,
        "date_traitement"  : str(di.date_traitement)   if di.date_traitement   else None,
        "created_at"       : str(di.created_at)        if di.created_at        else None,
    }


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# GET â€” Liste DI
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.get("/")
def liste_di(
    id_pole : int = None,
    statut  : str = None,
    id_user : int = None,
    db: Session = Depends(get_db),
):
    try:
        q = db.query(DemandeIntervention)
        if id_pole: q = q.filter(DemandeIntervention.id_pole      == id_pole)
        if statut:  q = q.filter(DemandeIntervention.statut       == statut)
        if id_user: q = q.filter(DemandeIntervention.id_declarant == id_user)
        dis = q.order_by(DemandeIntervention.created_at.desc()).all()
        return [di_to_dict(d, db) for d in dis]
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# GET â€” DÃ©tail DI
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.get("/{id_di}")
def get_di(id_di: int, db: Session = Depends(get_db)):
    di = db.get(DemandeIntervention, id_di)
    if not di:
        raise HTTPException(status_code=404, detail="DI introuvable")
    return di_to_dict(di, db)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# POST â€” CrÃ©er DI
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.post("/")
async def creer_di(data: dict, db: Session = Depends(get_db)):
    print(f"[DI] Received data: {data}")
    
    # Validation des champs requis
    required_fields = ['id_equipement', 'id_pole', 'id_declarant', 'description_panne']
    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Champ requis manquant: {field}")
    
    try:
        equip = db.get(Equipement, data["id_equipement"])
        if not equip:
            raise HTTPException(status_code=404, detail="Ã‰quipement introuvable")

        di = DemandeIntervention(
            numero_di         = get_next_numero_di(db),
            id_equipement     = data["id_equipement"],
            id_pole           = data["id_pole"],
            id_declarant      = data["id_declarant"],
            description_panne = data["description_panne"].strip(),
            statut            = "EN_ATTENTE",
            urgence           = data.get("urgence", "NORMALE"),
        )
        db.add(di); db.commit(); db.refresh(di)

        # Notifier les mÃ©thodistes du pÃ´le
        try:
            import logging
            logger = logging.getLogger("di")
            from services.notification_service import manager
            methodistes = db.query(Utilisateur).filter(
                Utilisateur.id_pole == data["id_pole"],
                Utilisateur.role == "METHODISTE"
            ).all()
            logger.info(f"[DI] Notifier {len(methodistes)} mÃ©thodistes du pÃ´le {data['id_pole']}")
            logger.info(f"[DI] Connexions actives: {list(manager.connections.keys())}")
            logger.info(f"[DI] Manager ID: {id(manager)}")
            
            for m in methodistes:
                target_user_id = int(m.id_user)
                logger.info(f"[DI] Envoi notif Ã  mÃ©thodiste user_id={target_user_id}, nom={m.prenom} {m.nom}")
                logger.info(f"[DI] user_id dans connections: {target_user_id in manager.connections}")
                
                message = {
                    "type": "nouvelle_di",
                    "id_di": di.id_di,
                    "numero_di": di.numero_di,
                    "description": data["description_panne"][:50] + "...",
                    "equipement": equip.equipment_code,
                    "urgence": data.get("urgence", "NORMALE"),
                }
                await manager.send_personal_message(user_id=target_user_id, message=message)
                logger.info(f"[DI] Notif envoyÃ©e Ã  user_id={target_user_id}")
                
                # Si pas envoyÃ©, tester broadcast
                if target_user_id not in manager.connections:
                    logger.warning(f"[DI] user_id {target_user_id} pas connectÃ©, test broadcast")
                    await manager.broadcast(message)
        except Exception as e:
            import traceback
            logger.error(f"[DI] Notification error: {e}\n{traceback.format_exc()}")

        return di_to_dict(di, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[DI] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {type(e).__name__}: {str(e)}")


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# POST â€” VÃ©rifier sur terrain â†’ EN_ATTENTE â†’ VERIFIE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.post("/{id_di}/verifier")
async def verifier_di(id_di: int, data: dict, db: Session = Depends(get_db)):
    try:
        di = db.get(DemandeIntervention, id_di)
        if not di:
            raise HTTPException(status_code=404, detail="DI introuvable")

        # Idempotent
        if di.statut == "VERIFIE":
            return di_to_dict(di, db)

        if di.statut != "EN_ATTENTE":
            raise HTTPException(
                status_code=400,
                detail=f"Impossible de verifier une DI au statut '{di.statut}'"
            )

        di.statut             = "VERIFIE"
        di.id_methodiste      = data.get("id_methodiste")
        di.date_verification  = datetime.now()

        db.commit(); db.refresh(di)
        return di_to_dict(di, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


@router.get("/debug-equip/{id_equip}")
def debug_equip(id_equip: int, db: Session = Depends(get_db)):
    """Debug endpoint to see what's stored in DB for an equipment"""
    e = db.get(Equipement, id_equip)
    if not e:
        return {"error": "Equipment not found"}
    
    zone = db.get(Zone, e.id_zone) if e.id_zone else None
    machine_racine = db.get(Equipement, e.id_machine_racine) if e.id_machine_racine else None
    parent = db.get(Equipement, e.id_parent) if e.id_parent else None
    
    return {
        "equipment": {
            "id": e.id_equipement,
            "code": e.equipment_code,
            "hierarchy_level": e.hierarchy_level,
            "id_parent": e.id_parent,
            "parent_code": parent.equipment_code if parent else None,
            "id_machine_racine": e.id_machine_racine,
            "machine_racine_code": machine_racine.equipment_code if machine_racine else None,
            "id_zone": e.id_zone,
            "zone_nom": zone.nom_zone if zone else None,
        },
        "machine_racine_zone": {
            "id": machine_racine.id_zone if machine_racine else None,
            "nom": db.get(Zone, machine_racine.id_zone).nom_zone if machine_racine and machine_racine.id_zone else None
        } if machine_racine else None
    }


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# POST â€” Valider â†’ crÃ©e OT CORRECTIF (requiert VERIFIE)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.post("/{id_di}/valider")
async def valider_di(id_di: int, data: dict, db: Session = Depends(get_db)):
    try:
        from datetime import datetime as datetime_type

        di = db.get(DemandeIntervention, id_di)
        if not di:
            raise HTTPException(status_code=404, detail="DI introuvable")

        if di.statut == "EN_ATTENTE":
            raise HTTPException(
                status_code=400,
                detail="Verifiez d'abord la DI sur le terrain."
            )
        if di.statut != "VERIFIE":
            raise HTTPException(
                status_code=400,
                detail=f"DI deja traitee (statut : {di.statut})"
            )

        # Date prévue (avec heure optionnelle)
        date_prevue = None
        if data.get("date_prevue"):
            try:
                # Essayer avec datetime (avec heure)
                date_prevue = datetime.fromisoformat(data["date_prevue"])
            except ValueError:
                try:
                    # Sinon juste date
                    date_prevue = date.fromisoformat(data["date_prevue"])
                except ValueError:
                    raise HTTPException(status_code=400, detail="Format date invalide. Attendu : YYYY-MM-DD ou YYYY-MM-DDTHH:MM")

        # Classe
        classe_map = {
            "MECANIQUE" : ClasseOT.MECANIQUE,
            "ELECTRIQUE": ClasseOT.ELECTRIQUE,
            "GLOBALE"   : ClasseOT.GLOBALE,
        }
        classe = classe_map.get(str(data.get("classe", "MECANIQUE")).upper(), ClasseOT.MECANIQUE)

        priorite_map = {
            "FAIBLE"  : PrioriteOT.FAIBLE,
            "NORMALE" : PrioriteOT.NORMALE,
            "HAUTE"   : PrioriteOT.HAUTE,
            "CRITIQUE": PrioriteOT.CRITIQUE,
            "NIVEAU_1": PrioriteOT.NORMALE,
            "NIVEAU_2": PrioriteOT.HAUTE,
            "NIVEAU_3": PrioriteOT.CRITIQUE,
        }
        priorite = priorite_map.get(
            data.get("priorite", "NORMALE"),
            PrioriteOT.NORMALE
        )

        ot = OrdreTravail(
            numero_ot     = get_next_numero_ot(db, "CORRECTIF"),
            type_ot       = TypeOT.CORRECTIF,
            classe        = classe,
            priorite      = priorite,
            statut        = StatutOT.CREE,
            id_equipement = di.id_equipement,
            id_pole       = di.id_pole,
            id_methodiste = data["id_methodiste"],
            description   = data.get("description", di.description_panne).strip(),
            date_prevue   = date_prevue,
            duree_estimee = int(data["duree_estimee"]) if data.get("duree_estimee") else None,
            id_di         = id_di,
        )
        db.add(ot); db.flush()

        # VÃ©rification du stock
        stock_info = {"has_stock": False, "piece": None}
        composante = db.query(ComposanteStock).filter(
            ComposanteStock.id_equipement == di.id_equipement
        ).first()
        
        if composante:
            piece = db.get(PieceStock, composante.id_piece)
            if piece:
                stock_info = {
                    "has_stock": True,
                    "piece": {
                        "code_stock": piece.code_stock,
                        "designation": piece.designation,
                        "quantite": piece.quantite,
                        "seuil_alerte": piece.seuil_alerte,
                        "status": "critical" if piece.quantite == 0 else ("warning" if piece.quantite <= piece.seuil_alerte else "ok")
                    }
                }

        di.statut          = "VALIDEE"
        di.id_methodiste   = data["id_methodiste"]
        di.id_ot_genere    = ot.id_ot
        di.date_traitement = datetime.now()

        db.commit(); db.refresh(di)

        try:
            from services.notification_service import manager
            await manager.send_personal_message(
                user_id=int(di.id_declarant),
                message={
                    "type"     : "DI_VALIDEE",
                    "numero_di": di.numero_di,
                    "numero_ot": ot.numero_ot,
                }
            )
        except Exception as e:
            print(f"[DI] Erreur notif declarant: {e}")

        return {
            "di": di_to_dict(di, db),
            "ot": {"id_ot": ot.id_ot, "numero_ot": ot.numero_ot, "statut": str(ot.statut)},
            "stock": stock_info
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# POST â€” Rejeter DI (EN_ATTENTE ou VERIFIE)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.post("/{id_di}/rejeter")
async def rejeter_di(id_di: int, data: dict, db: Session = Depends(get_db)):
    try:
        di = db.get(DemandeIntervention, id_di)
        if not di:
            raise HTTPException(status_code=404, detail="DI introuvable")
        if di.statut not in ["EN_ATTENTE", "VERIFIE"]:
            raise HTTPException(status_code=400, detail="DI deja traitee")
        if not data.get("motif_rejet", "").strip():
            raise HTTPException(status_code=400, detail="Le motif de rejet est obligatoire")

        di.statut          = "REJETEE"
        di.id_methodiste   = data["id_methodiste"]
        di.motif_rejet     = data["motif_rejet"].strip()
        di.date_traitement = datetime.now()

        db.commit(); db.refresh(di)

        # Notification au mecanicien qui a cree la DI
        from services.notification_service import manager as _manager
        notif = {
            "type"       : "DI_REJETEE",
            "id_di"      : di.id_di,
            "numero_di"  : di.numero_di,
            "message"    : f"Votre DI a ete rejetee: {di.numero_di}",
            "motif"      : di.motif_rejet,
        }
        if di.id_createur:
            await _manager.send_personal_message(user_id=di.id_createur, message=notif)

        return di_to_dict(di, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")