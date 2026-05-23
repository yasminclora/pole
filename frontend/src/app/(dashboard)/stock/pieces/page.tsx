'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import api from '@/services/axiosInstance'
import {
  Loader2, Package, Search, Plus, AlertOctagon, AlertTriangle,
  CheckCircle2, Hash, ChevronRight, RefreshCw, Boxes,
  PackagePlus, X, Save,
} from 'lucide-react'

interface Piece {
  id_piece:    number
  code_stock:  string
  designation: string
  quantite:     number
  seuil_alerte: number
  composantes_liees?: { equipment_code: string; description: string; level: number }[]
}

interface Stats {
  nb_pieces_total:       number
  nb_absentes:           number
  nb_faibles:            number
  nb_ok:                 number
  qte_totale:            number
  nb_pieces_liees:       number
  nb_pieces_orphelines:  number
}

type FiltreAlerte = 'TOUS' | 'ABSENT' | 'FAIBLE' | 'OK'

function alerteFor(p: Piece): 'ABSENT' | 'FAIBLE' | 'OK' {
  if (p.quantite === 0)           return 'ABSENT'
  if (p.quantite <= p.seuil_alerte) return 'FAIBLE'
  return 'OK'
}

const ALERTE_CFG: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  ABSENT: { bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200',     label: 'Absent' },
  FAIBLE: { bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-200',  label: 'Faible' },
  OK:     { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'OK' },
}

export default function PiecesPage() {
  const router  = useRouter()
  const user    = useSelector((s: RootState) => s.auth.user)
  const canEdit = user?.role === 'ADMIN' || user?.role === 'GESTIONNAIRE_STOCK'

  const [pieces, setPieces]       = useState<Piece[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]       = useState('')
  const [filtre, setFiltre]       = useState<FiltreAlerte>('TOUS')
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]         = useState(0)

  // ── Modale d'ajustement de stock ─────────────────────────────────
  const [adjustingPiece, setAdjustingPiece] = useState<Piece | null>(null)
  const [adjustMode,     setAdjustMode]     = useState<'add' | 'set'>('add')
  const [adjustValue,    setAdjustValue]    = useState<number>(0)
  const [adjustSeuil,    setAdjustSeuil]    = useState<number>(2)
  const [saving,         setSaving]         = useState(false)
  const [adjustError,    setAdjustError]    = useState<string | null>(null)

  const openAdjust = (p: Piece) => {
    setAdjustingPiece(p)
    setAdjustMode('add')
    setAdjustValue(0)
    setAdjustSeuil(p.seuil_alerte)
    setAdjustError(null)
  }
  const closeAdjust = () => {
    if (saving) return
    setAdjustingPiece(null)
    setAdjustError(null)
  }
  const handleAdjust = async () => {
    if (!adjustingPiece) return
    setSaving(true); setAdjustError(null)
    try {
      const newQte = adjustMode === 'add'
        ? adjustingPiece.quantite + adjustValue
        : adjustValue
      if (newQte < 0) { setAdjustError('Quantité finale négative impossible'); setSaving(false); return }
      await api.put(`/stock/pieces/${adjustingPiece.id_piece}`, {
        quantite:     newQte,
        seuil_alerte: adjustSeuil,
      })
      closeAdjust()
      fetchPieces()
    } catch (err: any) {
      setAdjustError(err?.response?.data?.detail ?? 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const fetchPieces = useCallback(async () => {
    setLoading(true)
    try {
      const [piecesRes, statsRes] = await Promise.all([
        api.get('/stock/liste', { params: { page, limit: 20, search } }),
        api.get('/stock/stats/global'),
      ])
      setPieces(piecesRes.data.data || [])
      setTotalPages(piecesRes.data.total_pages || 1)
      setTotal(piecesRes.data.total || 0)
      setStats(statsRes.data || null)
    } catch (err) {
      console.error('Erreur:', err)
      setPieces([])
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchPieces() }, [fetchPieces])

  const handleSearch = () => { setSearch(searchInput); setPage(1) }

  const piecesFiltrees = pieces.filter(p => filtre === 'TOUS' || alerteFor(p) === filtre)

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock pièces de rechange</h1>
            <p className="text-sm text-gray-500">
              {total} pièce(s) référencée(s)
              {stats && ` · ${stats.qte_totale} unités totales`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchPieces} disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm transition">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          {canEdit && (
            <button onClick={() => router.push('/stock/pieces/nouveau')}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow text-sm transition">
              <Plus size={15} />
              Nouvelle pièce
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={<Boxes className="w-4 h-4" />} label="Pièces référencées"
                   value={stats.nb_pieces_total} color="text-blue-600" bg="bg-blue-50"
                   onClick={() => setFiltre('TOUS')} active={filtre === 'TOUS'} />
          <KpiCard icon={<AlertOctagon className="w-4 h-4" />} label="Absent"
                   value={stats.nb_absentes} color="text-red-600" bg="bg-red-50"
                   onClick={() => setFiltre('ABSENT')} active={filtre === 'ABSENT'} />
          <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Faible"
                   value={stats.nb_faibles} color="text-orange-600" bg="bg-orange-50"
                   onClick={() => setFiltre('FAIBLE')} active={filtre === 'FAIBLE'} />
          <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Disponibles"
                   value={stats.nb_ok} color="text-emerald-600" bg="bg-emerald-50"
                   onClick={() => setFiltre('OK')} active={filtre === 'OK'} />
        </div>
      )}

      {/* Toolbar : recherche + filtre */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher par code (STK-…) ou désignation…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button onClick={handleSearch}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800">
          Rechercher
        </button>
        {search && (
          <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
                  className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-900">
            ✕ Effacer
          </button>
        )}
      </div>

      {/* Liste / Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
        </div>
      ) : piecesFiltrees.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
          <Package size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-3">Aucune pièce trouvée</p>
          {canEdit && (
            <button onClick={() => router.push('/stock/pieces/nouveau')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              <Plus size={14} /> Ajouter une pièce
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {piecesFiltrees.map(p => {
            const al = alerteFor(p)
            const cfg = ALERTE_CFG[al]
            return (
              <div key={p.id_piece}
                   onClick={() => router.push(`/stock/pieces/${encodeURIComponent(p.code_stock)}`)}
                   className={`bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition group ${cfg.ring} ring-1 ring-transparent hover:${cfg.ring}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Hash size={11} className="text-gray-400" />
                      <span className="font-mono font-bold text-gray-900 text-sm truncate">{p.code_stock}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mt-1 line-clamp-2">{p.designation}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className={`mt-3 p-2.5 rounded-lg ${cfg.bg}`}>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className={`text-2xl font-bold tabular-nums ${cfg.text}`}>{p.quantite}</div>
                      <div className="text-[10px] text-gray-500">unités disponibles</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500">Seuil alerte</div>
                      <div className="text-sm font-semibold text-gray-700">{p.seuil_alerte}</div>
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openAdjust(p) }}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg
                               border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold
                               hover:bg-blue-100 hover:border-blue-300 transition"
                  >
                    <PackagePlus size={13}/> Ajuster le stock
                  </button>
                )}

                {p.composantes_liees && p.composantes_liees.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="text-[10px] text-gray-400 mb-1">
                      {p.composantes_liees.length} équipement(s) lié(s)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.composantes_liees.slice(0, 3).map((c, i) => (
                        <span key={i} className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {c.equipment_code}
                        </span>
                      ))}
                      {p.composantes_liees.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{p.composantes_liees.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition">
                  Voir détail <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ Modale d'ajustement de stock ═══ */}
      {adjustingPiece && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={closeAdjust}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <PackagePlus size={20}/>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Ajustement de stock</p>
                  <h2 className="font-mono font-bold text-base truncate">{adjustingPiece.code_stock}</h2>
                  <p className="text-xs text-blue-100 truncate">{adjustingPiece.designation}</p>
                </div>
              </div>
              <button onClick={closeAdjust} disabled={saving}
                      className="p-2 rounded-lg hover:bg-white/15 transition disabled:opacity-50">
                <X size={16}/>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* État actuel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quantité actuelle</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{adjustingPiece.quantite}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Seuil actuel</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{adjustingPiece.seuil_alerte}</p>
                </div>
              </div>

              {/* Mode */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Mode d'ajustement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAdjustMode('add')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition border ${
                      adjustMode === 'add'
                        ? 'bg-blue-600 text-white border-blue-600 shadow'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    ➕ Ajouter (livraison)
                  </button>
                  <button
                    onClick={() => setAdjustMode('set')}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition border ${
                      adjustMode === 'set'
                        ? 'bg-blue-600 text-white border-blue-600 shadow'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    🎯 Fixer (inventaire)
                  </button>
                </div>
              </div>

              {/* Valeur */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  {adjustMode === 'add' ? 'Quantité à ajouter' : 'Nouvelle quantité totale'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={adjustValue}
                  onChange={e => setAdjustValue(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-2xl font-bold text-center
                             focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  autoFocus
                />
                {adjustMode === 'add' && adjustValue > 0 && (
                  <p className="text-xs text-emerald-600 font-semibold mt-1.5 text-center">
                    → Nouvelle quantité : {adjustingPiece.quantite + adjustValue} unités
                  </p>
                )}
              </div>

              {/* Seuil */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Seuil d'alerte
                  <span className="text-[10px] text-slate-400 font-normal ml-1 normal-case">
                    (modifiable)
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={adjustSeuil}
                  onChange={e => setAdjustSeuil(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {adjustError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                  <AlertTriangle size={14}/> {adjustError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={closeAdjust} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleAdjust} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow disabled:opacity-50 transition"
              >
                {saving
                  ? <><Loader2 size={14} className="animate-spin"/> Mise à jour…</>
                  : <><Save size={14}/> Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">
            ← Précédent
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color, bg, onClick, active }: {
  icon: React.ReactNode; label: string; value: number; color: string; bg: string;
  onClick?: () => void; active?: boolean
}) {
  return (
    <button onClick={onClick}
            className={`text-left ${bg} border rounded-xl p-4 transition ${
              active ? `border-current ring-2 ring-current ring-opacity-20 ${color}` : 'border-gray-200 hover:shadow'
            }`}>
      <div className={`flex items-center gap-1.5 ${color} mb-2 text-xs uppercase font-semibold tracking-wider`}>
        {icon} {label}
      </div>
      <div className={`text-3xl font-bold ${color} tabular-nums leading-none`}>{value}</div>
    </button>
  )
}
