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
  supprimer: async (id: number, force = false) => {
    const res = await api.delete(`/users/${id}`, { params: force ? { force: true } : {} })
    return res.data
  },

  /**
   * Récupère la page HTML d'impression (avec auth Bearer) et l'ouvre dans
   * un nouvel onglet qui lance automatiquement la boîte d'impression.
   */
  ouvrirImpression: async (id_pole?: number | null) => {
    const res = await api.get('/users/imprimer', {
      params: id_pole ? { id_pole } : {},
      responseType: 'text',
    })
    const win = window.open('', '_blank')
    if (!win) {
      alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez votre bloqueur de pop-ups.")
      return
    }
    win.document.open()
    win.document.write(res.data)
    win.document.close()
    // Le HTML inclut déjà un bouton "Imprimer" — on laisse l'utilisateur choisir
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