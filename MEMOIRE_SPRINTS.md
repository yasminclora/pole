# Organisation Scrum — Projet GMAO Optima

> **Méthodologie Agile Scrum** appliquée au développement d'une plateforme de maintenance prédictive pour CEVITAL.
> **Durée totale estimée : 16 semaines.**

---

## Vue d'ensemble — Backlog produit

| Sprint | Thème | Durée | Livrables clés |
|---|---|---|---|
| **Sprint 0** | Initialisation projet | 1 sem | Architecture, BDD initiale, maquettes, backlog |
| **Sprint 1** | Authentification & Gestion utilisateurs | 2 sem | JWT, RBAC, CRUD users/pôles/zones/équipes |
| **Sprint 2** | Gestion équipements & historique | 2 sem | Hiérarchie machines, import historique CSV |
| **Sprint 3** | Workflow maintenance (DI / OT / Interventions) | 3 sem | DI → OT → Intervention + notifications WebSocket |
| **Sprint 4** | Module Stock | 2 sem | Pièces, liaison composantes, réservations |
| **Sprint 5** | Prédiction ML (LSTM / GRU) | 3 sem | Pipeline RUL, comparaison pannes réelles vs prédites, OT prédictifs |
| **Sprint 6** | Dashboard & Analytics | 2 sem | KPIs live, alertes intelligentes, visualisations |
| **Sprint 7** *(buffer)* | Tests, déploiement, soutenance | 1 sem | Tests E2E, déploiement, rédaction finale |

---

## Acteurs (8 rôles)

| Rôle | Description |
|---|---|
| **ADMIN** | Administrateur système — accès global, configuration |
| **METHODISTE** | Méthodiste — pilote prédictif et planification (par pôle) |
| **CHEF_POLE** | Responsable opérationnel d'un pôle |
| **CHEF_EQUIPE** | Chef d'équipe terrain |
| **MECANICIEN** | Intervenant mécanique |
| **TECHNICIEN** | Intervenant technique |
| **HSE** | Hygiène, Sécurité, Environnement |
| **GESTIONNAIRE_STOCK** | Gestion des pièces de rechange |

---

# 🔵 SPRINT 0 — Initialisation projet (1 semaine)

## Objectifs
- Cadrer le projet et définir l'architecture
- Modéliser la base de données initiale
- Réaliser les maquettes (Figma / wireframes)
- Constituer le backlog produit complet
- Choix techno : **Next.js 16 · FastAPI · PostgreSQL · TensorFlow/Keras · Redux Toolkit**

## Livrables
- Schéma d'architecture en couches (Frontend / API REST / BDD / Service ML)
- Diagramme de déploiement
- Backlog priorisé (60+ user stories)
- Maquettes Figma de toutes les pages principales

---

# 🔵 SPRINT 1 — Authentification & Gestion des utilisateurs (2 semaines)

## Description
Mise en place de la sécurité (JWT), du contrôle d'accès basé sur les rôles (RBAC), de la gestion des utilisateurs et de la structure organisationnelle (pôles, zones, équipes, quarts de travail).

## User Stories
1. En tant qu'**utilisateur**, je veux me connecter avec mon identifiant et mot de passe pour accéder à l'application.
2. En tant qu'**utilisateur**, je veux pouvoir réinitialiser mon mot de passe.
3. En tant qu'**ADMIN**, je veux créer/modifier/supprimer des utilisateurs avec leurs rôles.
4. En tant qu'**ADMIN**, je veux gérer les pôles industriels (CRUD).
5. En tant qu'**ADMIN**, je veux gérer les zones rattachées aux pôles.
6. En tant qu'**ADMIN**, je veux gérer les équipes (rattachées à un pôle et à un quart).
7. En tant qu'**ADMIN**, je veux gérer les quarts de travail (Matin / Après-midi / Nuit).
8. En tant qu'**utilisateur**, je veux modifier mon profil et changer mon mot de passe.
9. En tant qu'**utilisateur**, je veux que ma session expire après 30 min d'inactivité.

