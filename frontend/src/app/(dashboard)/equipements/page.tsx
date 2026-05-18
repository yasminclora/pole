'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { equipementsService } from '@/services/equipementsService'
import { zonesService } from '@/services/zonesService'
import {
  Loader2, Plus, Search, ChevronRight, ChevronLeft,
  Factory, Settings, Calendar, Layers,
  LayoutGrid, List, Filter, Activity,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────

interface Machine {
  id_equipement  : number
  equipment_code : string
  description    : string
  hierarchy_level: number
  nom_pole?      : string
  nom_zone?      : string
  install_date?  : string
  status         : string
  nb_enfants     : number
}

interface Zone {
  id_zone  : number
  code_zone: string
  nom_zone : string
}

interface PaginationData {
  data        : Machine[]
  total       : number
  page        : number
  limit       : number
  total_pages : number
}

// ─── Composant carte grille ───────────────────────────────────────────

function MachineCard({ machine, onClick }: { machine: Machine; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="relative bg-white dark:bg-gray-900
                 border border-gray-200 dark:border-gray-800
                 rounded-2xl overflow-hidden cursor-pointer
                 hover:border-blue-300 dark:hover:border-blue-700
                 hover:shadow-md transition-all group"
    >
      {/* barre bleue en haut */}
      <div className="h-1 w-full bg-blue-500" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20
                          flex items-center justify-center flex-shrink-0">
            <Factory size={17} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* Code */}
        <p className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
          {machine.equipment_code}
        </p>

        {/* Description */}
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-4 line-clamp-2 leading-snug">
          {machine.description}
        </p>

        {/* Méta */}
        <div className="space-y-1.5">
          {machine.nom_pole && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Settings size={11} />
              {machine.nom_pole}
            </div>
          )}
          {machine.nom_zone && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Filter size={11} />
              {machine.nom_zone}
            </div>
          )}
          {machine.install_date && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Calendar size={11} />
              {new Date(machine.install_date).toLocaleDateString('fr-FR')}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Layers size={11} />
            {machine.nb_enfants} sous-système{machine.nb_enfants !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end mt-4 pt-3
                        border-t border-gray-100 dark:border-gray-800">
          <ChevronRight
            size={15}
            className="text-gray-300 group-hover:text-blue-500 transition-colors"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Composant ligne liste ────────────────────────────────────────────

function MachineRow({ machine, onClick }: { machine: Machine; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-900
                 border border-gray-200 dark:border-gray-800
                 border-l-2 border-l-blue-500
                 rounded-xl p-4 cursor-pointer flex items-center gap-4
                 hover:border-blue-300 dark:hover:border-blue-700
                 hover:shadow-sm transition-all group"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20
                      flex items-center justify-center flex-shrink-0">
        <Factory size={16} className="text-blue-600 dark:text-blue-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 mb-0.5">
          {machine.equipment_code}
        </p>
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {machine.description}
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {machine.nom_pole && (
            <span className="text-xs text-gray-400">{machine.nom_pole}</span>
          )}
          {machine.nom_zone && (
            <span className="text-xs text-gray-400">{machine.nom_zone}</span>
          )}
          <span className="text-xs text-gray-400">
            {machine.nb_enfants} sous-système{machine.nb_enfants !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <ChevronRight
        size={15}
        className="text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0"
      />
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────

export default function EquipementsPage() {
  const router   = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idPole   = Number(authUser?.id_pole)
  const isAdmin  = authUser?.role === 'ADMIN'

  const [pagination, setPagination] = useState<PaginationData>({
    data: [], total: 0, page: 1, limit: 12, total_pages: 0,
  })
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [view,         setView]         = useState<'grid' | 'list'>('grid')
  const [zones,        setZones]        = useState<Zone[]>([])
  const [selectedZone, setSelectedZone] = useState<number | ''>('')

  const charger = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const data = await equipementsService.listeMachines({
        id_pole: isAdmin ? undefined : idPole,
        id_zone: selectedZone || undefined,
        search : search || undefined,
        page,
        limit  : 12,
      })
      setPagination({
        data       : data.data        || [],
        total      : data.total       || 0,
        page       : data.page        || 1,
        limit      : data.limit       || 12,
        total_pages: data.total_pages || 0,
      })
    } finally { setLoading(false) }
  }, [isAdmin, idPole, selectedZone, search])

  useEffect(() => {
    if (isAdmin) {
      zonesService.lister().then(setZones).catch(() => setZones([]))
    }
    charger(1)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    charger(1)
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.total_pages) charger(page)
  }

  return (
    <div className="space-y-5">

      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Équipements
          </h1>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-0.5">
            {pagination.total} machine{pagination.total !== 1 ? 's' : ''} au total
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle vue */}
          <div className="flex items-center bg-white dark:bg-gray-900
                          border border-gray-200 dark:border-gray-700
                          rounded-xl p-1 gap-1">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded-lg transition-all ${
                view === 'grid'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-all ${
                view === 'list'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <List size={15} />
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => router.push('/equipements/ajouter')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl
                         bg-blue-600 hover:bg-blue-700 text-white text-sm
                         font-medium transition-all"
            >
              <Plus size={15} /> Nouvelle machine
            </button>
          )}
        </div>
      </div>

      {/* ── Carte stat Total uniquement ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200
                      dark:border-gray-800 rounded-xl p-4 w-fit">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <Activity size={14} />
          </div>
          <span className="text-xs text-gray-400">Total machines</span>
        </div>
        <p className="text-2xl font-semibold text-gray-900 dark:text-white">
          {pagination.total}
        </p>
      </div>

      {/* ── Filtres (sans statut) ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par code ou description…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border
                         border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-900
                         text-gray-900 dark:text-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        {isAdmin && zones.length > 0 && (
          <select
            value={selectedZone}
            onChange={e => {
              setSelectedZone(e.target.value === '' ? '' : Number(e.target.value))
              setTimeout(() => charger(1), 100)
            }}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les zones</option>
            {zones.map(z => (
              <option key={z.id_zone} value={z.id_zone}>{z.nom_zone}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="text-blue-500 animate-spin" />
        </div>
      ) : pagination.data.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-800 rounded-2xl">
          <Factory size={36} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
            Aucune machine trouvée
          </p>
          {isAdmin && (
            <button
              onClick={() => router.push('/equipements/ajouter')}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                         text-white text-sm font-medium transition-all"
            >
              Ajouter une machine
            </button>
          )}
        </div>
      ) : (
        <>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagination.data.map(m => (
                <MachineCard
                  key={m.id_equipement}
                  machine={m}
                  onClick={() => router.push(`/equipements/${m.id_equipement}`)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {pagination.data.map(m => (
                <MachineRow
                  key={m.id_equipement}
                  machine={m}
                  onClick={() => router.push(`/equipements/${m.id_equipement}`)}
                />
              ))}
            </div>
          )}

          {/* ── Pagination ── */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-900
                           hover:bg-gray-50 dark:hover:bg-gray-800
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={15} />
              </button>

              {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                let pageNum: number
                if (pagination.total_pages <= 5)        pageNum = i + 1
                else if (pagination.page <= 3)          pageNum = i + 1
                else if (pagination.page >= pagination.total_pages - 2)
                  pageNum = pagination.total_pages - 4 + i
                else pageNum = pagination.page - 2 + i

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                      pagination.page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-900
                           hover:bg-gray-50 dark:hover:bg-gray-800
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={15} />
              </button>

              <span className="text-xs text-gray-400 ml-2">
                Page {pagination.page} sur {pagination.total_pages}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}