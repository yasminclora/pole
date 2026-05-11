'use client'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { equipesService } from '@/services/equipesService'
import { polesService   } from '@/services/polesService'
import { useWebSocket   } from '@/hooks/useWebSocket'
import {
  getQuartInfo, getSemaine, getMois,
  getLundiSemaine, JOURS_COURTS, MOIS_COURTS, QUART_MAP
} from '@/utils/planning'
import {
  ChevronLeft, ChevronRight, Loader2,
  Calendar, Search, Download
} from 'lucide-react'

interface Equipe {
  id_equipe               : number
  nom_equipe              : string
  id_pole                 : number
  date_reference_cycle    : string | null
  position_initiale_cycle : number
}

interface Pole { id_pole: number; nom_pole: string }

export default function PlanningPage() {
  const authUser     = useSelector((s: RootState) => s.auth.user)
  const isAdmin      = authUser?.role === 'ADMIN'
  const idPoleUser   = Number(authUser?.id_pole)
  const idEquipeUser = Number(authUser?.id_equipe)

  const [equipes,    setEquipes]    = useState<Equipe[]>([])
  const [poles,      setPoles]      = useState<Pole[]>([])
  const [loading,    setLoading]    = useState(true)
  const [vue,        setVue]        = useState<'semaine' | 'mois'>('semaine')
  const [recherche,  setRecherche]  = useState('')
  const [filtrePole, setFiltrePole] = useState('')
  const [dateRef,    setDateRef]    = useState(new Date())

  const charger = async () => {
    setLoading(true)
    try {
      if (isAdmin) {
        const [eqs, ps] = await Promise.all([
          equipesService.lister(),
          polesService.lister(),
        ])
        setEquipes(eqs)
        setPoles(ps)
      } else {
        const eqs = await equipesService.parPole(idPoleUser)
        setEquipes(eqs)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  useWebSocket((msg) => {
    // Mise à jour config → recalcul automatique sur toutes les pages
    if (msg.type === 'CONFIG_PLANNING_MISE_A_JOUR') {
      if (msg.payload?.equipes) {
        setEquipes(prev => prev.map(eq => {
          const updated = msg.payload.equipes.find(
            (e: any) => e.id_equipe === eq.id_equipe
          )
          return updated ? {
            ...eq,
            date_reference_cycle    : updated.date_reference_cycle,
            position_initiale_cycle : updated.position_initiale_cycle,
          } : eq
        }))
      }
    }
    // Échange accepté → recalcul
    if (msg.type === 'DEMANDE_ECHANGE_ACCEPTEE') {
      charger()
    }
  })

  const naviguer = (sens: number) => {
    const d = new Date(dateRef)
    if (vue === 'semaine') d.setDate(d.getDate() + sens * 7)
    else d.setMonth(d.getMonth() + sens)
    setDateRef(d)
  }

  const allerAujourdhui = () => setDateRef(new Date())

  const joursSemaine = getSemaine(getLundiSemaine(dateRef))
  const joursMois    = getMois(dateRef.getFullYear(), dateRef.getMonth())

  const equipesFiltrees = equipes.filter(eq => {
    const matchPole      = !filtrePole || String(eq.id_pole) === filtrePole
    const matchRecherche = !recherche  ||
      eq.nom_equipe.toLowerCase().includes(recherche.toLowerCase())
    return matchPole && matchRecherche
  })

  const titrePeriode = () => {
    if (vue === 'semaine') {
      const debut = joursSemaine[0]
      const fin   = joursSemaine[6]
      if (debut.getMonth() === fin.getMonth()) {
        return `${debut.getDate()} – ${fin.getDate()} ${MOIS_COURTS[fin.getMonth()]} ${fin.getFullYear()}`
      }
      return `${debut.getDate()} ${MOIS_COURTS[debut.getMonth()]} – ${fin.getDate()} ${MOIS_COURTS[fin.getMonth()]} ${fin.getFullYear()}`
    }
    return `${MOIS_COURTS[dateRef.getMonth()]} ${dateRef.getFullYear()}`
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const estAujourdhui = (d: Date) => {
    const dd = new Date(d); dd.setHours(0, 0, 0, 0)
    return dd.getTime() === today.getTime()
  }

  const buildConfig = (eq: Equipe) =>
    eq.date_reference_cycle
      ? { date_debut: eq.date_reference_cycle, position_alpha: eq.position_initiale_cycle }
      : null

  const exportCSV = () => {
    const jours = vue === 'semaine' ? joursSemaine : joursMois
    const headers = [
      'Équipe',
      ...jours.map(d =>
        `${JOURS_COURTS[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${d.getDate()}/${d.getMonth() + 1}`
      )
    ]
    const rows = equipesFiltrees.map(eq => {
      const config = buildConfig(eq)
      return [
        eq.nom_equipe,
        ...jours.map(d => getQuartInfo(config, eq, d, [], equipes).label)
      ]
    })
    const csv  = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `planning_${vue}_${dateRef.toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="text-blue-500 animate-spin"/>
    </div>
  )

  const CelluleQuart = ({ eq, date, compact = false }: {
    eq: Equipe; date: Date; compact?: boolean
  }) => {
    const config  = buildConfig(eq)
    const info    = getQuartInfo(config, eq, date, [], equipes)
    const isToday = estAujourdhui(date)
    return (
      <div className={`flex flex-col items-center justify-center rounded-lg
                       border transition-all
                       ${compact ? 'p-1 min-h-[40px]' : 'p-2 min-h-[56px]'}
                       ${info.bg} ${info.border}
                       ${isToday
                         ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-900'
                         : ''
                       }`}>
        <span className={`font-bold ${compact ? 'text-xs' : 'text-sm'} ${info.couleur}`}>
          {info.lettre}
        </span>
        {!compact && (
          <span className={`text-[10px] ${info.couleur} opacity-70`}>
            {info.icone}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center
                      justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600
                          flex items-center justify-center">
            <Calendar size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Calendrier équipes
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
              {isAdmin ? 'Vue globale' : 'Votre pôle'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border
                       border-gray-200 dark:border-gray-700
                       text-gray-600 dark:text-gray-400 text-sm
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            <Download size={14}/>
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            {(['semaine', 'mois'] as const).map(v => (
              <button key={v} onClick={() => setVue(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium
                            transition-all ${
                  vue === v
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filtres + navigation */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher une équipe..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border
                       border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900
                       text-gray-900 dark:text-white text-sm
                       placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>

        {isAdmin && (
          <select value={filtrePole}
            onChange={e => setFiltrePole(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tous les pôles</option>
            {poles.map(p => (
              <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2">
          <button onClick={() => naviguer(-1)}
            className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700
                       flex items-center justify-center text-gray-500
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <ChevronLeft size={16}/>
          </button>
          <button onClick={allerAujourdhui}
            className="px-3 py-1.5 rounded-lg border border-gray-200
                       dark:border-gray-700 text-gray-700 dark:text-gray-300
                       text-sm font-medium hover:bg-gray-100
                       dark:hover:bg-gray-800 transition-all whitespace-nowrap">
            {titrePeriode()}
          </button>
          <button onClick={() => naviguer(1)}
            className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700
                       flex items-center justify-center text-gray-500
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            <ChevronRight size={16}/>
          </button>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-2">
        {Object.values(QUART_MAP).map(q => (
          <span key={q.lettre}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1
                       rounded-lg text-xs font-medium border
                       ${q.bg} ${q.couleur} ${q.border}`}>
            {q.icone} {q.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1
                         rounded-lg text-xs font-medium border
                         bg-blue-50 dark:bg-blue-900/20
                         text-blue-600 dark:text-blue-400
                         border-blue-200 dark:border-blue-800">
          ◉ Aujourd'hui
        </span>
      </div>

      {/* VUE SEMAINE */}
      {vue === 'semaine' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b
                                border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold
                                 text-gray-500 dark:text-gray-400 uppercase
                                 tracking-wider w-36">
                    Équipe
                  </th>
                  {joursSemaine.map((d, i) => (
                    <th key={i}
                      className={`px-2 py-3 text-center text-xs font-semibold
                                 uppercase tracking-wider ${
                        estAujourdhui(d)
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                      <div>{JOURS_COURTS[i]}</div>
                      <div className={`text-base font-bold mt-0.5 ${
                        estAujourdhui(d)
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {d.getDate()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {equipesFiltrees.map(eq => {
                  const estMonEquipe = idEquipeUser === eq.id_equipe
                  return (
                    <tr key={eq.id_equipe}
                      className={`transition-colors ${
                        estMonEquipe
                          ? 'bg-blue-50/50 dark:bg-blue-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {estMonEquipe && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"/>
                          )}
                          <div>
                            <p className={`text-sm font-medium ${
                              estMonEquipe
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {eq.nom_equipe}
                            </p>
                            {isAdmin && (
                              <p className="text-xs text-gray-400">
                                {poles.find(p => p.id_pole === eq.id_pole)?.nom_pole}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {joursSemaine.map((d, i) => (
                        <td key={i} className="px-1 py-2">
                          <CelluleQuart eq={eq} date={d}/>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800
                          bg-gray-50 dark:bg-gray-800/30 text-xs text-gray-400
                          flex items-center justify-between">
            <span>
              {equipesFiltrees.length} équipe{equipesFiltrees.length > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              Temps réel actif
            </span>
          </div>
        </div>
      )}

      {/* VUE MOIS */}
      {vue === 'mois' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full"
              style={{ minWidth: `${joursMois.length * 36 + 160}px` }}>
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b
                                border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold
                                 text-gray-500 dark:text-gray-400 uppercase
                                 tracking-wider sticky left-0 w-36
                                 bg-gray-50 dark:bg-gray-800/50 z-10">
                    Équipe
                  </th>
                  {joursMois.map((d, i) => (
                    <th key={i}
                      className={`py-3 text-center text-xs font-semibold
                                 uppercase tracking-wider min-w-[32px] ${
                        estAujourdhui(d)
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                      <div className="text-[10px]">
                        {JOURS_COURTS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                      </div>
                      <div className={`font-bold ${
                        estAujourdhui(d)
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {d.getDate()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {equipesFiltrees.map(eq => {
                  const estMonEquipe = idEquipeUser === eq.id_equipe
                  return (
                    <tr key={eq.id_equipe}
                      className={estMonEquipe
                        ? 'bg-blue-50/50 dark:bg-blue-900/10'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                      }>
                      <td className="px-4 py-2 sticky left-0
                                     bg-white dark:bg-gray-900 z-10">
                        <div className="flex items-center gap-1.5">
                          {estMonEquipe && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                          )}
                          <div>
                            <p className={`text-sm font-medium whitespace-nowrap ${
                              estMonEquipe
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {eq.nom_equipe}
                            </p>
                            {isAdmin && (
                              <p className="text-xs text-gray-400 whitespace-nowrap">
                                {poles.find(p => p.id_pole === eq.id_pole)?.nom_pole}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {joursMois.map((d, i) => (
                        <td key={i} className="px-0.5 py-1">
                          <CelluleQuart eq={eq} date={d} compact/>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800
                          bg-gray-50 dark:bg-gray-800/30 text-xs text-gray-400
                          flex items-center justify-between">
            <span>
              {joursMois.length} jours · {equipesFiltrees.length} équipe{equipesFiltrees.length > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              Temps réel actif
            </span>
          </div>
        </div>
      )}

      {equipesFiltrees.length === 0 && !loading && (
        <div className="text-center py-16 bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-800 rounded-2xl">
          <Calendar size={36}
            className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-500 dark:text-gray-400">Aucune équipe trouvée</p>
        </div>
      )}
    </div>
  )
}