## Diagramme de cas d'utilisation

```plantuml
@startuml UC_Sprint1
left to right direction
skinparam packageStyle rectangle

actor Administrateur as Admin
actor Utilisateur as User
actor "Chef d'équipe" as ChefEq

rectangle "Authentification & Utilisateurs" {
  usecase "S'authentifier" as UC1
  usecase "Réinitialiser mot de passe" as UC2
  usecase "Se déconnecter" as UC3
  usecase "Modifier son profil" as UC4

  usecase "Gérer les utilisateurs" as UC5
  usecase "Gérer les pôles" as UC6
  usecase "Gérer les zones" as UC7
  usecase "Gérer les équipes" as UC8
  usecase "Gérer les quarts" as UC9

  usecase "Demander un échange de quart" as UC10
  usecase "Valider un échange" as UC11
}

User --> UC1
User --> UC2
User --> UC3
User --> UC4
User --> UC10

Admin --|> User
Admin --> UC5
Admin --> UC6
Admin --> UC7
Admin --> UC8
Admin --> UC9

ChefEq --|> User
ChefEq --> UC11
@enduml
```

## Diagramme de classes

```plantuml
@startuml DC_Sprint1
hide circle
skinparam classAttributeIconSize 0

enum RoleEnum {
  ADMIN
  METHODISTE
  CHEF_POLE
  CHEF_EQUIPE
  MECANICIEN
  TECHNICIEN
  HSE
  GESTIONNAIRE_STOCK
}

enum GenreEnum {
  HOMME
  FEMME
}

class Utilisateur {
  - id_user : int <<PK>>
  - nom : string
  - prenom : string
  - email : string <<unique>>
  - identifiant : string <<unique>>
  - mot_de_passe : string <<hashed>>
  - role : RoleEnum
  - genre : GenreEnum
  - date_naissance : date
  - date_embauche : date
  - telephone : string
  + s_authentifier(login, mdp) : Token
  + changer_mot_de_passe()
}

class Pole {
  - id_pole : int <<PK>>
  - code_pole : string <<unique>>
  - nom_pole : string
  - description : string
}

class Zone {
  - id_zone : int <<PK>>
  - code_zone : string
  - nom_zone : string
}

class Equipe {
  - id_equipe : int <<PK>>
  - nom_equipe : string
}

class Quart {
  - id_quart : int <<PK>>
  - nom_quart : string
  - heure_debut : time
  - heure_fin : time
}

class ConfigPlanning {
  - id : int <<PK>>
  - date_debut : date
  - date_fin : date
  - rotation : string
}

class DemandeEchange {
  - id_demande : int <<PK>>
  - statut : string
  - date_demande : datetime
  - motif : string
}

Pole "1" --o "*" Zone : contient
Pole "1" --o "*" Equipe : possède
Pole "1" --o "*" Utilisateur : rattaché à
Equipe "1" --o "*" Utilisateur : membres
Equipe "1" --> "1" Quart : assigné à
Utilisateur "1" --o "*" DemandeEchange : demande
ConfigPlanning "*" --> "1" Equipe
@enduml
```

---

# 🔵 SPRINT 2 — Gestion des équipements & historique (2 semaines)

## Description
Modélisation de la hiérarchie des équipements (5 niveaux : système → ensemble → sous-ensemble → composant → pièce) et import du fichier historique des interventions correctives/préventives.

## User Stories
1. En tant qu'**ADMIN**, je veux créer un équipement avec son niveau hiérarchique et son parent.
2. En tant qu'**ADMIN**, je veux modifier/supprimer un équipement existant.
3. En tant qu'**utilisateur**, je veux visualiser la hiérarchie machine racine d'un composant.
4. En tant qu'**utilisateur**, je veux filtrer les équipements par pôle, zone ou niveau.
5. En tant qu'**utilisateur**, je veux rechercher un équipement par code SAP.
6. En tant qu'**ADMIN**, je veux importer un fichier CSV d'historique d'interventions.
7. En tant qu'**ADMIN**, je veux consulter l'historique d'un équipement (toutes ses pannes).

