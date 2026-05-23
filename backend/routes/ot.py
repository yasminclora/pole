from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, date, time, timedelta
import traceback
import io
import csv

from database          import get_db
from models.ot         import OrdreTravail, StatutOT, TypeOT, ClasseOT, PrioriteOT
from models.equipement import Equipement
from models.pole       import Pole
from models.user       import Utilisateur, RoleEnum, ShiftEnum
from models.zone       import Zone
from models.di        import DemandeIntervention
from models.intervention import Intervention
from models.equipe     import Equipe

router = APIRouter()

# Cycle de quarts: 8 jours (2j Matin → 2j Après-midi → 2j Nuit → 2j Repos)
CYCLE = ["Matin", "Matin", "Après-midi", "Après-midi", "Nuit", "Nuit", "Repos", "Repos"]
CYCLE_LENGTH = 8


def get_quart_from_datetime(dt: datetime) -> str:
    """Calcule le quart en fonction de l'heure de la datetime."""
    if not dt:
        return "Inconnu"
    hour = dt.hour
    if 6 <= hour < 14:
        return "Matin"
    elif 14 <= hour < 22:
        return "Après-midi"
    else:
        return "Nuit"


def get_quart_equipe(equipe: Equipe, target_date: date) -> str:
    """Calcule le quart d'une équipe à une date donnée en suivant le cycle tournant."""
    if not equipe or not equipe.date_reference_cycle:
        return "Inconnu"
    
    delta = (target_date - equipe.date_reference_cycle).days
    position = (equipe.position_initiale_cycle + delta) % CYCLE_LENGTH
    return CYCLE[position]


# ── GET AVAILABLE USERS FOR ASSIGNMENT (MUST BE FIRST) ─────────────
@router.get("/users-disponibles")
def get_users_disponibles(
    id_pole: int = 0,
    classe: str = "MECANIQUE",
    date_prevue: str | None = None,
    db: Session = Depends(get_db)
):
    if not id_pole or id_pole <= 0:
        return []
    
    target_datetime = None
    target_date = date.today()
    
    if date_prevue:
        try:
            # Essayer de parser en datetime (avec heure)
            target_datetime = datetime.fromisoformat(date_prevue)
            target_date = target_datetime.date()
        except:
            try:
                # Sinon juste en date
                target_date = date.fromisoformat(date_prevue)
            except:
                pass
    
    # Définir les rôles selon la classe
    if classe == "MECANIQUE":
        allowed_roles = [RoleEnum.MECANICIEN]
    elif classe == "ELECTRIQUE":
        allowed_roles = [RoleEnum.TECHNICIEN]
    else:
        allowed_roles = [RoleEnum.MECANICIEN, RoleEnum.TECHNICIEN]
    
    # Récupérer les utilisateurs du pôle avec les bons rôles
    users = db.query(Utilisateur).filter(
        Utilisateur.id_pole == id_pole,
        Utilisateur.role.in_(allowed_roles),
        Utilisateur.id_equipe.isnot(None)
    ).all()
    
    # Charger les équipes du pôle
    equipes = {e.id_equipe: e for e in db.query(Equipe).filter_by(id_pole=id_pole).all()}
    
    # Récupérer les OT assignés à cette date pour voir qui est occupé
    ots_du_jour = db.query(OrdreTravail).filter(
        OrdreTravail.id_pole == id_pole,
        OrdreTravail.date_prevue != None,
        # Comparer seulement la date (sans l'heure)
    ).all()
    
    # Filtrer les OT du même jour
    ots_du_jour = [ot for ot in ots_du_jour if ot.date_prevue and ot.date_prevue.date() == target_date]
    
    # Si datetime fourni, trouver quelle équipe travaille ce quart à cette date
    equipe_travaillant_id = None
    if target_datetime:
        quart_actif = get_quart_from_datetime(target_datetime)
        
        # Gestion nuit : entre minuit et 6h, l'équipe active est celle de la veille
        date_pour_nuit = target_date
        if target_datetime.hour < 6:
            date_pour_nuit = target_date - timedelta(days=1)
        
        for eq_id, equipe in equipes.items():
            quart_equipe = get_quart_equipe(equipe, date_pour_nuit)
            if quart_equipe == quart_actif:
                equipe_travaillant_id = eq_id
                break
    
    result = []
    for user in users:
        equipe = equipes.get(user.id_equipe) if user.id_equipe else None
        
        # Si on a datetime avec équipe spécifique, filtrer par cette équipe
        if equipe_travaillant_id is not None:
            if user.id_equipe != equipe_travaillant_id:
                continue
        
        # Si on a l'heure (datetime), calculer le quart basé sur l'heure
        if target_datetime:
            quart = get_quart_from_datetime(target_datetime)
        # Sinon, utiliser le cycle de l'équipe
        else:
            quart = get_quart_equipe(equipe, target_date) if equipe else "Inconnu"
        
        # Exclure ceux en repos
        if quart == "Repos":
            continue
        
        # Compter les OT en cours pour cet utilisateur (même quart)
        user_ots = []
        for ot in ots_du_jour:
            if ot.id_assigne == user.id_user:
                if target_datetime:
                    # Si datetime défini, vérifier même heure
                    if ot.date_prevue and ot.date_prevue.date() == target_datetime.date():
                        user_ots.append(ot)
                else:
                    user_ots.append(ot)
        
        equipe_nom = equipe.nom_equipe if equipe else "N/A"
        
        result.append({
            "id_user": user.id_user,
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "role": user.role.value,
            "id_equipe": user.id_equipe,
            "nom_equipe": equipe_nom,
            "quart": quart,
            "ot_en_cours": len(user_ots),
            "disponible": len(user_ots) == 0
        })
    
    # Trier par disponibilité puis par nom
    result.sort(key=lambda x: (not x["disponible"], x["nom"]))
    
    return result


# ── Helpers ───────────────────────────────────────────────────────────

def get_next_numero_ot(db: Session, type_ot: str) -> str:
    annee = datetime.now().year
    count = db.query(OrdreTravail)\
              .filter(OrdreTravail.numero_ot.like(f"OT-{type_ot}-{annee}-%"))\
              .count()
    return f"OT-{type_ot}-{annee}-{str(count + 1).zfill(3)}"


def equip_info(id_equip: int, db: Session) -> dict:
    e = db.get(Equipement, id_equip)
    if not e: return {}
    
    # Get parent (niveau 2)
    parent = db.get(Equipement, e.id_parent) if e.id_parent else None
    
    # Get machine racine (niveau 1)
    racine = db.get(Equipement, e.id_machine_racine) if e.id_machine_racine else None
    
    # Get zone - from equip, then from machine racine
    zone_nom = None
    zone_code = None
    if e.id_zone:
        z = db.get(Zone, e.id_zone)
        if z:
            zone_nom = z.code_zone
            zone_code = z.code_zone
    if not zone_nom and racine and racine.id_zone:
        z = db.get(Zone, racine.id_zone)
        if z:
            zone_nom = z.code_zone
            zone_code = z.code_zone
    
    return {
        "id_equipement"           : e.id_equipement,
        "equipment_code"          : e.equipment_code,
        "description"             : e.description,
        "hierarchy_level"        : e.hierarchy_level,
        "parent_code"            : parent.equipment_code if parent else None,
        "parent_desc"            : parent.description if parent else None,
        "parent_id"              : parent.id_equipement if parent else None,
        "machine_racine_code"    : racine.equipment_code if racine else None,
        "machine_racine_desc"    : racine.description if racine else None,
        "machine_racine_id"      : racine.id_equipement if racine else None,
        "id_zone"               : e.id_zone,
        "nom_zone"               : zone_nom,
        "code_zone"              : zone_code,
    }


