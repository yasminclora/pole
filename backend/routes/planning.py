from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime
import traceback

from database import get_db
from models.planing import ConfigPlanning, DemandeEchange, EchangeQuart, StatutDemande, QuartEnum
from models.equipe  import Equipe
from models.pole    import Pole
from models.user    import Utilisateur
from services.notification_service import manager

router = APIRouter()

CYCLE = ["Matin","Matin","Après-midi","Après-midi","Nuit","Nuit","Repos","Repos"]
ORDRE = ["Alpha","Bravo","Charlie","Delta"]

# ── Helpers ──────────────────────────────────────────────────────────

def get_nom_court(nom_equipe: str) -> str:
    if not nom_equipe:
        return ''
    return nom_equipe.strip().split(" ")[-1]

def get_quart_normal(config: ConfigPlanning, equipe: Equipe, date_cible: date):
    if not config or not equipe:
        return None
    nom      = get_nom_court(equipe.nom_equipe)
    index    = ORDRE.index(nom) if nom in ORDRE else 0
    decalage = index * 2
    ecart    = (date_cible - config.date_debut).days
    position = (config.position_alpha + decalage + ecart) % 8
    return CYCLE[position]

def get_quart_avec_echange(config, equipe, date_cible, echanges, equipes):
    quart_normal = get_quart_normal(config, equipe, date_cible)
    echange = next((
        e for e in echanges
        if str(e.date_echange) == str(date_cible) and
        (e.id_equipe_1 == equipe.id_equipe or e.id_equipe_2 == equipe.id_equipe)
    ), None)
    if not echange:
        return quart_normal
    id_autre = echange.id_equipe_2 if echange.id_equipe_1 == equipe.id_equipe else echange.id_equipe_1
    autre    = next((e for e in equipes if e.id_equipe == id_autre), None)
    if not autre:
        return quart_normal
    return get_quart_normal(config, autre, date_cible)

def config_to_dict(config: ConfigPlanning) -> dict:
    return {
        "id"             : config.id,
        "id_pole"        : config.id_pole,
        "date_debut"     : str(config.date_debut),
        "position_alpha" : config.position_alpha,
        "created_at"     : str(config.created_at),
    }

def demande_to_dict(d: DemandeEchange) -> dict:
    return {
        "id"                  : d.id,
        "id_pole"             : d.id_pole,
        "id_equipe_demandeur" : d.id_equipe_demandeur,
        "nom_equipe_demandeur": d.equipe_demandeur.nom_equipe if d.equipe_demandeur else None,
        "date_echange"        : str(d.date_echange),
        "quart_souhaite"      : d.quart_souhaite.value,
        "motif"               : d.motif,
        "statut"              : d.statut.value,
        "motif_refus"         : d.motif_refus,
        "id_equipe_cible"     : d.id_equipe_cible,
        "nom_equipe_cible"    : d.equipe_cible.nom_equipe if d.equipe_cible else None,
        "created_at"          : str(d.created_at),
        "traite_at"           : str(d.traite_at) if d.traite_at else None,
    }

def echange_to_dict(e: EchangeQuart) -> dict:
    return {
        "id"           : e.id,
        "id_pole"      : e.id_pole,
        "date_echange" : str(e.date_echange),
        "id_equipe_1"  : e.id_equipe_1,
        "nom_equipe_1" : e.equipe_1.nom_equipe if e.equipe_1 else None,
        "id_equipe_2"  : e.id_equipe_2,
        "nom_equipe_2" : e.equipe_2.nom_equipe if e.equipe_2 else None,
        "motif"        : e.motif,
        "created_at"   : str(e.created_at),
    }

# ── Config ───────────────────────────────────────────────────────────

@router.get("/pole/{id_pole}/config")
def get_config(id_pole: int, db: Session = Depends(get_db)):
    config = db.query(ConfigPlanning).filter_by(id_pole=id_pole).first()
    if not config:
        return None
    return config_to_dict(config)