## Diagramme de cas d'utilisation

```plantuml
@startuml UC_Sprint2
left to right direction

actor Administrateur as Admin
actor Méthodiste as Meth
actor Utilisateur as User

rectangle "Équipements & Historique" {
  usecase "Créer un équipement" as UC1
  usecase "Modifier un équipement" as UC2
  usecase "Supprimer un équipement" as UC3
  usecase "Visualiser hiérarchie" as UC4
  usecase "Rechercher un équipement" as UC5
  usecase "Filtrer par pôle/zone/niveau" as UC6
  usecase "Importer historique CSV" as UC7
  usecase "Consulter historique équipement" as UC8
}

Admin --> UC1
Admin --> UC2
Admin --> UC3
Admin --> UC7

User --> UC4
User --> UC5
User --> UC6
User --> UC8

Meth --|> User
@enduml
```

## Diagramme de classes

```plantuml
@startuml DC_Sprint2
hide circle
skinparam classAttributeIconSize 0

enum TypeTravailHistorique {
  PREV
  CORR
}

class Equipement {
  - id_equipement : int <<PK>>
  - equipment_code : string <<unique>>
  - description : string
  - hierarchy_level : int
  - status : string
  - categorie : string
  - install_date : date
  + get_machine_racine() : Equipement
  + get_descendants() : List<Equipement>
}

class HistoriqueIntervention {
  - id : int <<PK>>
  - equipment_code : string
  - equipment_description : string
  - equipment_level : int
  - parent_code : string
  - parent_level : float
  - system_equipment : string
  - type_travail : TypeTravailHistorique
  - action_entity : string
  - date_declaration : date
  - date_fin : date
  - date_creation : date
  - cout_total : float
  - source : string
}

Equipement "1" --o "*" Equipement : parent
Equipement "1" --o "*" Equipement : machine_racine
Equipement "*" --> "1" Pole
Equipement "*" --> "1" Zone

Pole "1" --o "*" Equipement
Zone "1" --o "*" Equipement
@enduml
```

---

# 🔵 SPRINT 3 — Workflow Maintenance (3 semaines)

## Description
Implémentation du workflow complet de maintenance corrective et préventive : déclaration d'une demande d'intervention (DI), conversion en ordre de travail (OT), assignation à un mécanicien, exécution de l'intervention, et validation hiérarchique (Chef d'équipe + HSE). Notifications temps réel via WebSocket.

## User Stories
1. En tant qu'**utilisateur**, je veux créer une DI pour signaler une panne.
2. En tant que **METHODISTE**, je veux vérifier et valider/rejeter une DI.
3. En tant que **METHODISTE**, je veux générer un OT depuis une DI validée.
4. En tant que **METHODISTE**, je veux assigner un OT à un mécanicien.
5. En tant que **MECANICIEN**, je veux démarrer une intervention.
6. En tant que **MECANICIEN**, je veux clôturer une intervention avec un rapport.
7. En tant que **CHEF_EQUIPE**, je veux valider une intervention terminée.
8. En tant que **HSE**, je veux valider HSE une intervention.
9. En tant qu'**utilisateur**, je veux recevoir des notifications temps réel pour mes OT et DI.
10. En tant qu'**utilisateur**, je veux exporter un OT en PDF ou CSV.

## Diagramme de cas d'utilisation

