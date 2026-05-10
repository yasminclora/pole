'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { stockService } from '@/services/stockService'
import { 
  Loader2, Package, CheckCircle, XCircle, Clock, 
  Truck, AlertTriangle, Search, ChevronRight, ChevronLeft,
  Eye, Check, X, FileText
} from 'lucide-react'

interface Reservation {
  id_reservation: number
  id_piece: number
  code_stock: string
  designation: string
  quantite_demandee: number
  quantite_livree: number | null
  statut: string
  notes_mecanicien: string | null
  notes_gestionnaire: string | null
  date_demande: string
  date_validation: string | null
  date_livraison: string | null
  id_ot: number
  id_mecanicien: number
  mecanicien_nom: string
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  EN_ATTENTE: { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
  VALIDEE: { label: 'Validée', color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle },
  LIVREE: { label: 'Livrée', color: 'text-green-600', bg: 'bg-green-50', icon: Truck },
  ANNULEE: { label: 'Annulée', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
}

interface PaginationData {
  data: Reservation[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export default function StockReservationPage() {
  const authUser = useSelector((s: RootState) => s.auth.user)
  
  const [pagination, setPagination] = useState<PaginationData>({
    data: [], total: 0, page: 1, limit: 10, total_pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('')
  const [search, setSearch] = useState('')
  
  // Modal for delivery
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [deliveryQty, setDeliveryQty] = useState(1)
  const [gestionnaireNotes, setGestionnaireNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const charger = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const data = await stockService.listReservations({
        page,
        limit: 10,
        statut: filterStatut || undefined,
      })
      setPagination({
        data: data.data || [],
        total: data.total || 0,
        page: data.page || 1,
        limit: data.limit || 10,
        total_pages: data.total_pages || 0,
      })
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }, [filterStatut])

  useEffect(() => {
    charger(1)
  }, [charger])

  const handleValidate = async (res: Reservation) => {
    console.log('[Reservation] Validating:', res)
    if (!confirm(`Valider la réservation de ${res.designation}?`)) return
    try {
      await stockService.validateReservation(res.id_reservation, {
        id_gestionnaire: authUser?.id_user,
        notes_gestionnaire: ''
      })
      console.log('[Reservation] Validation done, reloading...')
      // Reset to first page and reload
      setFilterStatut('')  // Show all
      charger(1)
    } catch (error) {
      console.error('[Reservation] Validate error:', error)
      alert('Erreur lors de la validation')
    }
  }

  const handleDelivery = async () => {
    if (!selectedReservation) return
    setSubmitting(true)
    try {
      await stockService.deliverReservation(selectedReservation.id_reservation, {
        quantite_livree: deliveryQty
      })
      setShowDeliveryModal(false)
      setSelectedReservation(null)
      setDeliveryQty(1)
      setGestionnaireNotes('')
      charger(pagination.page)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Erreur lors de la livraison')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (res: Reservation) => {
    if (!confirm('Annuler cette réservation?')) return
    try {
      await stockService.cancelReservation(res.id_reservation)
      charger(pagination.page)
    } catch (error) {
      alert('Erreur lors de l\'annulation')
    }
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.total_pages) {
      charger(page)
    }
  }

  const stats = {
    enAttente: pagination.data.filter(r => r.statut === 'EN_ATTENTE').length,
    validees: pagination.data.filter(r => r.statut === 'VALIDEE').length,
    livrees: pagination.data.filter(r => r.statut === 'LIVREE').length,
  }

  return (
    <div className="max-w-6xl mx-auto pb-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="text-[#003B7A]"/> Gestion des Réservations
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {pagination.total} réservation{pagination.total > 1 ? 's' : ''} au total
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock size={20} className="text-amber-600"/>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{stats.enAttente}</p>
              <p className="text-xs text-amber-600">En attente</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <CheckCircle size={20} className="text-blue-600"/>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.validees}</p>
              <p className="text-xs text-blue-600">Validées</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Truck size={20} className="text-green-600"/>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.livrees}</p>
              <p className="text-xs text-green-600">Livrées</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        {['EN_ATTENTE', 'VALIDEE', 'LIVREE', 'ANNULEE'].map(statut => (
          <button
            key={statut}
            onClick={() => setFilterStatut(statut)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filterStatut === statut 
                ? 'bg-[#003B7A] text-white' 
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {STATUT_CONFIG[statut].label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[#003B7A] w-8 h-8"/>
        </div>
      ) : pagination.data.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border">
          <Package size={40} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-500">Aucune réservation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagination.data.map(res => {
            const config = STATUT_CONFIG[res.statut] || STATUT_CONFIG.EN_ATTENTE
            const Icon = config.icon
            
            return (
              <div key={res.id_reservation} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}>
                      <Icon size={24} className={config.color}/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{res.designation}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 font-mono">{res.code_stock}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{res.quantite_demandee}</p>
                      <p className="text-xs text-gray-400">demandé(es)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{res.mecanicien_nom}</p>
                      <p className="text-xs text-gray-400">OT #{res.id_ot}</p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      {res.statut === 'EN_ATTENTE' && (
                        <>
                          <button
                            onClick={() => handleValidate(res)}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => handleCancel(res)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
                          >
                            Refuser
                          </button>
                        </>
                      )}
                      {res.statut === 'VALIDEE' && (
                        <button
                          onClick={() => {
                            setSelectedReservation(res)
                            setDeliveryQty(res.quantite_demandee)
                            setShowDeliveryModal(true)
                          }}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center gap-1"
                        >
                          <Truck size={14}/> Livrer
                        </button>
                      )}
                      {res.statut === 'LIVREE' && (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle size={16}/>
                          <span>Livré le {res.date_livraison?.split('T')[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {res.notes_mecanicien && (
                  <div className="mt-3 pt-3 border-t text-sm text-gray-500">
                    <span className="font-medium">Notes:</span> {res.notes_mecanicien}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
          >
            <ChevronLeft size={16}/>
          </button>
          <span className="px-4 py-1.5 text-sm text-gray-600">
            Page {pagination.page} sur {pagination.total_pages}
          </span>
          <button
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.total_pages}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
          >
            <ChevronRight size={16}/>
          </button>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Truck className="text-green-500"/> Livrer la pièce
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                    <Package size={24} className="text-green-600"/>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{selectedReservation.designation}</p>
                    <p className="text-sm font-mono text-gray-500">{selectedReservation.code_stock}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Quantité à livrer
                </label>
                <input 
                  type="number"
                  min="1"
                  max={selectedReservation.quantite_demandee}
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(Math.min(selectedReservation.quantite_demandee, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full border rounded-lg p-2 text-center font-semibold"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Demandé: {selectedReservation.quantite_demandee}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  value={gestionnaireNotes}
                  onChange={(e) => setGestionnaireNotes(e.target.value)}
                  rows={2}
                  placeholder="Observations..."
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>
            </div>

            <div className="border-t px-6 py-4 flex gap-3">
              <button 
                onClick={() => { setShowDeliveryModal(false); setSelectedReservation(null) }}
                className="flex-1 py-3 rounded-xl border text-gray-600 font-medium"
              >
                Annuler
              </button>
              <button 
                onClick={handleDelivery}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: '#00A651' }}
              >
                {submitting ? <Loader2 className="animate-spin w-5 h-5"/> : <>Confirmer livraison</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}