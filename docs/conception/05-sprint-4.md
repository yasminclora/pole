# Sprint 4 — Réentraînement & Dashboards

## Objectif du Sprint

> Boucler le cycle d'amélioration continue du modèle ML grâce à l'intégration d'un outil de réentraînement externe, et fournir aux administrateurs/méthodistes des tableaux de bord d'analyse historique et de suivi temps réel des KPIs de maintenance.

## Périmètre

| Fonctionnalité | Estimation |
|----------------|------------|
| Réentraînement de modèle (export historique + outil externe) | 5 pts |
| Import et activation du nouveau modèle réentraîné | 5 pts |
| Tableau de bord KPIs et historique des interventions | 8 pts |
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

' ════════ ACTEURS ════════
actor "Utilisateur" as User
actor "Administrateur" as Admin
actor "Méthodiste" as Meth
actor "Outil d'Expérimentation\n(externe)" as Outil <<system>>

User <|-- Admin
User <|-- Meth

rectangle "Optima — Sprint 4 (Réentraînement & Dashboards)" {

  ' ── Réentraînement ──
  package "Cycle de Réentraînement" {
    usecase "Exporter l'historique\nenrichi (CSV)" as UC_EXPORT
    usecase "Accéder à l'outil\nd'expérimentation" as UC_OUTIL
    usecase "Importer le nouveau\nmodèle réentraîné" as UC_IMPORT
    usecase "Versionner les modèles" as UC_VERSION
    usecase "Activer le nouveau modèle" as UC_ACTIVATE
  }

  ' ── Dashboard Historique ──
  package "Dashboard Historique" {
    usecase "Consulter dashboard\nhistorique" as UC_DASH_HIST
    usecase "Filtrer par pôle / période /\nniveau d'équipement" as UC_DASH_FILTER
    usecase "Consulter évolution mensuelle\n(PREV vs CORR)" as UC_DASH_EVOL
    usecase "Consulter top composantes\ncritiques" as UC_DASH_TOP
    usecase "Consulter top machines\ncritiques" as UC_DASH_MACH
    usecase "Consulter répartition\ndes coûts" as UC_DASH_COST
  }

  ' ── Dashboard Temps Réel ──
  package "Dashboard Temps Réel" {
    usecase "Consulter dashboard\ntemps réel" as UC_DASH_LIVE
    usecase "Consulter flux DI/OT\nen cours" as UC_DASH_FLUX
    usecase "Consulter activité\ntemps réel" as UC_DASH_ACT
  }
}

' ════════ RELATIONS ACTEURS → UC ════════
Admin --> UC_EXPORT
Admin --> UC_OUTIL
Admin --> UC_IMPORT
Admin --> UC_VERSION

Admin --> UC_DASH_HIST
Admin --> UC_DASH_LIVE
Meth  --> UC_DASH_HIST
Meth  --> UC_DASH_LIVE

' Acteur système externe
UC_OUTIL ..> Outil : <<communique avec>>

' ════════ INCLUDE / EXTEND ════════

' Cycle de réentraînement
UC_OUTIL ..> UC_EXPORT     : <<include>>
UC_IMPORT ..> UC_VERSION   : <<include>>
UC_IMPORT <.. UC_ACTIVATE  : <<extend>>

' Dashboard historique
UC_DASH_HIST ..> UC_DASH_FILTER : <<include>>
UC_DASH_HIST ..> UC_DASH_EVOL   : <<include>>
UC_DASH_HIST ..> UC_DASH_TOP    : <<include>>
UC_DASH_HIST ..> UC_DASH_MACH   : <<include>>
UC_DASH_HIST ..> UC_DASH_COST   : <<include>>

' Dashboard temps réel
UC_DASH_LIVE ..> UC_DASH_FLUX : <<include>>
UC_DASH_LIVE ..> UC_DASH_ACT  : <<include>>

