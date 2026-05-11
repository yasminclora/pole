import api from './axiosInstance'

export const interventionService = {

  // Pièce liée à une composante
  pieceComposante: async (id_equipement: number) => {
    const res = await api.get(
      `/interventions/composante/${id_equipement}/piece`
    )
    return res.data
  },

  // Intervention d'un OT
  getByOT: async (id_ot: number) => {
    const res = await api.get(`/interventions/ot/${id_ot}`)
    return res.data
  },

  // Soumettre feedback
  soumettreFeedback: async (id_ot: number, data: {
    id_realisateur       : number
    type_travail         : string
    description_travail  : string
    observations        ?: string
    composante_remplacee?: number
  }) => {
    const res = await api.post(`/interventions/ot/${id_ot}/feedback`, data)
    return res.data
  },

  // Valider
  valider: async (id_ot: number, data: {
    id_validateur: number
    role         : string
  }) => {
    const res = await api.post(`/interventions/ot/${id_ot}/valider`, data)
    return res.data
  },

  // Rejeter
  rejeter: async (id_ot: number, data: {
    id_rejecteur: number
    motif_rejet : string
  }) => {
    const res = await api.post(`/interventions/ot/${id_ot}/rejeter`, data)
    return res.data
  },

  // Réserver une pièce - utilise la route stock
  reserverPiece: async (id_ot: number, data: {
    id_piece          : number
    id_mecanicien     : number
    quantite_demandee : number
    notes            ?: string
  }) => {
    const res = await api.post('/stock/reservation', {
      id_piece: data.id_piece,
      id_ot: id_ot,
      id_mecanicien: data.id_mecanicien,
      quantite_demandee: data.quantite_demandee,
      notes_mecanicien: data.notes || ''
    })
    return res.data
  },
}