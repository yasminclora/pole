import api from './axiosInstance'

export const equipementsService = {

  // Machines racines (Level 1) avec pagination
  listeMachines: async (params?: {
    id_pole?: number
    id_zone?: number
    search ?: string
    page ?: number
    limit ?: number
  }) => {
    const res = await api.get('/equipements/machines', { params })
    return res.data // { data: [], total, page, limit, total_pages }
  },

    // Ajouter dans equipementsService
rechercheComposantes: async (params: {
  id_pole?: number
  search ?: string
}) => {
  const res = await api.get('/equipements/composantes/recherche', { params })
  return res.data
},

  // Détail d'un équipement
  getById: async (id: number) => {
    const res = await api.get(`/equipements/${id}`)
    return res.data
  },

  // Arbre complet d'une machine
  getArbre: async (id: number) => {
    const res = await api.get(`/equipements/${id}/arbre`)
    return res.data
  },

  // Enfants directs
  getEnfants: async (id: number) => {
    const res = await api.get(`/equipements/${id}/enfants`)
    return res.data
  },

  // Créer un équipement (machine ou sous-élément)
  creer: async (data: {
    equipment_code : string
    description    : string
    id_parent     ?: number
    id_pole       ?: number
    id_zone       ?: number
    install_date  ?: string
    status        ?: string
    categorie     ?: string
  }) => {
    const res = await api.post('/equipements/', data)
    return res.data
  },

  // Modifier
  modifier: async (id: number, data: {
    description  ?: string
    status       ?: string
    categorie    ?: string
    install_date ?: string
  }) => {
    const res = await api.put(`/equipements/${id}`, data)
    return res.data
  },

  // Supprimer
  supprimer: async (id: number) => {
    const res = await api.delete(`/equipements/${id}`)
    return res.data
  },
}