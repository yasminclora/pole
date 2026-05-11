import api from './axiosInstance'

export interface UserDisponible {
  id_user: number
  nom: string
  prenom: string
  email: string
  role: string
  shift: string | null
  ot_en_cours: number
}

export const otService = {

  liste: async (params?: {
    id_pole?: number; statut?: string; type_ot?: string;
    id_assigne?: number; id_zone?: number;
    date_debut?: string; date_fin?: string;
  }) => {
    const res = await api.get('/ot/', { params })
    return res.data
  },

  getById: async (id: number) => {
    const res = await api.get(`/ot/${id}`)
    return res.data
  },

  assigner: async (id: number, data: { id_assigne: number; id_assigne_2?: number; date_prevue?: string; duree_estimee?: number }) => {
    const res = await api.post(`/ot/${id}/assigner`, data)
    return res.data
  },

  demarrer: async (id: number, data: {
    id_realisateur: number
    type_travail?: string
    description_travail?: string
    observations?: string
    composante_remplacee?: number
  }) => {
    const res = await api.post(`/ot/${id}/demarrer`, data)
    return res.data
  },

  statsArchives: async (id_pole?: number) => {
    const res = await api.get('/ot/archives/stats', { params: { id_pole } })
    return res.data
  },

  exportArchivesCSV: async (params?: {
    id_pole?: number; id_zone?: number;
    date_debut?: string; date_fin?: string; type_ot?: string;
  }) => {
    const res = await api.get('/ot/archives/export', { params, responseType: 'blob' })
    return res as any
  },

  /**
   * Récupère les maintenanciers disponibles pour un OT.
   */
  getMecaniciensDisponibles: async (id_ot: number): Promise<UserDisponible[]> => {
    const res = await api.get(`/ot/${id_ot}/mecaniciens-disponibles`)
    return res.data
  },

  /**
   * @deprecated Utiliser getMecaniciensDisponibles(id_ot) à la place.
   */
  getDisponibles: async (id_pole: number, classe: string = 'GLOBALE', date_prevue?: string): Promise<UserDisponible[]> => {
    const params: any = { id_pole, classe }
    if (date_prevue) params.date_prevue = date_prevue
    const res = await api.get('/ot/users-disponibles', { params })
    return res.data
  },
}