@enduml
```

---

## 2. Diagramme de classes

> Sprint 4 introduit la table `interventions_archivees` (archive miroir pour ML et dashboards) et la table `prev_corr` (données historiques 2 ans pour dashboards). Le sprint réutilise aussi les classes `ModeleML` du Sprint 3 (versioning des modèles réentraînés).

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

' ════════ CLASSES SPRINTS PRÉCÉDENTS (allégées) ════════
class Utilisateur <<Sprint 1>> {
  - id_user : int  {PK}
}

class ModeleML <<Sprint 3>> {
  - id_modele : int  {PK}
  - version : string(50)
  - is_active : boolean
}

class Intervention <<Sprint 2>> {
  - id_intervention : int  {PK}
  - statut_validation : StatutValidation
}

' ════════ ÉNUMÉRATIONS ════════
enum TypeTravailHistorique {
  PREV
  CORR
}

enum JobClassPrevCorr {
  PREVEN
  MECA
  ELEC
}

' ════════ INTERVENTION ARCHIVÉE ════════
note as N1
  Lorsqu'une intervention est validée
  par HSE et archivée par le méthodiste,
  elle est répliquée dans cette table
  pour enrichir le dataset ML.
end note

class InterventionArchivee {
  - id : int  {PK}
  - system_equipment : string(100)
  - equipment_description : string(255)
  - equipment_code : string(100)  {nullable}
  - equipment_level : int  {nullable}
  - parent_code : string(100)  {nullable}
  - parent_level : float  {nullable}
  - type_travail : TypeTravailHistorique
  - action_entity : string(100)  {nullable}
  - date_declaration : date
  - date_fin : date  {nullable}
  - date_creation : date
  - cout_total : float
  - source : string(50)
  - created_at : datetime
}

' ════════ PREV_CORR (full historique) ════════
note as N2
  Table chargée depuis le CSV
  d'historique maintenance (PREV + CORR)
  Utilisée pour les dashboards
  historiques et l'export ML.
end note

class PrevCorr {
  - id : int  {PK}
  - system_equipment : string(100)
  - equipment_description : string(255)
  - equipment_code : string(100)  {nullable}
  - equipment_level : int  {nullable}
  - parent_code : string(100)  {nullable}
  - parent_level : float  {nullable}
  - type_travail : TypeTravailHistorique
  - job_class : JobClassPrevCorr  {nullable}
  - action_entity : string(100)  {nullable}
  - date_declaration : date
  - date_fin : date  {nullable}
  - date_creation : date
  - cout_total : float
  - source : string(50)
  - label_quality : string(20)  {nullable}
  - created_at : datetime
}

' ════════ DASHBOARD (entités virtuelles agrégées) ════════
note as N3
  Les KPIs et statistiques des
  dashboards sont des AGRÉGATIONS
  calculées en temps réel via des
  requêtes SQL — pas de table dédiée.
end note

class DashboardHistorique <<virtual>> {
  - filtre_pole : string
  - filtre_periode : (date_debut, date_fin)
  - filtre_niveau : int
  --
  + calculer_kpis() : KPIs
  + evolution_mensuelle() : List
  + repartition_corr_prev() : Map
  + top_composantes_critiques() : List
  + top_machines_critiques() : List
  + repartition_couts() : Map
}

class DashboardTempsReel <<virtual>> {
  - filtre_pole : string
  --
  + nb_ot_actifs() : int
  + nb_di_en_attente() : int
  + nb_interventions_en_cours() : int
  + dernieres_activites() : List
}

' ════════ ENTITÉS DU CYCLE DE RÉENTRAÎNEMENT ════════
note as N4
  Le flux de réentraînement n'a pas
  de table dédiée — il s'agit d'un
  workflow opérationnel :
  Export CSV → Outil externe → Import .keras
  Le suivi se fait via la table modeles_ml
  (chaque nouveau modèle = nouvelle version).
end note

' ════════ RELATIONS ════════

' Archive
InterventionArchivee "*" --> "1" TypeTravailHistorique
InterventionArchivee "0..*" ..> "1" Intervention : source\n(au moment de l'archivage)

' PrevCorr
PrevCorr "*" --> "1" TypeTravailHistorique
PrevCorr "*" --> "0..1" JobClassPrevCorr

' Dashboards (agrégations)
DashboardHistorique ..> InterventionArchivee : agrège
DashboardHistorique ..> PrevCorr             : agrège
DashboardTempsReel  ..> Intervention         : interroge en live

' Réentraînement
ModeleML "0..*" --> "1" Utilisateur          : uploadé par
note bottom of ModeleML
  Chaque exécution du cycle de
  réentraînement produit une nouvelle
  version (v1, v2, v3...) du modèle.
  L'ancien modèle reste accessible
  pour rollback si nécessaire.
end note

@enduml
```

---

## 3. Diagrammes de séquence

Les diagrammes de séquence pour les cas d'utilisation principaux ("Cycle complet de réentraînement", "Consulter dashboard historique avec filtres") seront détaillés dans le **fichier final dédié** (`06-diagrammes-sequence.md`).