def ot_to_dict(ot: OrdreTravail, db: Session) -> dict:
    # ── Methodiste (createur OT) ─────────────────────────────────────────
    methodiste = db.get(Utilisateur, ot.id_methodiste) if ot.id_methodiste else None
    
    # ── Assigné(s) ────────────────────────────────────────────────────────
    assigne = db.get(Utilisateur, ot.id_assigne) if ot.id_assigne else None
    assigne_2 = db.get(Utilisateur, ot.id_assigne_2) if ot.id_assigne_2 else None

    # ── Equipement (avec zone + hierarchie L1/L2/L3) ─────────────────────
    equip = db.get(Equipement, ot.id_equipement) if ot.id_equipement else None
    
    # Get parent (L2)
    parent = None
    if equip and equip.id_parent:
        parent = db.get(Equipement, equip.id_parent)
    
    # Get machine racine (L1)
    racine = None
    if equip and equip.id_machine_racine:
        racine = db.get(Equipement, equip.id_machine_racine)
    
    # Get zone from equip, fallback to racine
    zone_nom = None
    zone_code = None
    if equip and equip.id_zone:
        zone = db.get(Zone, equip.id_zone)
        if zone:
            zone_nom = zone.code_zone
            zone_code = zone.code_zone
    if not zone_nom and racine and racine.id_zone:
        zone = db.get(Zone, racine.id_zone)
        if zone:
            zone_nom = zone.code_zone
            zone_code = zone.code_zone
    
    equip_dict = None
    if equip:
        equip_dict = {
            "id_equipement": equip.id_equipement,
            "equipment_code": equip.equipment_code,
            "description": equip.description,
            "hierarchy_level": equip.hierarchy_level,
            "id_zone": equip.id_zone or (racine.id_zone if racine else None),
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
            # L3 - current
            "current_code": equip.equipment_code,
            "current_desc": equip.description,
        }

    # ── DI (si OT généré depuis DI) ──────────────────────────────────────
    di = None
    di_dict = None
    if ot.id_di:
        di = db.get(DemandeIntervention, ot.id_di)
        if di:
            declarant = db.get(Utilisateur, di.id_declarant) if di.id_declarant else None
            di_dict = {
                "id_di": di.id_di,
                "numero_di": di.numero_di,
                "description": di.description_panne,
                "urgence": di.urgence,
                "statut": di.statut,
                "declarant": f"{declarant.prenom} {declarant.nom}" if declarant else None,
                "email_declarant": declarant.email if declarant else None,
                "created_at": str(di.created_at) if di.created_at else None,
            }

    # ── Intervention ─────────────────────────────────────────────────────
    intervention = db.query(Intervention).filter(Intervention.id_ot == ot.id_ot).first()
    
    inter_dict = None
    if intervention:
        realisateur = db.get(Utilisateur, intervention.id_realisateur) if intervention.id_realisateur else None
        comp_remp = db.get(Equipement, intervention.composante_remplacee) if intervention.composante_remplacee else None
        
        inter_dict = {
            "id_intervention": intervention.id_intervention,
            "type_travail": intervention.type_travail if intervention.type_travail else None,
            "description_travail": intervention.description_travail,
            "observations": intervention.observations,
            "date_debut": str(intervention.date_debut) if intervention.date_debut else None,
            "date_fin": str(intervention.date_fin) if intervention.date_fin else None,
            "realisateur": f"{realisateur.prenom} {realisateur.nom}" if realisateur else None,
            "email_realisateur": realisateur.email if realisateur else None,
            "composante_remplacee": comp_remp.equipment_code if comp_remp else None,
            "composante_remplacee_desc": comp_remp.description if comp_remp else None,
            "statut_validation": intervention.statut_validation.value if intervention.statut_validation else None,
            "date_soumission": str(intervention.date_soumission) if intervention.date_soumission else None,
            # Equipment info from intervention
            "equipement": {
                "id_equipement": intervention.equipement.id_equipement if intervention.equipement else None,
                "equipment_code": intervention.equipement.equipment_code if intervention.equipement else None,
                "description": intervention.equipement.description if intervention.equipement else None,
            } if intervention.equipement else None,
        }

    # ── Calcul durée réelle ─────────────────────────────────────────────
    duree_reelle = None
    if ot.date_debut_reelle and ot.date_fin_reelle:
        delta = ot.date_fin_reelle - ot.date_debut_reelle
        duree_reelle = int(delta.total_seconds() / 60)

    return {
        "id_ot": ot.id_ot,
        "numero_ot": ot.numero_ot,
        "type_ot": ot.type_ot,
        "classe": ot.classe,
        "priorite": ot.urgence,
        "statut": ot.statut,
        "description": ot.description,
        "observations": ot.observations,
        "equipement": equip_dict,
        "methodiste": {
            "id": methodiste.id_user,
            "nom": f"{methodiste.prenom} {methodiste.nom}",
            "email": methodiste.email,
        } if methodiste else None,
        "assigne": {
            "id": assigne.id_user,
            "nom": f"{assigne.prenom} {assigne.nom}",
            "email": assigne.email,
            "role": assigne.role,
            "id_equipe": assigne.id_equipe,
            "nom_equipe": db.get(Equipe, assigne.id_equipe).nom_equipe if assigne.id_equipe and db.get(Equipe, assigne.id_equipe) else None,
        } if assigne else None,
        "assigne_2": {
            "id": assigne_2.id_user,
            "nom": f"{assigne_2.prenom} {assigne_2.nom}",
            "email": assigne_2.email,
            "role": assigne_2.role,
            "id_equipe": assigne_2.id_equipe,
            "nom_equipe": db.get(Equipe, assigne_2.id_equipe).nom_equipe if assigne_2.id_equipe and db.get(Equipe, assigne_2.id_equipe) else None,
        } if assigne_2 else None,
        "date_prevue": str(ot.date_prevue) if ot.date_prevue else None,
        "duree_estimee": ot.duree_estimee,
        "date_debut_reelle": str(ot.date_debut_reelle) if ot.date_debut_reelle else None,
        "date_fin_reelle": str(ot.date_fin_reelle) if ot.date_fin_reelle else None,
        "duree_reelle": duree_reelle,
        "date_assignation": str(ot.date_assignation) if ot.date_assignation else None,
        "date_validation_ce": str(ot.date_validation_ce) if ot.date_validation_ce else None,
        "date_validation_hse": str(ot.date_validation_hse) if ot.date_validation_hse else None,
        "date_archive": str(ot.date_archive) if ot.date_archive else None,
        "motif_rejet": ot.motif_rejet,
        "id_di": ot.id_di,
        "di": di_dict,
        "intervention": inter_dict,
        "id_prediction": ot.id_prediction,
        "created_at": str(ot.created_at) if ot.created_at else None,
    }


# ── GET — Liste OT ────────────────────────────────────────────────────