@router.post("/pole/{id_pole}/config")
async def creer_ou_modifier_config(
    id_pole: int, data: dict, db: Session = Depends(get_db)
):
    try:
        date_debut     = date.fromisoformat(data["date_debut"])
        position_alpha = int(data["position_alpha"])
        cree_par       = data.get("cree_par")

        # 1. Sauvegarder dans configurations_planning
        config = db.query(ConfigPlanning).filter_by(id_pole=id_pole).first()
        if config:
            config.date_debut     = date_debut
            config.position_alpha = position_alpha
        else:
            config = ConfigPlanning(
                id_pole        = id_pole,
                date_debut     = date_debut,
                position_alpha = position_alpha,
                cree_par       = cree_par,
            )
            db.add(config)

        # 2. Mettre à jour les 4 équipes du pôle
        equipes = db.query(Equipe).filter_by(id_pole=id_pole).all()
        for equipe in equipes:
            nom_court = get_nom_court(equipe.nom_equipe)
            if nom_court in ORDRE:
                index    = ORDRE.index(nom_court)
                decalage = index * 2
                position = (position_alpha + decalage) % 8
                equipe.date_reference_cycle    = date_debut
                equipe.position_initiale_cycle = position

        db.commit()
        db.refresh(config)

        # 3. Préparer payload équipes
        equipes_info = []
        for equipe in equipes:
            nom_court = get_nom_court(equipe.nom_equipe)
            if nom_court in ORDRE:
                index    = ORDRE.index(nom_court)
                decalage = index * 2
                position = (position_alpha + decalage) % 8
                equipes_info.append({
                    "id_equipe"               : equipe.id_equipe,
                    "nom_equipe"              : equipe.nom_equipe,
                    "date_reference_cycle"    : str(date_debut),
                    "position_initiale_cycle" : position,
                })

        # 4. WebSocket
        await manager.broadcast({
            "type"    : "CONFIG_PLANNING_MISE_A_JOUR",
            "message" : "Le planning du pôle a été mis à jour",
            "payload" : {
                "id_pole"        : id_pole,
                "date_debut"     : str(date_debut),
                "position_alpha" : position_alpha,
                "equipes"        : equipes_info,
            }
        })

        return {
            "config" : config_to_dict(config),
            "equipes": equipes_info,
        }

    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Champ manquant : {e}")
    except Exception as e:
        db.rollback()
        print("ERREUR config:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

# ── Demandes ─────────────────────────────────────────────────────────

@router.post("/demandes")
async def creer_demande(data: dict, db: Session = Depends(get_db)):
    try:
        equipe_demandeur = db.get(Equipe, data["id_equipe_demandeur"])
        if not equipe_demandeur:
            raise HTTPException(status_code=404, detail="Équipe introuvable")

        existante = db.query(DemandeEchange).filter_by(
            id_equipe_demandeur = data["id_equipe_demandeur"],
            date_echange        = date.fromisoformat(data["date_echange"]),
            statut              = StatutDemande.EN_ATTENTE,
        ).first()
        if existante:
            raise HTTPException(
                status_code=400,
                detail="Une demande est déjà en attente pour cette date"
            )

        demande = DemandeEchange(
            id_pole             = equipe_demandeur.id_pole,
            id_equipe_demandeur = data["id_equipe_demandeur"],
            date_echange        = date.fromisoformat(data["date_echange"]),
            quart_souhaite      = QuartEnum(data["quart_souhaite"]),
            motif               = data.get("motif"),
        )
        db.add(demande)
        db.commit()
        db.refresh(demande)

        # CHEF_POLE deprecated → METHODISTE pilote désormais les pôles
        chef_pole = db.query(Utilisateur).filter_by(
            id_pole = equipe_demandeur.id_pole,
            role    = "METHODISTE"
        ).first()

        await manager.broadcast({
            "type"    : "DEMANDE_ECHANGE_CREEE",
            "message" : f"Nouvelle demande d'échange de {equipe_demandeur.nom_equipe}",
            "payload" : {
                "id_demande"          : demande.id,
                "id_pole"             : equipe_demandeur.id_pole,
                "id_equipe_demandeur" : demande.id_equipe_demandeur,
                "nom_equipe"          : equipe_demandeur.nom_equipe,
                "date_echange"        : str(demande.date_echange),
                "quart_souhaite"      : demande.quart_souhaite.value,
                "motif"               : demande.motif,
                "pour_user"           : chef_pole.id_user if chef_pole else None,
            }
        })

        return demande_to_dict(demande)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR demande:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.get("/demandes/equipe/{id_equipe}")
def mes_demandes(id_equipe: int, db: Session = Depends(get_db)):
    demandes = db.query(DemandeEchange).filter_by(
        id_equipe_demandeur=id_equipe
    ).order_by(DemandeEchange.created_at.desc()).all()
    return [demande_to_dict(d) for d in demandes]

@router.get("/demandes/pole/{id_pole}")
def demandes_pole(id_pole: int, db: Session = Depends(get_db)):
    demandes = db.query(DemandeEchange).filter_by(
        id_pole=id_pole
    ).order_by(DemandeEchange.created_at.desc()).all()
    return [demande_to_dict(d) for d in demandes]

@router.put("/demandes/{id_demande}/accepter")
async def accepter_demande(
    id_demande: int, data: dict, db: Session = Depends(get_db)
):
    try:
        demande = db.get(DemandeEchange, id_demande)
        if not demande:
            raise HTTPException(status_code=404, detail="Demande introuvable")
        if demande.statut != StatutDemande.EN_ATTENTE:
            raise HTTPException(status_code=400, detail="Demande déjà traitée")

        config = db.query(ConfigPlanning).filter_by(id_pole=demande.id_pole).first()
        if not config:
            raise HTTPException(status_code=400, detail="Pôle non configuré")

        equipes            = db.query(Equipe).filter_by(id_pole=demande.id_pole).all()
        echanges_existants = db.query(EchangeQuart).filter_by(
            id_pole      = demande.id_pole,
            date_echange = demande.date_echange,
        ).all()

        equipe_cible = None
        for eq in equipes:
            if eq.id_equipe == demande.id_equipe_demandeur:
                continue
            quart = get_quart_avec_echange(
                config, eq, demande.date_echange,
                echanges_existants, equipes
            )
            if quart == demande.quart_souhaite.value:
                equipe_cible = eq
                break

        if not equipe_cible:
            raise HTTPException(
                status_code=400,
                detail=f"Aucune équipe ne travaille en {demande.quart_souhaite.value} ce jour"
            )

        demande.statut          = StatutDemande.ACCEPTE
        demande.id_equipe_cible = equipe_cible.id_equipe
        demande.traite_par      = data.get("traite_par")
        demande.traite_at       = datetime.now()

        echange = EchangeQuart(
            id_pole      = demande.id_pole,
            date_echange = demande.date_echange,
            id_equipe_1  = demande.id_equipe_demandeur,
            id_equipe_2  = equipe_cible.id_equipe,
            motif        = demande.motif,
            id_demande   = demande.id,
            cree_par     = data.get("traite_par"),
        )
        db.add(echange)
        db.commit()
        db.refresh(demande)

        equipe_demandeur = db.get(Equipe, demande.id_equipe_demandeur)

        await manager.broadcast({
            "type"    : "DEMANDE_ECHANGE_ACCEPTEE",
            "message" : f"Échange accordé : {equipe_demandeur.nom_equipe} ⇄ {equipe_cible.nom_equipe} le {demande.date_echange}",
            "payload" : {
                "id_demande"   : demande.id,
                "id_pole"      : demande.id_pole,
                "date_echange" : str(demande.date_echange),
                "id_equipe_1"  : demande.id_equipe_demandeur,
                "nom_equipe_1" : equipe_demandeur.nom_equipe,
                "id_equipe_2"  : equipe_cible.id_equipe,
                "nom_equipe_2" : equipe_cible.nom_equipe,
                "quart_obtenu" : demande.quart_souhaite.value,
                "pour_user"    : data.get("pour_chef_equipe"),
            }
        })

        return demande_to_dict(demande)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR accepter:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.put("/demandes/{id_demande}/refuser")
async def refuser_demande(
    id_demande: int, data: dict, db: Session = Depends(get_db)
):
    try:
        demande = db.get(DemandeEchange, id_demande)
        if not demande:
            raise HTTPException(status_code=404, detail="Demande introuvable")
        if demande.statut != StatutDemande.EN_ATTENTE:
            raise HTTPException(status_code=400, detail="Demande déjà traitée")

        demande.statut      = StatutDemande.REFUSE
        demande.motif_refus = data.get("motif_refus", "")
        demande.traite_par  = data.get("traite_par")
        demande.traite_at   = datetime.now()
        db.commit()

        equipe_demandeur = db.get(Equipe, demande.id_equipe_demandeur)

        await manager.broadcast({
            "type"    : "DEMANDE_ECHANGE_REFUSEE",
            "message" : f"Demande d'échange refusée pour {equipe_demandeur.nom_equipe}",
            "payload" : {
                "id_demande"  : demande.id,
                "id_pole"     : demande.id_pole,
                "motif_refus" : demande.motif_refus,
                "pour_user"   : data.get("pour_chef_equipe"),
            }
        })

        return demande_to_dict(demande)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR refuser:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

# ── Échanges & Planning ───────────────────────────────────────────────

@router.get("/echanges/pole/{id_pole}")
def echanges_pole(id_pole: int, db: Session = Depends(get_db)):
    echanges = db.query(EchangeQuart).filter_by(
        id_pole=id_pole
    ).order_by(EchangeQuart.date_echange.desc()).all()
    return [echange_to_dict(e) for e in echanges]

@router.get("/pole/{id_pole}/planning")
def get_planning_pole(id_pole: int, db: Session = Depends(get_db)):
    config   = db.query(ConfigPlanning).filter_by(id_pole=id_pole).first()
    echanges = db.query(EchangeQuart).filter_by(id_pole=id_pole).all()
    equipes  = db.query(Equipe).filter_by(id_pole=id_pole).all()

    return {
        "config"  : config_to_dict(config) if config else None,
        "echanges": [echange_to_dict(e) for e in echanges],
        "equipes" : [
            {
                "id_equipe"               : eq.id_equipe,
                "nom_equipe"              : eq.nom_equipe,
                "id_pole"                 : eq.id_pole,
                # ✅ Ces deux champs étaient manquants
                "date_reference_cycle"    : str(eq.date_reference_cycle)
                                           if eq.date_reference_cycle else None,
                "position_initiale_cycle" : eq.position_initiale_cycle
                                           if eq.position_initiale_cycle is not None
                                           else 0,
                "nb_membres"              : len(eq.membres)
                                           if hasattr(eq, 'membres') else 0,
            }
            for eq in equipes
        ],
    }


# ── GET — Utilisateurs disponibles par date/classe ─────────────────────
@router.get("/utilisateurs-disponibles")
def get_utilisateurs_disponibles(
    id_pole: int,
    date_cible: str,  # YYYY-MM-DD
    classe: str,     # MECANIQUE, ELECTRIQUE
    db: Session = Depends(get_db)
):
    """
    Retourne les utilisateurs disponibles pour une date donnée et une classe.
    Utilise le planning pour déterminer quels équipes travaillent ce jour.
    """
    from datetime import date as date_type
    from models.user import Utilisateur, RoleEnum
    from models.equipe import Equipe
    
    try:
        target_date = date_type.fromisoformat(date_cible)
    except:
        target_date = date_type.today()
    
    config = db.query(ConfigPlanning).filter_by(id_pole=id_pole).first()
    equipes = db.query(Equipe).filter_by(id_pole=id_pole).all()
    echanges = db.query(EchangeQuart).filter_by(id_pole=id_pole).all()
    
    result = []
    
    for equipe in equipes:
        quart = get_quart_avec_echange(config, equipe, target_date, echanges, equipes) if config else "Matin"
        
        if quart == "Repos":
            continue
        
        # Get users in this team
        users = db.query(Utilisateur).filter(
            Utilisateur.id_equipe == equipe.id_equipe
        ).all()
        
        for user in users:
            # Filter by class
            if classe == "MECANIQUE" and user.role != RoleEnum.MECANICIEN:
                continue
            if classe == "ELECTRIQUE" and user.role != RoleEnum.TECHNICIEN:
                continue
            
            result.append({
                "id": user.id_user,
                "nom": user.nom,
                "prenom": user.prenom,
                "role": user.role.value,
                "id_equipe": equipe.id_equipe,
                "equipe": equipe.nom_equipe,
                "quart": quart,
                "disponible": True
            })
    
    return result