```plantuml
@startuml UC_Sprint3
left to right direction

actor "Demandeur\n(Tout utilisateur)" as User
actor Méthodiste as Meth
actor Mécanicien as Meca
actor Technicien as Tech
actor "Chef d'équipe" as ChefEq
actor HSE

rectangle "Workflow Maintenance" {
  usecase "Créer une DI" as UC1
  usecase "Vérifier/Valider/Rejeter DI" as UC2
  usecase "Générer OT depuis DI" as UC3
  usecase "Assigner OT à un intervenant" as UC4
  usecase "Démarrer intervention" as UC5
  usecase "Terminer intervention" as UC6
  usecase "Saisir rapport d'intervention" as UC7
  usecase "Valider intervention CE" as UC8
  usecase "Valider intervention HSE" as UC9
  usecase "Recevoir notification temps réel" as UC10
  usecase "Exporter OT (PDF/CSV)" as UC11
  usecase "Consulter mes OT" as UC12
}

User --> UC1
User --> UC10
User --> UC11
User --> UC12

Meth --|> User
Meth --> UC2
Meth --> UC3
Meth --> UC4

Meca --|> User
Tech --|> User
Meca --> UC5
Meca --> UC6
Meca --> UC7
Tech --> UC5
Tech --> UC6
Tech --> UC7

ChefEq --|> User
ChefEq --> UC8

HSE --|> User
HSE --> UC9
@enduml
```

## Diagramme de classes

```plantuml
@startuml DC_Sprint3
hide circle
skinparam classAttributeIconSize 0

enum StatutDI {
  EN_ATTENTE
  VERIFIE
  VALIDEE
  REJETEE
  EN_COURS
}

enum UrgenceDI {
  FAIBLE
  NORMALE
  HAUTE
  CRITIQUE
}

enum StatutOT {
  CREE
  ASSIGNE
  EN_COURS
  TERMINE
  VALIDE_CE
  VALIDE_HSE
  ARCHIVE
  REJETE
}

enum TypeOT {
  CORRECTIF
  PREVENTIF
  PREDICTIF
}

enum ClasseOT {
  MECANIQUE
  ELECTRIQUE
  GLOBALE
}

enum StatutIntervention {
  EN_ATTENTE
  VALIDE
  REJETE
  VALIDE_HSE
  ARCHIVE
}

class DemandeIntervention {
  - id_di : int <<PK>>
  - numero_di : string <<unique>>
  - description : string
  - urgence : UrgenceDI
  - statut : StatutDI
  - date_declaration : datetime
  - photo_url : string
  + valider()
  + rejeter()
}

class OrdreTravail {
  - id_ot : int <<PK>>
  - numero_ot : string <<unique>>
  - type_ot : TypeOT
  - classe : ClasseOT
  - priorite : string
  - statut : StatutOT
  - description : string
  - date_creation : datetime
  - date_prevue : datetime
  - duree_estimee : int
  + assigner(intervenant)
  + cloturer()
}

class Intervention {
  - id_intervention : int <<PK>>
  - statut_validation : StatutIntervention
  - date_debut : datetime
  - date_fin : datetime
  - rapport : text
  - cout_main_oeuvre : float
  + valider_chef_equipe()
  + valider_hse()
}

class Notification {
  - id_notif : int <<PK>>
  - message : string
  - type : string
  - lue : boolean
  - date_creation : datetime
  - link : string
}

Utilisateur "1" --o "*" DemandeIntervention : demande
DemandeIntervention "1" --> "0..1" OrdreTravail : génère
Utilisateur "1" --o "*" OrdreTravail : méthodiste
Utilisateur "1" --o "*" OrdreTravail : assigné à
OrdreTravail "1" --o "*" Intervention : exécutions
Equipement "1" --o "*" DemandeIntervention
Equipement "1" --o "*" OrdreTravail
Utilisateur "1" --o "*" Notification : destinataire
@enduml
```

---

# 🔵 SPRINT 4 — Module Stock (2 semaines)

## Description
Gestion complète du stock de pièces de rechange : référencement des pièces, liaison aux équipements concernés (table de jonction `ComposanteStock`), workflow de réservation par les mécaniciens, validation et livraison par le gestionnaire de stock.

