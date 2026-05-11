# Optima Maintenance - Gestion de Maintenance Industrielle

Une plateforme complète de gestion de maintenance industrielle (G-MAO) développée pour Cevital, permettant la gestion des équipements, des ordres de travail, des interventions, du planning des équipes et du stock de pièces de rechange.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/Python-3.13+-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-orange)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)

## Table des Matières

- [Architecture du Projet](#architecture-du-projet)
- [Stack Technologique](#stack-technologique)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Structure du Projet](#structure-du-projet)
- [API Endpoints](#api-endpoints)
- [Rôles Utilisateurs](#rôles-utilisateurs)
- [Fonctionnalités](#fonctionnalités)
- [Dépannage](#dépannage)
- [Licence](#licence)

---

## Architecture du Projet

```
optima-maintenance/
├── backend/                    # API FastAPI
│   ├── main.py               # Point d'entrée
│   ├── database.py           # Configuration DB
│   ├── routes/               # Endpoints API
│   ├── models/               # Modèles SQLAlchemy
│   ├── schemas/             # Schemas Pydantic
│   ├── services/            # Services métier
│   ├── core/               # Sécurité & dépendances
│   ├── seed_*.py           # Scripts de初始isation
│   └── .env                # Variables d'environnement
│
└── frontend/                 # Application Next.js
    ├── src/
    │   ├── app/            # Pages (App Router)
    │   ├── components/     # Composants React
    │   ├── services/      # Services API
    │   ├── store/        # Redux store
    │   └── utils/        # Utilitaires
    ├── package.json
    └── .env.local
```

---

## Stack Technologique

### Backend
- **Framework**: FastAPI 0.109+
- **ORM**: SQLAlchemy 2.0
- **Base de données**: PostgreSQL 15+
- **Authentification**: JWT (python-jose + bcrypt)
- **Validation**: Pydantic v2
- **WebSocket**: FastAPI native
- **Migration**: Alembic

### Frontend
- **Framework**: Next.js 16.2.4 (App Router)
- **UI**: React 19 + TypeScript
- **Styling**: TailwindCSS 4 + shadcn/ui
- **State**: Redux Toolkit
- **HTTP**: Axios
- **Graphs**: Recharts
- **Icons**: Lucide React
- **Real-time**: Socket.io-client

---

## Prérequis

### Logiciels Requis
- **Python**: 3.11 ou supérieur
- **Node.js**: 20.x ou supérieur
- **PostgreSQL**: 15.x ou supérieur
- **npm** ou **yarn**

### Outils Recommandés
- **DB Browser** ou **pgAdmin** pour gérer la base de données
- **VS Code** pour le développement

---

## Installation

### 1. Cloner le Projet

```bash
git clone <repository-url>
cd optima-maintenance
```

### 2. Configuration Backend

```bash
cd backend

# Créer l'environnement virtuel
python -m venv .venv

# Activer l'environnement (Windows)
.venv\Scripts\activate

# Activer l'environnement (Linux/Mac)
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

### 3. Configuration Frontend

```bash
cd frontend

# Installer les dépendances
npm install
# ou
yarn install
```

---

## Configuration

### 1. Base de Données PostgreSQL

#### Créer la Base de Données

```sql
CREATE DATABASE Cevitalnew;
```

#### Créer l'Utilisateur

```sql
CREATE USER cevital WITH PASSWORD 'yasmin';
GRANT ALL PRIVILEGES ON DATABASE Cevitalnew TO cevital;
```

#### Accorder les Permissions

```sql
\c Cevitalnew;

GRANT USAGE ON SCHEMA public TO cevital;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cevital;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cevital;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL ON TABLES TO cevital;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL ON SEQUENCES TO cevital;
```

### 2. Variables d'Environnement

#### Backend (.env)

```env
# Configuration Base de Données
DATABASE_URL=postgresql+asyncpg://cevital:yasmin@localhost:5432/Cevitalnew
DATABASE_URL_SYNC=postgresql://cevital:yasmin@localhost:5432/Cevitalnew

# Clé secrète pour JWT (générez une clé aléatoire)
SECRET_KEY=votre-cle-secrete-tres-longue-et-securisee

# Mode debug
DEBUG=false

# Origines CORS autorisées (séparées par des virgules)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

#### Frontend (.env.local)

```env
# URL de l'API backend
NEXT_PUBLIC_API_URL=http://localhost:8001

# URL WebSocket
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

---

## Démarrage

### 1. Initialiser la Base de Données

```bash
cd backend

# Créer les tables
python init_db.py

# (Optionnel) Initialiser les données de test
python seed_poles_zones.py
python seed_equipements.py
python seed_stock.py
python seed_historique.py
```

### 2. Démarrer le Backend

```bash
cd backend
uvicorn main:app --reload --port 8001
```

Le serveur API sera accessible sur: `http://localhost:8001`
- Documentation API (Swagger): `http://localhost:8001/docs`
- Documentation API (ReDoc): `http://localhost:8001/redoc`

### 3. Démarrer le Frontend

```bash
cd frontend
npm run dev
```

L'application sera accessible sur: `http://localhost:3000`

### 4. Identifiants de Connexion Par Défaut

Après l'initialisation, créez un utilisateur administrateur ou utilisez les identifiants par défaut:

```
Email: admin@optima.dz
Mot de passe: admin123
```

Pour réinitialiser le mot de passe, utilisez: `Optima@DDMMYYYY` (date d'embauche)

---

## Structure du Projet

### Backend

```
backend/
├── main.py                    # Application FastAPI
├── database.py                # Configuration SQLAlchemy
├── init_db.py                # Création des tables
├── .env                      # Variables d'environnement
│
├── core/                     # Configuration centrale
│   ├── security.py          # JWT & hashing
│   └── dependencies.py      # Dépendances FastAPI
│
├── models/                   # Modèles SQLAlchemy
│   ├── user.py              # Utilisateurs
│   ├── pole.py              # Sites/Pôles
│   ├── zone.py              # Zones
│   ├── equipe.py            # Équipes
│   ├── equipement.py        # Équipements
│   ├── di.py                # Demandes Intervention
│   ├── ot.py                # Ordres de Travail
│   ├── intervention.py      # Interventions
│   ├── stock.py             # Pièces de rechange
│   └── planing.py           # Planning équipes
│
├── schemas/                  # Schemas Pydantic
│   ├── auth.py
│   ├── user.py
│   └── ...
│
├── routes/                   # Endpoints API
│   ├── auth.py              # /auth
│   ├── users.py             # /users
│   ├── poles.py             # /poles
│   ├── zones.py             # /zones
│   ├── equipes.py           # /equipes
│   ├── planning.py          # /planning
│   ├── equipements.py       # /equipements
│   ├── di.py                # /di
│   ├── ot.py                # /ot
│   ├── intervention.py      # /interventions
│   ├── stock.py             # /stock
│   ├── historique.py        # /historique
│   ├── dashboard.py         # /dashboard
│   ├── predictions.py       # /predictions
│   └── disponibilite.py     # /disponibilite
│
├── services/                 # Services métier
│   ├── notification_service.py
│   ├── dashboard_service.py
│   ├── prediction_service.py
│   └── export_service.py
│
└── seed_*.py               # Scripts d'initialisation
```

### Frontend

```
frontend/
├── src/
│   ├── app/                 # Pages (App Router)
│   │   ├── login/          # Page connexion
│   │   └── (dashboard)/   # Pages authentifiées
│   │       ├── dashboard/
│   │       ├── poles/
│   │       ├── zones/
│   │       ├── equipes/
│   │       ├── equipements/
│   │       ├── di/
│   │       ├── ot/
│   │       ├── stock/
│   │       ├── utilisateurs/
│   │       ├── historique/
│   │       ├── predictions/
│   │       └── profil/
│   │
│   ├── components/         # Composants
│   │   ├── layout/         # Sidebar, TopBar
│   │   └── ui/             # Composants shadcn
│   │
│   ├── services/           # Services API
│   │   ├── axiosInstance.ts
│   │   ├── authService.ts
│   │   ├── otService.ts
│   │   └── ...
│   │
│   ├── store/              # Redux
│   │   ├── store.ts
│   │   └── slices/
│   │       └── authSlice.ts
│   │
│   └── utils/             # Utilitaires
│       ├── exportUtils.ts
│       └── planning.ts
│
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── .env.local
```

---

## API Endpoints

### Authentication
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/login` | Connexion utilisateur |
| POST | `/auth/reinitialiser-mdp` | Réinitialiser mot de passe |
| GET | `/auth/me` | Obtenir utilisateur actuel |

### Utilisateurs
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/users` | Liste tous les utilisateurs |
| POST | `/users` | Créer un utilisateur |
| GET | `/users/{id}` | Obtenir un utilisateur |
| PUT | `/users/{id}` | Mettre à jour |
| DELETE | `/users/{id}` | Supprimer |

### Pôles & Zones
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/poles` | CRUD Pôles |
| GET/POST | `/zones` | CRUD Zones |

### Équipes & Planning
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/equipes` | CRUD Équipes |
| GET | `/planning/pole/{id}/config` | Configuration planning |
| POST | `/planning/echanges` | Échanger des quarts |

### Équipements
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/equipements` | CRUD Équipements |
| GET | `/equipements/{id}` | Détail équipement |

### Demandes Intervention (DI)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/di` | CRUD Demandes |
| POST | `/di/{id}/valider` | Valider une DI |
| POST | `/di/{id}/rejeter` | Rejeter une DI |

### Ordres de Travail (OT)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/ot` | CRUD Ordres |
| GET | `/ot/users-disponibles` | Techniciens disponibles |
| POST | `/ot/{id}/assigner` | Assigner un OT |

### Interventions
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/interventions` | CRUD Interventions |
| PUT | `/interventions/{id}/complete` | Terminer intervention |

### Stock
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/POST | `/stock` | CRUD Pièces |
| POST | `/stock/reserver` | Réserver une pièce |

### Dashboard & Analytics
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/dashboard/stats` | Statistiques |
| GET | `/predictions` | Prédictions maintenance |

---

## Rôles Utilisateurs

| Rôle | Description |
|------|-------------|
| `ADMIN` | Administrateur système |
| `METHODISTE` | Méthodiste planification |
| `CHEF_POLE` | Chef de pôle/site |
| `CHEF_EQUIPE` | Chef d'équipe |
| `MECANICIEN` | Technicien mécanique |
| `TECHNICIEN` | Technicien électrique |
| `HSE` | Hygiène Sécurité Environnement |
| `GESTIONNAIRE_STOCK` | Gestionnaire pièces |

---

## Fonctionnalités

### Gestion des Équipements
- Inventaire complet des équipements
- Hiérarchie: Pôle → Zone → Équipement
- Suivi de l'état et maintenance

### Workflow DI → OT
1. Création d'une Demande d'Intervention (DI)
2. Validation par le méthodiste
3. Conversion en Ordre de Travail (OT)
4. Assignation à un techniciens
5. Exécution de l'intervention
6. Clôture avec compte-rendu

### Planning des Équipes
- Configuration du cycle de rotation (8 jours)
- 4 équipes: Alpha, Bravo, Charlie, Delta
- Système d'échange de quarts
- Gestion des shifts: Matin, Après-midi, Nuit

### Gestion du Stock
- Catalogue de pièces de rechange
- Réservation pour interventions
- Suivi des quantités

### Dashboard & Analytics
- Statistiques desOT par statut
- Taux de rendement synthétique (TRS)
- Graphiques et visualisation

### Prédictions
- Analyse des historiques d'interventions
- Prédiction des pannes

---

## Dépannage

### Erreur CORS

Si vous avez une erreur CORS:
```bash
# Dans .env
ALLOWED_ORIGINS=*
```

### Erreur de Connexion DB

Vérifiez que PostgreSQL est en cours d'exécution et que les identifiants dans `.env` sont corrects.

### Port Déjà Utilisé

Si le port 8000 ou 3000 est occupé:
```bash
# Backend sur port 8001
uvicorn main:app --reload --port 8001

# Mettre à jour .env.local
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### Permissions Base de Données

Si erreur `permission denied`:
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cevital;
```

---

## License

Copyright © 2026 Cevital - Optima Maintenance v1.0

---

## Contact

Pour toute question ou support, contactez l'équipe de développement.