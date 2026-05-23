'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Calendar, Clock, Users, Check, AlertCircle, Loader2 } from 'lucide-react'
import { otService, UserDisponible } from '@/services/otService'

interface AssignModalProps {
  isOpen: boolean
  onClose: () => void
  ot: {
    id_ot: number
    numero_ot: string
    classe: string
    equipement?: { equipment_code: string; description: string }
    date_prevue?: string | null
    duree_estimee?: number | null
  } | null
  idPole: number
  onAssignSuccess: () => void
}

const SHIFT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  MATIN: { label: 'Matin (06h-14h)', color: 'text-amber-600', bg: 'bg-amber-100' },
  APRES_MIDI: { label: 'Après-midi (14h-22h)', color: 'text-orange-600', bg: 'bg-orange-100' },
  NUIT: { label: 'Nuit (22h-06h)', color: 'text-indigo-600', bg: 'bg-indigo-100' },
}

export default function AssignModal({ isOpen, onClose, ot, idPole, onAssignSuccess }: AssignModalProps) {
  const [users, setUsers] = useState<UserDisponible[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [selected1, setSelected1] = useState<number | null>(null)
  const [selected2, setSelected2] = useState<number | null>(null)
  const [datePrevue, setDatePrevue] = useState('')
  const [dureeEstimee, setDureeEstimee] = useState(60)

  // Fonction pour charger les utilisateurs
  const loadUsers = useCallback(async (dateToSend?: string | null) => {
    setLoading(true)
    setError('')
    try {
      const poleId = Number(idPole)
      if (!poleId || isNaN(poleId) || poleId <= 0) {
        setError('Erreur: ID du pôle invalide')
        return
      }

      const otClasse = ot?.classe || 'MECANIQUE'
      console.log('[AssignModal] Loading users with date:', dateToSend, 'classe:', otClasse)
      
      const data = await otService.getDisponibles(poleId, otClasse, dateToSend || undefined)
      setUsers(data)
      console.log('[AssignModal] Users loaded:', data.length)
    } catch (e: any) {
      console.error('[AssignModal] Error loading users:', e)
      setError(e?.message || 'Erreur chargement utilisateurs')
    } finally {
      setLoading(false)
    }
  }, [idPole, ot])

  // Initialiser la date et durée quand le modal s'ouvre
  useEffect(() => {
    if (!isOpen || !ot) return
    
    console.log('[AssignModal] Modal opened, ot:', ot)
    
    // Récupérer la date prévue de l'OT (depuis la base de données)
    if (ot.date_prevue) {
      // La date vient de l'API en format ISO, on la convertit pour datetime-local
      const dt = new Date(ot.date_prevue)
      const formatted = dt.toISOString().slice(0, 16)
      setDatePrevue(formatted)
      console.log('[AssignModal] Date set from OT:', formatted)
      
      // Charger les utilisateurs avec cette date
      loadUsers(ot.date_prevue)
    } else {
      // Pas de date prévue, charger tous les utilisateurs disponibles
      console.log('[AssignModal] No date, loading all users')
      loadUsers(null)
    }
    
    // Récupérer la durée estimée
    if (ot.duree_estimee) {
      setDureeEstimee(ot.duree_estimee)
    }
    
  }, [isOpen, ot])

  // Recharger quand l'utilisateur change la date
  useEffect(() => {
    if (!isOpen || !datePrevue) return
    console.log('[AssignModal] Date changed, reloading:', datePrevue)
    // Convertir le format datetime-local en ISO
    const isoDate = new Date(datePrevue).toISOString()
    loadUsers(isoDate)
  }, [datePrevue])

  async function handleSubmit() {
    if (!selected1) {
      setError('Veuillez sélectionner un utilisateur')
      return
    }

    const secondUser = selected2

    setSubmitting(true)
    setError('')
    try {
      await otService.assigner(ot!.id_ot, {
        id_assigne: selected1,
        id_assigne_2: secondUser || undefined,
        date_prevue: datePrevue || undefined,
        duree_estimee: dureeEstimee,
      })
      onAssignSuccess()
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erreur lors de l\'assignation')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !ot) return null

  const canSelectTwo = false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#003B7A] to-[#004a8f] p-6 text-white">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold flex items-center gap-3">
            <Users size={24} />
            Assigner l'OT
          </h2>
          <p className="text-blue-200 text-sm mt-1">{ot.numero_ot} • {ot.classe}</p>
          {ot.equipement && (
            <p className="text-blue-100 text-xs mt-2">{ot.equipement.equipment_code} - {ot.equipement.description}</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Date & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar size={14} className="inline mr-1" /> Date et heure prévue
              </label>
              <input
                type="datetime-local"
                value={datePrevue}
                onChange={(e) => setDatePrevue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#003B7A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Clock size={14} className="inline mr-1" /> Durée (minutes)
              </label>
              <input
                type="number"
                value={dureeEstimee}
                onChange={(e) => setDureeEstimee(Number(e.target.value))}
                min={15}
                step={15}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#003B7A] focus:outline-none"
              />
            </div>
          </div>

          {/* Selection Info */}
          <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${canSelectTwo ? 'bg-green-500' : 'bg-blue-500'}`} />
            <span className="text-sm text-blue-800">
              {`Classe ${ot.classe}: Sélectionnez 1 ${ot.classe === 'MECANIQUE' ? 'mecanicien' : ot.classe === 'ELECTRIQUE' ? 'technicien' : 'chef d\'equipe'}`}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Users List */}
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="animate-spin text-[#003B7A]" />
              <span className="text-gray-500">Chargement des utilisateurs...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Sélectionner l'intervenant principal:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {users.map((user) => (
                  <button
                    key={user.id_user}
                    onClick={() => setSelected1(user.id_user)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      selected1 === user.id_user
                        ? 'border-[#003B7A] bg-blue-50'
                        : 'border-gray-200 hover:border-[#003B7A]/50 hover:bg-gray-50'
                    }`}
                  >
                    {selected1 === user.id_user && (
                      <Check className="absolute top-3 right-3 text-[#003B7A]" size={18} />
                    )}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        user.role === 'MECANICIEN' ? 'bg-orange-500' : user.role === 'TECHNICIEN' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}>
                        {user.prenom[0]}{user.nom[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{user.prenom} {user.nom}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {user.shift && (
                        <span className={`text-xs px-2 py-0.5 rounded ${SHIFT_LABELS[user.shift]?.bg || 'bg-gray-100'} ${SHIFT_LABELS[user.shift]?.color || 'text-gray-600'}`}>
                          {SHIFT_LABELS[user.shift]?.label.split(' ')[0] || user.shift}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {user.ot_en_cours} OT en cours
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Second user selection (désactivé — canSelectTwo=false) */}
              {canSelectTwo && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Sélectionner le deuxième intervenant (optionnel):</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {users.filter(u => u.id_user !== selected1).map((user) => (
                      <button
                        key={user.id_user}
                        onClick={() => setSelected2(selected2 === user.id_user ? null : user.id_user)}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                          selected2 === user.id_user
                            ? 'border-[#00A651] bg-green-50'
                            : 'border-gray-200 hover:border-[#00A651]/50 hover:bg-gray-50'
                        }`}
                      >
                        {selected2 === user.id_user && (
                          <Check className="absolute top-3 right-3 text-[#00A651]" size={18} />
                        )}
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            user.role === 'MECANICIEN' ? 'bg-orange-500' : user.role === 'TECHNICIEN' ? 'bg-blue-500' : 'bg-purple-500'
                          }`}>
                            {user.prenom[0]}{user.nom[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{user.prenom} {user.nom}</p>
                            <p className="text-xs text-gray-500">{user.role}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-semibold hover:border-gray-400 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selected1}
            className="px-6 py-3 rounded-xl bg-[#003B7A] text-white font-semibold hover:bg-[#002a5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Assignation...
              </>
            ) : (
              <>
                <Check size={18} />
                Assigner
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}