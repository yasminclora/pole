import api from './axiosInstance'

export const zonesService = {
  lister: async () => {
    const res = await api.get('/zones/')
    return res.data
  },
  parPole: async (id_pole: number) => {
    const res = await api.get(`/zones/pole/${id_pole}`)
    return res.data
  },
  creer: async (data: { code_zone: string; nom_zone: string; id_pole: number }) => {
    const res = await api.post('/zones/', data)
    return res.data
  },
  supprimer: async (id: number) => {
    const res = await api.delete(`/zones/${id}`)
    return res.data
  },
}