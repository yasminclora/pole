'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import api from '@/services/axiosInstance'
import {
  LayoutDashboard, Activity, AlertOctagon, ShieldCheck, Wallet,
  RefreshCw, Building2, Wrench, ChevronDown, Sparkles, Globe2,
  Factory, Layers, Calendar, Cog, X, Filter,
} from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
  PieChart, Pie,
} from 'recharts'

// ════════════════════════════════════════════════════════════════
// PALETTE — monochrome bleu + 2 accents corporate
// ════════════════════════════════════════════════════════════════
const BLUE       = '#003B7A'    // primaire CEVITAL
const BLUE_DARK  = '#001a3d'
const BLUE_LIGHT = '#DBEAFE'
const SLATE      = '#475569'
const SLATE_BG   = '#F1F5F9'

// Accents Correctif / Préventif (palette corporate sobre)
const CORR_COLOR = '#475569'    // Slate gray (CORR — imprévus) - ultra sobre
const CORR_BG    = '#F1F5F9'    // background très clair (slate-100)
const CORR_TEXT  = '#1E293B'    // texte foncé sur fond clair (slate-800)
const PREV_COLOR = '#0052CC'    // Bleu Royal (PREV — planifié)
const PREV_BG    = '#E0EAFF'    // background très clair
const PREV_TEXT  = '#1E3A8A'    // texte foncé sur fond clair

// Aliases legacy pour minimiser les modifs
const RED   = CORR_COLOR
const GREEN = PREV_COLOR

// Tons bleus pour le dégradé du rang dans les top barres (gardés)
const BLUE_TIERS = ['#003B7A', '#0a4d99', '#1166b8', '#1d7fd0', '#3b95dc', '#5fa9e4', '#82bdec', '#a3d1f0', '#c5e2f6', '#dceefa']

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════
interface Kpis {
  nb_composantes: number; nb_interventions: number
  nb_corr: number; nb_prev: number
  cout_total: number; cout_corr: number; cout_prev: number
}
interface EvolutionPoint {
  mois: string; corr: number; prev: number; total: number
  cout: number; cout_corr: number; cout_prev: number
}
interface ComposanteCritique {
  code: string; description: string; level: number; pole: string
  nb_interventions: number; nb_corr: number; nb_prev: number; cout: number
}
interface MachineCritique {
  machine: string; description: string; nb_interventions: number
  nb_corr: number; nb_prev: number; nb_composantes: number; cout: number
}
interface Repartition { corr: number; prev: number; pct_corr: number; pct_prev: number }

