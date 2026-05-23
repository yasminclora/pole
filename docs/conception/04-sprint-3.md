# Sprint 3 — Module ML & Ordres de Travail Prédictifs

## Objectif du Sprint

> Intégrer les modèles d'intelligence artificielle (LSTM/GRU) pour prédire la durée de vie restante (RUL) des composantes critiques, et permettre au méthodiste de transformer une prédiction critique en ordre de travail prédictif (proactif).

## Périmètre

| Fonctionnalité | Estimation |
|----------------|------------|
| Gestion des modèles ML (upload et activation) | 5 pts |
| Lancement d'une prédiction sur composantes L3-L4 | 5 pts |
| Consultation des résultats de prédiction et création d'un OT prédictif | 5 pts |
| **Total** | **15 pts** |

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
actor "Maintenancier" as Maint
actor "Service ML\n(Inférence)" as ML <<system>>

User <|-- Admin
User <|-- Meth
User <|-- Maint

rectangle "Optima — Sprint 3 (ML & Prédictif)" {

  ' ── Gestion des modèles ML ──
  package "Modèles ML" {
    usecase "Gérer les modèles ML" as UC_MODEL
    usecase "Uploader un modèle" as UC_MODEL_UP
    usecase "Activer un modèle" as UC_MODEL_ACT
    usecase "Consulter les modèles" as UC_MODEL_LIST
  }

  ' ── Prédictions ──
  package "Prédictions RUL" {
    usecase "Lancer une prédiction" as UC_PRED_RUN
    usecase "Consulter résultats prédiction" as UC_PRED_VIEW
    usecase "Consulter historique des runs" as UC_RUN_HIST
    usecase "Consulter détail composante" as UC_COMP_DETAIL
  }

  ' ── OT prédictif ──
  package "Ordres de Travail Prédictifs" {
    usecase "Créer un OT prédictif" as UC_OT_PRED
    usecase "Assigner OT prédictif" as UC_OT_PRED_ASSIGN
    usecase "Exécuter OT prédictif" as UC_OT_PRED_EXEC
  }
}

' ════════ RELATIONS ACTEURS → UC ════════
Admin --> UC_MODEL

Meth --> UC_PRED_RUN
Meth --> UC_PRED_VIEW
Meth --> UC_RUN_HIST
Meth --> UC_COMP_DETAIL
Meth --> UC_OT_PRED

Maint --> UC_OT_PRED_EXEC

' Acteur système ML
UC_PRED_RUN ..> ML : invoque

' ════════ INCLUDE / EXTEND ════════
UC_MODEL    ..> UC_MODEL_UP      : <<include>>
UC_MODEL    ..> UC_MODEL_ACT     : <<include>>
UC_MODEL    ..> UC_MODEL_LIST    : <<include>>

UC_PRED_RUN  ..> UC_MODEL_ACT    : <<include>>
UC_PRED_VIEW ..> UC_COMP_DETAIL  : <<extend>>
UC_OT_PRED   ..> UC_OT_PRED_ASSIGN : <<include>>
UC_OT_PRED   ..> UC_PRED_VIEW    : <<include>>

