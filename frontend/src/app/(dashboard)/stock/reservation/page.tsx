'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { stockService } from '@/services/stockService'
import {
  Loader2, Package, CheckCircle, XCircle, Clock,
  Truck, Search, ChevronRight, ChevronLeft,
  Filter, User, Calendar, MapPin, Wrench, AlertCircle, ListChecks,
} from 'lucide-react'

interface Demandeur {
  id_user     : number
  nom         : string
  prenom      : string
  nom_complet : string
  email      ?: string
  telephone  ?: string
  role       ?: string
  nom_equipe ?: string
  nom_pole   ?: string
  initiales  ?: string
}

interface Reservation {
  id_reservation        : number
  id_piece              : number
  code_stock            : string
  designation           : string
  description          ?: string
  quantite_stock       ?: number
  emplacement          ?: string
  quantite_demandee     : number
  quantite_livree       : number | null
  statut                : string
  notes_mecanicien      : string | null
  notes_gestionnaire    : string | null
  date_demande          : string
  date_validation       : string | null
  date_livraison        : string | null
  date_prevue           : string | null
  id_ot                 : number
  numero_ot             : string
  ot_statut            ?: string
  ot_priorite          ?: string
  id_mecanicien         : number
  mecanicien_nom       ?: string
  mecanicien_role      ?: string
  demandeur            ?: Demandeur
  equipement_code      ?: string
  equipement_description?: string
  machine_racine_code  ?: string
  nom_zone             ?: string
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  EN_ATTENTE: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200', icon: Clock },
  VALIDEE   : { label: 'Validée',    color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200',  icon: CheckCircle },
  LIVREE    : { label: 'Livrée',     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Truck },
  ANNULEE   : { label: 'Annulée',    color: 'text-gray-600',  bg: 'bg-gray-100',  border: 'border-gray-200',  icon: XCircle },
}

const PRIORITE_COLOR: Record<string, string> = {
  CRITIQUE: 'text-red-700 bg-red-50 border-red-200',
  HAUTE   : 'text-orange-700 bg-orange-50 border-orange-200',
  NORMALE : 'text-blue-700 bg-blue-50 border-blue-200',
  FAIBLE  : 'text-gray-700 bg-gray-100 border-gray-200',
}

interface PaginationData {
  data        : Reservation[]
  total       : number
  page        : number
  limit       : number
  total_pages : number
}

export default function StockReservationPage() {
  const authUser = useSelector((s: RootState) => s.auth.user)

  const [pagination, setPagination] = useState<PaginationData>({
    data: [], total: 0, page: 1, limit: 10, total_pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState<string>('EN_ATTENTE')   // ← sélecteur par défaut
  const [search, setSearch] = useState('')

  // Modal détail
  const [detailRes, setDetailRes] = useState<Reservation | null>(null)

  // Modal livraison
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [deliveryQty, setDeliveryQty] = useState(1)
  const [gestionnaireNotes, setGestionnaireNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Modal refus
  const [refusRes, setRefusRes] = useState<Reservation | null>(null)
  const [motifRefus, setMotifRefus] = useState('')

  const charger = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const data = await stockService.listReservations({
        page,
        limit: 10,
        statut: filterStatut === 'TOUS' ? undefined : filterStatut || undefined,
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

  useEffect(() => { charger(1) }, [charger])

  const handleValidate = async (res: Reservation) => {
    if (!authUser?.id_user) return
    if (!confirm(`Valider la réservation de ${res.designation} demandée par ${res.demandeur?.nom_complet ?? res.mecanicien_nom} ?`)) return
    try {
      await stockService.validateReservation(res.id_reservation, {
        id_gestionnaire: authUser.id_user,
        notes_gestionnaire: ''
      })
      charger(pagination.page)
    } catch {
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

  const handleCancel = async () => {
    if (!refusRes) return
    try {
      await stockService.cancelReservation(refusRes.id_reservation)
      setRefusRes(null)
      setMotifRefus('')
      charger(pagination.page)
    } catch {
      alert("Erreur lors de l'annulation")
    }
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.total_pages) charger(page)
  }

  // Stats globales (sur la page courante seulement, simple)
  const stats = {
    enAttente : pagination.data.filter(r => r.statut === 'EN_ATTENTE').length,
    validees  : pagination.data.filter(r => r.statut === 'VALIDEE').length,
    livrees   : pagination.data.filter(r => r.statut === 'LIVREE').length,
  }

  // Filtrage côté client par recherche
  const filteredList = pagination.data.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.designation?.toLowerCase().includes(q) ||
      r.code_stock?.toLowerCase().includes(q) ||
      r.numero_ot?.toLowerCase().includes(q) ||
      r.demandeur?.nom_complet?.toLowerCase().includes(q) ||
      r.mecanicien_nom?.toLowerCase().includes(q) ||
      r.equipement_code?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-7xl mx-auto pb-8 px-4">

      {/* ─── Header gradient ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-6 text-white shadow-lg mb-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Package size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gestion des réservations</h1>
              <p className="text-blue-200 text-sm mt-0.5">
                {pagination.total} réservation{pagination.total > 1 ? 's' : ''} au total
                {filterStatut !== 'TOUS' && filterStatut !== '' && ` · filtrées sur "${STATUT_CONFIG[filterStatut]?.label ?? filterStatut}"`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stats cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="En attente" value={stats.enAttente} icon={Clock}      color="amber"  />
        <StatCard label="Validées"   value={stats.validees}  icon={CheckCircle} color="blue"   />
        <StatCard label="Livrées"    value={stats.livrees}   icon={Truck}       color="emerald"/>
      </div>

      {/* ─── Barre de filtres ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Filter size={16} /> Filtres
          </div>

          {/* Sélecteur statut (un seul à la fois) */}
          <div className="relative">
            <select
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003B7A]/30 cursor-pointer"
            >
              <option value="TOUS">Tous les statuts</option>
              <option value="EN_ATTENTE">⏳ En attente</option>
              <option value="VALIDEE">✓ Validées</option>
              <option value="LIVREE">📦 Livrées</option>
              <option value="ANNULEE">✗ Annulées</option>
            </select>
            <ListChecks size={15} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
            <ChevronRight size={14} className="absolute right-2 top-3 text-gray-400 rotate-90 pointer-events-none" />
          </div>

          {/* Recherche */}
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher (code, pièce, OT, demandeur...)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003B7A]/30"
            />
          </div>
        </div>
      </div>

      {/* ─── Liste ─── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[#003B7A] w-8 h-8" />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <Package size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune réservation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map(res => (
            <ReservationCard
              key={res.id_reservation}
              res={res}
              onDetail={() => setDetailRes(res)}
              onValidate={() => handleValidate(res)}
              onAskRefus={() => { setRefusRes(res); setMotifRefus('') }}
              onLivrer={() => {
                setSelectedReservation(res)
                setDeliveryQty(res.quantite_demandee)
                setShowDeliveryModal(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-50">
            <ChevronLeft size={16} />
          </button>
          <span className="px-4 py-1.5 text-sm text-gray-600">
            Page {pagination.page} / {pagination.total_pages}
          </span>
          <button onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.total_pages}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-50">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ─── Modal détail ─── */}
      {detailRes && (
        <DetailModal res={detailRes} onClose={() => setDetailRes(null)} />
      )}

      {/* ─── Modal livraison ─── */}
      {showDeliveryModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Truck className="text-emerald-500" /> Livrer la pièce
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Package size={24} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{selectedReservation.designation}</p>
                  <p className="text-sm font-mono text-gray-500">{selectedReservation.code_stock}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Quantité à livrer</label>
                <input type="number" min="1" max={selectedReservation.quantite_demandee} value={deliveryQty}
                  onChange={e => setDeliveryQty(Math.min(selectedReservation.quantite_demandee, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full border border-gray-200 rounded-lg p-2 text-center font-semibold" />
                <p className="text-xs text-gray-400 mt-1">Demandé : {selectedReservation.quantite_demandee}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Notes (optionnel)</label>
                <textarea value={gestionnaireNotes} onChange={e => setGestionnaireNotes(e.target.value)} rows={2}
                  placeholder="Observations..." className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div className="border-t px-6 py-4 flex gap-3">
              <button onClick={() => { setShowDeliveryModal(false); setSelectedReservation(null) }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium">Annuler</button>
              <button onClick={handleDelivery} disabled={submitting}
                className="flex-1 py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : 'Confirmer livraison'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal refus ─── */}
      {refusRes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <XCircle className="text-red-500" /> Refuser la réservation
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Vous êtes sur le point de refuser la réservation de <strong>{refusRes.designation}</strong> demandée par <strong>{refusRes.demandeur?.nom_complet ?? refusRes.mecanicien_nom}</strong>.
              </p>
              <textarea value={motifRefus} onChange={e => setMotifRefus(e.target.value)} rows={3}
                placeholder="Motif du refus (optionnel)..." className="w-full border border-gray-200 rounded-lg p-2 text-sm" />
            </div>
            <div className="border-t px-6 py-4 flex gap-3">
              <button onClick={() => { setRefusRes(null); setMotifRefus('') }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium">Annuler</button>
              <button onClick={handleCancel}
                className="flex-1 py-3 rounded-xl text-white font-medium bg-red-600 hover:bg-red-700">
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// Sous-composants
// ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: 'amber' | 'blue' | 'emerald' }) {
  const map = {
    amber  : { from: 'from-amber-50',   to: 'to-amber-100',   border: 'border-amber-200',   txt: 'text-amber-700',   icon: 'text-amber-600',   bg: 'bg-amber-500/20'   },
    blue   : { from: 'from-blue-50',    to: 'to-blue-100',    border: 'border-blue-200',    txt: 'text-blue-700',    icon: 'text-blue-600',    bg: 'bg-blue-500/20'    },
    emerald: { from: 'from-emerald-50', to: 'to-emerald-100', border: 'border-emerald-200', txt: 'text-emerald-700', icon: 'text-emerald-600', bg: 'bg-emerald-500/20' },
  }[color]
  return (
    <div className={`bg-gradient-to-br ${map.from} ${map.to} rounded-2xl p-4 border ${map.border}`}>
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl ${map.bg} flex items-center justify-center`}>
          <Icon size={22} className={map.icon} />
        </div>
        <div>
          <p className={`text-3xl font-bold ${map.txt}`}>{value}</p>
          <p className={`text-xs ${map.txt} opacity-80`}>{label}</p>
        </div>
      </div>
    </div>
  )
}

function ReservationCard({
  res, onDetail, onValidate, onAskRefus, onLivrer,
}: {
  res         : Reservation
  onDetail    : () => void
  onValidate  : () => void
  onAskRefus  : () => void
  onLivrer    : () => void
}) {
  const config = STATUT_CONFIG[res.statut] || STATUT_CONFIG.EN_ATTENTE
  const Icon   = config.icon
  const initiales = res.demandeur?.initiales || ((res.mecanicien_nom ?? '?').slice(0, 2)).toUpperCase()

  // Peut-on livrer ? date_prevue de l'OT atteinte
  const now = new Date()
  const datePrevue = res.date_prevue ? new Date(res.date_prevue) : null
  const peutLivrer = !datePrevue || datePrevue <= now

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icône statut */}
          <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
            <Icon size={22} className={config.color} />
          </div>

          {/* Bloc principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{res.designation}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {res.code_stock}
                  {res.emplacement && <span className="ml-2 text-gray-400">· {res.emplacement}</span>}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} border ${config.border}`}>
                {config.label}
              </span>
            </div>

            {/* Demandeur */}
            <div className="mt-3 flex items-center gap-3 p-2.5 bg-gradient-to-r from-blue-50/60 to-transparent rounded-lg border border-blue-100/60">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#003B7A] to-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {initiales}
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-semibold text-gray-800 truncate">
                  {res.demandeur?.nom_complet ?? res.mecanicien_nom ?? '—'}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5 truncate">
                  <User size={11} />
                  {res.demandeur?.role ?? res.mecanicien_role ?? '—'}
                  {res.demandeur?.nom_equipe && <span>· équipe {res.demandeur.nom_equipe}</span>}
                  {res.demandeur?.nom_pole && <span>· {res.demandeur.nom_pole}</span>}
                </p>
              </div>
            </div>

            {/* Infos OT */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <span className="inline-flex items-center gap-1 text-gray-600">
                <Wrench size={12} className="text-[#003B7A]" /> {res.numero_ot || `#${res.id_ot}`}
              </span>
              {res.ot_priorite && (
                <span className={`px-2 py-0.5 rounded-full font-semibold border text-[10px] ${PRIORITE_COLOR[res.ot_priorite] || ''}`}>
                  {res.ot_priorite}
                </span>
              )}
              {res.equipement_code && (
                <span className="inline-flex items-center gap-1 text-gray-600 truncate">
                  <Package size={12} className="text-gray-400" /> {res.equipement_code}
                </span>
              )}
              {res.nom_zone && (
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <MapPin size={12} /> {res.nom_zone}
                </span>
              )}
              {res.date_prevue && (
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <Calendar size={12} />
                  {new Date(res.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-semibold">
                ×{res.quantite_demandee}
              </span>
            </div>

            {/* Notes */}
            {res.notes_mecanicien && (
              <div className="mt-3 px-3 py-2 bg-amber-50/60 border border-amber-100 rounded-lg text-xs text-amber-900">
                <strong>Notes : </strong>{res.notes_mecanicien}
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={onDetail}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition">
                Détails
              </button>

              {res.statut === 'EN_ATTENTE' && (
                <>
                  <button onClick={onValidate}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1">
                    <CheckCircle size={13} /> Valider
                  </button>
                  <button onClick={onAskRefus}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                    <XCircle size={13} /> Refuser
                  </button>
                </>
              )}

              {res.statut === 'VALIDEE' && (
                peutLivrer ? (
                  <button onClick={onLivrer}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1">
                    <Truck size={13} /> Livrer
                  </button>
                ) : (
                  <div className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium flex items-center gap-1">
                    <AlertCircle size={13} />
                    Livraison possible à partir du {datePrevue!.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )
              )}

              {res.statut === 'LIVREE' && (
                <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                  <CheckCircle size={14} /> Livrée le {res.date_livraison?.split('T')[0]}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailModal({ res, onClose }: { res: Reservation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Package className="text-[#003B7A]" /> Détail de la réservation
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <XCircle size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <Section title="Pièce">
            <Field label="Désignation" value={res.designation} />
            <Field label="Code stock" value={res.code_stock} mono />
            {res.description && <Field label="Description" value={res.description} />}
            {res.emplacement && <Field label="Emplacement" value={res.emplacement} />}
            <Field label="Stock disponible" value={String(res.quantite_stock ?? '—')} />
          </Section>

          {res.demandeur && (
            <Section title="Demandeur">
              <Field label="Nom" value={res.demandeur.nom_complet} />
              <Field label="Rôle" value={res.demandeur.role ?? '—'} />
              {res.demandeur.nom_equipe && <Field label="Équipe" value={res.demandeur.nom_equipe} />}
              {res.demandeur.nom_pole && <Field label="Pôle" value={res.demandeur.nom_pole} />}
              {res.demandeur.email && <Field label="Email" value={res.demandeur.email} />}
              {res.demandeur.telephone && <Field label="Téléphone" value={res.demandeur.telephone} />}
            </Section>
          )}

          <Section title="Ordre de travail">
            <Field label="Numéro OT" value={res.numero_ot || `#${res.id_ot}`} />
            {res.ot_statut && <Field label="Statut OT" value={res.ot_statut} />}
            {res.ot_priorite && <Field label="Priorité" value={res.ot_priorite} />}
            {res.equipement_code && <Field label="Équipement" value={`${res.equipement_code} — ${res.equipement_description ?? ''}`} />}
            {res.machine_racine_code && <Field label="Machine racine" value={res.machine_racine_code} />}
            {res.nom_zone && <Field label="Zone" value={res.nom_zone} />}
            {res.date_prevue && <Field label="Date prévue" value={new Date(res.date_prevue).toLocaleString('fr-FR')} />}
          </Section>

          <Section title="Réservation">
            <Field label="Quantité demandée" value={String(res.quantite_demandee)} />
            {res.quantite_livree != null && <Field label="Quantité livrée" value={String(res.quantite_livree)} />}
            <Field label="Statut" value={STATUT_CONFIG[res.statut]?.label ?? res.statut} />
            <Field label="Date demande" value={new Date(res.date_demande).toLocaleString('fr-FR')} />
            {res.date_validation && <Field label="Date validation" value={new Date(res.date_validation).toLocaleString('fr-FR')} />}
            {res.date_livraison && <Field label="Date livraison" value={new Date(res.date_livraison).toLocaleString('fr-FR')} />}
            {res.notes_mecanicien && <Field label="Notes mécanicien" value={res.notes_mecanicien} />}
            {res.notes_gestionnaire && <Field label="Notes gestionnaire" value={res.notes_gestionnaire} />}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 border border-gray-100">{children}</div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-gray-800 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