## User Stories
1. En tant que **GESTIONNAIRE_STOCK**, je veux créer une nouvelle pièce de rechange.
2. En tant que **GESTIONNAIRE_STOCK**, je veux lier une pièce aux équipements concernés.
3. En tant que **GESTIONNAIRE_STOCK**, je veux modifier la quantité et le seuil d'alerte.
4. En tant que **MECANICIEN**, je veux rechercher une pièce par code équipement.
5. En tant que **MECANICIEN**, je veux réserver une pièce pour un OT.
6. En tant que **GESTIONNAIRE_STOCK**, je veux valider une demande de réservation.
7. En tant que **GESTIONNAIRE_STOCK**, je veux livrer une pièce (décrément automatique du stock).
8. En tant qu'**utilisateur**, je veux voir les alertes de stock faible/épuisé.

## Diagramme de cas d'utilisation

```plantuml
@startuml UC_Sprint4
left to right direction

actor "Gestionnaire\nStock" as Gest
actor Mécanicien as Meca
actor Administrateur as Admin

rectangle "Module Stock" {
  usecase "Créer une pièce" as UC1
  usecase "Modifier une pièce" as UC2
  usecase "Lier pièce à équipement" as UC3
  usecase "Délier composante" as UC4
  usecase "Consulter stock" as UC5
  usecase "Rechercher par équipement" as UC6
  usecase "Réserver une pièce" as UC7
  usecase "Valider réservation" as UC8
  usecase "Livrer pièce" as UC9
  usecase "Annuler réservation" as UC10
  usecase "Consulter alertes stock" as UC11
}

Gest --> UC1
Gest --> UC2
Gest --> UC3
Gest --> UC4
Gest --> UC8
Gest --> UC9
Gest --> UC11

Meca --> UC5
Meca --> UC6
Meca --> UC7
Meca --> UC10

Admin --|> Gest
@enduml
```

## Diagramme de classes

```plantuml
@startuml DC_Sprint4
hide circle
skinparam classAttributeIconSize 0

enum StatutReservation {
  EN_ATTENTE
  VALIDEE
  LIVREE
  ANNULEE
}

class PieceStock {
  - id_piece : int <<PK>>
  - code_stock : string <<unique>>
  - designation : string
  - description : string
  - quantite : int
  - seuil_alerte : int
  - emplacement : string
  - unite : string
  + alerte() : "OK"|"FAIBLE"|"ABSENT"
}

class ComposanteStock {
  - id : int <<PK>>
  - code_stock : string
  - quantite_type : int
  - created_at : datetime
}

class ReservationPiece {
  - id_reservation : int <<PK>>
  - quantite_demandee : int
  - quantite_livree : int
  - statut : StatutReservation
  - notes_mecanicien : text
  - notes_gestionnaire : text
  - date_demande : datetime
  - date_validation : datetime
  - date_livraison : datetime
  + valider()
  + livrer()
  + annuler()
}

PieceStock "1" --o "*" ComposanteStock : liens
Equipement "1" --o "*" ComposanteStock : pièces compatibles
PieceStock "1" --o "*" ReservationPiece
OrdreTravail "1" --o "*" ReservationPiece
Utilisateur "1" --o "*" ReservationPiece : mécanicien
Utilisateur "1" --o "*" ReservationPiece : gestionnaire
@enduml
```

---

# 🔵 SPRINT 5 — Prédiction ML (LSTM / GRU) (3 semaines)

## Description
**Cœur du projet** — Mise en œuvre du système de maintenance prédictive basé sur des modèles deep learning (LSTM et GRU) entraînés sur l'historique des interventions correctives. Pipeline complet : ingestion des features (DSLF, DSLM, pannes/maintenances roulantes), inférence mensuelle avec ref_date glissant, et boucle d'apprentissage continu (export → réentraînement externe → réimport).

