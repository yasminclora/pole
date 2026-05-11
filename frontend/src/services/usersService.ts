import api from './axiosInstance'

export const usersService = {
  creer: async (data: any) => {
    const res = await api.post('/users/', data)
    return res.data
  },
  lister: async () => {
    const res = await api.get('/users/')
    return res.data
  },
  getById: async (id: number) => {
    const res = await api.get(`/users/${id}`)
    return res.data
  },
  // Admin : modifier rôle + équipe
  modifierAffectation: async (id: number, data: { role?: string; id_equipe?: number | null }) => {
    const res = await api.put(`/users/${id}/affectation`, data)
    return res.data
  },
  // Profil : modifier téléphone + date naissance
  modifierInfosPerso: async (id: number, data: { telephone?: string | null; date_naissance?: string | null }) => {
    const res = await api.put(`/users/${id}/infos-personnelles`, data)
    return res.data
  },
  supprimer: async (id: number) => {
    const res = await api.delete(`/users/${id}`)
    return res.data
  },
  reinitMdp: async (id: number) => {
    const res = await api.post(`/users/${id}/reinit-mdp`)
    return res.data
  },
  changerMdp: async (id: number, ancien_mdp: string, nouveau_mdp: string) => {
    const res = await api.put(`/users/${id}/changer-mdp`, { ancien_mdp, nouveau_mdp })
    return res.data
  },
}