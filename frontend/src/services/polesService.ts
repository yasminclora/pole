import api from './axiosInstance'

export const polesService = {
  lister: async () => {
    const res = await api.get('/poles/')
    return res.data
  },
  creer: async (data: {
    nom_pole     : string
    code_pole   ?: string
    description ?: string
  }) => {
    const res = await api.post('/poles/', data)
    return res.data
  },
  getById: async (id: number) => {
    const res = await api.get(`/poles/${id}`)
    return res.data
  },
  supprimer: async (id: number) => {
    const res = await api.delete(`/poles/${id}`)
    return res.data
  },
}