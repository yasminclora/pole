'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import {
  AlertTriangle, AlertOctagon, Clock, CheckCircle2,
  Zap, Filter, Search, RefreshCw, ChevronRight, TrendingUp,
  Activity, Sparkles, Loader2, Building2, Calendar,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import {
  usePredictionsDashboard,
  useFiltresMeta,
  useLancerScan,
} from '@/hooks/usePredictions'
import type { Criticite, FiltresDashboard } from '@/types/prediction'
import type { RootState } from '@/store/store'

const CRITICITE_CONFIG: Record<Criticite, {
  label: string; color: string; bg: string; bgGradient: string; text: string; icon: any; ring: string
}> = {
  CRITIQUE: {
    label: 'Critique', color: '#dc2626',
    bg: 'bg-red-50 dark:bg-red-950/30',
    bgGradient: 'from-red-500 to-rose-600',
    text: 'text-red-700 dark:text-red-300',
    icon: AlertOctagon,
    ring: 'ring-red-200 dark:ring-red-900',
  },
  ELEVE: {
    label: 'Risque Élevé', color: '#ea580c',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    bgGradient: 'from-orange-500 to-amber-600',
    text: 'text-orange-700 dark:text-orange-300',
    icon: AlertTriangle,
    ring: 'ring-orange-200 dark:ring-orange-900',
  },
  MODERE: {
    label: 'Modéré', color: '#ca8a04',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    bgGradient: 'from-amber-500 to-yellow-600',
    text: 'text-amber-700 dark:text-amber-300',
    icon: Clock,
    ring: 'ring-amber-200 dark:ring-amber-900',
  },
  STABLE: {
    label: 'Stable', color: '#16a34a',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    bgGradient: 'from-emerald-500 to-green-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
    ring: 'ring-emerald-200 dark:ring-emerald-900',
  },
}

