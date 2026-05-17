'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import api from '@/services/axiosInstance'
import { polesService } from '@/services/polesService'
import {
  Wrench, Activity, CheckCircle2, Clock, MapPin, RefreshCw,
  ClipboardList, AlertTriangle, ClipboardCheck, Brain, Package,
  ChevronRight, TrendingUp, Bell, ArrowUpRight, AlertOctagon,
} from 'lucide-react'

interface Pole { id_pole: number; nom_pole: string }

const STATUT_OT: Record<string, string> = {
  CREE: 'Créé', ASSIGNE: 'Assigné', EN_COURS: 'En cours',
  TERMINE: 'Terminé', VALIDE_CE: 'Validé CE', VALIDE_HSE: 'Validé HSE',
  ARCHIVE: 'Archivé', REJETE: 'Rejeté',
}
const STATUT_DI: Record<string, string> = {
  EN_ATTENTE: 'En attente', VERIFIE: 'Vérifié', VALIDEE: 'Validée',
  REJETEE: 'Rejetée', EN_COURS: 'En cours',
}
const STATUT_INTERV: Record<string, string> = {
  EN_ATTENTE: 'En attente', VALIDE: 'Validé',
  REJETE: 'Rejeté', VALIDE_HSE: 'Validé HSE', ARCHIVE: 'Archivé',
}
const STATUT_ML: Record<string, { color: string; bg: string }> = {
  CRITIQUE:     { color: '#dc2626', bg: 'bg-red-100 text-red-700' },
  URGENT:       { color: '#ea580c', bg: 'bg-orange-100 text-orange-700' },
  SURVEILLANCE: { color: '#ca8a04', bg: 'bg-amber-100 text-amber-700' },
  OK:           { color: '#16a34a', bg: 'bg-emerald-100 text-emerald-700' },
}
const STOCK_BADGE: Record<string, string> = {
  ABSENT: 'bg-red-100 text-red-700',
  FAIBLE: 'bg-orange-100 text-orange-700',
  OK:     'bg-emerald-100 text-emerald-700',
}

const COLORS = ['#6366f1','#3b82f6','#8b5cf6','#f59e0b','#10b981','#14b8a6','#ef4444','#ec4899']

async function apiGet<T>(url: string, params?: Record<string, any>): Promise<T | null> {
  try {
    const r = await api.get(url, { params })
    return r.data as T
  } catch { return null }
}

// ── Donut SVG ──────────────────────────────────────────────────────────────
function Donut({ data, valueKey, colors, size = 130 }:
  { data: any[]; valueKey: string; colors: string[]; size?: number }) {
  const r = size * 0.38; const cx = size / 2; const cy = size / 2
  const circ = 2 * Math.PI * r
  const total = data.reduce((a, b) => a + (b[valueKey] || 0), 0)
  if (total === 0) return (
    <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height: size }}>
      Aucune donnée
    </div>
  )
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="16"/>
      {data.map((d, i) => {
        const dash = (d[valueKey] || 0) / total * circ
        const seg = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={colors[i % colors.length]} strokeWidth="16"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}/>
        )
        offset += dash
        return seg
      })}
      <text x={cx} y={cy - 4} textAnchor="middle"
        style={{ fontSize: size * 0.16, fontWeight: 800 }}
        className="fill-gray-900">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        style={{ fontSize: size * 0.075, fill: '#9ca3af' }}>total</text>
    </svg>
  )
}

