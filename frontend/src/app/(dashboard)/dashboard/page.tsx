'use client'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import api from '@/services/axiosInstance'
import { polesService } from '@/services/polesService'
import {
  Wrench, Activity, CheckCircle2,
  Clock, MapPin, FileText, RefreshCw,
  ClipboardList, AlertTriangle, ClipboardCheck,
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

const COLORS = [
  '#6366f1','#3b82f6','#8b5cf6','#f59e0b',
  '#10b981','#14b8a6','#ef4444','#ec4899',
]

async function apiGet<T>(url: string, params?: Record<string, any>): Promise<T | null> {
  try {
    const r = await api.get(url, { params })
    return r.data as T
  } catch { return null }
}

// ── Donut SVG ──
function Donut({ data, valueKey, colors, size = 150 }:
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="18"/>
      {data.map((d, i) => {
        const dash = (d[valueKey] || 0) / total * circ
        const seg = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={colors[i % colors.length]} strokeWidth="18"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}/>
        )
        offset += dash
        return seg
      })}
      <text x={cx} y={cy - 6} textAnchor="middle"
        style={{ fontSize: size * 0.14, fontWeight: 700, fill: 'currentColor' }}
        className="fill-gray-900">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle"
        style={{ fontSize: size * 0.065, fill: '#9ca3af' }}>total</text>
    </svg>
  )
}