export default function PredictionsDashboardPage() {
  const router = useRouter()
  const user   = useSelector((s: RootState) => s.auth.user)
  const isAdmin = user?.role === 'ADMIN'
  const [filtres, setFiltres] = useState<FiltresDashboard>({})

  const { data, isLoading, isFetching, error } = usePredictionsDashboard(filtres)
  const { data: meta } = useFiltresMeta()
  const scan = useLancerScan()

  const top20 = useMemo(
    () => data?.composants.slice(0, 20).map(c => ({
      code   : c.equipment_code,
      short  : c.equipment_code.split('-').slice(-2).join('-'),
      rul    : c.rul_jours,
      crit   : c.criticite,
      desc   : c.description,
      machine: c.machine,
    })) ?? [],
    [data],
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── HEADER ───────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Maintenance Prédictive
              </h1>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                <Activity className="w-3.5 h-3.5" />
                {data ? (
                  <>
                    <span>Dernier scan : <span className="font-medium">{new Date(data.scanned_at).toLocaleString('fr-FR')}</span></span>
                    {data.pole_effectif && (
                      <>
                        <span className="text-gray-300 dark:text-gray-700">·</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded font-semibold">
                          <Building2 className="w-3 h-3" /> {data.pole_effectif}
                        </span>
                      </>
                    )}
                    {!data.pole_effectif && isAdmin && (
                      <>
                        <span className="text-gray-300 dark:text-gray-700">·</span>
                        <span className="text-xs text-gray-400">Tous pôles</span>
                      </>
                    )}
                  </>
                ) : (
                  'Chargement…'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="group flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all disabled:opacity-60"
          >
            {scan.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scan en cours…
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Lancer Scan Prédictif
              </>
            )}
          </button>
        </div>

        {/* ── KPI CARDS ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['CRITIQUE', 'ELEVE', 'MODERE', 'STABLE'] as Criticite[]).map(crit => (
            <KPICard
              key={crit}
              criticite={crit}
              value={data?.kpis[crit.toLowerCase() as keyof typeof data.kpis] ?? 0}
              total={data?.kpis.total ?? 0}
              loading={isLoading}
              active={filtres.criticite === crit}
              onClick={() => setFiltres(f => ({ ...f, criticite: f.criticite === crit ? undefined : crit }))}
            />
          ))}
        </div>

        {/* ── FILTRES ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Filter className="w-4 h-4" /> Filtres
            </div>

            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un composant…"
                value={filtres.search ?? ''}
                onChange={e => setFiltres(f => ({ ...f, search: e.target.value || undefined }))}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            {isAdmin && (
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={filtres.pole ?? ''}
                  onChange={e => setFiltres(f => ({ ...f, pole: e.target.value || undefined }))}
                  className="pl-9 pr-3 py-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                >
                  <option value="">Tous les pôles</option>
                  {meta?.poles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            <select
              value={filtres.zone ?? ''}
              onChange={e => setFiltres(f => ({ ...f, zone: e.target.value || undefined }))}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="">Toutes les zones</option>
              {meta?.zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <select
              value={filtres.machine ?? ''}
              onChange={e => setFiltres(f => ({ ...f, machine: e.target.value || undefined }))}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="">Toutes les machines</option>
              {meta?.machines.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            {(filtres.search || filtres.zone || filtres.machine || filtres.criticite || filtres.pole || filtres.date_from || filtres.date_to) && (
              <button
                onClick={() => setFiltres({})}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                Réinitialiser
              </button>
            )}
            {isFetching && !isLoading && (
              <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
            )}
          </div>

          {/* Plage de dates (basée sur date_declaration de l'historique) */}
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              <Calendar className="w-3.5 h-3.5" /> Période d'historique
            </div>
            <input
              type="date"
              value={filtres.date_from ?? ''}
              onChange={e => setFiltres(f => ({ ...f, date_from: e.target.value || undefined }))}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={filtres.date_to ?? ''}
              onChange={e => setFiltres(f => ({ ...f, date_to: e.target.value || undefined }))}
              className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            {data?.ref_date && (
              <span className="text-xs text-gray-500 ml-auto">
                Date de référence du calcul : <span className="font-semibold">{new Date(data.ref_date).toLocaleDateString('fr-FR')}</span>
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-sm">
            Erreur : {(error as Error).message}
          </div>
        )}

        {/* ── HISTOGRAMME TOP 20 ──────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Top 20 — Composants les plus critiques</h2>
                <p className="text-xs text-gray-500">Triés par RUL croissant</p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {top20.length} composants affichés
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="h-[600px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : top20.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                Aucun composant ne correspond aux filtres
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(400, top20.length * 32)}>
                <BarChart
                  data={top20}
                  layout="vertical"
                  margin={{ top: 10, right: 60, left: 10, bottom: 10 }}
                  onClick={(e: any) => {
                    if (e?.activePayload?.[0]?.payload?.code) {
                      router.push(`/predictions/composant/${encodeURIComponent(e.activePayload[0].payload.code)}`)
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={11} domain={[0, 'dataMax + 5']} />
                  <YAxis
                    type="category"
                    dataKey="short"
                    stroke="#9ca3af"
                    fontSize={11}
                    width={130}
                    interval={0}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                  <Bar dataKey="rul" radius={[0, 6, 6, 0]} cursor="pointer">
                    {top20.map((c, i) => (
                      <Cell key={i} fill={CRITICITE_CONFIG[c.crit as Criticite].color} />
                    ))}
                    <LabelList
                      dataKey="rul"
                      position="right"
                      formatter={(v: number) => `${v}j`}
                      style={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── LISTE DÉTAILLÉE ────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Composants analysés</h2>
            <div className="text-xs text-gray-500">{data?.composants.length ?? 0} résultats</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Composant</th>
                  <th className="text-left px-4 py-3 font-medium">Machine / Zone</th>
                  <th className="text-left px-4 py-3 font-medium">RUL</th>
                  <th className="text-left px-4 py-3 font-medium">Confiance</th>
                  <th className="text-left px-4 py-3 font-medium">Stock</th>
                  <th className="text-left px-4 py-3 font-medium">Criticité</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(data?.composants ?? []).slice(0, 50).map(c => {
                  const cfg = CRITICITE_CONFIG[c.criticite]
                  return (
                    <tr
                      key={c.equipment_code}
                      onClick={() => router.push(`/predictions/composant/${encodeURIComponent(c.equipment_code)}`)}
                      className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div className="font-mono text-xs font-semibold">{c.equipment_code}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.description}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium">{c.machine}</div>
                        <div className="text-gray-500">{c.zone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <RulBar rul={c.rul_jours} criticite={c.criticite} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${c.confiance_pct}%` }} />
                          </div>
                          <span className="text-xs font-medium">{c.confiance_pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          c.stock_ok
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        }`}>
                          {c.stock_disponible} u. {c.stock_ok ? '✓' : '⚠'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                          <cfg.icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
function KPICard({
  criticite, value, total, loading, active, onClick,
}: {
  criticite: Criticite; value: number; total: number; loading: boolean; active: boolean; onClick: () => void
}) {
  const cfg = CRITICITE_CONFIG[criticite]
  const Icon = cfg.icon
  const pct = total ? Math.round((value / total) * 100) : 0

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden text-left p-5 rounded-2xl border transition-all ${
        active
          ? `bg-gradient-to-br ${cfg.bgGradient} text-white border-transparent shadow-lg`
          : `${cfg.bg} border-gray-200 dark:border-gray-800 hover:shadow-md hover:-translate-y-0.5`
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${
          active ? 'bg-white/20' : `bg-gradient-to-br ${cfg.bgGradient}`
        }`}>
          <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-white'}`} />
        </div>
        <div className={`text-xs font-medium ${active ? 'text-white/80' : 'text-gray-500'}`}>
          {pct}%
        </div>
      </div>
      <div className={`text-3xl font-bold mb-1 ${active ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
        {loading ? '—' : value}
      </div>
      <div className={`text-sm font-medium ${active ? 'text-white/90' : cfg.text}`}>
        {cfg.label}
      </div>
      <div className={`text-xs mt-1 ${active ? 'text-white/70' : 'text-gray-500'}`}>
        {criticite === 'CRITIQUE' ? 'RUL < 7j'
          : criticite === 'ELEVE'  ? 'RUL 7-14j'
          : criticite === 'MODERE' ? 'RUL 15-30j'
          : 'RUL > 30j'}
      </div>
    </button>
  )
}

function RulBar({ rul, criticite }: { rul: number; criticite: Criticite }) {
  const cfg = CRITICITE_CONFIG[criticite]
  const pct = Math.min(100, (rul / 60) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color: cfg.color }}>{rul}j</span>
    </div>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  const cfg = CRITICITE_CONFIG[d.crit as Criticite]
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 min-w-[220px]">
      <div className="font-mono text-xs font-bold text-gray-900 dark:text-white mb-1">{d.code}</div>
      <div className="text-xs text-gray-500 mb-2">{d.desc}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500">Machine</span>
        <span className="text-xs font-medium">{d.machine}</span>
      </div>
      <div className="flex items-center justify-between gap-3 mt-1">
        <span className="text-xs text-gray-500">RUL</span>
        <span className="text-sm font-bold" style={{ color: cfg.color }}>{d.rul} jours</span>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
      </div>
      <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">→ Cliquez pour le détail</div>
    </div>
  )
}
