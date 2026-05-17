export type Criticite    = 'CRITIQUE' | 'ELEVE' | 'MODERE' | 'STABLE'
export type StatutRUL    = 'CRITIQUE' | 'URGENT' | 'SURVEILLANCE' | 'OK'
export type StatutRun    = 'EN_COURS' | 'TERMINE' | 'ERREUR'
export type SourcePred   = 'ML' | 'SIMULATION'
export type AlerteStock  = 'OK' | 'FAIBLE' | 'ABSENT'

// ── Résultats d'une prédiction ML ────────────────────────────────────────────
export interface PredictionResultat {
  id_resultat       : number
  equipment_code    : string
  equipment_desc    : string | null
  system_equipment  : string | null
  pole              : string | null
  zone              : string | null
  comp_level        : number | null
  rul_jours         : number
  statut            : StatutRUL
  date_panne_prevue : string | null     // ISO date
  confiance_pct     : number | null
  source            : SourcePred
  stock_disponible  : number | null
  alerte_stock      : AlerteStock | null
}

export interface PredictionRun {
  id_run          : number
  id_modele       : number
  pole            : string | null
  statut          : StatutRun
  nb_composants   : number | null
  nb_critiques    : number | null
  nb_urgents      : number | null
  nb_surveillance : number | null
  nb_ok           : number | null
  duree_ms        : number | null
  launched_at     : string             // ISO datetime
  finished_at     : string | null
  resultats       : PredictionResultat[]
}

export interface PredictionRunSummary extends Omit<PredictionRun, 'resultats'> {}

export interface ModeleActifInfo {
  id_modele      : number
  version        : string
  type_modele    : 'LSTM' | 'GRU'
  nom            : string
  metrics        : { r2?: number; mae?: number; recall?: number; f1?: number }
  lookback       : number
  max_rul        : number
  num_composants : number
}

export interface ModeleComparaison extends ModeleActifInfo {
  description : string | null
  is_active   : boolean
  uploaded_at : string
}

export interface ComposantPrediction {
  equipment_code     : string
  description        : string
  zone               : string
  machine            : string
  pole               : string
  niveau_hierarchie  : number          // 3, 4 ou 5
  rul_jours          : number
  criticite          : Criticite
  confiance_pct      : number          // 0-100
  date_panne_prevue  : string          // ISO date
  derniere_intervention : string | null
  nb_pannes          : number
  mtbf_jours         : number
  cout_moyen         : number          // DA
  stock_disponible   : number
  stock_seuil_alerte : number
  stock_ok           : boolean
}

export interface DashboardKPIs {
  critique : number
  eleve    : number
  modere   : number
  stable   : number
  total    : number
}

export interface DashboardData {
  kpis          : DashboardKPIs
  composants    : ComposantPrediction[]   // tous les composants analysés
  scanned_at    : string                  // date dernier scan
  pole_effectif?: string | null           // pôle effectivement filtré
  ref_date     ?: string | null           // date de référence du calcul RUL
}

export interface RULTrendPoint {
  date            : string             // ISO
  rul_predit     ?: number
  rul_reel       ?: number             // si intervention réelle
  intervention   ?: boolean
}

export interface ComposantDetail extends ComposantPrediction {
  trend              : RULTrendPoint[]
  interventions_passees : {
    date        : string
    type        : string
    description : string
    cout        : number
  }[]
  recommandation     : string
}

export interface FiltresDashboard {
  pole     ?: string   // ADMIN uniquement
  zone     ?: string
  machine  ?: string
  criticite?: Criticite | 'TOUS'
  search   ?: string
  date_from?: string   // YYYY-MM-DD
  date_to  ?: string   // YYYY-MM-DD
}

export interface OTPredictifPayload {
  equipment_code : string
  classe         : 'MECANIQUE' | 'ELECTRIQUE' | 'GLOBALE'
  priorite       : 'FAIBLE' | 'NORMALE' | 'HAUTE' | 'CRITIQUE'
  date_prevue    : string              // ISO
  duree_estimee  : number              // minutes
  description    : string
}
