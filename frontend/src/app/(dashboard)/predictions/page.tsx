'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import {
  Brain, Play, Loader2, AlertOctagon, AlertTriangle, CheckCircle2,
  Package, History, ChevronRight, Search, X, Calendar, Cpu, Sparkles,
  Wrench, ArrowRight, MapPin, Factory, Cog, ShieldAlert, RefreshCw,
} from 'lucide-react'
import type { RootState } from '@/store/store'
import api from '@/services/axiosInstance'

// ─── Types ───────────────────────────────────────────────────────────
type ModelType = 'LSTM' | 'GRU'

interface ModelMetrics { r2?: number; mae?: number; recall?: number; f1?: number }

interface PredictionResultat {
  equipment_code:     string
  description?:       string | null
  system_equipment?:  string | null
  pole?:              string | null
  zone?:              string | null
  comp_level?:        number | null
  rul_jours:          number
  statut:             'CRITIQUE' | 'URGENT' | 'OK'
  date_panne_prevue:  string | null
  derniere_panne:     string | null
  confiance_pct:      number | null
  stock?: {
    total_pieces:    number
    total_quantite:  number
    alerte_globale:  'OK' | 'FAIBLE' | 'ABSENT'
    disponible:      boolean
    pieces:          any[]
  } | null
  stock_disponible:   number | null
  alerte_stock:       'OK' | 'FAIBLE' | 'ABSENT' | null
  ot_predictif_existant?: {
    id_ot:       number
    numero_ot:   string
    statut:      string
    date_prevue: string | null
  } | null
}

interface PredictionRunResponse {
  id_run:           number
  statut:           string
  duree_ms:         number
  model_type:       ModelType
  model_version:    string
  metrics:          ModelMetrics
  nb_composants:    number
  nb_sans_prediction: number
  nb_critiques:     number   // ROUGE
  nb_urgents:       number   // ORANGE
  nb_ok:            number   // VERT
  resultats:        PredictionResultat[]
  alertes_stock:    PredictionResultat[]
}

