import api from './axiosInstance'

export const planningService = {

  getConfig: async (id_pole: number) => {
    const res = await api.get(`/planning/pole/${id_pole}/config`)
    return res.data
  },

  creerConfig: async (id_pole: number, data: {
    date_debut     : string
    position_alpha : number
    cree_par      ?: number
  }) => {
    const res = await api.post(`/planning/pole/${id_pole}/config`, data)
    return res.data
  },

  getPlanningPole: async (id_pole: number) => {
    const res = await api.get(`/planning/pole/${id_pole}/planning`)
    return res.data
  },

  demandesPole: async (id_pole: number) => {
    const res = await api.get(`/planning/demandes/pole/${id_pole}`)
    return res.data
  },

  demandesEquipe: async (id_equipe: number) => {
    const res = await api.get(`/planning/demandes/equipe/${id_equipe}`)
    return res.data
  },

  creerDemande: async (data: {
    id_equipe_demandeur : number
    date_echange        : string
    quart_souhaite      : string
    motif              ?: string
  }) => {
    const res = await api.post('/planning/demandes', data)
    return res.data
  },

  accepterDemande: async (id: number, data: {
    traite_par       : number
    pour_chef_equipe : number
  }) => {
    const res = await api.put(`/planning/demandes/${id}/accepter`, data)
    return res.data
  },

  refuserDemande: async (id: number, data: {
    traite_par  : number
    motif_refus : string
  }) => {
    const res = await api.put(`/planning/demandes/${id}/refuser`, data)
    return res.data
  },
}