from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
import traceback

from database          import get_db
from models.ot         import OrdreTravail, StatutOT, TypeOT, ClasseOT, PrioriteOT
from models.equipement import Equipement
from models.pole       import Pole
from models.user       import Utilisateur, RoleEnum
from models.zone       import Zone
from models.di        import DemandeIntervention
from models.intervention import Intervention

router = APIRouter()


# ── GET AVAILABLE USERS FOR ASSIGNMENT (MUST BE FIRST) ─────────────
@router.get("/users-disponibles")
def get_users_disponibles(
    id_pole: int = 0,
    classe: str = "GLOBALE",
    date_prevue: str | None = None,
    db: Session = Depends(get_db)
):
    if not id_pole or id_pole <= 0:
        return []
    
    from datetime import date
    
    target_date = date.today()
    if date_prevue:
        try:
            target_date = date.fromisoformat(date_prevue)
        except:
            pass
    
    if classe == "MECANIQUE":
        allowed_roles = [RoleEnum.MECANICIEN, RoleEnum.CHEF_EQUIPE]
    elif classe == "ELECTRIQUE":
        allowed_roles = [RoleEnum.TECHNICIEN, RoleEnum.CHEF_EQUIPE]
    else:
        allowed_roles = [RoleEnum.MECANICIEN, RoleEnum.TECHNICIEN, RoleEnum.CHEF_EQUIPE]
    
    users = db.query(Utilisateur).filter(
        Utilisateur.id_pole == id_pole,
        Utilisateur.role.in_(allowed_roles),
        Utilisateur.shift != None
    ).all()
    
    from models.equipe import Equipe
    equipes = {e.id_equipe: e for e in db.query(Equipe).filter_by(id_pole=id_pole).all()}
    
    ots_du_jour = db.query(OrdreTravail).filter(
        OrdreTravail.id_pole == id_pole,
        OrdreTravail.date_prevue == target_date,
        OrdreTravail.statut.in_([StatutOT.ASSIGNE, StatutOT.EN_COURS])
    ).all()
    
    result = []
    for user in users:
        user_shift = user.shift.value if user.shift else None
        
        if user_shift == "NUIT" or user_shift is None:
            continue
        
        user_ots = [ot for ot in ots_du_jour if ot.id_assigne == user.id_user]
        
        equipe_nom = equipes.get(user.id_equipe).nom_equipe if user.id_equipe and user.id_equipe in equipes else "N/A"
        
        result.append({
            "id_user": user.id_user,
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "role": user.role.value,
            "id_equipe": user.id_equipe,
            "nom_equipe": equipe_nom,
            "shift": user_shift,
            "ot_en_cours": len(user_ots),
            "disponible": len(user_ots) == 0
        })
    
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
            zone_nom = z.nom_zone
            zone_code = z.code_zone
    if not zone_nom and racine and racine.id_zone:
        z = db.get(Zone, racine.id_zone)
        if z:
            zone_nom = z.nom_zone
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
            zone_nom = zone.nom_zone
            zone_code = zone.code_zone
    if not zone_nom and racine and racine.id_zone:
        zone = db.get(Zone, racine.id_zone)
        if zone:
            zone_nom = zone.nom_zone
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
            "type_travail": intervention.type_travail.value if intervention.type_travail else None,
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
        "priorite": ot.priorite,
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
        } if assigne else None,
        "assigne_2": {
            "id": assigne_2.id_user,
            "nom": f"{assigne_2.prenom} {assigne_2.nom}",
            "email": assigne_2.email,
            "role": assigne_2.role,
        } if assigne_2 else None,
        "date_prevue": str(ot.date_prevue) if ot.date_prevue else None,
        "duree_estimee": ot.duree_estimee,
        "date_debut_reelle": str(ot.date_debut_reelle) if ot.date_debut_reelle else None,
        "date_fin_reelle": str(ot.date_fin_reelle) if ot.date_fin_reelle else None,
        "duree_reelle": duree_reelle,
        "date_assignation": str(ot.date_assignation) if ot.date_assignation else None,
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
    db        : Session = Depends(get_db)
):
    try:
        q = db.query(OrdreTravail)
        if id_pole:    q = q.filter(OrdreTravail.id_pole    == id_pole)
        if statut:     q = q.filter(OrdreTravail.statut     == statut)
        if type_ot:    q = q.filter(OrdreTravail.type_ot    == type_ot)
        if id_assigne: q = q.filter(OrdreTravail.id_assigne == id_assigne)

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

        ot = OrdreTravail(
            numero_ot     = get_next_numero_ot(db, type_ot),
            type_ot       = type_ot,
            classe        = data.get("classe", ClasseOT.MECANIQUE),
            priorite      = data.get("priorite", PrioriteOT.NORMALE),
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
        if ot.statut not in [StatutOT.CREE, StatutOT.REJETE]:
            raise HTTPException(status_code=400,
                                detail="OT ne peut pas être assigné")

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

        ot.statut           = StatutOT.ASSIGNE
        ot.date_assignation = datetime.now()

        db.commit()
        db.refresh(ot)

        # ── Notifications ────────────────────────────────────────────
        from services.notification_service import manager as _manager
        notif = {
            "type"       : "OT_ASSIGNE",
            "id_ot"      : ot.id_ot,
            "numero_ot"  : ot.numero_ot,
            "message"    : f"Un OT vous a été assigné : {ot.numero_ot}",
            "priorite"   : ot.priorite.value if ot.priorite else None,
            "date_prevue": str(ot.date_prevue) if ot.date_prevue else None,
        }
        await _manager.send_personal_message(ot.id_assigne, notif)
        if ot.id_assigne_2:
            notif2 = {**notif, "message": f"Un OT vous a été co-assigné : {ot.numero_ot}"}
            await _manager.send_personal_message(ot.id_assigne_2, notif2)

        return ot_to_dict(ot, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# ── POST — Démarrer OT ────────────────────────────────────────────────

@router.post("/{id_ot}/demarrer")
async def demarrer_ot(id_ot: int, data: dict, db: Session = Depends(get_db)):
    """Mécanicien démarre l'intervention - crée aussi l'Intervention"""
    from models.intervention import Intervention, StatutValidation
    
    try:
        ot = db.get(OrdreTravail, id_ot)
        if not ot:
            raise HTTPException(status_code=404, detail="OT introuvable")
        if ot.statut != StatutOT.ASSIGNE:
            raise HTTPException(status_code=400,
                                detail="OT doit être assigné pour démarrer")

        now = datetime.now()
        ot.statut           = StatutOT.EN_COURS
        ot.date_debut_reelle = now

        # Create Intervention if not exists
        intervention = db.query(Intervention).filter(Intervention.id_ot == id_ot).first()
        if not intervention:
            # Get the primary assignee (id_assigne)
            id_realisateur = data.get("id_realisateur", ot.id_assigne)
            
            intervention = Intervention(
                id_ot               = id_ot,
                id_realisateur      = id_realisateur,
                id_pole             = ot.id_pole,
                id_equipement       = ot.id_equipement,
                type_travail        = None,  # will be filled at submission
                description_travail = "",
                date_debut          = now,
                date_fin            = None,
                statut_validation   = StatutValidation.EN_ATTENTE,
            )
            db.add(intervention)

        db.commit()
        db.refresh(ot)
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

from fastapi.responses import Response
from services.export_service import generate_ot_csv, generate_ot_pdf_html, generate_ot_list_pdf_html


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


