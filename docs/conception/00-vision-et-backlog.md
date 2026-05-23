# Optima — Vision Produit & Product Backlog Global

> Document fondateur du projet de fin d'études.
> Méthodologie : Scrum — 6 sprints — durée totale ≈ 15 semaines.

---

## 1. Vision Produit

**Nom du produit :** Optima — GMAO Prédictive CEVITAL

**Vision (Elevator pitch) :**

> Pour **CEVITAL**, qui gère un parc industriel volumineux soumis à des pannes coûteuses et imprévisibles,
> **Optima** est une **Gestion de Maintenance Assistée par Ordinateur (GMAO) augmentée par l'IA prédictive**
> qui digitalise le workflow correctif (de la déclaration de panne à l'archivage de l'intervention)
> et anticipe les défaillances des composantes critiques grâce à un modèle de prédiction de RUL
> (Remaining Useful Life) entraîné sur l'historique des interventions SAP.
> Contrairement aux solutions GMAO classiques (réactives), Optima intègre **un cycle d'amélioration continue
> du modèle ML** via un outil de réentraînement embarqué.

**Objectifs stratégiques :**

| # | Objectif | KPI cible |
|---|----------|-----------|
| 1 | Digitaliser le flux correctif (DI → OT → Intervention) | 100% des interventions tracées numériquement |
| 2 | Réduire les pannes imprévues sur composantes Niveau 3-4 | -30% de pannes correctives sur 12 mois |
| 3 | Améliorer le taux de maintenance préventive | Ratio Préventif/Total > 40% |
| 4 | Offrir une visibilité opérationnelle temps réel | Dashboard live avec auto-refresh 60s |
| 5 | Boucle d'amélioration ML continue | 1 réentraînement / trimestre minimum |

**Périmètre fonctionnel :**

- Gestion de l'infrastructure (pôles, zones, équipements hiérarchiques 4 niveaux, stock)
- Gestion des utilisateurs avec RBAC (8 rôles distincts)
- Workflow correctif complet : DI → Validation → OT → Intervention → Validations en cascade → Archivage
- Workflow prédictif : Prédiction RUL → OT prédictif → Intervention préventive
- Outil de réentraînement intégré (fusion d'un outil d'expérimentation externe)
- Dashboards (historique 2 ans + temps réel)

**Hors périmètre (V1) :**

- Mobile native (responsive web seulement)
- Multi-langue (français uniquement)
- Intégration ERP SAP en temps réel (export CSV statique pour la V1)

---

## 2. Acteurs

### 2.1 Acteurs humains

