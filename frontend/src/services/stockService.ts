import api from './axiosInstance'

export const stockService = {
  // Search pieces by designation or code_stock
  search: async (q: string) => {
    const res = await api.get('/stock/search', { params: { q } })
    return res.data
  },

  // Get piece by equipment_code (composante SAP)
  getByEquipmentCode: async (equipment_code: string) => {
    const res = await api.get('/stock/by-composante', { params: { equipment_code } })
    return res.data
  },

  // List all pieces
  list: async (page = 1, limit = 20, search = '') => {
    const res = await api.get('/stock/liste', { params: { page, limit, search } })
    return res.data
  },

  // Get piece by code_stock
  get: async (code_stock: string) => {
    const res = await api.get(`/stock/${code_stock}`)
    return res.data
  },

  // Alias getByCode (utilisé par la page détail)
  getByCode: async (code_stock: string) => {
    const res = await api.get(`/stock/${code_stock}`)
    return res.data
  },

  // ----- RESERVATIONS -----

  // List reservations with filters
  listReservations: async (params: { page?: number; limit?: number; statut?: string; id_mecanicien?: number; id_ot?: number }) => {
    const res = await api.get('/stock/reservation/liste', { params })
    return res.data
  },

  // Create a new reservation
  createReservation: async (data: {
    id_piece: number
    id_ot: number
    id_mecanicien: number
    id_intervention?: number
    quantite_demandee: number
    notes_mecanicien?: string
  }) => {
    const res = await api.post('/stock/reservation', data)
    return res.data
  },

  // Validate a reservation (gestionnaire)
  validateReservation: async (id_reservation: number, data: {
    id_gestionnaire: number
    notes_gestionnaire?: string
  }) => {
    const res = await api.put(`/stock/reservation/${id_reservation}/valider`, data)
    return res.data
  },

  // Deliver a reservation (gestionnaire) - decreases stock
  deliverReservation: async (id_reservation: number, data: {
    quantite_livree: number
  }) => {
    const res = await api.put(`/stock/reservation/${id_reservation}/livrer`, data)
    return res.data
  },

  // Cancel a reservation
  cancelReservation: async (id_reservation: number) => {
    const res = await api.put(`/stock/reservation/${id_reservation}/annuler`, {})
    return res.data
  },
}

// Note: planningService est défini dans planningService.ts — ne pas le dupliquer ici