type NiveauFilter = 'tous' | 'machines' | 'composantes'
type PeriodKey   = 'tout' | 'annee' | 'trimestre' | 'mois'
const GLOBAL_KEY = '__GLOBAL__'

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════
const formatMonth = (m: string): string => {
  const [y, mo] = m.split('-')
  const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']
  return `${months[parseInt(mo) - 1]} ${y.slice(2)}`
}
const formatMoney = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} k`
  return n.toFixed(0)
}
const formatNumber = (n: number): string => n.toLocaleString('fr-FR')

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'tout',      label: 'Toute la période' },
  { key: 'annee',     label: 'Année 2023' },
  { key: 'trimestre', label: 'Trimestre Q4 2023' },
  { key: 'mois',      label: 'Mois Décembre 2023' },
]

function resolvePeriod(p: PeriodKey): { date_debut?: string; date_fin?: string } {
  if (p === 'mois')      return { date_debut: '2023-12-01', date_fin: '2023-12-31' }
  if (p === 'trimestre') return { date_debut: '2023-10-01', date_fin: '2023-12-31' }
  if (p === 'annee')     return { date_debut: '2023-01-01', date_fin: '2023-12-31' }
  return {}
}

// ════════════════════════════════════════════════════════════════
// Count-up
// ════════════════════════════════════════════════════════════════
function useCountUp(target: number, duration = 1400): number {
  const [val, setVal] = useState(0)
  const startVal = useRef(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const from = startVal.current
    const animate = (t: number) => {
      const p = Math.min((t - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      setVal(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(animate)
      else startVal.current = target
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

// ════════════════════════════════════════════════════════════════
// Tooltip standard
// ════════════════════════════════════════════════════════════════
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 px-3 py-2 min-w-[160px]">
      <p className="text-[11px] font-bold text-white mb-1.5 uppercase tracking-wider">{label}</p>
      {payload.map((p: any, idx: number) => (
        <div key={idx} className="flex items-center justify-between gap-3 text-xs py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }}/>
            <span className="text-slate-300">{p.name}</span>
          </span>
          <span className="font-bold text-white">{typeof p.value === 'number' ? p.value.toLocaleString('fr-FR') : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// KPI Card — toutes bleues, monochrome
// ════════════════════════════════════════════════════════════════
function KpiCard({ icon: Icon, label, value, isCurrency, delay = 0, caption }: {
  icon: any; label: string; value: number; isCurrency?: boolean; delay?: number; caption?: string
}) {
  const animated = useCountUp(value)
  const display = isCurrency ? formatMoney(animated) : formatNumber(Math.round(animated))
  return (
    <div
      className="group relative bg-slate-100 hover:bg-white rounded-2xl p-5 shadow-sm hover:shadow-2xl
                 transition-all duration-300 ease-out
                 hover:-translate-y-2 hover:scale-[1.02]
                 ring-1 ring-slate-200 hover:ring-blue-300 overflow-hidden cursor-default
                 animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-[0.05] group-hover:opacity-[0.15] group-hover:scale-125 transition-all duration-500"
        style={{ background: `radial-gradient(circle, ${BLUE} 0%, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-125 group-hover:rotate-12 ring-1 ring-blue-100 group-hover:shadow-lg group-hover:ring-blue-300"
          style={{ background: BLUE_LIGHT, animation: `float-soft 3.5s ease-in-out infinite ${delay * 0.5}ms` }}
        >
          <Icon size={20} style={{ color: BLUE }} className="transition-transform duration-300"/>
        </div>
        {caption && (
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-white group-hover:bg-slate-50 px-2 py-1 rounded-md transition-colors duration-300">
            {caption}
          </span>
        )}
      </div>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-[26px] font-bold leading-none transition-transform duration-300 group-hover:scale-105 origin-left" style={{ color: BLUE }}>{display}</p>
        {isCurrency && <span className="text-xs font-bold opacity-60" style={{ color: BLUE }}>DA</span>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Hero mini stat
// ════════════════════════════════════════════════════════════════
function HeroStat({ icon: Icon, label, value, isCurrency, delay = 0 }: {
  icon: any; label: string; value: number; isCurrency?: boolean; delay?: number
}) {
  const animated = useCountUp(value, 1500)
  const display = isCurrency ? formatMoney(animated) : formatNumber(Math.round(animated))
  return (
    <div
      className="group bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10
                 hover:bg-white/15 hover:-translate-y-1 hover:shadow-lg hover:border-white/30
                 transition-all duration-300 ease-out cursor-default
                 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className="text-blue-200 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-6"/>
        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{display}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Panel wrapper
// ════════════════════════════════════════════════════════════════
function Panel({ title, subtitle, icon: Icon, children, delay = 0, action }: {
  title: string; subtitle?: string; icon?: any
  children: React.ReactNode; delay?: number; action?: React.ReactNode
}) {
  return (
    <div
      className="bg-slate-100 rounded-2xl ring-1 ring-slate-200 hover:ring-blue-300
                  shadow-sm hover:shadow-2xl transition-all duration-300 ease-out
                  hover:-translate-y-1.5 hover:bg-slate-50
                  p-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both h-full"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform hover:scale-110 hover:rotate-6 duration-300"
              style={{ background: BLUE_LIGHT, animation: `float-soft 4s ease-in-out infinite ${delay * 0.3}ms` }}
            >
              <Icon size={15} style={{ color: BLUE }} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Bar chart horizontal — Top items (cliquables)
// ════════════════════════════════════════════════════════════════
interface TopBarItem {
  key: string             // code unique (machine ou code)
  label: string           // ce qu'on affiche sur l'axe Y
  description: string
  nb_interventions: number
  nb_corr: number
  nb_prev: number
  cout: number
}
function TopBarsChart({ data, onClickItem }: {
  data: TopBarItem[]
  onClickItem: (item: TopBarItem) => void
}) {
  if (data.length === 0) return <div className="h-[420px] flex items-center justify-center text-slate-400 text-sm">Aucune donnée.</div>

  return (
    <ResponsiveContainer width="100%" height={Math.max(420, data.length * 36)}>
      <BarChart
        data={data} layout="vertical"
        margin={{ top: 5, right: 50, bottom: 5, left: 10 }}
        barCategoryGap="22%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false}/>
        <XAxis
          type="number" tick={{ fill: '#64748B', fontSize: 11 }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          type="category" dataKey="label" width={150}
          tick={{ fill: '#1E293B', fontSize: 11, fontWeight: 700 }}
          axisLine={false} tickLine={false}
        />
        <Tooltip
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as TopBarItem
            return (
              <div className="bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 px-3 py-2 max-w-[260px]">
                <p className="text-xs font-bold text-white mb-1 font-mono">{d.label}</p>
                <p className="text-[11px] text-slate-300 mb-2 truncate">{d.description}</p>
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between gap-4"><span className="text-slate-400">Interventions</span><span className="font-bold text-white">{d.nb_interventions}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-400">Coût</span><span className="font-bold text-white">{formatMoney(d.cout)} DA</span></div>
                  <div className="pt-1 border-t border-slate-700 flex justify-between gap-4">
                    <span style={{ color: RED }}>CORR</span>
                    <span className="font-bold text-white">{d.nb_corr}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span style={{ color: GREEN }}>PREV</span>
                    <span className="font-bold text-white">{d.nb_prev}</span>
                  </div>
                </div>
                <p className="text-blue-300 text-[10px] mt-1.5">👆 Cliquer pour les détails</p>
              </div>
            )
          }}
          cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
        />
        <Bar
          dataKey="nb_interventions" radius={[0, 8, 8, 0]}
          animationDuration={1100}
          onClick={(d: any) => onClickItem(d.payload)}
          cursor="pointer"
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={BLUE_TIERS[Math.min(idx, BLUE_TIERS.length - 1)]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ════════════════════════════════════════════════════════════════
// Page principale
// ════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const user    = useSelector((s: RootState) => s.auth.user)
  const isAdmin = user?.role === 'ADMIN'

  const [poleOptions, setPoleOptions]   = useState<string[]>([])
  const [selectedPole, setSelectedPole] = useState<string | null>(null)
  const [niveau, setNiveau]             = useState<NiveauFilter>('tous')
  const [period, setPeriod]             = useState<PeriodKey>('tout')
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false)

  const [kpis, setKpis]                 = useState<Kpis | null>(null)
  const [evolution, setEvolution]       = useState<EvolutionPoint[]>([])
  const [composantes, setComposantes]   = useState<ComposanteCritique[]>([])
  const [machines, setMachines]         = useState<MachineCritique[]>([])
  const [repartition, setRepartition]   = useState<Repartition | null>(null)
  const [refreshing, setRefreshing]     = useState(false)
  const [loading, setLoading]           = useState(true)

  // Drill-down state
  type DrillType = 'machine' | 'composante'
  const [drill, setDrill] = useState<{ type: DrillType; data: any } | null>(null)
  const [drillSubItems, setDrillSubItems] = useState<ComposanteCritique[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  // Init pole
  useEffect(() => {
    if (!user) return
    if (isAdmin) {
      api.get('/dashboard/historique/poles')
        .then(r => {
          const list: string[] = r.data || []
          setPoleOptions(list)
          setSelectedPole(list.includes('LLK') ? 'LLK' : (list[0] || null))
        })
        .catch(() => { setPoleOptions([]); setSelectedPole(null) })
    } else {
      const code = (user.nom_pole || '').split(' - ')[0].trim()
      setSelectedPole(code || null)
    }
  }, [user, isAdmin])

  // Charger
  const charger = async () => {
    if (!selectedPole) return
    setRefreshing(true)
    try {
      const isGlobal = selectedPole === GLOBAL_KEY
      const baseParams: any = isGlobal ? {} : { pole: selectedPole }
      const allParams = { ...baseParams, niveau, ...resolvePeriod(period) }

      const [k, e, c, m, r] = await Promise.all([
        api.get('/dashboard/historique/kpis',                  { params: allParams }),
        api.get('/dashboard/historique/evolution-mensuelle',   { params: allParams }),
        api.get('/dashboard/historique/composantes-critiques', { params: { ...baseParams, limit: 10 } }),
        api.get('/dashboard/historique/machines-critiques',    { params: { ...baseParams, limit: 10 } }),
        api.get('/dashboard/historique/repartition',           { params: allParams }),
      ])
      setKpis(k.data); setEvolution(e.data); setComposantes(c.data)
      setMachines(m.data); setRepartition(r.data)
    } catch (err) {
      console.error('[dashboard] load error:', err)
    } finally {
      setRefreshing(false); setLoading(false)
    }
  }
  useEffect(() => { charger() }, [selectedPole, niveau, period])

  // ── Drill-down ─────────────────────────────────────────────
  const openMachineDrill = async (m: MachineCritique) => {
    setDrill({ type: 'machine', data: m })
    setDrillLoading(true)
    try {
      const r = await api.get(`/dashboard/historique/machine/${encodeURIComponent(m.machine)}/composantes`, { params: { limit: 10 } })
      setDrillSubItems(r.data || [])
    } catch {
      setDrillSubItems([])
    } finally {
      setDrillLoading(false)
    }
  }
  const openComposanteDrill = (c: ComposanteCritique) => {
    setDrill({ type: 'composante', data: c })
    setDrillSubItems([])
  }
  const closeDrill = () => { setDrill(null); setDrillSubItems([]) }

  // ── Données dérivées ───────────────────────────────────────
  const donutData = useMemo(() => repartition ? [
    { name: 'Correctives', value: repartition.corr, color: RED },
    { name: 'Préventives', value: repartition.prev, color: GREEN },
  ] : [], [repartition])

  const evolutionData = useMemo(() => evolution.map(p => ({ ...p, label: formatMonth(p.mois) })), [evolution])

  const topMachinesData: TopBarItem[] = useMemo(() => machines.map(m => ({
    key: m.machine, label: m.machine, description: m.description,
    nb_interventions: m.nb_interventions, nb_corr: m.nb_corr, nb_prev: m.nb_prev, cout: m.cout,
  })), [machines])

  const topComposantesData: TopBarItem[] = useMemo(() => composantes.map(c => ({
    key: c.code, label: c.code, description: c.description,
    nb_interventions: c.nb_interventions, nb_corr: c.nb_corr, nb_prev: c.nb_prev, cout: c.cout,
  })), [composantes])

  const poleLabel   = selectedPole === GLOBAL_KEY ? 'Tous pôles confondus' : (selectedPole || '—')
  const periodLabel = PERIODS.find(p => p.key === period)?.label || ''
  const niveauLabel = niveau === 'machines' ? 'Machines (L1-L2)' : niveau === 'composantes' ? 'Composantes (L3-L4)' : 'Tous niveaux'

  if (loading && !kpis) {
    return (
      <div className="-m-6 p-6 min-h-[calc(100vh-64px)] bg-white flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-full border-4 border-blue-100 animate-spin" style={{ borderTopColor: BLUE }}/>
        <p className="text-slate-500 text-sm font-medium">Préparation du dashboard…</p>
      </div>
    )
  }

  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-64px)] bg-white">
      <div className="space-y-5 pb-8">
      {/* ══════════════════ HERO sober ══════════════════ */}
      <div
        className="relative overflow-hidden rounded-3xl shadow-xl animate-in fade-in-0 slide-in-from-top-2 duration-700"
        style={{ background: `linear-gradient(135deg, ${BLUE_DARK} 0%, ${BLUE} 50%, #0066CC 100%)` }}
      >
        {/* Photo industrielle floutée en arrière-plan (fallback : gradient ci-dessus si pas de photo) */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            backgroundImage: 'url(/dashboard-hero.jpg)',
            filter: 'blur(5px) brightness(0.55) saturate(1.1)',
            mixBlendMode: 'overlay',
            opacity: 0.85,
          }}
        />
        {/* Overlay bleu pour fusionner photo + gradient */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, rgba(0,26,61,0.55) 0%, rgba(0,59,122,0.35) 50%, rgba(0,102,204,0.35) 100%)` }}/>
        {/* Blobs lumineux qui dérivent lentement */}
        <div
          className="absolute top-0 right-0 w-96 h-96 bg-cyan-300/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"
          style={{ animation: 'drift-1 18s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-0 left-0 w-72 h-72 bg-blue-400/25 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl"
          style={{ animation: 'drift-2 22s ease-in-out infinite' }}
        />
        <div
          className="absolute top-1/2 right-1/4 w-48 h-48 bg-indigo-300/15 rounded-full blur-2xl"
          style={{ animation: 'drift-1 25s ease-in-out infinite reverse' }}
        />

        <div className="relative p-6 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xl"
                style={{ animation: 'float-soft 4s ease-in-out infinite' }}
              >
                <LayoutDashboard size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/30 text-white text-[10px] font-bold tracking-widest uppercase">
                    {isAdmin ? 'Admin' : 'Méthodiste'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-100 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" style={{ animation: 'pulse-soft 1.5s ease-in-out infinite' }}/>
                    Live
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard Maintenance</h1>
                <p className="text-blue-200 text-sm mt-1 flex items-center gap-2 flex-wrap">
                  <Building2 size={13}/>
                  <span className="font-semibold">{poleLabel}</span>
                  <span className="text-blue-300/50">·</span>
                  <span>{niveauLabel}</span>
                  <span className="text-blue-300/50">·</span>
                  <span>{periodLabel}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <div className="relative">
                  <select
                    value={selectedPole || ''}
                    onChange={e => setSelectedPole(e.target.value)}
                    className="appearance-none pl-10 pr-10 py-2.5 rounded-xl bg-white/10 backdrop-blur-md
                      border border-white/20 text-white text-sm font-bold cursor-pointer min-w-[180px]
                      hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                  >
                    <option value={GLOBAL_KEY} className="text-slate-800">🌐 Tous les pôles</option>
                    {poleOptions.map(p => <option key={p} value={p} className="text-slate-800">{p}</option>)}
                  </select>
                  <Globe2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-70"/>
                </div>
              )}
              <button
                onClick={charger} disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition disabled:opacity-50"
              >
                <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''}/>
              </button>
            </div>
          </div>

        
        </div>
      </div>

      {/* ══════════════════ FILTER BAR compact ══════════════════ */}
      <div className="bg-slate-100 hover:bg-white rounded-2xl ring-1 ring-slate-200 hover:ring-blue-300 shadow-sm hover:shadow-lg transition-all duration-300 p-3 flex items-center gap-2 flex-wrap animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-1.5 text-slate-500 px-2">
          <Filter size={14}/>
          <span className="text-xs font-bold uppercase tracking-widest">Filtres</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setPeriodMenuOpen(!periodMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition border border-slate-200"
          >
            <Calendar size={13}/>
            {periodLabel}
            <ChevronDown size={12} className={`transition ${periodMenuOpen ? 'rotate-180' : ''}`}/>
          </button>
          {periodMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPeriodMenuOpen(false)}/>
              <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 min-w-[200px] animate-in fade-in-0 slide-in-from-top-1 duration-200">
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => { setPeriod(p.key); setPeriodMenuOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold transition flex items-center gap-2 ${period === p.key ? 'bg-blue-50 text-[#003B7A]' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <Calendar size={11}/>{p.label}
                    {period === p.key && <span className="ml-auto text-[#003B7A]">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <select
            value={niveau}
            onChange={e => setNiveau(e.target.value as NiveauFilter)}
            className="appearance-none pl-8 pr-8 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer border border-slate-200 transition focus:outline-none"
          >
            <option value="tous">Tous niveaux</option>
            <option value="machines">Machines (L1-L2)</option>
            <option value="composantes">Composantes (L3-L4)</option>
          </select>
          <Layers size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"/>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"/>
        </div>

        <div className="ml-auto text-[10px] text-slate-400 px-2 hidden md:block">
          {kpis ? `${formatNumber(kpis.nb_interventions)} interventions analysées` : '—'}
        </div>
      </div>

      {/* ══════════════════ ROW 1 : KPI cards (toutes bleues) ══════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Wrench}      delay={150} label={niveau === 'machines' ? 'Machines' : niveau === 'composantes' ? 'Composantes' : 'Équipements'} caption={niveauLabel} value={kpis?.nb_composantes ?? 0}/>
        <KpiCard icon={Activity}    delay={220} label="Interventions"        caption="Cumul"    value={kpis?.nb_interventions ?? 0}/>
        <KpiCard icon={AlertOctagon} delay={290} label="Pannes correctives"  caption="Imprévus" value={kpis?.nb_corr ?? 0}/>
        <KpiCard icon={ShieldCheck} delay={360} label="Maintenances préventives" caption="Planifié" value={kpis?.nb_prev ?? 0}/>
      </div>

      {/* ══════════════════ ROW 2 : Histogramme + Donut ══════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Panel title="Évolution mensuelle des pannes" subtitle={`Comparaison CORR vs PREV par mois · ${niveauLabel}`} icon={Activity} delay={420}>
            {evolutionData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">Aucune donnée.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={evolutionData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} width={35}/>
                  <Tooltip content={<ChartTooltip/>} cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}/>
                  <Bar dataKey="corr" name="Correctives" fill={RED}   radius={[6,6,0,0]} animationDuration={1100}/>
                  <Bar dataKey="prev" name="Préventives" fill={GREEN} radius={[6,6,0,0]} animationDuration={1100} animationBegin={200}/>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs justify-center">
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <span className="w-3 h-3 rounded-sm" style={{ background: RED }}/>Correctives
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <span className="w-3 h-3 rounded-sm" style={{ background: GREEN }}/>Préventives
              </span>
            </div>
          </Panel>
        </div>

        <Panel title="Répartition globale" subtitle={niveauLabel} icon={ShieldCheck} delay={490}>
          {!repartition || (repartition.corr + repartition.prev) === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">Aucune donnée.</div>
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" animationDuration={1100} animationBegin={200}>
                      {donutData.map((e, i) => <Cell key={i} fill={e.color} stroke="#fff" strokeWidth={2}/>)}
                    </Pie>
                    <Tooltip content={<ChartTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-3xl font-bold text-slate-800 leading-none">{formatNumber(repartition.corr + repartition.prev)}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</p>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: CORR_BG }}>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-sm" style={{ background: CORR_COLOR }}/>
                    <span className="font-semibold" style={{ color: CORR_TEXT }}>Correctives</span>
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: CORR_TEXT }}>{repartition.pct_corr.toFixed(1)}%</span>
                    <span className="text-[10px] ml-1 opacity-60" style={{ color: CORR_TEXT }}>({formatNumber(repartition.corr)})</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: PREV_BG }}>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-sm" style={{ background: PREV_COLOR }}/>
                    <span className="font-semibold" style={{ color: PREV_TEXT }}>Préventives</span>
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: PREV_TEXT }}>{repartition.pct_prev.toFixed(1)}%</span>
                    <span className="text-[10px] ml-1 opacity-60" style={{ color: PREV_TEXT }}>({formatNumber(repartition.prev)})</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ══════════════════ ROW 3 : Top Machines | Top Composantes (côte à côte) ══════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Top 10 Machines critiques"
          subtitle="Cliquez sur une barre pour voir les composantes défaillantes"
          icon={Factory} delay={560}
        >
          <TopBarsChart data={topMachinesData} onClickItem={(it) => {
            const machine = machines.find(m => m.machine === it.key)
            if (machine) openMachineDrill(machine)
          }}/>
        </Panel>

        <Panel
          title="Top 10 Composantes critiques"
          subtitle="Composantes L3+L4 · alignées avec la prédiction ML"
          icon={Cog} delay={630}
        >
          <TopBarsChart data={topComposantesData} onClickItem={(it) => {
            const compo = composantes.find(c => c.code === it.key)
            if (compo) openComposanteDrill(compo)
          }}/>
        </Panel>
      </div>

      {/* ══════════════════ ROW 4 : Coûts breakdown ══════════════════ */}
      <Panel title="Répartition des coûts" subtitle={`Périmètre actuel · ${niveauLabel}`} icon={Wallet} delay={770}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 text-white shadow-md hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-out" style={{ background: `linear-gradient(135deg, ${BLUE_DARK} 0%, ${BLUE} 100%)` }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Coût total</p>
              <Wallet size={14} className="text-blue-200"/>
            </div>
            <p className="text-2xl font-bold flex items-baseline gap-1">
              {formatMoney(kpis?.cout_total ?? 0)}<span className="text-xs opacity-70">DA</span>
            </p>
            <p className="text-[10px] text-blue-200 mt-1">Toutes interventions confondues</p>
          </div>

          <div className="bg-white rounded-xl p-3.5 border hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-out" style={{ borderColor: CORR_BG }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CORR_TEXT }}>Correctif</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: CORR_TEXT, background: CORR_BG }}>
                {kpis && kpis.cout_total > 0 ? Math.round((kpis.cout_corr / kpis.cout_total) * 100) : 0}%
              </span>
            </div>
            <p className="text-xl font-bold flex items-baseline gap-1" style={{ color: CORR_COLOR }}>
              {formatMoney(kpis?.cout_corr ?? 0)}<span className="text-[10px] opacity-70">DA</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: CORR_BG }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${kpis && kpis.cout_total > 0 ? (kpis.cout_corr / kpis.cout_total) * 100 : 0}%`, background: CORR_COLOR }}/>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-out" style={{ borderColor: PREV_BG }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: PREV_TEXT }}>Préventif</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: PREV_TEXT, background: PREV_BG }}>
                {kpis && kpis.cout_total > 0 ? Math.round((kpis.cout_prev / kpis.cout_total) * 100) : 0}%
              </span>
            </div>
            <p className="text-xl font-bold flex items-baseline gap-1" style={{ color: PREV_COLOR }}>
              {formatMoney(kpis?.cout_prev ?? 0)}<span className="text-[10px] opacity-70">DA</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: PREV_BG }}>
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${kpis && kpis.cout_total > 0 ? (kpis.cout_prev / kpis.cout_total) * 100 : 0}%`, background: PREV_COLOR }}/>
            </div>
          </div>
        </div>
      </Panel>

      <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 animate-in fade-in-0 duration-1000 fill-mode-both" style={{ animationDelay: '850ms' }}>
        <Sparkles size={12}/>
        <span>Données mises à jour automatiquement · Source : <span className="font-mono font-semibold text-slate-500">prev_corr</span></span>
      </div>

      {/* ══════════════════ DRILL-DOWN MODAL ══════════════════ */}
      {drill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
          onClick={closeDrill}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative overflow-hidden p-5 text-white" style={{ background: `linear-gradient(135deg, ${BLUE_DARK} 0%, ${BLUE} 100%)` }}>
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"/>
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 flex-shrink-0">
                    {drill.type === 'machine' ? <Factory size={22}/> : <Cog size={22}/>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-1">
                      {drill.type === 'machine' ? 'Détail · Machine' : 'Détail · Composante'}
                    </p>
                    <h2 className="text-xl font-bold tracking-tight font-mono truncate">
                      {drill.type === 'machine' ? drill.data.machine : drill.data.code}
                    </h2>
                    <p className="text-blue-200 text-xs mt-0.5 truncate">{drill.data.description}</p>
                  </div>
                </div>
                <button onClick={closeDrill} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition flex-shrink-0">
                  <X size={16}/>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4 relative">
                <div className="bg-white/5 backdrop-blur-md rounded-lg p-2 border border-white/10">
                  <p className="text-[9px] text-white/60 uppercase font-bold tracking-widest">Interventions</p>
                  <p className="text-lg font-bold">{drill.data.nb_interventions}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-lg p-2 border border-white/10">
                  <p className="text-[9px] uppercase font-bold tracking-widest" style={{ color: '#CBD5E1' }}>Correctif</p>
                  <p className="text-lg font-bold">{drill.data.nb_corr}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-lg p-2 border border-white/10">
                  <p className="text-[9px] uppercase font-bold tracking-widest" style={{ color: '#93C5FD' }}>Préventif</p>
                  <p className="text-lg font-bold">{drill.data.nb_prev}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-lg p-2 border border-white/10">
                  <p className="text-[9px] text-white/60 uppercase font-bold tracking-widest">Coût</p>
                  <p className="text-lg font-bold">{formatMoney(drill.data.cout)}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto max-h-[55vh]">
              {drill.type === 'machine' ? (
                <>
                  <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Cog size={14} style={{ color: BLUE }}/>
                    Composantes L3+L4 défaillantes ({drill.data.nb_composantes} au total)
                  </h3>
                  {drillLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 rounded-full border-4 border-blue-100 animate-spin" style={{ borderTopColor: BLUE }}/>
                    </div>
                  ) : drillSubItems.length === 0 ? (
                    <div className="text-slate-400 text-sm text-center py-12">Aucune composante L3+L4 enregistrée pour cette machine.</div>
                  ) : (
                    <div className="space-y-2">
                      {drillSubItems.map((c, idx) => {
                        const max = drillSubItems[0]?.nb_interventions || 1
                        const ratio = c.nb_interventions / max
                        const tier = BLUE_TIERS[Math.min(idx, BLUE_TIERS.length - 1)]
                        return (
                          <div
                            key={c.code}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition animate-in fade-in-0 slide-in-from-left-2 fill-mode-both"
                            style={{ animationDelay: `${idx * 40}ms` }}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md" style={{ background: tier }}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-mono text-xs font-bold text-slate-800 truncate">{c.code}</p>
                                <span className="px-1.5 py-0 rounded text-[9px] font-bold bg-blue-100 text-blue-700">L{c.level}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">{c.description}</p>
                              <div className="mt-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${ratio * 100}%`, background: tier }}/>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-base font-bold text-slate-800 leading-none">{c.nb_interventions}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">interv</p>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{formatMoney(c.cout)} DA</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Sparkles size={14} style={{ color: BLUE }}/>
                    Informations détaillées
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Code composante</p>
                        <p className="font-mono font-bold text-slate-800 mt-1">{drill.data.code}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Niveau hiérarchique</p>
                        <p className="font-bold text-slate-800 mt-1">L{drill.data.level} · {drill.data.level === 3 ? 'Sous-composante' : 'Composante terminale'}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</p>
                      <p className="text-slate-800 mt-1">{drill.data.description}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pôle</p>
                      <p className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                        <Building2 size={12} style={{ color: BLUE }}/>{drill.data.pole}
                      </p>
                    </div>

                    {/* Ratio CORR/PREV */}
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Répartition des interventions</p>
                      {drill.data.nb_interventions > 0 && (
                        <>
                          <div className="flex h-3 rounded-full overflow-hidden">
                            <div style={{ width: `${(drill.data.nb_corr / drill.data.nb_interventions) * 100}%`, background: RED }}/>
                            <div style={{ width: `${(drill.data.nb_prev / drill.data.nb_interventions) * 100}%`, background: GREEN }}/>
                          </div>
                          <div className="flex justify-between mt-2 text-xs">
                            <span className="font-bold" style={{ color: RED }}>
                              {drill.data.nb_corr} CORR ({Math.round((drill.data.nb_corr / drill.data.nb_interventions) * 100)}%)
                            </span>
                            <span className="font-bold" style={{ color: GREEN }}>
                              {drill.data.nb_prev} PREV ({Math.round((drill.data.nb_prev / drill.data.nb_interventions) * 100)}%)
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
