# Sprint 2 — Flux Correctif Complet

## Objectif du Sprint

> Implémenter le flux complet de maintenance corrective, de la déclaration de panne par le maintenancier jusqu'à l'archivage de l'intervention par le méthodiste, en passant par la création de l'OT, la réservation des pièces et la validation en cascade (chef d'équipe → HSE).

## Périmètre

| Fonctionnalité | Estimation |
|----------------|------------|
| Création et suivi des Demandes d'Intervention (DI) | 5 pts |
| Création et assignation des OT correctifs | 8 pts |
| Réservation et délivrance des pièces | 5 pts |
| Saisie et validation du rapport d'intervention | 5 pts |
| Validation et archivage des interventions | 6 pts |
| Notifications temps réel (DI/OT/stock) | 5 pts |
| **Total** | **34 pts** |

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

' ════════ ACTEURS ════════
actor "Utilisateur" as User

actor "Maintenancier" as Maint
actor "Méthodiste" as Meth
actor "Chef d'équipe" as Chef
actor "HSE" as Hse
actor "Gestionnaire Stock" as Stock

User <|-- Maint
User <|-- Meth
User <|-- Chef
User <|-- Hse
User <|-- Stock

rectangle "Optima — Sprint 2 (Flux correctif)" {

  ' ── DI ──
  package "Demandes d'Intervention" {
    usecase "Créer une DI" as UC_DI_CREATE
    usecase "Consulter mes DI" as UC_DI_LIST
    usecase "Valider une DI" as UC_DI_VALIDATE
    usecase "Rejeter une DI" as UC_DI_REJECT
  }

  ' ── OT ──
  package "Ordres de Travail" {
    usecase "Créer un OT correctif" as UC_OT_CREATE
    usecase "Assigner un OT" as UC_OT_ASSIGN
    usecase "Consulter mes OT" as UC_OT_LIST
    usecase "Démarrer un OT" as UC_OT_START
  }

  ' ── Pièces ──
  package "Réservation Pièces" {
    usecase "Réserver une pièce" as UC_RES_CREATE
    usecase "Consulter réservations" as UC_RES_LIST
    usecase "Valider réservation" as UC_RES_VALIDATE
    usecase "Livrer une pièce" as UC_RES_DELIVER
  }

  ' ── Intervention ──
  package "Interventions" {
    usecase "Rédiger compte-rendu" as UC_INT_WRITE
    usecase "Soumettre intervention" as UC_INT_SUBMIT
    usecase "Valider (Chef d'équipe)" as UC_VAL_CE
    usecase "Rejeter / Retransmettre" as UC_VAL_REJECT
    usecase "Valider (HSE)" as UC_VAL_HSE
    usecase "Archiver intervention" as UC_INT_ARCHIVE
  }

  ' ── Notifications ──
  package "Notifications" {
    usecase "Recevoir notifications" as UC_NOTIF
    usecase "Consulter mes notifs" as UC_NOTIF_LIST
    usecase "Marquer comme lu" as UC_NOTIF_READ
  }
}

' ════════ RELATIONS ACTEURS → UC ════════

' Maintenancier
Maint --> UC_DI_CREATE
Maint --> UC_DI_LIST
Maint --> UC_OT_LIST
Maint --> UC_OT_START
Maint --> UC_RES_CREATE
Maint --> UC_RES_LIST
Maint --> UC_INT_WRITE
Maint --> UC_INT_SUBMIT

' Méthodiste
Meth --> UC_DI_VALIDATE
Meth --> UC_OT_CREATE
Meth --> UC_OT_ASSIGN
Meth --> UC_INT_ARCHIVE

' Chef d'équipe
Chef --> UC_VAL_CE
Chef --> UC_VAL_REJECT

' HSE
Hse --> UC_VAL_HSE

' Gestionnaire Stock
Stock --> UC_RES_VALIDATE
Stock --> UC_RES_DELIVER

' Notifications — tous les utilisateurs
User --> UC_NOTIF

' ════════ INCLUDE / EXTEND ════════

' DI
UC_DI_VALIDATE ..> UC_OT_CREATE   : <<include>>
UC_DI_VALIDATE <.. UC_DI_REJECT   : <<extend>>

' OT
UC_OT_CREATE   ..> UC_OT_ASSIGN   : <<include>>
UC_OT_START    ..> UC_RES_LIST    : <<include>>

' Intervention — workflow de validation cascade
UC_INT_SUBMIT  ..> UC_INT_WRITE   : <<include>>
UC_VAL_CE      ..> UC_VAL_HSE     : <<include>>
UC_VAL_HSE     ..> UC_INT_ARCHIVE : <<include>>
UC_VAL_CE      <.. UC_VAL_REJECT  : <<extend>>

' Réservation
UC_RES_DELIVER ..> UC_RES_VALIDATE : <<include>>

' Notifications
UC_NOTIF ..> UC_NOTIF_LIST : <<include>>
UC_NOTIF ..> UC_NOTIF_READ : <<include>>

@enduml
```

---

## 2. Diagramme de classes

> Basé sur les **vraies tables** : `demandes_intervention`, `ordres_travail`, `interventions`, `reservations_pieces`, `notifications`.
> Les classes héritées du Sprint 1 (Utilisateur, Equipement, Pole, PieceStock) sont représentées en allégé pour la lisibilité.

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

' ════════ CLASSES SPRINT 1 (allégées) ════════
class Utilisateur <<Sprint 1>> {
  - id_user : int  {PK}
  - role : RoleEnum
}

class Equipement <<Sprint 1>> {
  - id_equipement : int  {PK}
}

class Pole <<Sprint 1>> {
  - id_pole : int  {PK}
}

class PieceStock <<Sprint 1>> {
  - id_piece : int  {PK}
}

' ════════ ÉNUMÉRATIONS SPRINT 2 ════════
enum StatutDI {
  EN_ATTENTE
  VERIFIE
  VALIDEE
  REJETEE
  EN_COURS
}

enum UrgenceDI {
  NIVEAU_1
  NIVEAU_2
  NIVEAU_3
}

enum TypeOT {
  CORRECTIF
  PREDICTIF
}

enum ClasseOT {
  MECANIQUE
  ELECTRIQUE
  GLOBALE
}

enum StatutOT {
  CREE
  ASSIGNE
  EN_COURS
  TERMINE
  REWORK
  VALIDE_CE
  VALIDE_HSE
  ARCHIVE
  REJETE
}

enum TypeTravail {
  CORRECTIF
  PREDICTIF
  VERIFICATION
  NETTOYAGE
  REMPLACEMENT
  REPARATION
  REGLAGE
}

enum StatutValidation {
  EN_ATTENTE
  VALIDE
  REJETE
  VALIDE_HSE
  ARCHIVE
}

enum StatutReservation {
  EN_ATTENTE
  VALIDEE
  LIVREE
  ANNULEE
}

' ════════ DEMANDE D'INTERVENTION ════════
class DemandeIntervention {
  - id_di : int  {PK}
  - numero_di : string(30)  {unique}
  - id_equipement : int  {FK}
  - id_pole : int  {FK}
  - id_declarant : int  {FK}
  - id_methodiste : int  {FK, nullable}
  - description_panne : text
  - urgence : UrgenceDI
  - statut : StatutDI
  - motif_rejet : text  {nullable}
  - id_ot_genere : int  {FK, nullable}
  - date_verification : datetime  {nullable}
  - date_traitement : datetime  {nullable}
  - created_at : datetime
  - updated_at : datetime
}

' ════════ ORDRE DE TRAVAIL ════════
class OrdreTravail {
  - id_ot : int  {PK}
  - numero_ot : string(60)  {unique}
  - type_ot : TypeOT
  - classe : ClasseOT
  - urgence : string(20)
  - statut : StatutOT
  - id_equipement : int  {FK}
  - id_pole : int  {FK}
  - id_methodiste : int  {FK}
  - id_assigne : int  {FK, nullable}
  - id_assigne_2 : int  {FK, nullable}
  - description : text
  - observations : text  {nullable}
  - date_prevue : datetime  {nullable}
  - duree_estimee : int  {nullable}
  - date_debut_reelle : datetime  {nullable}
  - date_fin_reelle : datetime  {nullable}
  - id_di : int  {FK, nullable}
  - id_prediction : int  {FK, nullable}
  - motif_rejet : text  {nullable}
  - id_rejecteur : int  {FK, nullable}
  - date_assignation : datetime  {nullable}
  - date_validation_ce : datetime  {nullable}
  - date_validation_hse : datetime  {nullable}
  - date_archive : datetime  {nullable}
  - created_at : datetime
  - updated_at : datetime
}

' ════════ INTERVENTION ════════
class Intervention {
  - id_intervention : int  {PK}
  - id_ot : int  {FK, unique}
  - id_realisateur : int  {FK}
  - id_pole : int  {FK}
  - id_equipement : int  {FK}
  - type_travail : TypeTravail  {nullable}
  - description_travail : text
  - observations : text  {nullable}
  - date_debut : datetime  {nullable}
  - date_fin : datetime  {nullable}
  - composante_remplacee : int  {FK Equipement, nullable}
  - statut_validation : StatutValidation
  - motif_rejet : text  {nullable}
  - id_validateur_methode : int  {FK, nullable}
  - id_validateur_hse : int  {FK, nullable}
  - date_soumission : datetime  {nullable}
  - date_validation_met : datetime  {nullable}
  - date_validation_hse : datetime  {nullable}
  - date_archive : datetime  {nullable}
  - created_at : datetime
  - updated_at : datetime
}

' ════════ RÉSERVATION DE PIÈCE ════════
class ReservationPiece {
  - id_reservation : int  {PK}
  - id_piece : int  {FK}
  - id_ot : int  {FK}
  - id_intervention : int  {FK, nullable}
  - id_mecanicien : int  {FK}
  - id_gestionnaire : int  {FK, nullable}
  - quantite_demandee : int
  - quantite_livree : int  {nullable}
  - statut : StatutReservation
  - notes_mecanicien : text  {nullable}
  - notes_gestionnaire : text  {nullable}
  - date_demande : datetime
  - date_validation : datetime  {nullable}
  - date_livraison : datetime  {nullable}
}

' ════════ NOTIFICATION ════════
class Notification {
  - id_notification : int  {PK}
  - id_user : int  {FK}
  - type : string(50)
  - titre : string(200)  {nullable}
  - message : text
  - payload : json  {nullable}
  - id_ot : int  {nullable}
  - id_reservation : int  {nullable}
  - id_di : int  {nullable}
  - lu : boolean
  - date_lecture : datetime  {nullable}
  - created_at : datetime
}

' ════════ RELATIONS ════════

' DI
DemandeIntervention "0..*" --> "1" Equipement       : concerne
DemandeIntervention "0..*" --> "1" Pole             : appartient à
DemandeIntervention "0..*" --> "1" Utilisateur      : déclarée par
DemandeIntervention "0..*" --> "0..1" Utilisateur   : traitée par (méthodiste)
DemandeIntervention "0..1" --> "0..1" OrdreTravail  : génère

' OT
OrdreTravail "0..*" --> "1" Equipement              : cible
OrdreTravail "0..*" --> "1" Pole                    : appartient à
OrdreTravail "0..*" --> "1" Utilisateur             : créé par (méthodiste)
OrdreTravail "0..*" --> "0..1" Utilisateur          : assigné à
OrdreTravail "0..1" --> "0..1" DemandeIntervention  : issue de
OrdreTravail "1" -- "0..1" Intervention             : exécuté par

' Intervention
Intervention "1" --> "1" OrdreTravail               : pour
Intervention "0..*" --> "1" Utilisateur             : réalisée par
Intervention "0..*" --> "0..1" Utilisateur          : validée méthode
Intervention "0..*" --> "0..1" Utilisateur          : validée HSE

' Réservation
ReservationPiece "0..*" --> "1" PieceStock          : porte sur
ReservationPiece "0..*" --> "1" OrdreTravail        : pour
ReservationPiece "0..*" --> "1" Utilisateur         : demandée par
ReservationPiece "0..*" --> "0..1" Utilisateur      : validée par
ReservationPiece "0..*" --> "0..1" Intervention     : consommée par

' Notification
Notification "0..*" --> "1" Utilisateur             : destinée à

' Énumérations
DemandeIntervention "*" --> "1" StatutDI
DemandeIntervention "*" --> "1" UrgenceDI
OrdreTravail "*" --> "1" TypeOT
OrdreTravail "*" --> "1" ClasseOT
OrdreTravail "*" --> "1" StatutOT
Intervention "*" --> "0..1" TypeTravail
Intervention "*" --> "1" StatutValidation
ReservationPiece "*" --> "1" StatutReservation

@enduml
```

---

## 3. Diagrammes de séquence

Les diagrammes de séquence pour les cas d'utilisation principaux (création + validation d'une DI, cycle complet d'intervention avec validations cascade) seront détaillés dans le **fichier final dédié** (`06-diagrammes-sequence.md`).
