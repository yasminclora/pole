import api from './axiosInstance'

// SHIFT LOGIC (based on CEVITAL cycle):
// Alpha = Matin (06h-14h)
// Bravo = Après-midi (14h-22h)  
// Charlie = Nuit (22h-06h)
// Delta = Repos
const EQUIPE_SHIFTS = {
  'Alpha': 'Matin',
  'Bravo': 'Après-midi',
  'Charlie': 'Nuit',
  'Delta': 'Repos',
}

function getShiftFromDate(dateStr: string): string {
  // Parse date - if date has time, extract hour
  let hour = 10 // default morning
  
  if (dateStr.includes('T')) {
    const timePart = dateStr.split('T')[1]
    if (timePart) {
      hour = parseInt(timePart.split(':')[0])
    }
  }
  
  if (hour >= 6 && hour < 14) return 'Matin'
  if (hour >= 14 && hour < 22) return 'Après-midi'
  return 'Nuit'
}

export const disponibiliteService = {

  // Get users filtered by shift (based on date/time of intervention)
  getUsersDisponibles: async (params: {
    id_pole: number
    date_cible: string  // Can include time like "2026-05-09T10:00"
    classe: string       // MECANIQUE, ELECTRIQUE
  }) => {
    const equipesRes = await api.get(`/equipes/pole/${params.id_pole}`)
    const equipes = equipesRes.data
    
    // Determine which shift we need based on date_prevue
    const targetShift = getShiftFromDate(params.date_cible)
    // debug suppressed: // console.log('[DisponibiliteService] Target shift:', targetShift, 'for date:', params.date_cible)
    
    const result = []
    
    for (const eq of equipes) {
      // Get the short name (Alpha, Bravo, Charlie, Delta)
      const nomCourt = eq.nom_equipe?.split(' ').pop() || 'Alpha'
      const equipeShift = EQUIPE_SHIFTS[nomCourt] || 'Matin'
      
      // Only include teams working the target shift
      if (equipeShift !== targetShift) {
        // debug suppressed: // console.log('[DisponibiliteService] Skip equipe:', eq.nom_equipe, 'shift:', equipeShift)
        continue
      }
      
      const membres = eq.membres || []
      
      for (const m of membres) {
        // For MECANIQUE: only MECANICIEN
        // For ELECTRIQUE: only TECHNICIEN
        if (params.classe === 'MECANIQUE' && m.role !== 'MECANICIEN') continue
        if (params.classe === 'ELECTRIQUE' && m.role !== 'TECHNICIEN') continue
        
        result.push({
          id: m.id_user,
          nom: m.nom,
          prenom: m.prenom,
          role: m.role,
          id_equipe: eq.id_equipe,
          equipe: eq.nom_equipe,
          shift: equipeShift,
          disponible: true
        })
      }
    }
    
    // debug suppressed: // console.log('[DisponibiliteService] Result:', result)
    return result
  },

  // Get all users in pole (no shift filtering)
  getUsersSimple: async (id_pole: number, classe: string) => {
    const equipesRes = await api.get(`/equipes/pole/${id_pole}`)
    const equipes = equipesRes.data
    
    const result = []
    for (const eq of equipes) {
      const membres = eq.membres || []
      for (const m of membres) {
        if (classe === 'MECANIQUE' && m.role !== 'MECANICIEN') continue
        if (classe === 'ELECTRIQUE' && m.role !== 'TECHNICIEN') continue
        
        result.push({
          id: m.id_user,
          nom: m.nom,
          prenom: m.prenom,
          role: m.role,
          id_equipe: eq.id_equipe,
          equipe: eq.nom_equipe,
          disponible: true
        })
      }
    }
    return result
  },

  // Get stock by equipment code - try multiple endpoints
  checkStock: async (equipment_code: string) => {
    // debug suppressed: // console.log('[DisponibiliteService] checkStock:', equipment_code)
    
    // First try: via disponibilite endpoint (best for equipment_code)
    try {
      const res = await api.get('/disponibilite/stock-par-code', { 
        params: { equipment_code } 
      })
      // debug suppressed: // console.log('[DisponibiliteService] stock-par-code response:', res.data)
      if (res.data?.has_stock && res.data.piece) {
        return res.data
      }
    } catch (e) {
      // debug suppressed: // console.log('[DisponibiliteService] Stock endpoint 1 failed:', e)
    }
    
    // Second try: via stock route
    try {
      const res = await api.get('/stock/by-composante', { 
        params: { equipment_code } 
      })
      // debug suppressed: // console.log('[DisponibiliteService] by-composante response:', res.data)
      if (res.data && res.data.id_piece) {
        return {
          has_stock: true,
          piece: res.data
        }
      }
    } catch (e) {
      // debug suppressed: // console.log('[DisponibiliteService] Stock endpoint 2 failed:', e)
    }
    
    return {
      has_stock: false,
      message: 'Aucune pièce liée à cet équipement'
    }
  },
}