import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { predictionsService } from '@/services/predictionsService'
import type { FiltresDashboard, OTPredictifPayload } from '@/types/prediction'

export const predictionsKeys = {
  all         : ['predictions'] as const,
  dashboard   : (f: FiltresDashboard)  => [...predictionsKeys.all, 'dashboard', f] as const,
  composant   : (code: string)         => [...predictionsKeys.all, 'composant', code] as const,
  composantML : (code: string)         => [...predictionsKeys.all, 'composant-ml', code] as const,
  filtresMeta : ['predictions', 'filtres-meta'] as const,
  historique  : ['predictions', 'historique'] as const,
  run         : (id: number)           => [...predictionsKeys.all, 'run', id] as const,
  modeleActif : ['predictions', 'modele-actif'] as const,
  comparaison : ['predictions', 'comparaison-modeles'] as const,
}

// ── Dashboard simulé ──────────────────────────────────────────────────────────
export function usePredictionsDashboard(filtres: FiltresDashboard) {
  return useQuery({
    queryKey: predictionsKeys.dashboard(filtres),
    queryFn : () => predictionsService.getDashboard(filtres),
  })
}

export function usePredictionComposant(code: string) {
  return useQuery({
    queryKey: predictionsKeys.composant(code),
    queryFn : () => predictionsService.getComposant(code),
    enabled : Boolean(code),
  })
}

export function useFiltresMeta() {
  return useQuery({
    queryKey: predictionsKeys.filtresMeta,
    queryFn : () => predictionsService.getFiltresMeta(),
    staleTime: 5 * 60_000,
  })
}

// ── ML ────────────────────────────────────────────────────────────────────────
export function useModeleActif() {
  return useQuery({
    queryKey : predictionsKeys.modeleActif,
    queryFn  : () => predictionsService.getModeleActif(),
    staleTime: 60_000,
  })
}

export function useHistoriquePredictions() {
  return useQuery({
    queryKey: predictionsKeys.historique,
    queryFn : () => predictionsService.getHistorique(),
  })
}

export function useRunDetails(id_run: number | null) {
  return useQuery({
    queryKey: predictionsKeys.run(id_run ?? 0),
    queryFn : () => predictionsService.getRunDetails(id_run!),
    enabled : id_run !== null,
  })
}

export function useComposantDetailML(code: string) {
  return useQuery({
    queryKey: predictionsKeys.composantML(code),
    queryFn : () => predictionsService.getComposantDetail(code),
    enabled : Boolean(code),
  })
}

export function useLancerPrediction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (model_type?: string) => predictionsService.lancerPrediction(model_type),
    onSuccess : () => {
      qc.invalidateQueries({ queryKey: predictionsKeys.historique })
      qc.invalidateQueries({ queryKey: predictionsKeys.all })
    },
  })
}

// ── OT ────────────────────────────────────────────────────────────────────────
export function useGenererOT(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: OTPredictifPayload) => predictionsService.genererOT(code, payload),
    onSuccess : () => {
      qc.invalidateQueries({ queryKey: predictionsKeys.composant(code) })
      qc.invalidateQueries({ queryKey: predictionsKeys.all })
    },
  })
}

/** Alias pour compatibilité avec l'ancien hook useLancerScan */
export function useLancerScan() {
  return useLancerPrediction()
}

/** Comparaison LSTM vs GRU pour le pôle de l'utilisateur. */
export function useComparaisonModeles() {
  return useQuery({
    queryKey: predictionsKeys.comparaison,
    queryFn : () => predictionsService.getComparaisonModeles(),
  })
}
