/**
 * Service Prédictions — appels réels au backend FastAPI.
 *
 * Anciens endpoints (dashboard simulation) :
 *   GET  /predictions/dashboard
 *   GET  /predictions/composant/:code
 *   GET  /predictions/filtres-meta
 *   POST /predictions/composant/:code/generer-ot
 *
 * Nouveaux endpoints ML :
 *   POST /predictions/run
 *   GET  /predictions/historique
 *   GET  /predictions/runs/:id
 *   GET  /predictions/composant/:code/detail
 *   GET  /predictions/modele-actif
 */

import api from './axiosInstance'
import type {
  DashboardData,
  ComposantDetail,
  FiltresDashboard,
  OTPredictifPayload,
  PredictionRun,
  PredictionRunSummary,
  ModeleActifInfo,
} from '@/types/prediction'

export const predictionsService = {
  // ── Anciens endpoints (dashboard simulé) ─────────────────────────────────
  async getDashboard(filtres: FiltresDashboard = {}): Promise<DashboardData> {
    const params: Record<string, string> = {}
    if (filtres.pole)      params.pole      = filtres.pole
    if (filtres.zone)      params.zone      = filtres.zone
    if (filtres.machine)   params.machine   = filtres.machine
    if (filtres.criticite && filtres.criticite !== 'TOUS') params.criticite = filtres.criticite
    if (filtres.search)    params.search    = filtres.search
    if (filtres.date_from) params.date_from = filtres.date_from
    if (filtres.date_to)   params.date_to   = filtres.date_to
    const res = await api.get('/predictions/dashboard', { params })
    return res.data
  },

  async getComposant(code: string): Promise<ComposantDetail> {
    const res = await api.get(`/predictions/composant/${encodeURIComponent(code)}`)
    return res.data
  },

  async getFiltresMeta(): Promise<{ poles: string[]; zones: string[]; machines: string[] }> {
    const res = await api.get('/predictions/filtres-meta')
    return res.data
  },

  async genererOT(code: string, payload: OTPredictifPayload): Promise<{ id_ot: number; numero_ot: string }> {
    const body = {
      classe        : payload.classe,
      priorite      : payload.priorite,
      date_prevue   : payload.date_prevue.slice(0, 10),
      duree_estimee : payload.duree_estimee,
      description   : payload.description,
    }
    const res = await api.post(`/predictions/composant/${encodeURIComponent(code)}/generer-ot`, body)
    return res.data
  },

  // ── Nouveaux endpoints ML ────────────────────────────────────────────────

  /** Lance la prédiction ML. model_type = "GRU" | "LSTM" | undefined (actif par défaut). */
  async lancerPrediction(model_type?: string): Promise<PredictionRun> {
    const body = model_type ? { model_type } : {}
    const res = await api.post('/predictions/run', body, { timeout: 5 * 60_000 })
    return res.data
  },

  /** Historique des runs passés (filtré par pôle pour METHODISTE). */
  async getHistorique(): Promise<PredictionRunSummary[]> {
    const res = await api.get('/predictions/historique')
    return res.data
  },

  /** Détail complet d'un run (avec tous ses résultats). */
  async getRunDetails(id_run: number): Promise<PredictionRun> {
    const res = await api.get(`/predictions/runs/${id_run}`)
    return res.data
  },

  /** Fiche complète d'un composant (depuis le dernier run). */
  async getComposantDetail(code: string): Promise<any> {
    const res = await api.get(`/predictions/composant/${encodeURIComponent(code)}/detail`)
    return res.data
  },

  /** Info sur le modèle actif. */
  async getModeleActif(): Promise<ModeleActifInfo | null> {
    try {
      const res = await api.get('/predictions/modele-actif')
      return res.data
    } catch {
      return null
    }
  },

  /** Comparaison du dernier run LSTM vs dernier run GRU pour le pôle de l'user. */
  async getComparaisonModeles(): Promise<any> {
    const res = await api.get('/predictions/comparaison-modeles')
    return res.data
  },
}
