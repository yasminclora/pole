import api from './axiosInstance'

export const diService = {

  liste: async (params?: {
    id_pole ?: number
    statut  ?: string
    id_user ?: number
  }) => {
    const res = await api.get('/di/', { params })
    return res.data
  },

  getById: async (id: number) => {
    const res = await api.get(`/di/${id}`)
    return res.data
  },

  creer: async (data: {
    id_equipement    : number
    id_pole          : number
    id_declarant     : number
    description_panne: string
    gravite         ?: string
  }) => {
    const res = await api.post('/di/', data)
    return res.data
  },

  verifier: async (id_di: number, data: { id_methodiste: number }) => {
    const res = await api.post(`/di/${id_di}/verifier`, data)
    return res.data
  },

  valider: async (id: number, data: {
    id_methodiste  : number
    classe         : string
    description   ?: string
    priorite      ?: string
    date_prevue   ?: string
    duree_estimee ?: number
  }) => {
    const res = await api.post(`/di/${id}/valider`, data)
    return res.data
  },

  rejeter: async (id: number, data: {
    id_methodiste: number
    motif_rejet  : string
  }) => {
    const res = await api.post(`/di/${id}/rejeter`, data)
    return res.data
  },
}