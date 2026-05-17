'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import api from '@/services/axiosInstance'
import {
  Loader2, Package, Search, Plus, AlertOctagon, AlertTriangle,
  CheckCircle2, MapPin, Hash, ChevronRight, RefreshCw, Boxes,
} from 'lucide-react'

interface Piece {
  id_piece:    number
  code_stock:  string
  designation: string
  description?: string
  quantite:     number
  seuil_alerte: number
  emplacement?: string
  unite:        string
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
                      <div className="text-[10px] text-gray-500">{p.unite ?? 'pcs'} disponibles</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500">Seuil alerte</div>
                      <div className="text-sm font-semibold text-gray-700">{p.seuil_alerte}</div>
                    </div>
                  </div>
                </div>

                {p.emplacement && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
                    <MapPin size={11} />
                    <span className="truncate">{p.emplacement}</span>
                  </div>
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