## User Stories
1. En tant qu'**ADMIN**, je veux uploader un modèle ML (.keras + 2 scalers).
2. En tant qu'**ADMIN**, je veux activer un modèle parmi ceux disponibles.
3. En tant qu'**ADMIN**, je veux comparer les performances des modèles (R², MAE, F1).
4. En tant que **METHODISTE**, je veux choisir le type de modèle (GRU/LSTM/Actif) avant un run.
5. En tant que **METHODISTE**, je veux lancer une prédiction RUL filtrée sur les composants test de mon pôle.
6. En tant que **METHODISTE**, je veux visualiser les résultats sous 3 vues : tableau, graphes (donut, histogramme, top critiques), comparaison machines/zones.
7. En tant que **METHODISTE**, je veux consulter la fiche détail d'un composant avec comparaison pannes réelles vs prédite.
8. En tant que **METHODISTE**, je veux générer un OT prédictif depuis une fiche composant.
9. En tant qu'**ADMIN**, je veux exporter les nouvelles données depuis le dernier export pour réentraînement externe.
10. En tant qu'**ADMIN**, je veux consulter l'historique complet des runs de prédiction.

## Diagramme de cas d'utilisation

```plantuml
@startuml UC_Sprint5
left to right direction

actor Administrateur as Admin
actor Méthodiste as Meth
actor "Système ML\n(TensorFlow)" as ML <<system>>

rectangle "Maintenance Prédictive ML" {
  usecase "Uploader modèle ML" as UC1
  usecase "Activer un modèle" as UC2
  usecase "Comparer modèles" as UC3
  usecase "Supprimer modèle" as UC4

  usecase "Choisir type GRU/LSTM" as UC5
  usecase "Lancer prédiction RUL" as UC6
  usecase "Consulter résultats" as UC7
  usecase "Visualiser graphes &\nanalyses" as UC8
  usecase "Comparer machines & zones" as UC9
  usecase "Fiche détail composant" as UC10
  usecase "Comparer pannes\nréelles vs prédites" as UC11
  usecase "Générer OT prédictif" as UC12

  usecase "Exporter nouvelles\ndonnées" as UC13
  usecase "Consulter historique runs" as UC14
}

Admin --> UC1
Admin --> UC2
Admin --> UC3
Admin --> UC4
Admin --> UC13

Meth --> UC5
Meth --> UC6
Meth --> UC7
Meth --> UC8
Meth --> UC9
Meth --> UC10
Meth --> UC11
Meth --> UC12
Meth --> UC14

UC6 ..> ML : <<utilise>>
@enduml
```

## Diagramme de classes

```plantuml
@startuml DC_Sprint5
hide circle
skinparam classAttributeIconSize 0

enum TypeModeleEnum {
  LSTM
  GRU
}

enum StatutRun {
  EN_COURS
  TERMINE
  ERREUR
}

enum StatutRUL {
  CRITIQUE
  URGENT
  SURVEILLANCE
  OK
}

enum SourcePrediction {
  ML
  SIMULATION
}

class ModeleML {
  - id_modele : int <<PK>>
  - version : string <<unique>>
  - type_modele : TypeModeleEnum
  - nom : string
  - description : text
  - path_keras : string
  - path_scaler_x : string
  - path_scaler_y : string
  - is_active : boolean
  - uploaded_at : datetime
  + activer()
  + charger()
}

class PredictionRun {
  - id_run : int <<PK>>
  - pole : string
  - statut : StatutRun
  - nb_composants : int
  - nb_critiques : int
  - nb_urgents : int
  - nb_surveillance : int
  - nb_ok : int
  - duree_ms : int
  - launched_at : datetime
  - finished_at : datetime
  + executer()
}

class PredictionResultat {
  - id_resultat : int <<PK>>
  - ref_date : date
  - equipment_code : string
  - equipment_desc : string
  - system_equipment : string
  - pole : string
  - zone : string
  - comp_level : int
  - rul_jours : int
  - statut : StatutRUL
  - date_panne_prevue : date
  - confiance_pct : int
  - source : SourcePrediction
  - stock_disponible : int
  - alerte_stock : string
}

class PipelineInference <<service>> {
  + load_active_model()
  + build_daily_panel(features)
  + run_monthly_predictions(pole)
  + predict_one(equipment_code, ref_date) : RUL
}

ModeleML "1" --o "*" PredictionRun : utilisé par
Utilisateur "1" --o "*" PredictionRun : lancé par
PredictionRun "1" --o "*" PredictionResultat : contient
PredictionResultat "*" --> "1" Equipement : concerne
PipelineInference ..> ModeleML : <<utilise>>
PipelineInference ..> HistoriqueIntervention : <<features>>
@enduml
```

