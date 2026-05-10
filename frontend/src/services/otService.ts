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

  liste: async (params?: { id_pole?: number; statut?: string; type_ot?: string; id_assigne?: number }) => {
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

  demarrer: async (id: number, id_realisateur: number) => {
    const res = await api.post(`/ot/${id}/demarrer`, { id_realisateur })
    return res.data
  },

  /**
   * Récupère les maintenanciers disponibles pour un OT.
   * Utilise l'endpoint unifié /ot/{id_ot}/mecaniciens-disponibles qui tient compte
   * des quarts réels via get_quart_avec_echange().
   */
  getMecaniciensDisponibles: async (id_ot: number): Promise<UserDisponible[]> => {
    const res = await api.get(`/ot/${id_ot}/mecaniciens-disponibles`)
    return res.data
  },

  /**
   * @deprecated Utiliser getMecaniciensDisponibles(id_ot) à la place.
   * Conservé temporairement pour compatibilité avec AssignModal.
   */
  getDisponibles: async (id_pole: number, classe: string = 'GLOBALE', date_prevue?: string): Promise<UserDisponible[]> => {
    const params: any = { id_pole, classe }
    if (date_prevue) params.date_prevue = date_prevue
    const res = await api.get('/ot/users-disponibles', { params })
    return res.data
  },
}