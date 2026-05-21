from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from datetime import date, datetime
from html import escape
import traceback
from database import get_db
from core.dependencies import get_current_user
from models.user import Utilisateur, RoleEnum
from models.pole import Pole
from models.equipe import Equipe
from schemas.user import UserCreate, UserUpdate
from core.security import hash_password, verify_password
from services.notification_service import manager
from services.print_templates import CEVITAL_TEMPLATE as _CEVITAL_TEMPLATE

router = APIRouter()

def generer_email(prenom: str, nom: str) -> str:
    p = prenom.lower().strip().replace(" ", "")
    n = nom.lower().strip().replace(" ", "")
    return f"{p}.{n}@optima.dz"

def generer_identifiant(prenom: str, nom: str, db: Session) -> str:
    base = f"{prenom[0].lower()}{nom.lower().replace(' ', '')}"
    identifiant = base
    compteur = 1
    while db.query(Utilisateur).filter_by(identifiant=identifiant).first():
        identifiant = f"{base}{compteur}"
        compteur += 1
    return identifiant

def generer_mot_de_passe(date_embauche: date) -> str:
    return f"Optima@{date_embauche.strftime('%d%m%Y')}"

def user_to_dict(u: Utilisateur, db: Session) -> dict:
    pole   = db.get(Pole,   u.id_pole)   if u.id_pole   else None
    equipe = db.get(Equipe, u.id_equipe) if u.id_equipe else None
    return {
        "id_user"        : u.id_user,
        "nom"            : u.nom,
        "prenom"         : u.prenom,
        "email"          : u.email,
        "identifiant"    : u.identifiant,
        "role"           : u.role.value,
        "genre"          : u.genre.value,
        "date_naissance" : str(u.date_naissance),
        "date_embauche"  : str(u.date_embauche),
        "telephone"      : u.telephone,
        "id_pole"        : u.id_pole,
        "id_equipe"      : u.id_equipe,
        "nom_pole"       : pole.nom_pole     if pole   else None,
        "nom_equipe"     : equipe.nom_equipe if equipe else None,
        "photo_url"      : u.photo_url,
    }