---

# 🔵 SPRINT 6 — Dashboard & Analytics (2 semaines)

## Description
Tableau de bord unifié intégrant toutes les données opérationnelles : KPIs live (OT/DI/Interventions), widget de prédictions ML (composants à risque immédiat + alertes stock), graphes interactifs et auto-refresh.

## User Stories
1. En tant qu'**utilisateur**, je veux consulter mon tableau de bord en temps réel.
2. En tant qu'**ADMIN**, je veux filtrer le dashboard par pôle.
3. En tant que **METHODISTE**, je veux voir uniquement les données de mon pôle.
4. En tant qu'**utilisateur**, je veux voir les 6 KPIs principaux en haut.
5. En tant qu'**utilisateur**, je veux voir les composants à risque immédiat (ML).
6. En tant qu'**utilisateur**, je veux voir les graphes OT/DI/Interventions par statut.
7. En tant qu'**utilisateur**, je veux voir le top zones et top pôles.
8. En tant qu'**utilisateur**, je veux voir les activités récentes (OT + DI).
9. En tant qu'**utilisateur**, je veux que le dashboard se rafraîchisse automatiquement.

## Diagramme de cas d'utilisation

```plantuml
@startuml UC_Sprint6
left to right direction

actor Administrateur as Admin
actor Méthodiste as Meth
actor "Tout utilisateur" as User

rectangle "Dashboard & Analytics" {
  usecase "Consulter dashboard" as UC1
  usecase "Filtrer par pôle" as UC2
  usecase "Consulter KPIs live" as UC3
  usecase "Voir composants à risque\n(widget ML)" as UC4
  usecase "Consulter alertes stock" as UC5
  usecase "Visualiser graphes par statut" as UC6
  usecase "Voir top zones/pôles" as UC7
  usecase "Consulter activités récentes" as UC8
  usecase "Rafraîchir manuellement" as UC9
  usecase "Naviguer vers fiche détaillée" as UC10
}

User --> UC1
User --> UC3
User --> UC4
User --> UC5
User --> UC6
User --> UC7
User --> UC8
User --> UC9
User --> UC10

Admin --|> User
Admin --> UC2

Meth --|> User
@enduml
```

## Diagramme de classes

> Le sprint 6 **n'introduit pas de nouvelle entité métier** — il s'appuie sur des **vues agrégées** des modules précédents via des services dédiés.

```plantuml
@startuml DC_Sprint6
hide circle
skinparam classAttributeIconSize 0

class DashboardService <<service>> {
  + get_live_kpi(id_pole) : KPISet
  + get_ot_by_status(id_pole) : List
  + get_di_by_status(id_pole) : List
  + get_intervention_by_status(id_pole) : List
  + get_ot_by_zone(id_pole) : List
  + get_ot_by_pole() : List
  + get_recent_activity(id_pole, limit) : List
  + get_predictions_summary(id_pole) : MLSummary
}

class KPISet <<DTO>> {
  + total_ot : int
  + ot_en_cours : int
  + ot_termine : int
  + taux_completion : float
  + di_en_attente : int
  + di_total : int
}

class MLSummary <<DTO>> {
  + last_run : PredictionRun
  + top_critiques : List<PredictionResultat>
  + nb_alertes_stock : int
}

DashboardService ..> OrdreTravail : <<lit>>
DashboardService ..> DemandeIntervention : <<lit>>
DashboardService ..> Intervention : <<lit>>
DashboardService ..> PredictionRun : <<lit>>
DashboardService ..> PredictionResultat : <<lit>>
DashboardService --> KPISet
DashboardService --> MLSummary
@enduml
```

---

# 🔵 SPRINT 7 *(buffer)* — Tests, déploiement, rédaction (1 semaine)