// ─── Configuration visuelle des 3 niveaux ────────────────────────────
const NIVEAU_CFG = {
  CRITIQUE: { label: 'ROUGE',  color: '#dc2626', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     ring: 'ring-red-100' },
  URGENT:   { label: 'ORANGE', color: '#ea580c', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  ring: 'ring-orange-100' },
  OK:       { label: 'VERT',   color: '#16a34a', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-100' },
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—'

// ═════════════════════════════════════════════════════════════════════════════
export default function PredictionsPage() {
  const router    = useRouter()
  const authUser  = useSelector((s: RootState) => s.auth.user)

  const [modelType, setModelType]       = useState<ModelType | null>(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [run, setRun]                   = useState<PredictionRunResponse | null>(null)

  // ── Persistance : restaure les résultats au montage depuis sessionStorage ─
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('predictions_run')
      if (saved) {
        const parsed = JSON.parse(saved)
        setRun(parsed.run ?? null)
        setModelType(parsed.modelType ?? null)
      }
    } catch {}
  }, [])

  // Sauvegarde le run dans sessionStorage à chaque changement
  useEffect(() => {
    try {
      if (run) {
        sessionStorage.setItem('predictions_run', JSON.stringify({ run, modelType }))
      } else {
        sessionStorage.removeItem('predictions_run')
      }
    } catch {}
  }, [run, modelType])

  // Filtres
  const [search, setSearch]             = useState('')
  const [filtreNiveau, setFiltreNiveau] = useState<'TOUS' | 'CRITIQUE' | 'URGENT' | 'OK'>('TOUS')
  const [dateDebut, setDateDebut]       = useState<string>('')
  const [dateFin, setDateFin]           = useState<string>('')

  // Modal composant
  const [modalCode, setModalCode]       = useState<string | null>(null)

  // ── Lancement ─────────────────────────────────────────────────────────────
  async function handleLancer() {
    if (!modelType) {
      setError('Veuillez choisir un modèle (LSTM ou GRU) avant de lancer la prédiction.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await api.post('/predictions/run', { model_type: modelType }, { timeout: 5 * 60_000 })
      setRun(res.data)
      setFiltreNiveau('TOUS')
      setSearch('')
      setDateDebut('')
      setDateFin('')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err.message ?? 'Erreur lors de la prédiction')
    } finally {
      setLoading(false)
    }
  }

  // ── Filtrage du tableau ───────────────────────────────────────────────────
  const resultatsFiltres = useMemo(() => {
    if (!run) return []
    let list = run.resultats
    if (filtreNiveau !== 'TOUS') list = list.filter(r => r.statut === filtreNiveau)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.equipment_code.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false) ||
        (r.system_equipment?.toLowerCase().includes(q) ?? false)
      )
    }
    if (dateDebut) {
      const d = new Date(dateDebut).getTime()
      list = list.filter(r => r.date_panne_prevue && new Date(r.date_panne_prevue).getTime() >= d)
    }
    if (dateFin) {
      const d = new Date(dateFin).getTime()
      list = list.filter(r => r.date_panne_prevue && new Date(r.date_panne_prevue).getTime() <= d)
    }
    return list
  }, [run, search, filtreNiveau, dateDebut, dateFin])

  const composantModal = modalCode ? run?.resultats.find(r => r.equipment_code === modalCode) : null

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">

      {/* ──────────────────────── HEADER ──────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>

        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
              <Brain size={28} className="text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Prédiction ML — Maintenance prédictive</h1>
          
            </div>
          </div>
          <button
            onClick={() => router.push('/predictions/historique')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition-all backdrop-blur-sm"
          >
            <History size={16}/> Historique des prédictions
          </button>
        </div>
      </div>

      {/* ──────────────────────── CHOIX MODÈLE ──────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Cpu size={18} className="text-[#003B7A]"/>
          <h2 className="font-bold text-gray-900">Choisir le modèle de prédiction</h2>
          <span className="text-xs text-red-600 font-semibold">* obligatoire</span>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card GRU */}
          <ModelCard
            type="GRU"
            selected={modelType === 'GRU'}
            onSelect={() => setModelType('GRU')}
            description="Modèle Champion — Performances supérieures"
            metrics={{ r2: 0.74, mae: 3.45, f1: 0.86, recall: 0.86 }}
            recommended
          />
          {/* Card LSTM */}
          <ModelCard
            type="LSTM"
            selected={modelType === 'LSTM'}
            onSelect={() => setModelType('LSTM')}
            description="Modèle PFE — Alternative robuste"
            metrics={{ r2: 0.72, mae: 3.76, f1: 0.85, recall: 0.84 }}
          />
        </div>

        <div className="px-6 pb-6 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            {modelType
              ? <><Sparkles size={14} className="text-emerald-500"/> <span><strong className="text-gray-900">{modelType}</strong> sélectionné. Prêt à lancer.</span></>
              : <><AlertTriangle size={14} className="text-amber-500"/> <span>Aucun modèle sélectionné</span></>
            }
          </p>
          <button
            onClick={handleLancer}
            disabled={loading || !modelType}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all
              bg-gradient-to-r from-[#003B7A] to-[#004a8f] hover:from-[#002a5a] hover:to-[#003B7A]
              disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin"/> Prédiction en cours…</>
              : <><Play size={16}/> Lancer la prédiction</>
            }
          </button>
        </div>

        {error && (
          <div className="mx-6 mb-6 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-sm text-red-700">
            <AlertOctagon size={16}/> {error}
          </div>
        )}
      </div>

      {/* ──────────────────────── RÉSULTATS ──────────────────────── */}
      {run && (
        <>
          {/* Bandeau résultat run */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Run #{run.id_run}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    run.model_type === 'GRU' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'
                  }`}>
                    {run.model_type} · {run.model_version}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {run.nb_composants} composants prédits · Durée {(run.duree_ms / 1000).toFixed(1)}s
                </h3>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <MetricsTrace metrics={run.metrics}/>
                <button
                  onClick={() => {
                    setRun(null)
                    setModelType(null)
                    setSearch('')
                    setFiltreNiveau('TOUS')
                    setDateDebut('')
                    setDateFin('')
                    setError(null)
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-600 border-2 border-gray-200 hover:border-[#003B7A] hover:text-[#003B7A] hover:bg-blue-50 transition-all"
                >
                  <RefreshCw size={13}/> Réinitialiser
                </button>
              </div>
            </div>

            {/* KPI cliquables (filtrent le tableau) */}
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="ROUGE — Urgent immédiat (≤5j)"  value={run.nb_critiques} cfg={NIVEAU_CFG.CRITIQUE}
                       active={filtreNiveau === 'CRITIQUE'} onClick={() => setFiltreNiveau(filtreNiveau === 'CRITIQUE' ? 'TOUS' : 'CRITIQUE')}/>
              <KpiCard label="ORANGE — À planifier (≤15j)"     value={run.nb_urgents}   cfg={NIVEAU_CFG.URGENT}
                       active={filtreNiveau === 'URGENT'}   onClick={() => setFiltreNiveau(filtreNiveau === 'URGENT'   ? 'TOUS' : 'URGENT')}/>
              <KpiCard label="VERT — État sain (>15j)"          value={run.nb_ok}        cfg={NIVEAU_CFG.OK}
                       active={filtreNiveau === 'OK'}       onClick={() => setFiltreNiveau(filtreNiveau === 'OK'       ? 'TOUS' : 'OK')}/>
            </div>
          </div>

          {/* ── Recherche ── */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  type="text"
                  placeholder="Rechercher par code composant, description, machine racine…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
                    focus:outline-none focus:border-[#003B7A] focus:bg-white focus:ring-4 focus:ring-[#003B7A]/10 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                    <X size={14}/>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                <Calendar size={14} className="text-gray-500"/>
                <span className="text-xs text-gray-500">Panne entre</span>
                <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                  className="text-xs bg-transparent border-0 focus:outline-none text-gray-900 font-medium"/>
                <span className="text-xs text-gray-400">→</span>
                <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
                  className="text-xs bg-transparent border-0 focus:outline-none text-gray-900 font-medium"/>
                {(dateDebut || dateFin) && (
                  <button onClick={() => { setDateDebut(''); setDateFin('') }} className="text-gray-400 hover:text-red-500">
                    <X size={12}/>
                  </button>
                )}
              </div>

              <span className="text-xs text-gray-500 ml-auto">
                {resultatsFiltres.length} / {run.resultats.length} composant{resultatsFiltres.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* ── Tableau résultats ── */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#003B7A' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100">Composant</th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100">Machine racine / Parent</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">RUL</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">Date panne prévue</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">Niveau</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">Stock</th>
                    <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">OT créé</th>
                    <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-blue-100 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resultatsFiltres.length === 0 ? (
                    <tr><td colSpan={8} className="py-16 text-center text-gray-400 text-sm">Aucun composant ne correspond aux filtres.</td></tr>
                  ) : resultatsFiltres.map(r => {
                    const cfg = NIVEAU_CFG[r.statut]
                    return (
                      <tr key={r.equipment_code}
                          onClick={() => setModalCode(r.equipment_code)}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-[#003B7A]">{r.equipment_code}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]" title={r.description ?? ''}>
                            {r.description ?? '—'}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-mono text-[11px] font-semibold text-gray-700">
                            {r.system_equipment ?? '—'}
                          </p>
                          {r.pole && (
                            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <Factory size={9}/> {r.pole}{r.zone ? ` · ${r.zone}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-lg font-bold tabular-nums" style={{ color: cfg.color }}>
                            {r.rul_jours}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-0.5">j</span>
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${cfg.bg} ${cfg.text}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }}/>
                              {cfg.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <p className="text-sm font-semibold text-gray-900">{fmtDate(r.date_panne_prevue)}</p>
                          {r.derniere_panne && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              dernière : {fmtDate(r.derniere_panne)}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-600">
                          {r.comp_level ? `Niveau ${r.comp_level}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <StockBadge alerte={r.alerte_stock} qty={r.stock_disponible}/>
                        </td>
                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                          {r.ot_predictif_existant ? (
                            <button
                              onClick={() => router.push(`/ot/${r.ot_predictif_existant!.id_ot}`)}
                              title={`Cliquer pour voir ${r.ot_predictif_existant.numero_ot}`}
                              className="inline-flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all">
                              <span className="flex items-center gap-1"><CheckCircle2 size={10}/> Créé</span>
                              <span className="font-mono text-[9px] opacity-80">{r.ot_predictif_existant.numero_ot}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-200">
                              Non créé
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right pr-4" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setModalCode(r.equipment_code)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#003B7A] text-white hover:bg-[#002a5a] transition-all">
                            Détail <ArrowRight size={12}/>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── État vide ── */}
      {!run && !loading && !error && (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-16 text-center">
          <Brain size={48} className="text-gray-300 mx-auto mb-3"/>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Sélectionnez un modèle (LSTM ou GRU) ci-dessus puis cliquez sur <strong>Lancer la prédiction</strong> pour évaluer l'état des composants de votre pôle.
          </p>
        </div>
      )}

      {/* ── Modal composant ── */}
      {composantModal && (
        <ComposantModal
          composant={composantModal}
          modelType={run!.model_type}
          onClose={() => setModalCode(null)}
          onVoirHistorique={(code) => router.push(`/predictions/composant/${encodeURIComponent(code)}`)}
          onCreerOT={(code) => router.push(`/predictions/composant/${encodeURIComponent(code)}?ot=1`)}
        />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  COMPOSANTS
// ═════════════════════════════════════════════════════════════════════════════

function ModelCard({ type, selected, onSelect, description, metrics, recommended }: {
  type: ModelType; selected: boolean; onSelect: () => void
  description: string
  metrics: { r2: number; mae: number; f1: number; recall: number }
  recommended?: boolean
}) {
  const color = type === 'GRU' ? '#4f46e5' : '#7c3aed'
  return (
    <button
      onClick={onSelect}
      className={`text-left p-5 rounded-2xl border-2 transition-all relative ${
        selected
          ? 'shadow-lg'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
      style={selected ? { borderColor: color, background: `${color}08` } : {}}
    >
      {recommended && (
        <span className="absolute -top-2 right-3 px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[9px] font-bold uppercase">
          Recommandé
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: `${color}15` }}>
            <Cpu size={20} style={{ color }}/>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{type}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        {selected && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: color }}>
            <CheckCircle2 size={14} className="text-white"/>
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Metric label="R²"     value={metrics.r2.toFixed(2)}     color={color}/>
        <Metric label="MAE"    value={`${metrics.mae.toFixed(1)}j`} color={color}/>
        <Metric label="F1"     value={metrics.f1.toFixed(2)}     color={color}/>
        <Metric label="Recall" value={metrics.recall.toFixed(2)} color={color}/>
      </div>
    </button>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg p-2">
      <div className="text-xs uppercase font-semibold text-gray-400">{label}</div>
      <div className="text-sm font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  )
}

function MetricsTrace({ metrics }: { metrics: ModelMetrics }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {metrics.r2 != null && <Pill label="R²"     value={metrics.r2.toFixed(2)}  color="indigo"/>}
      {metrics.mae != null && <Pill label="MAE"   value={`${metrics.mae.toFixed(2)}j`} color="purple"/>}
      {metrics.f1 != null && <Pill label="F1"     value={metrics.f1.toFixed(2)}  color="cyan"/>}
      {metrics.recall != null && <Pill label="Recall" value={metrics.recall.toFixed(2)} color="emerald"/>}
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: string; color: 'indigo' | 'purple' | 'cyan' | 'emerald' }) {
  const c: Record<string, string> = {
    indigo:  'bg-indigo-50 text-indigo-700',
    purple:  'bg-purple-50 text-purple-700',
    cyan:    'bg-cyan-50 text-cyan-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${c[color]}`}>
      {label} <strong className="font-bold ml-0.5">{value}</strong>
    </span>
  )
}

function KpiCard({ label, value, cfg, active, onClick }: {
  label: string; value: number
  cfg: { color: string; bg: string; text: string; border: string }
  active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-all ${cfg.bg} ${
        active ? cfg.border + ' shadow-md scale-[1.02]' : 'border-transparent hover:border-gray-200'
      }`}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: cfg.color }}>{label}</div>
      <div className="text-3xl font-bold tabular-nums" style={{ color: cfg.color }}>{value}</div>
    </button>
  )
}

function StockBadge({ alerte, qty }: { alerte: string | null; qty: number | null }) {
  if (alerte === 'ABSENT') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
      <Package size={10}/> ABSENT
    </span>
  )
  if (alerte === 'FAIBLE') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
      <Package size={10}/> FAIBLE ({qty})
    </span>
  )
  if (alerte === 'OK') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
      <Package size={10}/> {qty}
    </span>
  )
  return <span className="text-xs text-gray-400">—</span>
}

// ═════════════════════════════════════════════════════════════════════════════
//  MODAL COMPOSANT (compact)
// ═════════════════════════════════════════════════════════════════════════════
function ComposantModal({ composant, modelType, onClose, onVoirHistorique, onCreerOT }: {
  composant: PredictionResultat
  modelType: ModelType
  onClose: () => void
  onVoirHistorique: (code: string) => void
  onCreerOT: (code: string) => void
}) {
  const cfg = NIVEAU_CFG[composant.statut]
  const [detail, setDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)

  // Charge la hiérarchie complète + zone_code + OTs depuis le backend
  useEffect(() => {
    setLoadingDetail(true)
    api.get(`/predictions/composant/${encodeURIComponent(composant.equipment_code)}/detail`)
      .then(r => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false))
  }, [composant.equipment_code])

  const hierarchie: any[] = detail?.hierarchie ?? []
  const zoneCode = detail?.zone_code

  // OT prédictif existant pour ce composant — si au moins UN existe → bouton grisé
  const otsPredictifs: any[] = detail?.ots_predictifs ?? []
  const otExistant = useMemo(() => {
    return otsPredictifs.length > 0 ? otsPredictifs[0] : null
  }, [otsPredictifs])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#003B7A] to-[#004a8f] text-white p-5 rounded-t-2xl flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Cog size={18}/>
              <p className="font-mono text-sm font-bold truncate">{composant.equipment_code}</p>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20">
                {modelType}
              </span>
            </div>
            <p className="text-sm text-blue-100">{composant.description ?? '—'}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* ACTIONS PRINCIPALES en haut (ergonomie) */}
          <div className="flex gap-2">
            {otExistant ? (
              <button onClick={() => onCreerOT(composant.equipment_code)}   /* Le clic mène à la page composant, qui affichera l'OT */
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md hover:shadow-lg transition-all">
                <CheckCircle2 size={16}/>
                OT déjà créé : {otExistant.numero_ot}
              </button>
            ) : (
              <button onClick={() => onCreerOT(composant.equipment_code)}
                disabled={loadingDetail}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#003B7A] to-[#004a8f] hover:from-[#002a5a] hover:to-[#003B7A] shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loadingDetail ? <Loader2 size={16} className="animate-spin"/> : <Wrench size={16}/>}
                Créer un OT prédictif
              </button>
            )}
            <button onClick={() => onVoirHistorique(composant.equipment_code)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-bold hover:border-[#003B7A] hover:text-[#003B7A] hover:bg-blue-50 transition-all">
              <History size={16}/>
              Historique complet
            </button>
          </div>

          {/* Big RUL */}
          <div className={`p-5 rounded-2xl ${cfg.bg} ring-1 ${cfg.ring}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: cfg.color }}>
                  RUL prédit
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold tabular-nums" style={{ color: cfg.color }}>{composant.rul_jours}</span>
                  <span className="text-lg" style={{ color: cfg.color }}>jours</span>
                </div>
                <p className="text-sm mt-2" style={{ color: cfg.color }}>
                  Panne prévue : <strong>{fmtDate(composant.date_panne_prevue)}</strong>
                </p>
                {composant.derniere_panne && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Calcul depuis dernière panne : {fmtDate(composant.derniere_panne)}
                  </p>
                )}
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`}>
                {cfg.label}
              </span>
            </div>
          </div>

          {/* HIERARCHIE COMPLETE — chaque niveau avec code + description */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
              <Factory size={12}/> Hiérarchie complète
            </p>
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-3 border border-gray-200">
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 size={12} className="animate-spin"/> Chargement hiérarchie…
                </div>
              ) : hierarchie.length === 0 ? (
                <div className="text-xs text-gray-500 italic">Hiérarchie non disponible (composant non listé dans la table Equipement).</div>
              ) : (
                <div className="space-y-1.5">
                  {/* Affichage de la racine vers le composant pour bien lire */}
                  {[...hierarchie].reverse().map((h: any, i: number, arr: any[]) => {
                    const isRacine = h.is_racine
                    const isComp = i === arr.length - 1
                    return (
                      <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'ml-' + Math.min(i*4, 16) : ''}`}>
                        <span className="text-gray-300 text-xs">{i > 0 ? '└─' : ''}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isRacine ? 'bg-blue-100 text-blue-700' :
                          isComp   ? 'bg-emerald-100 text-emerald-700' :
                                     'bg-gray-100 text-gray-700'
                        }`}>
                          {isRacine ? 'RACINE' : isComp ? 'COMPOSANT' : `NIVEAU ${h.level}`}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#003B7A]">{h.code}</span>
                        <span className="text-xs text-gray-500 truncate">{h.description}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <InfoLine label="Pôle" value={composant.pole ?? '—'}/>
              <InfoLine label="Zone" value={zoneCode ?? '—'} mono/>
            </div>
          </div>

          {/* Stock */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
              <Package size={12}/> Pièces de rechange
            </p>
            {composant.stock?.pieces?.length ? (
              <div className="space-y-1.5">
                {composant.stock.pieces.map((p: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2.5 text-xs flex items-center gap-3">
                    <StockBadge alerte={p.alerte} qty={p.quantite}/>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] font-bold text-gray-900">{p.code_stock}</p>
                      <p className="text-[11px] text-gray-500 truncate">{p.designation}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Aucune pièce de rechange liée à ce composant dans le stock.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`font-medium text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