| Acteur | Description | Responsabilités principales |
|--------|-------------|------------------------------|
| **Admin** | Administrateur système & métier | Gère l'infrastructure (pôles/zones/équipements/stock), crée et désactive les comptes utilisateurs, attribue les rôles, gère les modèles ML, lance les réentraînements |
| **Méthodiste** | Pilote de la maintenance d'un pôle | Valide les DI, génère les OT, assigne les interventions, configure les équipes et plannings, lance les prédictions ML, archive les interventions terminées |
| **Chef d'équipe** | Encadrant d'une équipe terrain | Visualise son équipe, valide les interventions soumises par ses mécaniciens, peut retransmettre/rejeter, traite les demandes d'échange de quart |
| **Mécanicien** | Opérateur de maintenance mécanique | Crée des DI, exécute les OT qui lui sont assignés, réserve les pièces, soumet le compte-rendu d'intervention |
| **Technicien** | Opérateur de maintenance électrique | Identique au mécanicien sur le périmètre électrique |
| **HSE** | Responsable Hygiène Sécurité Environnement | Valide les aspects sécurité des interventions terminées (validation post chef d'équipe, avant archivage) |
| **Gestionnaire Stock** | Responsable du magasin pièces | Valide les réservations de pièces faites par les mécaniciens, déclenche les livraisons |

### 2.2 Acteurs systèmes

| Acteur système | Description | Interaction |
|----------------|-------------|-------------|
| **Service ML (Inférence)** | Module interne qui fait tourner les modèles LSTM/GRU pour prédire le RUL | Appelé par le méthodiste via le bouton "Lancer prédiction" |
| **Outil d'Expérimentation** (externe) | Plateforme MLflow-like de réentraînement et versioning de modèles | Reçoit l'historique exporté, renvoie un nouveau fichier modèle (.keras) |

---

## 3. Glossaire métier

| Terme | Définition |
|-------|------------|
| **GMAO** | Gestion de Maintenance Assistée par Ordinateur |
| **DI** | Demande d'Intervention — signal d'une panne déclarée par un opérateur |
| **OT** | Ordre de Travail — mission de maintenance générée à partir d'une DI ou d'une prédiction ML |
| **Intervention** | Travail effectivement réalisé sur le terrain, lié à un OT |
| **Pôle** | Division opérationnelle de CEVITAL (ex: LLK, BBS, ELKS_UAP1) |
| **Zone** | Sous-division géographique d'un pôle |
| **Niveau hiérarchique équipement** | L1 = machine racine, L2 = système, L3/L4 = composantes (sur lesquelles porte la prédiction ML) |
| **RUL** | Remaining Useful Life — durée de vie restante prédite d'une composante (en jours) |
| **MTBF** | Mean Time Between Failures — temps moyen entre deux pannes consécutives |
| **CORR / Correctif** | Maintenance après panne (réactif) |
| **PREV / Préventif** | Maintenance planifiée (avant panne, sur calendrier) |
| **PREDICTIF** | Maintenance déclenchée par alerte ML (proactif basé sur RUL) |
| **Quart** | Tranche horaire de travail (Matin, Après-midi, Nuit) |
| **Run de prédiction** | Une exécution complète du modèle ML sur l'ensemble des composantes d'un pôle |

---

## 4. Roadmap des Sprints

| # | Sprint | Durée | Thème | Livrable phare |
|---|--------|-------|-------|----------------|
| **1** | Authentification & Comptes utilisateurs | **2 sem** | Sécurité + RBAC + profil | Login JWT fonctionnel + gestion comptes admin |
| **2** | Infrastructure entreprise | **3 sem** | Pôles + équipements + stock + équipes/planning | Tous les CRUD admin opérationnels |
| **3** | Flux correctif complet | **3 sem** | DI → OT → Intervention → Validations | Workflow opérationnel de bout en bout |
| **4** | Modèle ML & OT prédictif | **3 sem** | Modèle, prédiction RUL, OT prédictif | Système de prédiction et de génération d'OT prédictifs |
| **5** | Outil d'expérimentation intégré | **2 sem** | Fusion outil de réentraînement | Boucle d'amélioration continue du modèle |
| **6** | Dashboards & finalisation | **2 sem** | Dashboard historique + temps réel + livraison | Application complète prête pour la soutenance |

**Total : 15 semaines** (~3.5 mois)

### Justification des durées

- **Sprint 1 (2 sem)** — court car ciblé : auth/profil/CRUD utilisateurs. Critique mais bien borné techniquement.
- **Sprint 2 (3 sem)** — long car beaucoup de modules CRUD interdépendants (pôles, zones, équipements à 4 niveaux, stock, équipes, planning).
- **Sprint 3 (3 sem)** — long car workflow le plus complexe : 8 statuts OT, 5 statuts intervention, 4 acteurs en cascade, notifications WebSocket.
- **Sprint 4 (3 sem)** — long car ML : entraînement modèles LSTM/GRU, intégration TensorFlow, gestion versions, génération OT depuis prédiction.
- **Sprint 5 (2 sem)** — court car l'outil d'expérimentation existe déjà côté étudiant ; il s'agit d'une **fusion** (intégration via bouton + endpoints d'export/import).
- **Sprint 6 (2 sem)** — court car les dashboards sont essentiellement de la visualisation de données déjà disponibles + finalisation/tests/déploiement.

---

## 5. Product Backlog Global

### 5.1 Convention

**Story Points** (échelle Fibonacci) :
- **1** = trivial (< 2h)
- **2** = simple (½ jour)
- **3** = standard (1 jour)
- **5** = complexe (2-3 jours)
- **8** = très complexe (1 semaine)
- **13** = épique à décomposer

**Priorité (MoSCoW) :**
- **M** = Must Have (indispensable V1)
- **S** = Should Have (important mais contournable)
- **C** = Could Have (nice to have)

### 5.2 Epic 1 — Authentification & Comptes utilisateurs (Sprint 1)

| ID | User Story | SP | Prio |
|----|-----------|----|----|
| US-001 | En tant qu'**utilisateur**, je veux me **connecter** avec mon identifiant et mot de passe, afin d'accéder à l'application | 3 | M |
| US-002 | En tant qu'**utilisateur**, je veux me **déconnecter**, afin de sécuriser ma session | 1 | M |
| US-003 | En tant qu'**utilisateur**, je veux changer mon mot de passe, afin de sécuriser mon compte | 2 | M |
| US-004 | En tant qu'**utilisateur**, je veux modifier mes informations personnelles (téléphone, date naissance), afin de tenir mon profil à jour | 2 | M |
| US-005 | En tant qu'**utilisateur**, je veux **uploader une photo de profil**, afin de personnaliser mon compte | 3 | S |
| US-006 | En tant qu'**admin**, je veux **créer un compte utilisateur** avec rôle, pôle, équipe, afin d'intégrer un nouvel employé | 5 | M |
| US-007 | En tant qu'**admin**, je veux **modifier un compte** (rôle, équipe, désactivation), afin de gérer le cycle de vie des utilisateurs | 3 | M |
| US-008 | En tant qu'**admin**, je veux **consulter la liste de tous les utilisateurs**, afin de superviser le personnel | 2 | M |
| US-009 | En tant qu'**admin**, je veux **réinitialiser un mot de passe** utilisateur, afin de débloquer un compte oublié | 2 | M |
| US-010 | En tant qu'**utilisateur** (tous rôles), je veux que les permissions soient automatiquement appliquées selon mon rôle (RBAC), afin de n'accéder qu'à mes fonctionnalités | 5 | M |

**Total Sprint 1 : 28 SP**

### 5.3 Epic 2 — Infrastructure entreprise (Sprint 2)

| ID | User Story | SP | Prio |
|----|-----------|----|----|
| US-011 | En tant qu'**admin**, je veux **créer un pôle** (code, nom), afin de structurer l'organisation | 2 | M |
| US-012 | En tant qu'**admin**, je veux **consulter la liste des pôles** avec stats, afin de superviser | 2 | M |
| US-013 | En tant qu'**admin**, je veux **créer une zone** rattachée à un pôle, afin d'affiner la structure géographique | 2 | M |
| US-014 | En tant qu'**admin**, je veux **importer ou créer des équipements** avec leur niveau hiérarchique (L1-L4), afin de référencer le parc | 8 | M |
| US-015 | En tant qu'**utilisateur** (admin/méthodiste/chef équipe), je veux **rechercher un équipement** par code/description, afin d'accéder rapidement à l'info | 3 | M |
| US-016 | En tant qu'**utilisateur**, je veux **consulter le détail d'un équipement** (hiérarchie, zone, pôle, pièces liées), afin de comprendre son contexte | 3 | M |
| US-017 | En tant qu'**admin/gestionnaire stock**, je veux **créer une pièce en stock** (code, désignation, quantité, seuil), afin de gérer l'inventaire | 3 | M |
| US-018 | En tant qu'**admin/gestionnaire stock**, je veux **lier une pièce à une composante** (équipement L3/L4), afin de tracer les remplacements | 5 | M |
| US-019 | En tant qu'**utilisateur**, je veux **rechercher une pièce** par code équipement, afin de savoir si une pièce de rechange existe | 3 | M |
| US-020 | En tant qu'**admin**, je veux **créer une équipe** (nom, pôle), afin d'organiser le personnel terrain | 2 | M |
| US-021 | En tant qu'**admin**, je veux **rattacher des utilisateurs à une équipe**, afin de constituer les équipes opérationnelles | 3 | M |
| US-022 | En tant que **méthodiste**, je veux **configurer le planning des équipes** (rotation matin/A-M/nuit), afin de gérer les quarts | 8 | M |
| US-023 | En tant que **chef d'équipe**, je veux **visualiser mon équipe** et leur planning, afin de coordonner les opérations | 3 | M |

**Total Sprint 2 : 47 SP**

### 5.4 Epic 3 — Flux correctif (Sprint 3)

| ID | User Story | SP | Prio |
|----|-----------|----|----|
| US-024 | En tant que **mécanicien/technicien/chef équipe**, je veux **créer une DI** (panne constatée), afin de signaler un problème | 5 | M |
| US-025 | En tant que **méthodiste**, je veux **recevoir une notification** quand une DI est créée dans mon pôle, afin de la traiter rapidement | 3 | M |
| US-026 | En tant que **méthodiste**, je veux **valider une DI** et la convertir en OT, afin de lancer le processus de réparation | 5 | M |
| US-027 | En tant que **méthodiste**, je veux **rejeter une DI** avec motif, afin de filtrer les fausses alertes | 2 | M |
| US-028 | En tant que **méthodiste**, je veux **créer un OT manuel** sans passer par une DI, afin de planifier une maintenance | 3 | M |
| US-029 | En tant que **méthodiste**, je veux **assigner un OT à un mécanicien/technicien**, afin de répartir le travail | 5 | M |
| US-030 | En tant que **mécanicien**, je veux **recevoir une notification** d'OT assigné, afin de m'organiser | 2 | M |
| US-031 | En tant que **mécanicien**, je veux **consulter mes OT** assignés, afin de planifier ma journée | 3 | M |
| US-032 | En tant que **mécanicien**, je veux **réserver une pièce** pour mon OT, afin d'avoir les pièces nécessaires | 5 | M |
| US-033 | En tant que **gestionnaire stock**, je veux **valider/livrer** une réservation, afin de fournir les pièces | 3 | M |
| US-034 | En tant que **mécanicien**, je veux **démarrer mon OT** quand la pièce est livrée et la date arrivée, afin de tracer l'exécution | 3 | M |
| US-035 | En tant que **mécanicien**, je veux **soumettre mon compte-rendu d'intervention** (description, type, composante remplacée), afin de clôturer le travail | 5 | M |
| US-036 | En tant que **chef d'équipe**, je veux **valider une intervention soumise**, afin de contrôler la qualité | 3 | M |
| US-037 | En tant que **chef d'équipe**, je veux **rejeter une intervention** (mécanicien doit recommencer) ou **retransmettre** au mécanicien, afin de gérer les erreurs | 5 | M |
| US-038 | En tant que **HSE**, je veux **valider les aspects sécurité** d'une intervention validée par le CE, afin d'assurer la conformité | 3 | M |
| US-039 | En tant que **HSE**, je veux **rejeter au CE** si problème HSE, afin de demander correction | 2 | M |
| US-040 | En tant que **méthodiste**, je veux **archiver une intervention** validée HSE, afin de clôturer définitivement | 3 | M |

**Total Sprint 3 : 60 SP**

### 5.5 Epic 4 — Modèle ML & OT prédictif (Sprint 4)

| ID | User Story | SP | Prio |
|----|-----------|----|----|
| US-041 | En tant qu'**admin**, je veux **uploader un nouveau modèle ML** (.keras + métadonnées), afin de mettre en production | 5 | M |
| US-042 | En tant qu'**admin**, je veux **consulter la liste des modèles** disponibles avec leurs versions et métriques, afin de superviser | 3 | M |
| US-043 | En tant qu'**admin**, je veux **activer un modèle** spécifique, afin de choisir lequel sera utilisé par défaut | 3 | M |
| US-044 | En tant que **méthodiste**, je veux **lancer une prédiction** sur les composantes de mon pôle, afin d'anticiper les pannes | 8 | M |
| US-045 | En tant que **méthodiste**, je veux **visualiser le résultat d'une prédiction** (RUL par composante, statut CRITIQUE/URGENT/OK), afin d'identifier les composantes à risque | 5 | M |
| US-046 | En tant que **méthodiste**, je veux **consulter l'historique des runs** de prédiction, afin de suivre les analyses passées | 3 | M |
| US-047 | En tant que **méthodiste**, je veux **créer un OT prédictif** depuis une composante critique, afin d'agir avant la panne | 5 | M |
| US-048 | En tant que **mécanicien**, je veux **exécuter un OT prédictif** comme un OT correctif (mais marqué type PREDICTIF), afin de réaliser la maintenance proactive | 3 | M |
| US-049 | En tant que **méthodiste**, je veux **consulter le détail d'une composante prédite** (historique pannes, RUL, MTBF, pièces de rechange), afin de prendre une décision éclairée | 5 | S |

**Total Sprint 4 : 40 SP**

### 5.6 Epic 5 — Outil d'expérimentation intégré (Sprint 5)

| ID | User Story | SP | Prio |
|----|-----------|----|----|
| US-050 | En tant qu'**admin**, je veux **exporter l'historique enrichi** (interventions archivées + données CSV initiales) au format CSV, afin de fournir le dataset au réentraînement | 5 | M |
| US-051 | En tant qu'**admin**, je veux **accéder à l'outil d'expérimentation** via un bouton dédié dans mon interface, afin de lancer un réentraînement | 3 | M |
| US-052 | En tant qu'**admin**, je veux **importer un nouveau modèle** issu du réentraînement (.keras + métriques), afin de le mettre à disposition dans Optima | 5 | M |
| US-053 | En tant qu'**admin**, je veux **versionner les modèles** (v1, v2, v3...) avec leurs métriques (RMSE, MAE), afin de comparer les performances | 3 | S |
| US-054 | En tant qu'**admin**, je veux **conserver le modèle précédent** lors de l'activation d'un nouveau, afin de pouvoir rollback en cas de régression | 2 | S |

**Total Sprint 5 : 18 SP**

### 5.7 Epic 6 — Dashboards & finalisation (Sprint 6)

| ID | User Story | SP | Prio |
|----|-----------|----|----|
| US-055 | En tant qu'**admin/méthodiste**, je veux un **dashboard historique** (KPIs maintenance, évolution mensuelle, top composantes critiques) basé sur les données 2 ans, afin d'avoir une vision stratégique | 8 | M |
| US-056 | En tant qu'**admin**, je veux **filtrer le dashboard par pôle, période, niveau** d'équipement, afin d'affiner l'analyse | 3 | M |
| US-057 | En tant qu'**utilisateur** (admin/méthodiste), je veux un **dashboard temps réel** des DI/OT en cours, afin de suivre l'activité opérationnelle | 5 | M |
| US-058 | En tant qu'**utilisateur**, je veux voir l'**activité temps réel** (dernières DI/OT créées) avec lien vers le détail, afin de réagir rapidement | 3 | M |
| US-059 | En tant qu'**équipe projet**, on veut **écrire les tests** d'intégration sur les workflows critiques, afin de garantir la qualité | 8 | M |
| US-060 | En tant qu'**équipe projet**, on veut **déployer l'application** en environnement de démo, afin de présenter à la soutenance | 5 | M |
| US-061 | En tant qu'**équipe projet**, on veut **rédiger la documentation utilisateur**, afin de faciliter l'adoption | 3 | S |

**Total Sprint 6 : 35 SP**

### 5.8 Récapitulatif charge

| Sprint | Story Points | Durée | Vélocité (SP/sem) |
|--------|--------------|-------|-------------------|
| Sprint 1 | 28 | 2 sem | 14 |
| Sprint 2 | 47 | 3 sem | 15.7 |
| Sprint 3 | 60 | 3 sem | 20 |
| Sprint 4 | 40 | 3 sem | 13.3 |
| Sprint 5 | 18 | 2 sem | 9 |
| Sprint 6 | 35 | 2 sem | 17.5 |
| **TOTAL** | **228 SP** | **15 sem** | **~15 SP/sem moyen** |

> **Note :** la vélocité varie volontairement — Sprint 3 (workflow correctif) et Sprint 4 (ML) sont les plus denses, ce qui correspond à leur complexité technique. Sprint 5 est sous-chargé en SP mais nécessite des aller-retours avec l'outil externe (réalité du terrain).

---

## 6. Conventions du projet

### 6.1 Definition of Ready (DoR)

Une user story est **Ready** pour le sprint si :
- ✅ Elle suit le format "En tant que… je veux… afin de…"
- ✅ Elle a des critères d'acceptation clairs
- ✅ Les dépendances techniques sont identifiées
- ✅ Le story point est estimé
- ✅ Le mockup ou wireframe existe (pour les US avec interface)

### 6.2 Definition of Done (DoD) — globale

Une user story est **Done** si :
- ✅ Code implémenté (backend + frontend)
- ✅ Test manuel passé sur les critères d'acceptation
- ✅ Pas de régression sur les fonctionnalités précédentes
- ✅ Code mergé sur la branche principale
- ✅ Documentation technique mise à jour si nécessaire
- ✅ Capture d'écran de l'interface réalisée (pour rapport)

### 6.3 Cérémonies Scrum

| Cérémonie | Fréquence | Durée | But |
|-----------|-----------|-------|-----|
| **Sprint Planning** | Début sprint | 2h | Sélectionner les US du sprint |
| **Daily Standup** | Quotidien | 15 min | Synchro équipe (étudiants + encadrant) |
| **Sprint Review** | Fin sprint | 1h | Démo des US Done à l'encadrant |
| **Sprint Retrospective** | Fin sprint | 1h | Améliorer le process pour le sprint suivant |

### 6.4 Stack technique

| Couche | Technologies |
|--------|--------------|
| **Backend** | Python 3.11+ · FastAPI · SQLAlchemy · PostgreSQL · JWT |
| **ML** | TensorFlow/Keras (LSTM, GRU) · NumPy · Pandas |
| **Frontend** | Next.js 16 · TypeScript · React 19 · Redux Toolkit · TailwindCSS · Recharts |
| **Temps réel** | WebSocket (FastAPI native) |
| **Versioning** | Git + GitHub |

---

## 7. Architecture globale (vue 30 000 ft)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Auth/Profil  │  │  Workflow    │  │  Dashboards & ML view  │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (JWT) + WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                       BACKEND (FastAPI)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Routes    │  │  Services   │  │  Service ML (Inférence) │  │
│  │  (REST API) │  │  (métier)   │  │  (TensorFlow/Keras)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────┬────────────────────────────────┬───────────────────┘
             │ SQLAlchemy ORM                  │ Export CSV / Import .keras
┌────────────▼─────────────┐    ┌──────────────▼──────────────────┐
│   PostgreSQL             │    │  Outil d'Expérimentation        │
│   (utilisateurs, OT,     │    │  (MLflow-like, externe au       │
│    DI, équipements,      │    │   départ, intégré au sprint 5)  │
│    modèles, ...)         │    │                                 │
└──────────────────────────┘    └─────────────────────────────────┘
```

---

## 8. Prochaines étapes

Une fois ce document validé, on attaquera **sprint par sprint** :

- `docs/conception/01-sprint-1.md` — Authentification & Comptes
- `docs/conception/02-sprint-2.md` — Infrastructure entreprise
- `docs/conception/03-sprint-3.md` — Flux correctif
- `docs/conception/04-sprint-4.md` — ML & OT prédictif
- `docs/conception/05-sprint-5.md` — Outil d'expérimentation
- `docs/conception/06-sprint-6.md` — Dashboards & finalisation

Chaque fichier contiendra :
- Sprint Goal
- Sprint Backlog détaillé (tâches techniques par US)
- Diagramme de classes (PlantUML)
- Diagramme de cas d'utilisation (PlantUML)
- 2 diagrammes de séquence (PlantUML)
- Definition of Done spécifique
- Liste des captures d'écran à inclure dans le rapport