## Objectifs
- **Tests E2E** : Playwright/Cypress sur les parcours critiques (login → DI → OT → prédiction → OT prédictif)
- **Tests unitaires** : services métier (`ml_inference`, `stock`, `predictions`)
- **Documentation** : OpenAPI/Swagger pour l'API REST + README pour le déploiement
- **Déploiement** : Docker Compose (frontend Next.js + backend FastAPI + PostgreSQL)
- **Rédaction finale du mémoire** : assemblage des chapitres + soutenance

---

# 📊 Diagramme de classes GLOBAL (référence)

> Vue unifiée à insérer en annexe du mémoire.

```plantuml
@startuml DC_Global
hide circle
skinparam classAttributeIconSize 0
skinparam linetype ortho

package "Utilisateurs & Organisation" {
  class Utilisateur
  class Pole
  class Zone
  class Equipe
  class Quart
}

package "Équipements" {
  class Equipement
  class HistoriqueIntervention
}

package "Workflow Maintenance" {
  class DemandeIntervention
  class OrdreTravail
  class Intervention
  class Notification
}

package "Stock" {
  class PieceStock
  class ComposanteStock
  class ReservationPiece
}

package "Prédiction ML" {
  class ModeleML
  class PredictionRun
  class PredictionResultat
}

Pole "1" --o "*" Zone
Pole "1" --o "*" Equipe
Pole "1" --o "*" Utilisateur
Equipe "1" --> "1" Quart
Equipe "1" --o "*" Utilisateur

Pole "1" --o "*" Equipement
Zone "1" --o "*" Equipement
Equipement "1" --o "*" Equipement : parent
Equipement "1" --o "*" HistoriqueIntervention

Utilisateur "1" --o "*" DemandeIntervention
DemandeIntervention "1" --> "0..1" OrdreTravail
Equipement "1" --o "*" DemandeIntervention
Equipement "1" --o "*" OrdreTravail
OrdreTravail "1" --o "*" Intervention
Utilisateur "1" --o "*" Notification

Equipement "1" --o "*" ComposanteStock
PieceStock "1" --o "*" ComposanteStock
PieceStock "1" --o "*" ReservationPiece
OrdreTravail "1" --o "*" ReservationPiece

ModeleML "1" --o "*" PredictionRun
PredictionRun "1" --o "*" PredictionResultat
PredictionResultat "*" --> "1" Equipement
@enduml
```

---

# 📋 Tableau récapitulatif sprints × livrables

| Sprint | Backend | Frontend | BDD | ML |
|---|---|---|---|---|
| 1 | JWT, RBAC, CRUD users | Login, Profil, Pages admin users/pôles | Tables auth | — |
| 2 | CRUD équipements, Import CSV | Page équipements + hiérarchie | Tables équipements, historique | — |
| 3 | Workflows DI/OT/Interventions + WS | Pages DI, OT, Interventions, notifications | Tables DI/OT/Intervention | — |
| 4 | CRUD pièces + réservations | Pages stock, ajout pièce, réservations | Tables pieces_stock | — |
| 5 | Pipeline ML + endpoints prédictions | Pages prédictions, fiche composant, admin modèles | Tables ModeleML, PredictionRun | **Inférence LSTM/GRU** |
| 6 | Endpoints dashboard live | Dashboard avec KPIs + widget ML | Vues SQL | — |
| 7 | Tests + Docker | Tests E2E | Migrations finales | Boucle réentraînement |

---

# 🎯 Conseils de rédaction pour le mémoire

1. **Pour chaque sprint** : 1 chapitre avec :
   - Objectifs & user stories
   - Diagrammes (UC + classes)
   - Architecture technique implémentée
   - Captures d'écran de l'interface
   - Difficultés rencontrées + solutions

2. **Avant sprints (chapitres 1-3)** : Contexte, état de l'art, méthodologie Scrum

3. **Après sprints (chapitres finaux)** : Évaluation du modèle ML (métriques R²=0.74, MAE=3.45j), résultats, perspectives

4. **Annexes** : Diagramme global, screenshots, code clés du pipeline ML