// ── Status Bar Chart ──
function StatusBars({ data, labelMap, colors, max }: {
  data: any[]; labelMap: Record<string, string>; colors: string[]; max: number }) {
  return (
    <div className="space-y-2.5">
      {data.map((s, i) => (
        <div key={s.statut}>
          <div className="flex justify-between text-sm mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded shrink-0"
                style={{ background: colors[i % colors.length] }}/>
              <span className="text-gray-600 truncate">{labelMap[s.statut] || s.statut}</span>
            </div>
            <span className="font-semibold text-gray-900 shrink-0 ml-2">
              {s.count}
              <span className="text-gray-400 font-normal ml-1 text-xs">
                ({data.reduce((a, b) => a + b.count, 0) > 0
                  ? Math.round(s.count / data.reduce((a, b) => a + b.count, 0) * 100)
                  : 0}%)
              </span>
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${(s.count / max) * 100}%`,
                background: colors[i % colors.length] }}/>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const authUser = useSelector((s: RootState) => s.auth.user)
  const isAdmin  = authUser?.role === 'ADMIN'
  const userPoleId = authUser?.id_pole as number | undefined

  const [poles, setPoles] = useState<Pole[]>([])
  const [filtrePole, setFiltrePole] = useState<number | ''>('')
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  const [kpi, setKpi] = useState<any>(null)
  const [otStatus, setOtStatus] = useState<any[]>([])
  const [diStatus, setDiStatus] = useState<any[]>([])
  const [intervStatus, setIntervStatus] = useState<any[]>([])
  const [otZone, setOtZone] = useState<any[]>([])
  const [otPole, setOtPole] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])

  const activePole = isAdmin ? (filtrePole || undefined) : userPoleId
  const params = activePole ? { id_pole: activePole } : {}

  useEffect(() => {
    if (isAdmin) polesService.lister().then(setPoles)
  }, [])

  const charger = async () => {
    setLoading(true)
    const [k, ots, dis, ivs, oz, op, rec] = await Promise.all([
      apiGet<any>('/dashboard/live/kpi', params),
      apiGet<any[]>('/dashboard/live/ot-by-status', params),
      apiGet<any[]>('/dashboard/live/di-by-status', params),
      apiGet<any[]>('/dashboard/live/intervention-by-status', params),
      apiGet<any[]>('/dashboard/live/ot-by-zone', params),
      apiGet<any[]>('/dashboard/live/ot-by-pole'),
      apiGet<any[]>('/dashboard/live/recent', { ...params, limit: 12 }),
    ])
    setKpi(k); setOtStatus(ots || []); setDiStatus(dis || [])
    setIntervStatus(ivs || []); setOtZone(oz || []); setOtPole(op || [])
    setRecent(rec || [])
    setLoading(false)
  }

  useEffect(() => { charger() }, [activePole])

  const maxOt = Math.max(...otStatus.map(s => s.count), 1)
  const maxDi = Math.max(...diStatus.map(s => s.count), 1)
  const maxIv = Math.max(...intervStatus.map(s => s.count), 1)
  const maxZone = Math.max(...otZone.map(z => z.count), 1)

  const TABS = [
    { id: 'overview',      label: 'Vue d\'ensemble', icon: Activity },
    { id: 'ot',            label: 'OT',               icon: ClipboardList },
    { id: 'di',            label: 'DI',               icon: AlertTriangle },
    { id: 'interventions', label: 'Interventions',    icon: ClipboardCheck },
  ]

  const renderOverview = () => (
    <div className="space-y-4">
      {/* OT + DI Donuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">OT par statut</h3>
          {otStatus.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>
          : <div className="flex items-start gap-6">
              <Donut data={otStatus} valueKey="count" colors={COLORS} size={140}/>
              <div className="flex-1"><StatusBars data={otStatus} labelMap={STATUT_OT} colors={COLORS} max={maxOt}/></div>
            </div>}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">DI par statut</h3>
          {diStatus.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>
          : <div className="flex items-start gap-6">
              <Donut data={diStatus} valueKey="count" colors={COLORS.slice(2)} size={140}/>
              <div className="flex-1"><StatusBars data={diStatus} labelMap={STATUT_DI} colors={COLORS.slice(2)} max={maxDi}/></div>
            </div>}
        </div>
      </div>

      {/* Interventions + Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Interventions par statut validation</h3>
          {intervStatus.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>
          : <div className="flex items-start gap-6">
              <Donut data={intervStatus} valueKey="count" colors={COLORS.slice(3)} size={140}/>
              <div className="flex-1"><StatusBars data={intervStatus} labelMap={STATUT_INTERV} colors={COLORS.slice(3)} max={maxIv}/></div>
            </div>}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-6">OT par zone</h3>
          {otZone.length === 0 ? <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>
          : <div className="space-y-3">
              {otZone.map((z, i) => (
                <div key={z.zone}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-gray-400"/>
                      <span className="text-gray-600">{z.zone}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{z.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${(z.count / maxZone) * 100}%`, background: COLORS[i % COLORS.length] }}/>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      </div>

      {/* Poles (admin) */}
      {isAdmin && otPole.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-6">OT par pôle</h3>
          <div className="flex items-end gap-3 h-40">
            {otPole.map((p, i) => {
              const maxP = Math.max(...otPole.map(x => x.count), 1)
              return (
                <div key={p.pole} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">{p.count}</span>
                  <div className="w-full rounded-t-lg transition-all duration-700"
                    style={{ height: `${Math.max((p.count / maxP) * 100, 8)}%`, minHeight: 8,
                      background: COLORS[i % COLORS.length] }}/>
                  <span className="text-[10px] text-gray-500 text-center leading-tight">{p.pole}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recent.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Activités récentes (OT + DI)</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>{['Référence', 'Type', 'Détail', 'Statut', 'Date'].map(h =>
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              )}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3"><span className="font-mono font-semibold text-sm text-gray-900">{r.ref}</span></td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      r.type === 'OT' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {r.type === 'OT' ? <Wrench size={10}/> : <FileText size={10}/>}
                      {r.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{r.sous_type}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{STATUT_OT[r.statut] || STATUT_DI[r.statut] || r.statut}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // ── Detail view for a status type ──
  function StatusDetail({ data, labelMap, colors, max, typeFilter }: {
    data: any[]; labelMap: Record<string, string>; colors: string[];
    max: number; typeFilter?: string;
  }) {
    const filteredRecent = recent.filter(r => !typeFilter || r.type === typeFilter)
    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start gap-8">
            <div className="text-center">
              <Donut data={data} valueKey="count" colors={colors} size={160}/>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition des statuts</h3>
              <StatusBars data={data} labelMap={labelMap} colors={colors} max={max}/>
            </div>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {data.map((s, i) => (
            <div key={s.statut} className="bg-white border border-gray-200 rounded-xl p-4"
              style={{ borderTop: `3px solid ${colors[i % colors.length]}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                {labelMap[s.statut] || s.statut}
              </p>
              <p className="text-2xl font-bold text-gray-900">{s.count}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.reduce((a, b) => a + b.count, 0) > 0
                  ? `${Math.round(s.count / data.reduce((a, b) => a + b.count, 0) * 100)}% du total`
                  : '—'}
              </p>
            </div>
          ))}
        </div>

        {/* Recent table */}
        {filteredRecent.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Récent</h3>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>{['Référence', 'Détail', 'Statut', 'Date'].map(h =>
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                )}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecent.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3"><span className="font-mono font-semibold text-sm text-gray-900">{r.ref}</span></td>
                    <td className="px-5 py-3 text-sm text-gray-600">{r.sous_type}</td>
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium"
                        style={{ color: colors[data.findIndex(d => d.statut === r.statut) >= 0 ? data.findIndex(d => d.statut === r.statut) % colors.length : 0] }}>
                        {labelMap[r.statut] || r.statut}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Suivi des OT, DI et interventions
            {!isAdmin && ' — votre pôle'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <select value={filtrePole}
              onChange={e => setFiltrePole(e.target.value ? Number(e.target.value) : '')}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tous les pôles</option>
              {poles.map(p => <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>)}
            </select>
          )}
          <button onClick={charger} disabled={loading}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
          </button>
        </div>
      </div>

   
      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#003B7A] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <Icon size={15}/>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={28} className="animate-spin text-blue-500"/>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'ot' && (
            <StatusDetail data={otStatus} labelMap={STATUT_OT} colors={COLORS} max={maxOt} typeFilter="OT"/>
          )}
          {activeTab === 'di' && (
            <StatusDetail data={diStatus} labelMap={STATUT_DI} colors={COLORS.slice(2)} max={maxDi} typeFilter="DI"/>
          )}
          {activeTab === 'interventions' && (
            <StatusDetail data={intervStatus} labelMap={STATUT_INTERV} colors={COLORS.slice(3)} max={maxIv}/>
          )}
        </>
      )}
    </div>
  )
}
