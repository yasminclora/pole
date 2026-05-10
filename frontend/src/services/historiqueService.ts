// services/historiqueService.ts  --  version mise a jour avec endpoints hierarchie
import api from './axiosInstance'

// ── Types ──────────────────────────────────────────────────────────
export interface EquipementNode {
  id_equipement: number
  equipment_code: string
  description: string
  level: number
  has_children?: boolean
}

export interface HierarchyResult {
  equipement: EquipementNode & { id_parent: number | null }
  chain: EquipementNode[]  // [level1, level2, level3, level4]
}

// ── Service historique ──────────────────────────────────────────────
export const historiqueService = {
  liste: async (params?: {
    page?: number
    limit?: number
    system_equipment?: string
    type_travail?: string
    source?: string
  }) => {
    const res = await api.get('/historique/liste', { params })
    return res.data
  },

  ajouter: async (data: {
    system_equipment: string
    equipment_description: string
    equipment_code?: string
    equipment_level?: number
    parent_code?: string
    parent_level?: number
    type_travail: string
    action_entity?: string
    cout_total?: number
    date_declaration: string
    date_fin?: string
    date_creation: string
    source?: string
  }) => {
    const res = await api.post('/historique/ajouter', data)
    return res.data
  },

  importCSV: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post('/historique/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },
}

// ── Service equipement (hierarchie) ────────────────────────────────
export const equipementService = {
  // Recherche par code -> retourne l'equipement + toute sa chaine de parents
  getByCode: async (code: string): Promise<HierarchyResult | null> => {
    const res = await api.get(`/equipements/by-code/${encodeURIComponent(code)}`)
    return res.data
  },

  // Enfants directs d'un equipement (pour navigation top-down)
  getChildren: async (id_equipement: number): Promise<EquipementNode[]> => {
    const res = await api.get(`/equipements/children/${id_equipement}`)
    return res.data
  },

  // Toutes les machines racines (level 1)
  getRoots: async (): Promise<EquipementNode[]> => {
    const res = await api.get('/equipements/roots')
    return res.data
  },

  // Autocomplete
  search: async (q: string): Promise<EquipementNode[]> => {
    const res = await api.get('/equipements/search', { params: { q } })
    return res.data
  },
}