@router.get("/")
def liste_ot(
    id_pole   : int = None,
    statut    : str = None,
    type_ot   : str = None,
    id_assigne: int = None,
    id_zone   : int = None,
    date_debut: str = None,
    date_fin  : str = None,
    db        : Session = Depends(get_db)
):
    try:
        q = db.query(OrdreTravail)
        if id_pole:    q = q.filter(OrdreTravail.id_pole    == id_pole)
        if statut:     q = q.filter(OrdreTravail.statut     == statut)
        if type_ot:    q = q.filter(OrdreTravail.type_ot    == type_ot)
        if id_assigne: q = q.filter(OrdreTravail.id_assigne == id_assigne)
        if id_zone:
            q = q.join(Equipement, OrdreTravail.id_equipement == Equipement.id_equipement
                      ).filter(Equipement.id_zone == id_zone)
        if date_debut:
            q = q.filter(OrdreTravail.date_archive >= datetime.fromisoformat(date_debut))
        if date_fin:
            q = q.filter(OrdreTravail.date_archive <= datetime.fromisoformat(date_fin))

        ots = q.order_by(OrdreTravail.created_at.desc()).all()
        return [ot_to_dict(o, db) for o in ots]

    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET — Détail OT ───────────────────────────────────────────────────

@router.get("/{id_ot}")
def get_ot(id_ot: int, db: Session = Depends(get_db)):
    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")
        return ot_to_dict(ot, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Créer OT PREDICTIF (méthodiste) ───────────────────────────

@router.post("/")
async def creer_ot(data: dict, db: Session = Depends(get_db)):
    try:
        equip = db.get(Equipement, data["id_equipement"])
        if not equip:
            raise HTTPException(status_code=404,
                                detail="Equipement introuvable")
        if equip.hierarchy_level not in [3, 4]:
            raise HTTPException(
                status_code=400,
                detail="L'OT doit concerner une composante (Level 3 ou 4)"
            )

        type_ot = data.get("type_ot", TypeOT.PREDICTIF)

        from datetime import date as date_type
        date_prevue = None
        if data.get("date_prevue"):
            try:
                date_prevue = date_type.fromisoformat(data["date_prevue"])
            except ValueError:
                pass

        # Accepte 'urgence' (nouveau) ou 'priorite' (legacy) en input, stocke en NIVEAU_1/2/3
        priorite_legacy_map = {
            "FAIBLE": "NIVEAU_1", "NORMALE": "NIVEAU_1",
            "HAUTE": "NIVEAU_2",  "CRITIQUE": "NIVEAU_3",
        }
        urgence_in = data.get("urgence") or data.get("priorite") or "NIVEAU_1"
        urgence_val = priorite_legacy_map.get(urgence_in, urgence_in)  # mappe legacy si besoin

        ot = OrdreTravail(
            numero_ot     = get_next_numero_ot(db, type_ot),
            type_ot       = type_ot,
            classe        = data.get("classe", ClasseOT.MECANIQUE),
            urgence       = urgence_val,
            statut        = StatutOT.CREE,
            id_equipement = data["id_equipement"],
            id_pole       = data["id_pole"],
            id_methodiste = data["id_methodiste"],
            description   = data["description"].strip(),
            date_prevue   = date_prevue,
            duree_estimee = data.get("duree_estimee"),
            id_prediction = data.get("id_prediction"),
        )
        db.add(ot)
        db.commit()
        db.refresh(ot)
        return ot_to_dict(ot, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Assigner OT ────────────────────────────────────────────────

@router.post("/{id_ot}/assigner")
async def assigner_ot(id_ot: int, data: dict, db: Session = Depends(get_db)):
    """Méthodiste assigne un mécanicien/technicien à l'OT"""
    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")
        # Statuts autorisés : CREE (jamais assigné), REJETE (à reprendre),
        # ASSIGNE (réassignation à un autre mécanicien avant démarrage),
        # REWORK (rejet CE → on peut réassigner avant que le méca recommence)
        statut_courant = str(ot.statut) if ot.statut else ""
        if statut_courant not in (
            StatutOT.CREE.value,
            StatutOT.REJETE.value,
            StatutOT.ASSIGNE.value,
            StatutOT.REWORK.value,
        ):
            raise HTTPException(
                status_code=400,
                detail=f"OT ne peut pas être assigné (statut actuel : {statut_courant})",
            )

        # Vérifier que l'assigné principal existe
        assigne = db.get(Utilisateur, data["id_assigne"])
        if not assigne:
            raise HTTPException(status_code=404,
                                detail="Utilisateur introuvable")

        ot.id_assigne      = data["id_assigne"]

        # Deuxième assigné (optionnel, pour electro-mecano)
        assigne_2 = None
        if data.get("id_assigne_2"):
            assigne_2 = db.get(Utilisateur, data["id_assigne_2"])
            if assigne_2:
                ot.id_assigne_2 = data["id_assigne_2"]

        # Date prévue et durée (optionnel - peut être modifié lors de l'assignation)
        if data.get("date_prevue"):
            try:
                ot.date_prevue = datetime.fromisoformat(data["date_prevue"])
            except:
                try:
                    from datetime import date
                    ot.date_prevue = date.fromisoformat(data["date_prevue"])
                except:
                    pass
        
        if data.get("duree_estimee"):
            ot.duree_estimee = int(data["duree_estimee"])

        ot.statut           = StatutOT.ASSIGNE
        ot.date_assignation = datetime.now()

        db.commit()
        db.refresh(ot)

        # ── Notifications ────────────────────────────────────────────
        from services.notification_service import manager as _manager
        print(f"[OT] Envoi notification OT_ASSIGNE pour OT {ot.numero_ot} vers user_id={ot.id_assigne}")
        notif = {
            "type"       : "OT_ASSIGNE",
            "id_ot"      : ot.id_ot,
            "numero_ot"  : ot.numero_ot,
            "message"    : f"Un OT vous a ete assigne : {ot.numero_ot}",
            "priorite"   : ot.urgence if ot.urgence else None,
            "date_prevue": str(ot.date_prevue) if ot.date_prevue else None,
        }
        await _manager.send_personal_message(user_id=ot.id_assigne, message=notif)
        print(f"[OT] Notification envoyee a user_id={ot.id_assigne}")
        if ot.id_assigne_2:
            notif2 = {**notif, "message": f"Un OT vous a ete co-assigne : {ot.numero_ot}"}
            await _manager.send_personal_message(user_id=ot.id_assigne_2, message=notif2)

        return ot_to_dict(ot, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Démarrer OT ────────────────────────────────────────────────

@router.get("/{id_ot}/peut-demarrer")
def peut_demarrer(id_ot: int, db: Session = Depends(get_db)):
    """
    Indique au frontend si l'OT peut être démarré.
    Conditions :
      1. Statut == ASSIGNE (ou REWORK pour re-saisie après rejet)
      2. Date prévue <= aujourd'hui
      3. TOUTES les réservations de pièces de l'OT sont LIVREE
    """
    from models.stock import ReservationPiece, StatutReservation, PieceStock

    ot = db.get(OrdreTravail, id_ot)
    if not ot:
        raise HTTPException(status_code=404, detail="OT introuvable")

    raisons: list[str] = []
    statut_ok = ot.statut in (StatutOT.ASSIGNE, StatutOT.REWORK)
    if not statut_ok:
        raisons.append(f"OT en statut {ot.statut} (doit être ASSIGNE)")

    today = date.today()
    date_ok = ot.date_prevue is None or (ot.date_prevue.date() if hasattr(ot.date_prevue, 'date') else ot.date_prevue) <= today
    if not date_ok:
        d_str = ot.date_prevue.strftime('%d/%m/%Y') if hasattr(ot.date_prevue, 'strftime') else str(ot.date_prevue)
        raisons.append(f"OT prévu le {d_str} — vous ne pouvez démarrer qu'à partir de cette date")

    # Réservations
    reservations = db.query(ReservationPiece).filter(
        ReservationPiece.id_ot == id_ot,
        ReservationPiece.statut != StatutReservation.ANNULEE,
    ).all()

    reservs_info = []
    pieces_ok = True
    for r in reservations:
        piece = db.get(PieceStock, r.id_piece)
        livree = r.statut == StatutReservation.LIVREE
        if not livree:
            pieces_ok = False
        reservs_info.append({
            "id_reservation": r.id_reservation,
            "code_stock"    : piece.code_stock if piece else None,
            "designation"   : piece.designation if piece else None,
            "statut"        : r.statut.value if r.statut else None,
            "livree"        : livree,
        })
    if not pieces_ok:
        en_attente = [r["code_stock"] for r in reservs_info if not r["livree"]]
        raisons.append(f"En attente de livraison : {', '.join(en_attente)}")

    return {
        "peut_demarrer": statut_ok and date_ok and pieces_ok,
        "statut_ok"    : statut_ok,
        "date_ok"      : date_ok,
        "pieces_ok"    : pieces_ok,
        "raisons"      : raisons,
        "reservations" : reservs_info,
        "date_prevue"  : str(ot.date_prevue) if ot.date_prevue else None,
        "statut_actuel": ot.statut if ot.statut else None,
    }


@router.post("/{id_ot}/demarrer")
async def demarrer_ot(id_ot: int, data: dict, db: Session = Depends(get_db)):
    """Mécanicien démarre l'intervention - enregistre le feedback immédiatement.
    Verrouillé : on vérifie statut + date + pièces livrées."""
    from models.intervention import Intervention, StatutValidation, TypeTravail
    from models.stock import ReservationPiece, StatutReservation

    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")

        # ── VERROUS ────────────────────────────────────────────────
        if ot.statut not in (StatutOT.ASSIGNE, StatutOT.REWORK):
            raise HTTPException(
                status_code=400,
                detail=f"OT en statut {ot.statut} — doit être ASSIGNE ou REWORK pour démarrer",
            )

        # Date prévue : on n'autorise pas un démarrage avant la date prévue
        today = date.today()
        if ot.date_prevue:
            d_prevue = ot.date_prevue.date() if hasattr(ot.date_prevue, 'date') else ot.date_prevue
            if d_prevue > today:
                raise HTTPException(
                    status_code=400,
                    detail=f"OT prévu le {d_prevue.strftime('%d/%m/%Y')} — démarrage impossible avant cette date",
                )

        # Toutes les réservations actives doivent être LIVREE
        reservations = db.query(ReservationPiece).filter(
            ReservationPiece.id_ot == id_ot,
            ReservationPiece.statut != StatutReservation.ANNULEE,
        ).all()
        non_livrees = [r for r in reservations if r.statut != StatutReservation.LIVREE]
        if non_livrees:
            raise HTTPException(
                status_code=400,
                detail=f"{len(non_livrees)} pièce(s) en attente de livraison — impossible de démarrer",
            )

        now = datetime.now()
        ot.statut           = StatutOT.EN_COURS
        ot.date_debut_reelle = now

        # extraire les champs feedback depuis la requete
        id_realisateur       = data.get("id_realisateur", ot.id_assigne)
        type_travail_val     = data.get("type_travail", "CORRECTIF")
        description_travail  = data.get("description_travail", "")
        observations         = data.get("observations", None)
        composante_remplacee = data.get("composante_remplacee", None)

        print(f"[DEBUG demarrer] data recue = {data}", flush=True)

        # Convertir le type_travail string en enum (case-insensitive)
        type_travail_upper = str(type_travail_val).upper()
        valid_values = {e.value: e for e in TypeTravail}
        type_travail_enum = valid_values.get(type_travail_upper, TypeTravail.CORRECTIF)
        print(f"[DEBUG demarrer] type_travail_val={type_travail_val} -> enum={type_travail_enum}", flush=True)

        # Create Intervention if not exists
        intervention = db.query(Intervention).filter(Intervention.id_ot == id_ot).first()
        if not intervention:
            intervention = Intervention(
                id_ot                = id_ot,
                id_realisateur       = id_realisateur,
                id_pole              = ot.id_pole,
                id_equipement        = ot.id_equipement,
                type_travail         = type_travail_enum,
                description_travail  = description_travail,
                observations         = observations,
                date_debut           = now,
                date_fin             = None,
                composante_remplacee = composante_remplacee,
                statut_validation    = StatutValidation.EN_ATTENTE,
            )
            db.add(intervention)
        else:
            intervention.type_travail        = type_travail_enum
            intervention.description_travail = description_travail
            intervention.observations        = observations
            if composante_remplacee:
                intervention.composante_remplacee = composante_remplacee

        db.commit()
        db.refresh(ot)
        
        # ── Notification au Chef Équipe ─────────────────────────────────
        if ot.id_assigne:
            assignee = db.get(Utilisateur, ot.id_assigne)
            if assignee and assignee.id_equipe:
                ce = db.query(Utilisateur).filter(
                    Utilisateur.id_equipe == assignee.id_equipe,
                    Utilisateur.role == RoleEnum.CHEF_EQUIPE
                ).first()
                if ce:
                    from services.notification_service import manager as _notif_manager
                    await _notif_manager.send_personal_message(user_id=ce.id_user, message={
                        "type"     : "OT_DEMARRE",
                        "id_ot"    : id_ot,
                        "numero_ot": ot.numero_ot,
                        "message"  : f"L'OT {ot.numero_ot} a ete demarre par {assignee.prenom} {assignee.nom}.",
                    })
        
        return ot_to_dict(ot, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Valider OT (Méthodiste) ───────────────────────────────────

@router.post("/{id_ot}/valider")
async def valider_ot(id_ot: int, data: dict, db: Session = Depends(get_db)):
    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")
        if ot.statut != StatutOT.VALIDE_HSE:
            raise HTTPException(status_code=400,
                                detail="OT doit être validé par HSE d'abord")

        ot.statut       = StatutOT.ARCHIVE
        ot.date_archive = datetime.now()

        db.commit()
        db.refresh(ot)
        return ot_to_dict(ot, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Rejeter OT ────────────────────────────────────────────────

@router.post("/{id_ot}/rejeter")
async def rejeter_ot(id_ot: int, data: dict, db: Session = Depends(get_db)):
    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")

        ot.statut       = StatutOT.REJETE
        ot.motif_rejet  = data.get("motif_rejet", "").strip()
        ot.id_rejecteur = data.get("id_rejecteur")

        db.commit()
        db.refresh(ot)
        return ot_to_dict(ot, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET — Mécaniciens disponibles pour un OT ─────────────────────────
@router.get("/{id_ot}/mecaniciens-disponibles")
def mecaniciens_disponibles(id_ot: int, db: Session = Depends(get_db)):
    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")

        # Date de l'OT (aujourd'hui si pas de date prévue)
        from datetime import date as date_type
        date_ot = ot.date_prevue if ot.date_prevue else date_type.today()

        # Filtrer rôles selon classe OT
        if ot.classe == ClasseOT.MECANIQUE:
            roles = [RoleEnum.MECANICIEN]
        elif ot.classe == ClasseOT.ELECTRIQUE:
            roles = [RoleEnum.TECHNICIEN]
        else:
            roles = [RoleEnum.MECANICIEN, RoleEnum.TECHNICIEN]

        # Récupérer tous les utilisateurs du pôle avec le bon rôle
        utilisateurs = db.query(Utilisateur).filter(
            Utilisateur.role.in_(roles),
            Utilisateur.id_pole == ot.id_pole,
        ).all()

        # Récupérer le planning du pôle
        from models.planing import ConfigPlanning, EchangeQuart
        from models.equipe  import Equipe

        config  = db.query(ConfigPlanning)\
                    .filter_by(id_pole=ot.id_pole).first()
        equipes = db.query(Equipe)\
                    .filter_by(id_pole=ot.id_pole).all()
        echanges= db.query(EchangeQuart)\
                    .filter_by(id_pole=ot.id_pole).all()

        # Calculer le quart de chaque équipe ce jour-là
        from routes.planning import get_quart_avec_echange, ORDRE, CYCLE

        quarts_equipes: dict = {}
        if config:
            for eq in equipes:
                quart = get_quart_avec_echange(
                    config, eq, date_ot, echanges, equipes
                )
                quarts_equipes[eq.id_equipe] = quart

        # Construire la liste des mécaniciens avec leur quart
        result = []
        for u in utilisateurs:
            # Trouver l'équipe de cet utilisateur
            equipe_user = next(
                (eq for eq in equipes if eq.id_equipe == u.id_equipe),
                None
            )

            quart_user = None
            disponible = True

            if equipe_user and equipe_user.id_equipe in quarts_equipes:
                quart_user = quarts_equipes[equipe_user.id_equipe]
                # Repos = non disponible
                disponible = quart_user != "Repos"

            result.append({
                "id_user"   : u.id_user,
                "nom"       : f"{u.prenom} {u.nom}",
                "role"      : u.role,
                "id_equipe" : equipe_user.id_equipe   if equipe_user else None,
                "nom_equipe": equipe_user.nom_equipe  if equipe_user else None,
                "quart"     : quart_user,
                "disponible": disponible,
                # True = travaille ce jour
                # False = en repos
            })

        # Trier : disponibles en premier
        result.sort(key=lambda x: (not x["disponible"], x["nom"]))
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── EXPORT ───────────────────────────────────────────────────────────────

from fastapi.responses import Response, HTMLResponse
from services.export_service import generate_ot_csv, generate_ot_pdf_html, generate_ot_list_pdf_html
from services.print_templates import CEVITAL_TEMPLATE
from sqlalchemy import func, extract
from html import escape as _esc


# ── GET — Stats Archives ─────────────────────────────────────────────

@router.get("/archives/stats")
def stats_archives(
    id_pole: int = None,
    db: Session = Depends(get_db)
):
    try:
        q = db.query(OrdreTravail).filter(OrdreTravail.statut == StatutOT.ARCHIVE)
        if id_pole:
            q = q.filter(OrdreTravail.id_pole == id_pole)

        total = q.count()

        # Par zone
        zone_stats = db.query(
            Zone.code_zone,
            func.count(OrdreTravail.id_ot)
        ).join(Equipement, OrdreTravail.id_equipement == Equipement.id_equipement
        ).join(Zone, Equipement.id_zone == Zone.id_zone
        ).filter(OrdreTravail.statut == StatutOT.ARCHIVE
        ).group_by(Zone.code_zone).all()

        # Par mois (cette année)
        current_year = datetime.now().year
        mois_stats = db.query(
            extract('month', OrdreTravail.date_archive).label('mois'),
            func.count(OrdreTravail.id_ot)
        ).filter(
            OrdreTravail.statut == StatutOT.ARCHIVE,
            extract('year', OrdreTravail.date_archive) == current_year
        ).group_by('mois').order_by('mois').all()

        # Top intervenants
        top_intervenants = db.query(
            Utilisateur.nom,
            Utilisateur.prenom,
            func.count(Intervention.id_intervention)
        ).join(Intervention, Intervention.id_realisateur == Utilisateur.id_user
        ).join(OrdreTravail, Intervention.id_ot == OrdreTravail.id_ot
        ).filter(OrdreTravail.statut == StatutOT.ARCHIVE
        ).group_by(Utilisateur.id_user
        ).order_by(func.count(Intervention.id_intervention).desc()
        ).limit(5).all()

        return {
            "total": total,
            "par_zone": [{"zone": z, "count": c} for z, c in zone_stats],
            "par_mois": [{"mois": int(m), "count": c} for m, c in mois_stats],
            "top_intervenants": [
                {"nom": f"{p} {n}", "count": c}
                for n, p, c in top_intervenants
            ],
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── GET — Imprimer Liste OT (toute la liste, tous statuts) ────────────

@router.get("/liste/imprimer", response_class=HTMLResponse)
def imprimer_liste_ot(
    id_pole:    int  | None = Query(None),
    id_zone:    int  | None = Query(None),
    id_equipe:  int  | None = Query(None),
    statut:     str  | None = Query(None, description="Filtre statut (CREE, ASSIGNE, EN_COURS, TERMINE, VALIDE_CE, VALIDE_HSE, ARCHIVE). Vide ou TOUS = tout"),
    type_ot:    str  | None = Query(None, description="Filtre type (CORRECTIF, PREVENTIF, PREDICTIF)"),
    priorite:   str  | None = Query(None),
    date_debut: date | None = Query(None),
    date_fin:   date | None = Query(None),
    groupement: str         = Query("statut", description="statut|zone|equipe|priorite|type|mois"),
    db: Session = Depends(get_db),
):
    """
    Génère une page HTML imprimable de TOUS les OT (peu importe le statut),
    avec filtres optionnels et regroupement.
    """
    q = (
        db.query(OrdreTravail)
        .order_by(OrdreTravail.created_at.desc())
    )

    if id_pole:
        q = q.filter(OrdreTravail.id_pole == id_pole)
    if statut and statut.upper() not in ("TOUS", "ALL", ""):
        try:
            q = q.filter(OrdreTravail.statut == StatutOT(statut.upper()))
        except ValueError:
            pass
    if type_ot and type_ot.upper() not in ("TOUS", "ALL", ""):
        try:
            q = q.filter(OrdreTravail.type_ot == TypeOT(type_ot.upper()))
        except ValueError:
            pass
    if priorite and priorite.upper() not in ("TOUS", "ALL", ""):
        # Filtre par urgence (NIVEAU_1/2/3) — accepte aussi anciens libellés FAIBLE/.../CRITIQUE
        legacy_map = {"FAIBLE":"NIVEAU_1","NORMALE":"NIVEAU_1","HAUTE":"NIVEAU_2","CRITIQUE":"NIVEAU_3"}
        val = legacy_map.get(priorite.upper(), priorite.upper())
        q = q.filter(OrdreTravail.urgence == val)
    if date_debut:
        q = q.filter(OrdreTravail.created_at >= date_debut)
    if date_fin:
        q = q.filter(OrdreTravail.created_at <= date_fin)

    if id_zone:
        q = q.join(Equipement, OrdreTravail.id_equipement == Equipement.id_equipement)\
             .filter(Equipement.id_zone == id_zone)

    if id_equipe:
        q = q.join(Utilisateur, OrdreTravail.id_assigne == Utilisateur.id_user)\
             .filter(Utilisateur.id_equipe == id_equipe)

    ots = q.all()

    equipements = {e.id_equipement: e for e in db.query(Equipement).all()}
    zones       = {z.id_zone: z       for z in db.query(Zone).all()}
    poles       = {p.id_pole: p       for p in db.query(Pole).all()}
    users       = {u.id_user: u       for u in db.query(Utilisateur).all()}
    equipes     = {e.id_equipe: e     for e in db.query(Equipe).all()}
    interventions_par_ot: dict[int, Intervention] = {
        i.id_ot: i for i in db.query(Intervention).all()
    }
    dis_par_id: dict[int, DemandeIntervention] = {
        d.id_di: d for d in db.query(DemandeIntervention).all()
    }

    def _zone_of(ot: OrdreTravail) -> Zone | None:
        eq = equipements.get(ot.id_equipement)
        if eq and eq.id_zone:
            return zones.get(eq.id_zone)
        return None

    def _equipe_of(ot: OrdreTravail) -> Equipe | None:
        u = users.get(ot.id_assigne) if ot.id_assigne else None
        if u and u.id_equipe:
            return equipes.get(u.id_equipe)
        return None

    grouped: dict[str, list[OrdreTravail]] = {}
    for ot in ots:
        s = ot.statut.value if hasattr(ot.statut, "value") else str(ot.statut or "—")
        if groupement == "statut":
            key = s
        elif groupement == "zone":
            z = _zone_of(ot)
            key = z.code_zone if z else "Sans zone"
        elif groupement == "equipe":
            e = _equipe_of(ot)
            key = e.nom_equipe if e else "Non assigné à une équipe"
        elif groupement == "priorite":
            key = (ot.urgence if hasattr(ot.urgence, "value") else str(ot.urgence or "—"))
        elif groupement == "type":
            key = (ot.type_ot.value if hasattr(ot.type_ot, "value") else str(ot.type_ot or "—"))
        elif groupement == "mois":
            key = ot.created_at.strftime("%Y-%m") if ot.created_at else "Sans date"
        else:
            key = "Tous"
        grouped.setdefault(key, []).append(ot)

    # Ordre d'affichage des statuts (si groupement=statut)
    STATUT_ORDER = ["CREE", "ASSIGNE", "EN_COURS", "TERMINE", "VALIDE_CE", "VALIDE_HSE", "ARCHIVE", "REJETE"]
    if groupement == "statut":
        groupe_keys_ordered = [s for s in STATUT_ORDER if s in grouped]
        groupe_keys_ordered += [k for k in sorted(grouped.keys()) if k not in groupe_keys_ordered]
    else:
        groupe_keys_ordered = sorted(grouped.keys())

    sections_html = []
    nb_total = len(ots)

    for groupe_key in groupe_keys_ordered:
        liste = grouped[groupe_key]
        rows = []
        for i, ot in enumerate(liste, 1):
            equip       = equipements.get(ot.id_equipement)
            zone        = _zone_of(ot)
            equipe      = _equipe_of(ot)
            interv      = interventions_par_ot.get(ot.id_ot)
            assigne     = users.get(ot.id_assigne) if ot.id_assigne else None
            methodiste  = users.get(ot.id_methodiste) if ot.id_methodiste else None
            di          = dis_par_id.get(ot.id_di) if ot.id_di else None
            pole        = poles.get(ot.id_pole) if ot.id_pole else None

            composante_txt  = equip.description if equip else "—"
            composante_code = equip.equipment_code if equip else "—"

            machine_racine = "—"
            if equip and equip.id_machine_racine:
                racine_eq = equipements.get(equip.id_machine_racine)
                if racine_eq:
                    machine_racine = racine_eq.equipment_code

            statut_v   = ot.statut.value if hasattr(ot.statut, "value") else str(ot.statut or "")
            priorite_v = ot.urgence if hasattr(ot.urgence, "value") else str(ot.urgence or "—")
            type_v     = ot.type_ot.value if hasattr(ot.type_ot, "value") else str(ot.type_ot or "—")

            duree_str = "—"
            if interv and interv.date_debut and interv.date_fin:
                delta = interv.date_fin - interv.date_debut
                mins = int(delta.total_seconds() // 60)
                duree_str = f"{mins // 60}h{mins % 60:02d}"

            rows.append(f"""
              <tr>
                <td class="num">{i:02d}</td>
                <td class="mono nom">{_esc(ot.numero_ot or '—')}</td>
                <td>{_esc(type_v)}</td>
                <td><span class="priorite {priorite_v}">{_esc(priorite_v)}</span></td>
                <td class="mono">{_esc(machine_racine)}</td>
                <td>
                  <div class="mono" style="font-size:7.5pt;">{_esc(composante_code)}</div>
                  <div style="color:#6b7280;font-size:7.5pt;">{_esc(composante_txt[:50])}</div>
                </td>
                <td>{_esc(zone.code_zone if zone else '—')}</td>
                <td>{_esc(pole.nom_pole if pole else '—')}</td>
                <td class="mono" style="font-size:7.5pt;">{_esc(di.numero_di if di else '—')}</td>
                <td>{_esc((methodiste.prenom + ' ' + methodiste.nom) if methodiste else '—')}</td>
                <td>{_esc((assigne.prenom + ' ' + assigne.nom) if assigne else '—')}</td>
                <td>{_esc(equipe.nom_equipe if equipe else '—')}</td>
                <td style="text-align:center;">{_esc(str(ot.date_prevue.date()) if ot.date_prevue else '—')}</td>
                <td style="text-align:center;">{_esc(str(ot.created_at.date()) if ot.created_at else '—')}</td>
                <td style="text-align:center;">{_esc(duree_str)}</td>
                <td><span class="statut {statut_v}">{_esc(statut_v)}</span></td>
              </tr>""")

        sections_html.append(f"""
          <section class="role-section">
            <div class="role-header">
              <h2>{_esc(groupe_key)}</h2>
              <span class="badge">{len(liste)} OT</span>
            </div>
            <table class="users-table">
              <thead>
                <tr>
                  <th class="num">#</th>
                  <th>N° OT</th>
                  <th>Type</th>
                  <th>Priorité</th>
                  <th>Machine</th>
                  <th>Composante</th>
                  <th>Zone</th>
                  <th>Pôle</th>
                  <th>N° DI</th>
                  <th>Méthodiste</th>
                  <th>Intervenant</th>
                  <th>Équipe</th>
                  <th>Date prévue</th>
                  <th>Créé le</th>
                  <th>Durée</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>{''.join(rows)}</tbody>
            </table>
          </section>
        """)

    sections_str = '\n'.join(sections_html) if sections_html else (
        '<p class="empty">Aucun OT pour les filtres sélectionnés.</p>'
    )

    pole_obj   = poles.get(id_pole)     if id_pole   else None
    zone_obj   = zones.get(id_zone)     if id_zone   else None
    equipe_obj = equipes.get(id_equipe) if id_equipe else None
    filtres_str = []
    if pole_obj:   filtres_str.append(f"Pôle {pole_obj.nom_pole}")
    if zone_obj:   filtres_str.append(f"Zone {zone_obj.code_zone}")
    if equipe_obj: filtres_str.append(f"Équipe {equipe_obj.nom_equipe}")
    if statut and statut.upper() not in ("TOUS", "ALL", ""):     filtres_str.append(f"Statut : {statut}")
    if type_ot and type_ot.upper() not in ("TOUS", "ALL", ""):   filtres_str.append(f"Type : {type_ot}")
    if priorite and priorite.upper() not in ("TOUS", "ALL", ""): filtres_str.append(f"Priorité : {priorite}")
    if date_debut: filtres_str.append(f"du {date_debut}")
    if date_fin:   filtres_str.append(f"au {date_fin}")
    sous_titre_filtres = " · ".join(filtres_str) if filtres_str else "Tous OT confondus"

    now = datetime.now()
    GROUPEMENT_LABEL = {
        "statut":   "statut",
        "zone":     "zone",
        "equipe":   "équipe",
        "priorite": "priorité",
        "type":     "type",
        "mois":     "mois",
    }

    html = CEVITAL_TEMPLATE.format(
        title="Liste des Ordres de Travail — CEVITAL Optima",
        document_title="Registre des Ordres de Travail",
        sous_titre=f"Système GMAO Optima · Regroupés par {GROUPEMENT_LABEL.get(groupement, groupement)} · {sous_titre_filtres}",
        meta=(
            f'<span><b>Date d\'édition :</b> {now.strftime("%d/%m/%Y à %H:%M")}</span>'
            f'<span><b>Nombre d\'OT :</b> {nb_total}</span>'
        ),
        content=sections_str,
        signatures='''
          <div class="signature-box">
            <div class="label">Le Méthodiste</div>
            <div class="sub">Cachet & signature</div>
          </div>
          <div class="signature-box">
            <div class="label">Le Chef de Maintenance</div>
            <div class="sub">Cachet & signature</div>
          </div>
          <div class="signature-box">
            <div class="label">Le Responsable HSE</div>
            <div class="sub">Cachet & signature</div>
          </div>
        ''',
    )

    return HTMLResponse(content=html)


# ── GET — Imprimer Archives (HTML stylé CEVITAL) ─────────────────────

@router.get("/archives/imprimer", response_class=HTMLResponse)
def imprimer_archives_ot(
    id_pole:    int  | None = Query(None),
    id_zone:    int  | None = Query(None),
    id_equipe:  int  | None = Query(None),
    date_debut: date | None = Query(None),
    date_fin:   date | None = Query(None),
    groupement: str         = Query("zone", description="zone|equipe|priorite|mois"),
    db: Session = Depends(get_db),
):
    """
    Génère une page HTML imprimable des OT archivés, avec filtres optionnels
    et groupement par zone, équipe, priorité ou mois.
    """
    # ── Requête principale ───────────────────────────────────────────────
    q = (
        db.query(OrdreTravail)
        .filter(OrdreTravail.statut == StatutOT.ARCHIVE)
        .order_by(OrdreTravail.date_archive.desc())
    )

    if id_pole:
        q = q.filter(OrdreTravail.id_pole == id_pole)
    if date_debut:
        q = q.filter(OrdreTravail.date_archive >= date_debut)
    if date_fin:
        q = q.filter(OrdreTravail.date_archive <= date_fin)

    # Filtre par zone : via Equipement.id_zone
    if id_zone:
        q = q.join(Equipement, OrdreTravail.id_equipement == Equipement.id_equipement)\
             .filter(Equipement.id_zone == id_zone)

    # Filtre par équipe : via assigne.id_equipe (uniquement OT assignés à un membre)
    if id_equipe:
        q = q.join(Utilisateur, OrdreTravail.id_assigne == Utilisateur.id_user)\
             .filter(Utilisateur.id_equipe == id_equipe)

    ots = q.all()

    # ── Préchargement des entités liées ─────────────────────────────────
    equipements = {e.id_equipement: e for e in db.query(Equipement).all()}
    zones       = {z.id_zone: z       for z in db.query(Zone).all()}
    poles       = {p.id_pole: p       for p in db.query(Pole).all()}
    users       = {u.id_user: u       for u in db.query(Utilisateur).all()}
    equipes     = {e.id_equipe: e     for e in db.query(Equipe).all()}
    interventions_par_ot: dict[int, Intervention] = {
        i.id_ot: i for i in db.query(Intervention).all()
    }
    dis_par_id: dict[int, DemandeIntervention] = {
        d.id_di: d for d in db.query(DemandeIntervention).all()
    }

    def _zone_of(ot: OrdreTravail) -> Zone | None:
        eq = equipements.get(ot.id_equipement)
        if eq and eq.id_zone:
            return zones.get(eq.id_zone)
        return None

    def _equipe_of(ot: OrdreTravail) -> Equipe | None:
        u = users.get(ot.id_assigne) if ot.id_assigne else None
        if u and u.id_equipe:
            return equipes.get(u.id_equipe)
        return None

    # ── Groupement ──────────────────────────────────────────────────────
    grouped: dict[str, list[OrdreTravail]] = {}
    for ot in ots:
        if groupement == "zone":
            z = _zone_of(ot)
            key = z.code_zone if z else "Sans zone"
        elif groupement == "equipe":
            e = _equipe_of(ot)
            key = e.nom_equipe if e else "Non assigné à une équipe"
        elif groupement == "priorite":
            key = (ot.urgence if hasattr(ot.urgence, "value") else str(ot.urgence or "—"))
        elif groupement == "mois":
            key = ot.date_archive.strftime("%Y-%m") if ot.date_archive else "Sans date"
        else:
            key = "Tous"
        grouped.setdefault(key, []).append(ot)

    # ── Rendu HTML ──────────────────────────────────────────────────────
    sections_html = []
    nb_total = len(ots)

    for groupe_key in sorted(grouped.keys()):
        liste = grouped[groupe_key]
        rows = []
        for i, ot in enumerate(liste, 1):
            equip       = equipements.get(ot.id_equipement)
            zone        = _zone_of(ot)
            equipe      = _equipe_of(ot)
            interv      = interventions_par_ot.get(ot.id_ot)
            assigne     = users.get(ot.id_assigne) if ot.id_assigne else None
            methodiste  = users.get(ot.id_methodiste) if ot.id_methodiste else None
            di          = dis_par_id.get(ot.id_di) if ot.id_di else None
            pole        = poles.get(ot.id_pole) if ot.id_pole else None

            # Composante = description équipement
            composante_txt = equip.description if equip else "—"
            composante_code = equip.equipment_code if equip else "—"

            # Machine racine
            machine_racine = "—"
            if equip and equip.id_machine_racine:
                racine_eq = equipements.get(equip.id_machine_racine)
                if racine_eq:
                    machine_racine = racine_eq.equipment_code

            statut    = ot.statut.value if hasattr(ot.statut, "value") else str(ot.statut or "")
            priorite  = ot.urgence if hasattr(ot.urgence, "value") else str(ot.urgence or "—")
            type_ot   = ot.type_ot.value if hasattr(ot.type_ot, "value") else str(ot.type_ot or "—")

            # Durée intervention
            duree_str = "—"
            if interv and interv.date_debut and interv.date_fin:
                delta = interv.date_fin - interv.date_debut
                mins = int(delta.total_seconds() // 60)
                duree_str = f"{mins // 60}h{mins % 60:02d}"

            rows.append(f"""
              <tr>
                <td class="num">{i:02d}</td>
                <td class="mono nom">{_esc(ot.numero_ot or '—')}</td>
                <td>{_esc(type_ot)}</td>
                <td><span class="priorite {priorite}">{_esc(priorite)}</span></td>
                <td class="mono">{_esc(machine_racine)}</td>
                <td>
                  <div class="mono" style="font-size:7.5pt;">{_esc(composante_code)}</div>
                  <div style="color:#6b7280;font-size:7.5pt;">{_esc(composante_txt[:50])}</div>
                </td>
                <td>{_esc(zone.code_zone if zone else '—')}</td>
                <td>{_esc(pole.nom_pole if pole else '—')}</td>
                <td class="mono" style="font-size:7.5pt;">{_esc(di.numero_di if di else '—')}</td>
                <td>{_esc((methodiste.prenom + ' ' + methodiste.nom) if methodiste else '—')}</td>
                <td>{_esc((assigne.prenom + ' ' + assigne.nom) if assigne else '—')}</td>
                <td>{_esc(equipe.nom_equipe if equipe else '—')}</td>
                <td style="text-align:center;">{_esc(str(ot.date_prevue.date()) if ot.date_prevue else '—')}</td>
                <td style="text-align:center;">{_esc(str(ot.date_archive.date()) if ot.date_archive else '—')}</td>
                <td style="text-align:center;">{_esc(duree_str)}</td>
                <td><span class="statut {statut}">{_esc(statut)}</span></td>
              </tr>""")

        sections_html.append(f"""
          <section class="role-section">
            <div class="role-header">
              <h2>{_esc(groupe_key)}</h2>
              <span class="badge">{len(liste)} OT</span>
            </div>
            <table class="users-table">
              <thead>
                <tr>
                  <th class="num">#</th>
                  <th>N° OT</th>
                  <th>Type</th>
                  <th>Priorité</th>
                  <th>Machine</th>
                  <th>Composante</th>
                  <th>Zone</th>
                  <th>Pôle</th>
                  <th>N° DI</th>
                  <th>Méthodiste</th>
                  <th>Intervenant</th>
                  <th>Équipe</th>
                  <th>Date prévue</th>
                  <th>Archivé le</th>
                  <th>Durée</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>{''.join(rows)}</tbody>
            </table>
          </section>
        """)

    sections_str = '\n'.join(sections_html) if sections_html else (
        '<p class="empty">Aucun OT archivé pour les filtres sélectionnés.</p>'
    )

    # Filtres dans le titre
    pole_obj   = poles.get(id_pole)   if id_pole   else None
    zone_obj   = zones.get(id_zone)   if id_zone   else None
    equipe_obj = equipes.get(id_equipe) if id_equipe else None
    filtres_str = []
    if pole_obj:   filtres_str.append(f"Pôle {pole_obj.nom_pole}")
    if zone_obj:   filtres_str.append(f"Zone {zone_obj.code_zone}")
    if equipe_obj: filtres_str.append(f"Équipe {equipe_obj.nom_equipe}")
    if date_debut: filtres_str.append(f"du {date_debut}")
    if date_fin:   filtres_str.append(f"au {date_fin}")
    sous_titre_filtres = " · ".join(filtres_str) if filtres_str else "Toutes archives confondues"

    now = datetime.now()
    GROUPEMENT_LABEL = {"zone": "zone", "equipe": "équipe", "priorite": "priorité", "mois": "mois"}

    html = CEVITAL_TEMPLATE.format(
        title="Archives des Ordres de Travail — CEVITAL Optima",
        document_title="Registre des Ordres de Travail Archivés",
        sous_titre=f"Système GMAO Optima · Regroupés par {GROUPEMENT_LABEL.get(groupement, groupement)} · {sous_titre_filtres}",
        meta=(
            f'<span><b>Date d\'édition :</b> {now.strftime("%d/%m/%Y à %H:%M")}</span>'
            f'<span><b>Nombre d\'OT archivés :</b> {nb_total}</span>'
        ),
        content=sections_str,
        signatures='''
          <div class="signature-box">
            <div class="label">Le Chef de Maintenance</div>
            <div class="sub">Cachet & signature</div>
          </div>
          <div class="signature-box">
            <div class="label">Le Responsable HSE</div>
            <div class="sub">Cachet & signature</div>
          </div>
          <div class="signature-box">
            <div class="label">Le Directeur d'Usine</div>
            <div class="sub">Cachet & signature</div>
          </div>
        ''',
    )

    return HTMLResponse(content=html)


# ── GET — Export Archives CSV ────────────────────────────────────────

@router.get("/archives/export")
def export_archives_csv(
    id_pole: int = None,
    id_zone: int = None,
    date_debut: str = None,
    date_fin: str = None,
    type_ot: str = None,
    db: Session = Depends(get_db)
):
    try:
        q = db.query(OrdreTravail).filter(OrdreTravail.statut == StatutOT.ARCHIVE)
        if id_pole:
            q = q.filter(OrdreTravail.id_pole == id_pole)
        if type_ot:
            q = q.filter(OrdreTravail.type_ot == type_ot)
        if date_debut:
            q = q.filter(OrdreTravail.date_archive >= datetime.fromisoformat(date_debut))
        if date_fin:
            q = q.filter(OrdreTravail.date_archive <= datetime.fromisoformat(date_fin))
        if id_zone:
            q = q.join(Equipement, OrdreTravail.id_equipement == Equipement.id_equipement
                      ).filter(Equipement.id_zone == id_zone)

        ots = q.order_by(OrdreTravail.date_archive.desc()).all()
        ots_data = [ot_to_dict(o, db) for o in ots]

        output = io.StringIO()
        headers = [
            "N° OT", "Type", "Classe", "Priorité",
            "Machine Racine", "Composante", "Zone",
            "Assigné", "Équipe",
            "Type Travail", "Description Travail",
            "Date Début", "Date Fin", "Durée (min)",
            "Validé CE", "Validé HSE", "Date Archive",
        ]
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()

        for ot in ots_data:
            equip = ot.get("equipement") or {}
            inter = ot.get("intervention") or {}
            assigne = ot.get("assigne") or {}
            writer.writerow({
                "N° OT": ot.get("numero_ot", ""),
                "Type": ot.get("type_ot", ""),
                "Classe": ot.get("classe", ""),
                "Priorité": ot.get("priorite", ""),
                "Machine Racine": equip.get("machine_racine_code", ""),
                "Composante": equip.get("equipment_code", ""),
                "Zone": equip.get("nom_zone", ""),
                "Assigné": assigne.get("nom", ""),
                "Équipe": "",
                "Type Travail": inter.get("type_travail", ""),
                "Description Travail": inter.get("description_travail", ""),
                "Date Début": inter.get("date_debut", ""),
                "Date Fin": inter.get("date_fin", ""),
                "Durée (min)": str(ot.get("duree_reelle") or ""),
                "Validé CE": ot.get("date_validation_ce", ""),
                "Validé HSE": ot.get("date_validation_hse", ""),
                "Date Archive": str(ot.get("date_archive") or ""),
            })

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=archives_export.csv"}
        )
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


@router.get("/export/csv")
def export_ots_csv(
    id_pole: int = None,
    statut: str = None,
    db: Session = Depends(get_db)
):
    """
    Exporte les OTs en CSV
    """
    query = db.query(OrdreTravail)
    if id_pole:
        query = query.filter(OrdreTravail.id_pole == id_pole)
    if statut:
        query = query.filter(OrdreTravail.statut == statut)
    
    ots = query.order_by(OrdreTravail.created_at.desc()).all()
    
    # Convertir en dict
    ots_data = [ot_to_dict(ot, db) for ot in ots]
    
    csv_content = generate_ot_csv(ots_data)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ots_export.csv"}
    )


@router.get("/{id_ot}/export/pdf")
def export_ot_pdf(id_ot: int, db: Session = Depends(get_db)):
    """
    Exporte un OT spécifique en PDF (HTML formaté)
    """
    ot = db.get(OrdreTravail, id_ot)
    if not ot:
        raise HTTPException(status_code=404, detail="OT introuvable")
    
    ot_data = ot_to_dict(ot, db)
    html_content = generate_ot_pdf_html(ot_data)
    
    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=OT_{ot.numero_ot}.html"}
    )


@router.get("/export/pdf")
def export_ots_list_pdf(
    id_pole: int = None,
    statut: str = None,
    db: Session = Depends(get_db)
):
    """
    Exporte la liste des OTs en PDF
    """
    query = db.query(OrdreTravail)
    if id_pole:
        query = query.filter(OrdreTravail.id_pole == id_pole)
    if statut:
        query = query.filter(OrdreTravail.statut == statut)
    
    ots = query.order_by(OrdreTravail.created_at.desc()).limit(100).all()
    ots_data = [ot_to_dict(ot, db) for ot in ots]
    
    html_content = generate_ot_list_pdf_html(ots_data)
    
    return Response(
        content=html_content,
        media_type="text/html",
        headers={"Content-Disposition": "attachment; filename=liste_ots.html"}
    )