function StatusBars({ data, labelMap, colors, max }: {
  data: any[]; labelMap: Record<string, string>; colors: string[]; max: number
}) {
  const total = data.reduce((a, b) => a + b.count, 0)
  return (
    <div className="space-y-2.5">
      {data.map((s, i) => (
        <div key={s.statut}>
          <div className="flex justify-between text-sm mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded shrink-0" style={{ background: colors[i % colors.length] }}/>
              <span className="text-gray-600 truncate">{labelMap[s.statut] || s.statut}</span>
            </div>
            <span className="font-semibold text-gray-900 shrink-0 ml-2">
              {s.count}
              <span className="text-gray-400 font-normal ml-1 text-xs">
                ({total > 0 ? Math.round(s.count / total * 100) : 0}%)
              </span>
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${(s.count / max) * 100}%`, background: colors[i % colors.length] }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const router    = useRouter()
  const authUser  = useSelector((s: RootState) => s.auth.user)
  const isAdmin   = authUser?.role === 'ADMIN'
  const userPoleId = authUser?.id_pole as number | undefined

  const [poles, setPoles] = useState<Pole[]>([])
  const [filtrePole, setFiltrePole] = useState<number | ''>('')
  const [activeTab, setActiveTab] = useState<'overview'|'ot'|'di'|'interventions'>('overview')
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Données
  const [kpi, setKpi]           = useState<any>(null)
  const [otStatus, setOtStatus] = useState<any[]>([])
  const [diStatus, setDiStatus] = useState<any[]>([])
  const [intervStatus, setIntervStatus] = useState<any[]>([])
  const [otZone, setOtZone]     = useState<any[]>([])
  const [otPole, setOtPole]     = useState<any[]>([])
  const [recent, setRecent]     = useState<any[]>([])
  const [mlSummary, setMlSummary] = useState<any>(null)

  const activePole = isAdmin ? (filtrePole || undefined) : userPoleId
  const params = activePole ? { id_pole: activePole } : {}

  useEffect(() => {
    if (isAdmin) polesService.lister().then(setPoles)
  }, [])

  const charger = async () => {
    setLoading(true)
    const [k, ots, dis, ivs, oz, op, rec, ml] = await Promise.all([
      apiGet<any>('/dashboard/live/kpi', params),
      apiGet<any[]>('/dashboard/live/ot-by-status', params),
      apiGet<any[]>('/dashboard/live/di-by-status', params),
      apiGet<any[]>('/dashboard/live/intervention-by-status', params),
      apiGet<any[]>('/dashboard/live/ot-by-zone', params),
      apiGet<any[]>('/dashboard/live/ot-by-pole'),
      apiGet<any[]>('/dashboard/live/recent', { ...params, limit: 12 }),
      apiGet<any>('/dashboard/live/predictions-summary', params),
    ])
    setKpi(k); setOtStatus(ots || []); setDiStatus(dis || [])
    setIntervStatus(ivs || []); setOtZone(oz || []); setOtPole(op || [])
    setRecent(rec || []); setMlSummary(ml || null)
    setLastRefresh(new Date())
    setLoading(false)
  }

  useEffect(() => { charger() }, [activePole])

  // Auto-refresh toutes les 60s
  useEffect(() => {
    const t = setInterval(charger, 60_000)
    return () => clearInterval(t)
  }, [activePole])

  const maxOt   = Math.max(...otStatus.map(s => s.count), 1)
  const maxDi   = Math.max(...diStatus.map(s => s.count), 1)
  const maxIv   = Math.max(...intervStatus.map(s => s.count), 1)
  const maxZone = Math.max(...otZone.map(z => z.count), 1)

  // Dérivés
  const nbCritiquesML = mlSummary?.last_run?.nb_critiques ?? 0
  const nbUrgentsML   = mlSummary?.last_run?.nb_urgents ?? 0
  const nbAlertesStock = mlSummary?.nb_alertes_stock ?? 0
  const totalAlertes  = (kpi?.di_en_attente ?? 0) + nbCritiquesML + nbAlertesStock

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Suivi opérationnel{!isAdmin && ' — votre pôle'}
            {lastRefresh && (
              <span className="ml-3 text-xs text-gray-400">
                · MAJ {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                · auto 60s
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <select value={filtrePole}
              onChange={e => setFiltrePole(e.target.value ? Number(e.target.value) : '')}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tous les pôles</option>
              {poles.map(p => <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>)}
            </select>
          )}
          <button onClick={charger} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* ── KPI TOP BAND : 6 cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <BigKpi
          icon={<ClipboardList className="w-4 h-4" />}
          label="OT actifs"
          value={kpi?.ot_non_archives ?? 0}
          color="text-blue-600" bg="bg-blue-50"
          onClick={() => router.push('/ot/liste')}
        />
        <BigKpi
          icon={<Activity className="w-4 h-4" />}
          label="OT en cours"
          value={kpi?.ot_en_cours ?? 0}
          color="text-indigo-600" bg="bg-indigo-50"
        />
        <BigKpi
          icon={<AlertTriangle className="w-4 h-4" />}
          label="DI en attente"
          value={kpi?.di_en_attente ?? 0}
          color="text-orange-600" bg="bg-orange-50"
          onClick={() => router.push('/di/liste')}
          highlight={(kpi?.di_en_attente ?? 0) > 0}
        />
        <BigKpi
          icon={<Brain className="w-4 h-4" />}
          label="Composants critiques"
          value={nbCritiquesML}
          color="text-red-600" bg="bg-red-50"
          onClick={() => router.push('/predictions')}
          highlight={nbCritiquesML > 0}
          subtext={`+ ${nbUrgentsML} urgents`}
        />
        <BigKpi
          icon={<Package className="w-4 h-4" />}
          label="Alertes stock"
          value={nbAlertesStock}
          color="text-purple-600" bg="bg-purple-50"
          onClick={() => router.push('/predictions')}
          highlight={nbAlertesStock > 0}
        />
        <BigKpi
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Taux completion"
          value={`${kpi?.taux_completion ?? 0}%`}
          color="text-emerald-600" bg="bg-emerald-50"
        />
      </div>

      {/* ── WIDGET ML : top 5 composants critiques ─────────────────────── */}
      {mlSummary?.top_critiques?.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 border border-red-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-red-100">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-gray-900">Composants à risque immédiat</h2>
              <span className="text-xs text-gray-500">
                · Dernier run ML #{mlSummary.last_run.id_run}
                {mlSummary.last_run.launched_at && (
                  <> · {new Date(mlSummary.last_run.launched_at).toLocaleDateString('fr-FR')}</>
                )}
              </span>
            </div>
            <button onClick={() => router.push('/predictions')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              Voir tout <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-red-100">
            {mlSummary.top_critiques.map((c: any) => (
              <div key={c.equipment_code}
                   onClick={() => router.push(`/predictions/composant/${encodeURIComponent(c.equipment_code)}`)}
                   className="px-5 py-3 flex items-center gap-4 hover:bg-white/50 cursor-pointer transition">
                <div className="text-xl font-bold tabular-nums w-14 text-center"
                     style={{ color: STATUT_ML[c.statut]?.color ?? '#6b7280' }}>
                  {c.rul_jours}j
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-gray-900 truncate">{c.equipment_code}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUT_ML[c.statut]?.bg ?? ''}`}>
                      {c.statut}
                    </span>
                    {c.alerte_stock && c.alerte_stock !== 'OK' && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${STOCK_BADGE[c.alerte_stock]}`}>
                        <Package className="w-2.5 h-2.5" />
                        Stock {c.alerte_stock}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 truncate">{c.equipment_desc}</div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {c.system_equipment} · {c.zone ?? c.pole ?? ''}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
        {[
          { id: 'overview',      label: 'Vue d\'ensemble', icon: Activity },
          { id: 'ot',            label: 'OT',              icon: ClipboardList },
          { id: 'di',            label: 'DI',              icon: AlertTriangle },
          { id: 'interventions', label: 'Interventions',   icon: ClipboardCheck },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-[#003B7A] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <Icon size={15}/> {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading && !lastRefresh ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={28} className="animate-spin text-blue-500"/>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* 3 Donuts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard title="OT par statut" icon={<ClipboardList className="w-4 h-4 text-blue-600" />}>
                  {otStatus.length === 0 ? <Empty />
                    : <div className="flex items-start gap-4">
                        <Donut data={otStatus} valueKey="count" colors={COLORS} size={130}/>
                        <div className="flex-1"><StatusBars data={otStatus} labelMap={STATUT_OT} colors={COLORS} max={maxOt}/></div>
                      </div>}
                </ChartCard>
                <ChartCard title="DI par statut" icon={<AlertTriangle className="w-4 h-4 text-orange-600" />}>
                  {diStatus.length === 0 ? <Empty />
                    : <div className="flex items-start gap-4">
                        <Donut data={diStatus} valueKey="count" colors={COLORS.slice(2)} size={130}/>
                        <div className="flex-1"><StatusBars data={diStatus} labelMap={STATUT_DI} colors={COLORS.slice(2)} max={maxDi}/></div>
                      </div>}
                </ChartCard>
                <ChartCard title="Interventions" icon={<ClipboardCheck className="w-4 h-4 text-purple-600" />}>
                  {intervStatus.length === 0 ? <Empty />
                    : <div className="flex items-start gap-4">
                        <Donut data={intervStatus} valueKey="count" colors={COLORS.slice(3)} size={130}/>
                        <div className="flex-1"><StatusBars data={intervStatus} labelMap={STATUT_INTERV} colors={COLORS.slice(3)} max={maxIv}/></div>
                      </div>}
                </ChartCard>
              </div>

              {/* Zones + Pôles (admin) */}
              <div className={`grid grid-cols-1 ${isAdmin && otPole.length > 0 ? 'lg:grid-cols-2' : ''} gap-4`}>
                <ChartCard title="OT par zone" icon={<MapPin className="w-4 h-4 text-teal-600" />}>
                  {otZone.length === 0 ? <Empty />
                    : <div className="space-y-2.5">
                        {otZone.slice(0, 8).map((z, i) => (
                          <div key={z.zone}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600 truncate">{z.zone}</span>
                              <span className="font-semibold text-gray-900 ml-2">{z.count}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="h-2 rounded-full transition-all duration-700"
                                style={{ width: `${(z.count / maxZone) * 100}%`, background: COLORS[i % COLORS.length] }}/>
                            </div>
                          </div>
                        ))}
                      </div>}
                </ChartCard>

                {isAdmin && otPole.length > 0 && (
                  <ChartCard title="OT par pôle" icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}>
                    <div className="flex items-end gap-2 h-44">
                      {otPole.map((p, i) => {
                        const maxP = Math.max(...otPole.map(x => x.count), 1)
                        return (
                          <div key={p.pole} className="flex-1 flex flex-col items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-700">{p.count}</span>
                            <div className="w-full rounded-t-lg transition-all duration-700"
                              style={{ height: `${Math.max((p.count / maxP) * 100, 8)}%`, minHeight: 8,
                                background: COLORS[i % COLORS.length] }}/>
                            <span className="text-[10px] text-gray-500 text-center leading-tight truncate w-full">
                              {p.pole}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </ChartCard>
                )}
              </div>

              {/* Activités récentes */}
              {recent.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Bell size={14} className="text-blue-600" />
                      Activités récentes (OT + DI)
                    </h3>
                    <span className="text-xs text-gray-400">{recent.length} entrées</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Référence</th>
                        <th className="px-4 py-2 text-left">Sous-type</th>
                        <th className="px-4 py-2 text-left">Statut</th>
                        <th className="px-4 py-2 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recent.map(r => (
                        <tr key={`${r.type}-${r.id}`} className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => router.push(r.type === 'OT' ? `/ot/${r.id}` : `/di/${r.id}`)}>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.type === 'OT' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>{r.type}</span>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{r.ref}</td>
                          <td className="px-4 py-2 text-gray-600">{r.sous_type ?? '—'}</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700">
                              {STATUT_OT[r.statut] ?? STATUT_DI[r.statut] ?? r.statut}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-400 text-xs">
                            {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ot' && (
            <StatusDetail data={otStatus} labelMap={STATUT_OT} colors={COLORS} max={maxOt} />
          )}
          {activeTab === 'di' && (
            <StatusDetail data={diStatus} labelMap={STATUT_DI} colors={COLORS.slice(2)} max={maxDi} />
          )}
          {activeTab === 'interventions' && (
            <StatusDetail data={intervStatus} labelMap={STATUT_INTERV} colors={COLORS.slice(3)} max={maxIv} />
          )}
        </>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function BigKpi({ icon, label, value, color, bg, onClick, highlight, subtext }: {
  icon: React.ReactNode; label: string; value: any; color: string; bg: string;
  onClick?: () => void; highlight?: boolean; subtext?: string
}) {
  const interactive = !!onClick
  return (
    <div
      onClick={onClick}
      className={`${bg} rounded-xl p-4 border border-gray-200
                  ${interactive ? 'cursor-pointer hover:shadow transition' : ''}
                  ${highlight ? 'ring-2 ring-offset-1 ring-current ring-opacity-30 ' + color : ''}`}>
      <div className={`flex items-center gap-1.5 ${color} mb-2 text-xs uppercase font-semibold tracking-wider`}>
        {icon}{label}
      </div>
      <div className={`text-3xl font-bold ${color} tabular-nums leading-none`}>{value}</div>
      {subtext && <div className={`text-[10px] mt-1 ${color} opacity-70`}>{subtext}</div>}
    </div>
  )
}

function ChartCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        {icon} {title}
      </h3>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>
}

function StatusDetail({ data, labelMap, colors, max }: any) {
  if (data.length === 0) return <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-400">Aucune donnée</div>
  const total = data.reduce((a: number, b: any) => a + b.count, 0)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-center">
          <Donut data={data} valueKey="count" colors={colors} size={200}/>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <div className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Distribution</div>
        <StatusBars data={data} labelMap={labelMap} colors={colors} max={max} />
        <div className="pt-3 border-t border-gray-100 text-sm text-gray-600">
          Total : <strong className="text-gray-900">{total}</strong>
        </div>
      </div>
    </div>
  )
}
