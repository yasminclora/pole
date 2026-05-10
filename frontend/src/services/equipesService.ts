import api from './axiosInstance'

export const equipesService = {
  lister: async () => {
    const res = await api.get('/equipes/')
    return res.data
  },
  listerAvecChef: async () => {
    const res = await api.get('/equipes/')
    return res.data
  },
  parPole: async (id_pole: number) => {
    const res = await api.get(`/equipes/pole/${id_pole}`)
    return res.data
  },
  getById: async (id: number) => {
    const res = await api.get(`/equipes/${id}`)
    return res.data
  },
  configurer: async (id: number, data: {
    date_reference_cycle    : string
    position_initiale_cycle : number
  }) => {
    const res = await api.put(`/equipes/${id}/configuration`, data)
    return res.data
  },
}