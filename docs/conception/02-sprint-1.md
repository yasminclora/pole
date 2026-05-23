# Sprint 1 — Socle technique et Infrastructure

## Objectif du Sprint

> Mettre en place l'authentification, le profil utilisateur, et permettre à l'administrateur de construire l'infrastructure de l'entreprise (pôles, zones, équipements, stock, comptes utilisateurs).

## Périmètre

| Fonctionnalité | Estimation |
|----------------|------------|
| Système d'authentification (connexion, déconnexion) | 3 pts |
| Gestion des pôles, zones et équipements (hiérarchie L1-L4) | 5 pts |
| Gestion des comptes utilisateurs et privilèges | 5 pts |
| Catalogue et stock des pièces de rechange | 3 pts |
| Gestion du profil et changement de mot de passe | 2 pts |
| **Total** | **18 pts** |

---

## 1. Diagramme de cas d'utilisation

```plantuml
@startuml
left to right direction
skinparam shadowing false
skinparam packageStyle rectangle
skinparam ArrowColor #003B7A
skinparam actor {
  BackgroundColor #FFFFFF
  BorderColor #003B7A
}
skinparam usecase {
  BackgroundColor #DBEAFE
  BorderColor #003B7A
}
skinparam package {
  BackgroundColor #F8FAFC
  BorderColor #94A3B8
}

' ── Acteurs (avec héritage) ──
actor "Utilisateur" as User
actor "Administrateur" as Admin
User <|-- Admin

rectangle "Optima — Sprint 1" {

  ' ── Authentification & Profil ──
  package "Authentification & Profil" {
    usecase "S'authentifier" as UC_AUTH
    usecase "Se déconnecter" as UC_LOGOUT
    usecase "Gérer mon profil" as UC_PROFIL
    usecase "Consulter mon profil" as UC_VIEW
    usecase "Modifier mes infos" as UC_EDIT_INFO
    usecase "Modifier ma photo" as UC_PHOTO
    usecase "Changer mon mot de passe" as UC_MDP
  }

  ' ── Gestion Pôles ──
  package "Pôles & Zones" {
    usecase "Gérer les pôles" as UC_POLE
    usecase "Ajouter un pôle" as UC_POLE_ADD
    usecase "Modifier un pôle" as UC_POLE_EDIT
    usecase "Consulter les pôles" as UC_POLE_LIST

    usecase "Gérer les zones" as UC_ZONE
    usecase "Ajouter une zone" as UC_ZONE_ADD
    usecase "Modifier une zone" as UC_ZONE_EDIT
    usecase "Consulter les zones" as UC_ZONE_LIST
  }

  ' ── Gestion Équipements ──
  package "Équipements" {
    usecase "Gérer les équipements" as UC_EQ
    usecase "Ajouter un équipement" as UC_EQ_ADD
    usecase "Modifier un équipement" as UC_EQ_EDIT
    usecase "Consulter / Rechercher" as UC_EQ_SEARCH
    usecase "Importer (CSV)" as UC_EQ_IMPORT
  }

  ' ── Gestion Stock ──
  package "Stock" {
    usecase "Gérer le stock" as UC_STOCK
    usecase "Ajouter une pièce" as UC_PIECE_ADD
    usecase "Modifier une pièce" as UC_PIECE_EDIT
    usecase "Consulter les pièces" as UC_PIECE_LIST
    usecase "Lier pièce ↔ composante" as UC_LINK
  }

  ' ── Gestion Comptes ──
  package "Comptes utilisateurs" {
    usecase "Gérer les comptes" as UC_USER
    usecase "Ajouter un compte" as UC_USER_ADD
    usecase "Modifier un compte" as UC_USER_EDIT
    usecase "Consulter les comptes" as UC_USER_LIST
    usecase "Désactiver un compte" as UC_USER_DEACT
    usecase "Réinitialiser mdp" as UC_USER_RESET
  }

  ' ── Gestion Équipes ──
  package "Équipes" {
    usecase "Gérer les équipes" as UC_EQUIPE
    usecase "Créer une équipe" as UC_EQUIPE_ADD
    usecase "Rattacher utilisateur" as UC_EQUIPE_LINK
    usecase "Consulter les équipes" as UC_EQUIPE_LIST
  }
}

' ── Relations Acteur → UC principaux ──
User  --> UC_AUTH
User  --> UC_LOGOUT
User  --> UC_PROFIL

Admin --> UC_POLE
Admin --> UC_ZONE
Admin --> UC_EQ
Admin --> UC_STOCK
Admin --> UC_USER
Admin --> UC_EQUIPE

' ── Décomposition par <<include>> ──
UC_PROFIL ..> UC_VIEW       : <<include>>
UC_PROFIL ..> UC_EDIT_INFO  : <<include>>
UC_PROFIL ..> UC_PHOTO      : <<include>>
UC_PROFIL ..> UC_MDP        : <<include>>

UC_POLE  ..> UC_POLE_ADD    : <<include>>
UC_POLE  ..> UC_POLE_EDIT   : <<include>>
UC_POLE  ..> UC_POLE_LIST   : <<include>>

UC_ZONE  ..> UC_ZONE_ADD    : <<include>>
UC_ZONE  ..> UC_ZONE_EDIT   : <<include>>
UC_ZONE  ..> UC_ZONE_LIST   : <<include>>

UC_EQ    ..> UC_EQ_ADD      : <<include>>
UC_EQ    ..> UC_EQ_EDIT     : <<include>>
UC_EQ    ..> UC_EQ_SEARCH   : <<include>>
UC_EQ    ..> UC_EQ_IMPORT   : <<extend>>

UC_STOCK ..> UC_PIECE_ADD   : <<include>>
UC_STOCK ..> UC_PIECE_EDIT  : <<include>>
UC_STOCK ..> UC_PIECE_LIST  : <<include>>
UC_STOCK ..> UC_LINK        : <<include>>

UC_USER  ..> UC_USER_ADD    : <<include>>
UC_USER  ..> UC_USER_EDIT   : <<include>>
UC_USER  ..> UC_USER_LIST   : <<include>>
UC_USER_EDIT <.. UC_USER_DEACT : <<extend>>
UC_USER_EDIT <.. UC_USER_RESET : <<extend>>

UC_EQUIPE ..> UC_EQUIPE_ADD  : <<include>>
UC_EQUIPE ..> UC_EQUIPE_LINK : <<include>>
UC_EQUIPE ..> UC_EQUIPE_LIST : <<include>>

@enduml
```