@enduml
```

---

## 2. Diagramme de classes

> Basé sur les **vraies tables** : `modeles_ml`, `predictions`, `prediction_runs`, `prediction_resultats`, `historique_interventions`.

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

class Pole <<Sprint 1>> {
  - id_pole : int  {PK}
}

class OrdreTravail <<Sprint 2>> {
  - id_ot : int  {PK}
  - type_ot : TypeOT
  - id_prediction : int  {FK, nullable}
}

' ════════ ÉNUMÉRATIONS SPRINT 3 ════════
enum TypeModeleEnum {
  LSTM
  GRU
}

enum StatutPrediction {
  ACTIVE
  OT_CREE
  RESOLUE
  IGNOREE
}

enum ModePrediction {
  SIMULATION
  MODEL
}

enum ConfiancePrediction {
  FAIBLE
  MOYENNE
  HAUTE
  INSUFFISANT
}

enum CriticitePrediction {
  CRITIQUE
  ATTENTION
  SAIN
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

enum TypeTravailHistorique {
  PREV
  CORR
}

' ════════ MODÈLE ML ════════
class ModeleML {
  - id_modele : int  {PK}
  - version : string(50)  {unique}
  - type_modele : TypeModeleEnum
  - nom : string(200)
  - description : text  {nullable}
  - path_keras : string(500)
  - path_scaler_x : string(500)
  - path_scaler_y : string(500)
  - is_active : boolean
  - uploaded_by : int  {FK Utilisateur}
  - uploaded_at : datetime
}

' ════════ RUN DE PRÉDICTION ════════
class PredictionRun {
  - id_run : int  {PK}
  - id_modele : int  {FK}
  - id_user : int  {FK}
  - pole : string(100)  {nullable}
  - statut : StatutRun
  - nb_composants : int  {nullable}
  - nb_critiques : int  {nullable}
  - nb_urgents : int  {nullable}
  - nb_surveillance : int  {nullable}
  - nb_ok : int  {nullable}
  - duree_ms : int  {nullable}
  - erreur_message : text  {nullable}
  - launched_at : datetime
  - finished_at : datetime  {nullable}
}

' ════════ RÉSULTAT DE PRÉDICTION (détail par composante) ════════
class PredictionResultat {
  - id_resultat : int  {PK}
  - id_run : int  {FK}
  - ref_date : date  {nullable}
  - equipment_code : string(100)
  - equipment_desc : string(255)  {nullable}
  - system_equipment : string(100)  {nullable}
  - pole : string(100)  {nullable}
  - zone : string(200)  {nullable}
  - comp_level : int  {nullable}
  - rul_jours : int
  - statut : StatutRUL
  - date_panne_prevue : date  {nullable}
  - confiance_pct : int  {nullable}
  - source : SourcePrediction
  - stock_disponible : int  {nullable}
  - alerte_stock : string(10)  {nullable}
}

' ════════ PRÉDICTION (alerte créée pour une composante critique) ════════
class Prediction {
  - id_prediction : int  {PK}
  - equipment_code : string(100)
  - description : string(500)  {nullable}
  - equipment_level : int  {nullable}
  - machine_racine : string(100)  {nullable}
  - id_pole : int  {FK}
  - rul_jours : float  {nullable}
  - criticite : CriticitePrediction  {nullable}
  - confiance : ConfiancePrediction  {nullable}
  - mode : ModePrediction
  - probabilite : float  {nullable}
  - date_prevue_panne : date  {nullable}
  - cout_moyen : float  {nullable}
  - mtbf_moyen : float  {nullable}
  - derniere_panne : date  {nullable}
  - stock_disponible : int  {nullable}
  - alerte_stock : string(20)  {nullable}
  - id_methodiste : int  {FK}
  - statut : StatutPrediction
  - id_ot_genere : int  {FK OT, nullable}
  - notes : text  {nullable}
  - date_prediction : datetime
  - created_at : datetime
}

' ════════ HISTORIQUE INTERVENTIONS (données ML training) ════════
class HistoriqueIntervention {
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

' ════════ RELATIONS ════════

' Modèle ML
ModeleML "*" --> "1" TypeModeleEnum
ModeleML "0..*" --> "1" Utilisateur : uploadé par

' Run
PredictionRun "0..*" --> "1" ModeleML       : utilise
PredictionRun "0..*" --> "1" Utilisateur    : lancé par
PredictionRun "*" --> "1" StatutRun

' Résultat
PredictionRun "1" -- "0..*" PredictionResultat : génère
PredictionResultat "*" --> "1" StatutRUL
PredictionResultat "*" --> "1" SourcePrediction

' Prediction (alerte)
Prediction "0..*" --> "1" Pole              : appartient à
Prediction "0..*" --> "1" Utilisateur       : lancée par (méthodiste)
Prediction "0..1" --> "0..1" OrdreTravail   : génère
Prediction "*" --> "0..1" StatutPrediction
Prediction "*" --> "0..1" ModePrediction
Prediction "*" --> "0..1" ConfiancePrediction
Prediction "*" --> "0..1" CriticitePrediction

' OT prédictif (lien inverse du Sprint 2)
OrdreTravail "0..*" --> "0..1" Prediction   : issu de

' Historique
HistoriqueIntervention "*" --> "1" TypeTravailHistorique

@enduml
```

---

## 3. Diagrammes de séquence

Les diagrammes de séquence pour les cas d'utilisation principaux ("Lancer une prédiction RUL", "Uploader et activer un modèle ML") seront détaillés dans le **fichier final dédié** (`06-diagrammes-sequence.md`).