@router.get("/")
def liste_utilisateurs(db: Session = Depends(get_db)):
    try:
        users = db.query(Utilisateur).all()
        return [user_to_dict(u, db) for u in users]
    except Exception as e:
        print("ERREUR liste:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

# ════════════════════════════════════════════════════════════════════════════
#  GET /users/imprimer  → page HTML imprimable (CEVITAL-branded)
#  ⚠ DOIT être déclaré AVANT /{id_user} sinon FastAPI essaie de parser
#    "imprimer" comme un int et retourne 422.
# ════════════════════════════════════════════════════════════════════════════

ROLE_LABELS = {
    "ADMIN":              "Administrateurs système",
    "METHODISTE":         "Méthodistes",
    "CHEF_POLE":          "Chefs de Pôle",
    "CHEF_EQUIPE":        "Chefs d'Équipe",
    "MECANICIEN":         "Mécaniciens",
    "TECHNICIEN":         "Techniciens",
    "HSE":                "Personnel HSE",
    "GESTIONNAIRE_STOCK": "Gestionnaires de Stock",
}

ROLE_ORDER = [
    "ADMIN", "METHODISTE", "CHEF_POLE", "CHEF_EQUIPE",
    "MECANICIEN", "TECHNICIEN", "HSE", "GESTIONNAIRE_STOCK",
]


@router.get("/imprimer", response_class=HTMLResponse)
def imprimer_liste_utilisateurs(
    id_pole:      int | None = Query(None, description="Filtrer par pôle (optionnel, ADMIN seulement)"),
    db:           Session    = Depends(get_db),
    current_user: dict       = Depends(get_current_user),
):
    """
    Génère une page HTML imprimable de la liste des utilisateurs.

    Règles d'accès :
      - ADMIN : voit tout le monde ; peut filtrer par ?id_pole=…
      - METHODISTE / CHEF_POLE : uniquement les utilisateurs de SON pôle,
        et SANS ADMIN ni GESTIONNAIRE_STOCK (utilisateurs transverses).
      - Autres rôles : 403.
    """
    raw_role  = (current_user.get("role") or "")
    user_role = raw_role.split(".")[-1] if "." in raw_role else raw_role

    if user_role not in ("ADMIN", "METHODISTE", "CHEF_POLE"):
        raise HTTPException(status_code=403, detail="Accès refusé à l'impression.")

    q = db.query(Utilisateur).order_by(Utilisateur.nom, Utilisateur.prenom)

    pole_filtre_force: int | None = None  # None = pas de restriction de pôle (ADMIN)

    if user_role == "ADMIN":
        # ADMIN : peut filtrer par id_pole si fourni en query
        if id_pole:
            q = q.filter(Utilisateur.id_pole == id_pole)
            pole_filtre_force = id_pole
    else:
        # METHODISTE / CHEF_POLE : forcé sur son pôle, sans rôles transverses
        me = db.get(Utilisateur, current_user["id_user"])
        if not me or not me.id_pole:
            raise HTTPException(
                status_code=400,
                detail="Aucun pôle assigné à votre compte — impossible d'imprimer.",
            )
        pole_filtre_force = me.id_pole
        q = q.filter(
            Utilisateur.id_pole == me.id_pole,
            ~Utilisateur.role.in_([RoleEnum.ADMIN, RoleEnum.GESTIONNAIRE_STOCK]),
        )

    users = q.all()

    poles   = {p.id_pole: p for p in db.query(Pole).all()}
    equipes = {e.id_equipe: e for e in db.query(Equipe).all()}
    pole_filtre = poles.get(pole_filtre_force) if pole_filtre_force else None

    grouped: dict[str, list] = {}
    for u in users:
        grouped.setdefault(u.role.value, []).append(u)

    now = datetime.now()
    sections_html = []
    nb_total = len(users)

    for role_key in ROLE_ORDER:
        if role_key not in grouped:
            continue
        u_list = grouped[role_key]
        rows = []
        for i, u in enumerate(u_list, 1):
            pole_nom   = poles.get(u.id_pole).nom_pole       if u.id_pole   and poles.get(u.id_pole)   else "—"
            equipe_nom = equipes.get(u.id_equipe).nom_equipe if u.id_equipe and equipes.get(u.id_equipe) else "—"
            rows.append(f"""
              <tr>
                <td class="num">{i:02d}</td>
                <td class="nom">{escape(u.nom)} {escape(u.prenom)}</td>
                <td>{escape(u.identifiant or '—')}</td>
                <td>{escape(u.email or '—')}</td>
                <td>{escape(u.telephone or '—')}</td>
                <td>{escape(u.genre.value if u.genre else '—')}</td>
                <td>{escape(str(u.date_naissance))}</td>
                <td>{escape(str(u.date_embauche))}</td>
                <td>{escape(pole_nom)}</td>
                <td>{escape(equipe_nom)}</td>
              </tr>""")

        sections_html.append(f"""
          <section class="role-section">
            <div class="role-header">
              <h2>{escape(ROLE_LABELS.get(role_key, role_key))}</h2>
              <span class="badge">{len(u_list)} membre(s)</span>
            </div>
            <table class="users-table">
              <thead>
                <tr>
                  <th class="num">#</th>
                  <th>Nom & Prénom</th>
                  <th>Identifiant</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Genre</th>
                  <th>Né(e) le</th>
                  <th>Embauché(e) le</th>
                  <th>Pôle</th>
                  <th>Équipe</th>
                </tr>
              </thead>
              <tbody>{''.join(rows)}</tbody>
            </table>
          </section>
        """)

    sections_str = '\n'.join(sections_html) if sections_html else (
        '<p class="empty">Aucun utilisateur à afficher.</p>'
    )

    titre_pole = f" — Pôle {escape(pole_filtre.nom_pole)}" if pole_filtre else ""
    date_str = now.strftime('%d/%m/%Y à %H:%M')

    html = _CEVITAL_TEMPLATE.format(
        title="Liste des utilisateurs — CEVITAL Optima",
        document_title=f"Liste du Personnel{titre_pole}",
        sous_titre="Système GMAO Optima — Maintenance Prédictive",
        meta=(
            f'<span><b>Date d\'édition :</b> {date_str}</span>'
            f'<span><b>Effectif total :</b> {nb_total} personne(s)</span>'
            + (f'<span><b>Pôle :</b> {escape(pole_filtre.nom_pole)}</span>' if pole_filtre else '')
        ),
        content=sections_str,
        signatures='''
          <div class="signature-box">
            <div class="label">Le Responsable RH</div>
            <div class="sub">Cachet & signature</div>
          </div>
          <div class="signature-box">
            <div class="label">Le Chef de Maintenance</div>
            <div class="sub">Cachet & signature</div>
          </div>
          <div class="signature-box">
            <div class="label">Le Directeur d'Usine</div>
            <div class="sub">Cachet & signature</div>
          </div>
        ''',
    )

    return HTMLResponse(content=html)


@router.get("/{id_user}")
def get_utilisateur(id_user: int, db: Session = Depends(get_db)):
    try:
        u = db.get(Utilisateur, id_user)
        if not u:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        return user_to_dict(u, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

@router.post("/")
async def creer_utilisateur(data: UserCreate, db: Session = Depends(get_db)):
    try:
        # Vérifier chef équipe unique
        if data.role == RoleEnum.CHEF_EQUIPE and data.id_equipe:
            existant = db.query(Utilisateur).filter_by(
                role=RoleEnum.CHEF_EQUIPE,
                id_equipe=data.id_equipe
            ).first()
            if existant:
                raise HTTPException(
                    status_code=400,
                    detail="Cette équipe a déjà un chef d'équipe"
                )

        # Vérifier chef pole unique
        if data.role == RoleEnum.CHEF_POLE and data.id_pole:
            existant = db.query(Utilisateur).filter_by(
                role=RoleEnum.CHEF_POLE,
                id_pole=data.id_pole
            ).first()
            if existant:
                raise HTTPException(
                    status_code=400,
                    detail="Ce pôle a déjà un chef de pôle"
                )

        email       = generer_email(data.prenom, data.nom)
        identifiant = generer_identifiant(data.prenom, data.nom, db)
        mdp_initial = generer_mot_de_passe(data.date_embauche)

        if db.query(Utilisateur).filter_by(email=email).first():
            raise HTTPException(status_code=400, detail="Email déjà utilisé")

        user = Utilisateur(
            nom            = data.nom,
            prenom         = data.prenom,
            genre          = data.genre,
            date_naissance = data.date_naissance,
            date_embauche  = data.date_embauche,
            telephone      = data.telephone,
            email          = email,
            identifiant    = identifiant,
            mot_de_passe   = hash_password(mdp_initial),
            role           = data.role,
            id_pole        = data.id_pole,
            id_equipe      = data.id_equipe,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        pole = db.get(Pole, user.id_pole) if user.id_pole else None

        await manager.broadcast({
            "type"    : "NOUVEL_UTILISATEUR",
            "message" : f"Nouvel utilisateur : {data.prenom} {data.nom}",
            "payload" : {
                "id_user"  : user.id_user,
                "prenom"   : user.prenom,
                "nom"      : user.nom,
                "role"     : user.role.value,
                "id_pole"  : user.id_pole,
                "nom_pole" : pole.nom_pole if pole else None,
            }
        })

        return user_to_dict(user, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR création:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")

# Route pour l'admin (rôle + équipe)
@router.put("/{id_user}/affectation")
async def modifier_affectation(
    id_user: int, data: dict, db: Session = Depends(get_db)
):
    try:
        user = db.get(Utilisateur, id_user)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        nouveau_role   = data.get("role")
        nouveau_equipe = data.get("id_equipe")

        # Vérifier chef équipe unique
        if nouveau_role == "CHEF_EQUIPE" and nouveau_equipe:
            existant = db.query(Utilisateur).filter(
                Utilisateur.role     == RoleEnum.CHEF_EQUIPE,
                Utilisateur.id_equipe == nouveau_equipe,
                Utilisateur.id_user  != id_user
            ).first()
            if existant:
                raise HTTPException(
                    status_code=400,
                    detail="Cette équipe a déjà un chef d'équipe"
                )

        # Vérifier chef pôle unique
        if nouveau_role == "CHEF_POLE":
            existant = db.query(Utilisateur).filter(
                Utilisateur.role    == RoleEnum.CHEF_POLE,
                Utilisateur.id_pole == user.id_pole,
                Utilisateur.id_user != id_user
            ).first()
            if existant:
                raise HTTPException(
                    status_code=400,
                    detail="Ce pôle a déjà un chef de pôle"
                )

        if nouveau_role:
            user.role = RoleEnum(nouveau_role)
        if "id_equipe" in data:
            user.id_equipe = nouveau_equipe

        db.commit()
        db.refresh(user)

        pole   = db.get(Pole,   user.id_pole)   if user.id_pole   else None
        equipe = db.get(Equipe, user.id_equipe) if user.id_equipe else None

        await manager.broadcast({
            "type"    : "UTILISATEUR_MODIFIE",
            "message" : f"Utilisateur modifié : {user.prenom} {user.nom}",
            "payload" : {
                "id_user"    : user.id_user,
                "id_pole"    : user.id_pole,
                "nom_pole"   : pole.nom_pole     if pole   else None,
                "nom_equipe" : equipe.nom_equipe if equipe else None,
                "nom"        : user.nom,
                "prenom"     : user.prenom,
                "role"       : user.role.value,
                "telephone"  : user.telephone,
                "date_naissance": str(user.date_naissance),
            }
        })

        return user_to_dict(user, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR affectation:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Erreur serveur interne")


# Route pour le profil (téléphone + date naissance)
@router.put("/{id_user}/infos-personnelles")
async def modifier_infos_perso(
    id_user: int, data: dict, db: Session = Depends(get_db)
):
    try:
        user = db.get(Utilisateur, id_user)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        if "telephone"      in data: user.telephone      = data["telephone"]
        if "date_naissance" in data: user.date_naissance = data["date_naissance"]

        db.commit()
        db.refresh(user)

        await manager.broadcast({
            "type"    : "UTILISATEUR_MODIFIE",
            "message" : f"Utilisateur modifié : {user.prenom} {user.nom}",
            "payload" : {
                "id_user"        : user.id_user,
                "id_pole"        : user.id_pole,
                "nom"            : user.nom,
                "prenom"         : user.prenom,
                "telephone"      : user.telephone,
                "date_naissance" : str(user.date_naissance),
            }
        })

        return user_to_dict(user, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur serveur interne")
    

    
@router.delete("/{id_user}")
async def supprimer_utilisateur(
    id_user: int,
    force:   bool = False,
    db:      Session = Depends(get_db),
):
    """
    Supprime un utilisateur.

    Sans `force=true` : refuse si l'utilisateur a des données historiques
    et retourne 409 avec la liste détaillée.

    Avec `force=true` :
      - FK nullable → NULL,
      - FK NOT NULL → réassignées au premier ADMIN trouvé (sinon les enregistrements sont supprimés),
      - Notifications & échanges de quart : supprimés (pas d'audit critique),
      - Puis suppression de l'utilisateur.
    """
    try:
        user = db.get(Utilisateur, id_user)
        if not user:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")

        prenom, nom, id_pole = user.prenom, user.nom, user.id_pole

        from models.di             import DemandeIntervention
        from models.ot             import OrdreTravail
        from models.intervention   import Intervention
        from models.notification   import Notification
        from models.stock          import ReservationPiece
        from models.prediction_run import PredictionRun
        from models.modele_ml      import ModeleML
        from models.planing        import DemandeEchange, EchangeQuart, ConfigPlanning

        # Compte des dépendances (vrais noms de colonnes)
        liens = {
            "DI déclarées (id_declarant)":         db.query(DemandeIntervention).filter(DemandeIntervention.id_declarant == id_user).count(),
            "DI gérées (id_methodiste)":           db.query(DemandeIntervention).filter(DemandeIntervention.id_methodiste == id_user).count(),
            "OT créés (id_methodiste)":            db.query(OrdreTravail).filter(OrdreTravail.id_methodiste == id_user).count(),
            "OT assignés (id_assigne)":            db.query(OrdreTravail).filter(OrdreTravail.id_assigne == id_user).count(),
            "OT 2e assigné (id_assigne_2)":        db.query(OrdreTravail).filter(OrdreTravail.id_assigne_2 == id_user).count(),
            "OT rejetés par cet user":             db.query(OrdreTravail).filter(OrdreTravail.id_rejecteur == id_user).count(),
            "Interventions réalisées":             db.query(Intervention).filter(Intervention.id_realisateur == id_user).count(),
            "Interventions validées (méthode)":    db.query(Intervention).filter(Intervention.id_validateur_methode == id_user).count(),
            "Interventions validées (HSE)":        db.query(Intervention).filter(Intervention.id_validateur_hse == id_user).count(),
            "Réservations (mécanicien)":           db.query(ReservationPiece).filter(ReservationPiece.id_mecanicien == id_user).count(),
            "Réservations (gestionnaire)":         db.query(ReservationPiece).filter(ReservationPiece.id_gestionnaire == id_user).count(),
            "Runs ML lancés":                      db.query(PredictionRun).filter(PredictionRun.id_user == id_user).count(),
            "Modèles ML uploadés":                 db.query(ModeleML).filter(ModeleML.uploaded_by == id_user).count(),
            "Notifications":                       db.query(Notification).filter(Notification.id_user == id_user).count(),
        }
        total = sum(liens.values())

        if total > 0 and not force:
            details = "; ".join(f"{k}: {v}" for k, v in liens.items() if v > 0)
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Impossible de supprimer : {prenom} {nom} a {total} enregistrement(s) lié(s). "
                    f"Détail : {details}. Utiliser force=true pour désaffecter automatiquement."
                )
            )

        # Mode force : nettoyage des FK
        if force and total > 0:
            # Trouve un admin de remplacement pour les FK NOT NULL
            admin = db.query(Utilisateur).filter(
                Utilisateur.role == RoleEnum.ADMIN,
                Utilisateur.id_user != id_user,
            ).first()
            admin_id = admin.id_user if admin else None

            # ── DI ──
            # id_declarant est NOT NULL : réassigne à admin
            if admin_id:
                db.query(DemandeIntervention).filter(DemandeIntervention.id_declarant == id_user)\
                    .update({DemandeIntervention.id_declarant: admin_id}, synchronize_session=False)
            else:
                db.query(DemandeIntervention).filter(DemandeIntervention.id_declarant == id_user).delete(synchronize_session=False)
            # id_methodiste nullable
            db.query(DemandeIntervention).filter(DemandeIntervention.id_methodiste == id_user)\
                .update({DemandeIntervention.id_methodiste: None}, synchronize_session=False)

            # ── OT ──
            # id_methodiste NOT NULL : réassigne
            if admin_id:
                db.query(OrdreTravail).filter(OrdreTravail.id_methodiste == id_user)\
                    .update({OrdreTravail.id_methodiste: admin_id}, synchronize_session=False)
            else:
                db.query(OrdreTravail).filter(OrdreTravail.id_methodiste == id_user).delete(synchronize_session=False)
            # autres FK OT nullable
            for col in (OrdreTravail.id_assigne, OrdreTravail.id_assigne_2, OrdreTravail.id_rejecteur):
                db.query(OrdreTravail).filter(col == id_user).update({col: None}, synchronize_session=False)

            # ── Interventions ──
            # id_realisateur NOT NULL : réassigne
            if admin_id:
                db.query(Intervention).filter(Intervention.id_realisateur == id_user)\
                    .update({Intervention.id_realisateur: admin_id}, synchronize_session=False)
            else:
                db.query(Intervention).filter(Intervention.id_realisateur == id_user).delete(synchronize_session=False)
            for col in (Intervention.id_validateur_methode, Intervention.id_validateur_hse):
                db.query(Intervention).filter(col == id_user).update({col: None}, synchronize_session=False)

            # ── Réservations stock ──
            # id_mecanicien NOT NULL : réassigne
            if admin_id:
                db.query(ReservationPiece).filter(ReservationPiece.id_mecanicien == id_user)\
                    .update({ReservationPiece.id_mecanicien: admin_id}, synchronize_session=False)
            else:
                db.query(ReservationPiece).filter(ReservationPiece.id_mecanicien == id_user).delete(synchronize_session=False)
            db.query(ReservationPiece).filter(ReservationPiece.id_gestionnaire == id_user)\
                .update({ReservationPiece.id_gestionnaire: None}, synchronize_session=False)

            # ── Prédictions ──
            if admin_id:
                db.query(PredictionRun).filter(PredictionRun.id_user == id_user)\
                    .update({PredictionRun.id_user: admin_id}, synchronize_session=False)
                db.query(ModeleML).filter(ModeleML.uploaded_by == id_user)\
                    .update({ModeleML.uploaded_by: admin_id}, synchronize_session=False)
            else:
                db.query(PredictionRun).filter(PredictionRun.id_user == id_user).delete(synchronize_session=False)
                db.query(ModeleML).filter(ModeleML.uploaded_by == id_user).delete(synchronize_session=False)

            # ── Planning : nullable, on met NULL ──
            db.query(ConfigPlanning).filter(ConfigPlanning.cree_par == id_user)\
                .update({ConfigPlanning.cree_par: None}, synchronize_session=False)
            db.query(DemandeEchange).filter(DemandeEchange.traite_par == id_user)\
                .update({DemandeEchange.traite_par: None}, synchronize_session=False)
            db.query(EchangeQuart).filter(EchangeQuart.cree_par == id_user)\
                .update({EchangeQuart.cree_par: None}, synchronize_session=False)

            # ── Notifications : suppression directe ──
            db.query(Notification).filter(Notification.id_user == id_user).delete(synchronize_session=False)

            # ── Table predictions legacy (simulation) ──
            try:
                from models.prediction import Prediction
                if admin_id:
                    db.query(Prediction).filter(Prediction.id_methodiste == id_user)\
                        .update({Prediction.id_methodiste: admin_id}, synchronize_session=False)
                else:
                    db.query(Prediction).filter(Prediction.id_methodiste == id_user).delete(synchronize_session=False)
            except Exception:
                pass   # table absente ou sans cette colonne, on ignore

            db.flush()

        db.delete(user)
        db.commit()

        await manager.broadcast({
            "type"    : "UTILISATEUR_SUPPRIME",
            "message" : f"Utilisateur supprimé : {prenom} {nom}",
            "payload" : {"id_user": id_user, "id_pole": id_pole},
        })

        return {
            "message":    f"Utilisateur {prenom} {nom} supprimé",
            "force":      force,
            "liens_nettoyes": total,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("ERREUR delete user:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

@router.post("/{id_user}/reinit-mdp")
def reinitialiser_mdp(id_user: int, db: Session = Depends(get_db)):
    user = db.get(Utilisateur, id_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    mdp_temp = generer_mot_de_passe(user.date_embauche)
    user.mot_de_passe = hash_password(mdp_temp)
    db.commit()
    # NE PAS retourner le mdp dans la réponse
    return {"message": "Mot de passe réinitialisé. L'utilisateur doit se connecter avec son mdp temporaire."}

@router.put("/{id_user}/changer-mdp")
def changer_mdp(id_user: int, data: dict, db: Session = Depends(get_db)):
    user = db.get(Utilisateur, id_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    ancien  = data.get("ancien_mdp",  "")
    nouveau = data.get("nouveau_mdp", "")
    if not verify_password(ancien, user.mot_de_passe):
        raise HTTPException(status_code=400, detail="Ancien mot de passe incorrect")
    if len(nouveau) < 6:
        raise HTTPException(status_code=400, detail="Minimum 6 caractères")
    user.mot_de_passe = hash_password(nouveau)
    db.commit()
    return {"message": "Mot de passe modifié avec succès"}

# Sentinel pour marquer la fin du doublon historique — voir route /imprimer en haut du fichier
_ROLE_LABELS_LEGACY_REMOVED = True


# ════════════════════════════════════════════════════════════════════
# Upload photo de profil
# ════════════════════════════════════════════════════════════════════
import os
import uuid
from fastapi import UploadFile, File

_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_MAX_SIZE    = 5 * 1024 * 1024  # 5 MB
_AVATAR_DIR  = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "avatars")


@router.post("/{id_user}/photo")
async def upload_photo_profil(
    id_user: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload d'une photo de profil. Retourne l'URL relative `/uploads/avatars/...`"""
    user = db.get(Utilisateur, id_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Validation extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporte. Autorises: {', '.join(_ALLOWED_EXT)}",
        )

    # Validation taille (lecture du contenu)
    content = await file.read()
    if len(content) > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 5 MB)")

    # Supprimer l'ancienne photo si existante
    if user.photo_url:
        old_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            user.photo_url.lstrip("/"),
        )
        if os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    # Sauvegarder le nouveau fichier
    os.makedirs(_AVATAR_DIR, exist_ok=True)
    filename = f"user_{id_user}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(_AVATAR_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # URL relative servie via le mount /uploads
    photo_url = f"/uploads/avatars/{filename}"
    user.photo_url = photo_url
    db.commit()
    db.refresh(user)

    return {"photo_url": photo_url, "user": user_to_dict(user, db)}


@router.delete("/{id_user}/photo")
def supprimer_photo_profil(id_user: int, db: Session = Depends(get_db)):
    """Supprime la photo de profil."""
    user = db.get(Utilisateur, id_user)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if user.photo_url:
        path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            user.photo_url.lstrip("/"),
        )
        if os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass

    user.photo_url = None
    db.commit()
    return {"message": "Photo supprimee", "user": user_to_dict(user, db)}