---

## 2. Diagramme de classes

> Basé sur les **vraies tables** de la base de données.
> Tables : `utilisateurs`, `poles`, `zones`, `equipes`, `equipements`, `pieces_stock`, `composante_stock`.

```plantuml
@startuml
skinparam shadowing false
skinparam ArrowColor #003B7A
skinparam class {
  BackgroundColor #DBEAFE
  BorderColor #003B7A
  AttributeFontColor #0F172A
}
skinparam enum {
  BackgroundColor #FEF3C7
  BorderColor #F59E0B
}

' ════════ ÉNUMÉRATIONS ════════
enum RoleEnum {
  ADMIN
  METHODISTE
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

enum ShiftEnum {
  MATIN
  APRES_MIDI
  NUIT
}

' ════════ UTILISATEUR ════════
class Utilisateur {
  - id_user : int  {PK}
  - nom : string(100)
  - prenom : string(100)
  - identifiant : string(100)  {unique}
  - email : string(255)  {unique}
  - mot_de_passe : string(255)  {bcrypt}
  - role : RoleEnum
  - genre : GenreEnum
  - date_naissance : date
  - date_embauche : date
  - telephone : string(20)
  - id_pole : int  {FK, nullable}
  - id_equipe : int  {FK, nullable}
  - shift : ShiftEnum  {nullable}
  - photo_url : string(255)  {nullable}
}

' ════════ PÔLE ════════
class Pole {
  - id_pole : int  {PK}
  - code_pole : string(50)  {unique, nullable}
  - nom_pole : string(200)
  - description : string(300)  {nullable}
}

' ════════ ZONE ════════
class Zone {
  - id_zone : int  {PK}
  - code_zone : string(50)
  - id_pole : int  {FK}
}

' ════════ ÉQUIPE ════════
class Equipe {
  - id_equipe : int  {PK}
  - nom_equipe : string(100)
  - id_pole : int  {FK}
  - date_reference_cycle : date  {nullable}
  - position_initiale_cycle : int  {default 0}
}

' ════════ ÉQUIPEMENT (hiérarchie L1-L4) ════════
class Equipement {
  - id_equipement : int  {PK}
  - equipment_code : string(100)  {unique}
  - description : string(500)
  - hierarchy_level : int  {1, 2, 3, 4}
  - id_parent : int  {FK auto-réf, nullable}
  - id_machine_racine : int  {FK auto-réf, nullable}
  - id_pole : int  {FK, nullable}
  - id_zone : int  {FK, nullable}
  - install_date : date  {nullable}
  - status : string(50)  {default "NORMAL"}
  - categorie : string(100)  {nullable}
  - created_at : datetime
}

' ════════ PIÈCE EN STOCK ════════
class PieceStock {
  - id_piece : int  {PK}
  - code_stock : string(50)  {unique}
  - designation : string(300)
  - quantite : int  {default 0}
  - seuil_alerte : int  {default 2}
  - created_at : datetime
  - updated_at : datetime
}

' ════════ COMPOSANTE-STOCK (association N-N) ════════
class ComposanteStock {
  - id : int  {PK}
  - id_equipement : int  {FK}
  - id_piece : int  {FK}
  - code_stock : string(50)  {dénormalisé}
  - quantite_type : int  {default 1}
  - created_at : datetime
}

' ════════ RELATIONS ════════

' Utilisateur — RoleEnum / GenreEnum / ShiftEnum
Utilisateur "*" --> "1" RoleEnum
Utilisateur "*" --> "1" GenreEnum
Utilisateur "*" --> "0..1" ShiftEnum

' Utilisateur — Pôle / Équipe
Utilisateur "0..*" --> "0..1" Pole : appartient à
Utilisateur "0..*" --> "0..1" Equipe : membre de

' Équipe — Pôle
Equipe "0..*" --> "1" Pole : rattachée à

' Zone — Pôle
Zone "0..*" --> "1" Pole : appartient à

' Équipement — Pôle, Zone
Equipement "0..*" --> "0..1" Pole : rattaché à
Equipement "0..*" --> "0..1" Zone : localisé dans

' Équipement — auto-référence (hiérarchie)
Equipement "0..*" --> "0..1" Equipement : parent
Equipement "0..*" --> "0..1" Equipement : machine_racine

' Association N-N Équipement ↔ Pièce via ComposanteStock
Equipement   "1" -- "0..*" ComposanteStock
PieceStock   "1" -- "0..*" ComposanteStock

@enduml
```

---

## 3. Diagrammes de séquence

Les diagrammes de séquence pour les cas d'utilisation principaux ("S'authentifier", "Créer un compte utilisateur") seront détaillés dans le **fichier final dédié** (`06-diagrammes-sequence.md`) après validation des 4 diagrammes de classes et cas d'utilisation des sprints.
