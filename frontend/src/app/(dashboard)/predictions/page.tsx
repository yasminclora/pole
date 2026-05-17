'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Brain, Play, Loader2, AlertOctagon, AlertTriangle, CheckCircle2, Eye,
  Package, Clock, History, ChevronRight, Search, BarChart3, PieChart as PieIcon,
  Factory, MapPin, Layers, TrendingUp, GitCompare, Equal, ArrowRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  useModeleActif,
  useHistoriquePredictions,
  useLancerPrediction,
  useRunDetails,
  useComparaisonModeles,
} from '@/hooks/usePredictions'
import type {
  PredictionRun,
  PredictionResultat,
  StatutRUL,
  AlerteStock,
} from '@/types/prediction'

const STATUT_CFG: Record<StatutRUL, { color: string; bg: string; label: string; ord: number }> = {
  CRITIQUE:     { color: '#dc2626', bg: 'bg-red-100 text-red-700',         label: 'Critique',     ord: 1 },
  URGENT:       { color: '#ea580c', bg: 'bg-orange-100 text-orange-700',   label: 'Urgent',       ord: 2 },
  SURVEILLANCE: { color: '#ca8a04', bg: 'bg-amber-100 text-amber-700',     label: 'Surveillance', ord: 3 },
  OK:           { color: '#16a34a', bg: 'bg-emerald-100 text-emerald-700', label: 'OK',           ord: 4 },
}

const STOCK_CFG: Record<AlerteStock, { color: string; bg: string; label: string }> = {
  ABSENT: { color: '#dc2626', bg: 'bg-red-100 text-red-700',         label: 'Absent' },
  FAIBLE: { color: '#ea580c', bg: 'bg-orange-100 text-orange-700',   label: 'Faible' },
  OK:     { color: '#16a34a', bg: 'bg-emerald-100 text-emerald-700', label: 'OK' },
}

type TabKey = 'RESULTATS' | 'GRAPHES' | 'MACHINES' | 'COMPARAISON'

// ═════════════════════════════════════════════════════════════════════════════
export default function PredictionsPage() {
  const router = useRouter()

  const { data: modeleActif }      = useModeleActif()
  const { data: historique = [] }  = useHistoriquePredictions()
  const lancer                     = useLancerPrediction()
  const comparaison                = useComparaisonModeles()

  const [modelType, setModelType]    = useState<'AUTO' | 'GRU' | 'LSTM'>('AUTO')
  const [activeRunId, setActiveRun]  = useState<number | null>(null)
  const [search, setSearch]          = useState('')
  const [filtreStatut, setFiltre]    = useState<StatutRUL | 'TOUS'>('TOUS')
  const [tab, setTab]                = useState<TabKey>('RESULTATS')

  const runDetails = useRunDetails(activeRunId)
  const lastRun    = lancer.data as PredictionRun | undefined
  const runCourant: PredictionRun | undefined = activeRunId ? runDetails.data : lastRun

  async function handleLancer() {
    setActiveRun(null)
    try {
      await lancer.mutateAsync(modelType === 'AUTO' ? undefined : modelType)
    } catch {}
  }

  // ── Calculs dérivés ───────────────────────────────────────────────────────
  const tousResultats = runCourant?.resultats ?? []

  const resultatsFiltres = useMemo(() => {
    let list = tousResultats.slice()
    if (filtreStatut !== 'TOUS') list = list.filter(r => r.statut === filtreStatut)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.equipment_code.toLowerCase().includes(q) ||
        (r.equipment_desc?.toLowerCase().includes(q) ?? false) ||
        (r.system_equipment?.toLowerCase().includes(q) ?? false)
      )
    }
    return list.sort((a, b) => {
      const o = (STATUT_CFG[a.statut]?.ord ?? 9) - (STATUT_CFG[b.statut]?.ord ?? 9)
      return o !== 0 ? o : a.rul_jours - b.rul_jours
    })
  }, [tousResultats, filtreStatut, search])

  const alertesStock = useMemo(
    () => tousResultats.filter(r => r.alerte_stock === 'ABSENT' || r.alerte_stock === 'FAIBLE'),
    [tousResultats]
  )

  // Distribution par statut (pour donut + bar)
  const distStatut = useMemo(() => {
    const d = { CRITIQUE: 0, URGENT: 0, SURVEILLANCE: 0, OK: 0 }
    tousResultats.forEach(r => { d[r.statut] = (d[r.statut] || 0) + 1 })
    return (Object.entries(d) as [StatutRUL, number][])
      .filter(([, v]) => v > 0)
      .map(([statut, count]) => ({ statut, count, label: STATUT_CFG[statut].label, color: STATUT_CFG[statut].color }))
  }, [tousResultats])

  // Distribution des RUL (histogramme)
  const distRul = useMemo(() => {
    const buckets = [
      { range: '0-3j',   min: 0,  max: 3,  count: 0, color: '#dc2626' },
      { range: '4-10j',  min: 4,  max: 10, count: 0, color: '#ea580c' },
      { range: '11-20j', min: 11, max: 20, count: 0, color: '#f59e0b' },
      { range: '21-30j', min: 21, max: 30, count: 0, color: '#16a34a' },
    ]
    tousResultats.forEach(r => {
      const b = buckets.find(x => r.rul_jours >= x.min && r.rul_jours <= x.max)
      if (b) b.count++
    })
    return buckets
  }, [tousResultats])

  // Top 10 composants les plus critiques (RUL le plus bas)
  const top10Critiques = useMemo(() => {
    return tousResultats
      .slice()
      .sort((a, b) => a.rul_jours - b.rul_jours)
      .slice(0, 10)
      .map(r => ({
        code: r.equipment_code.length > 20 ? r.equipment_code.slice(0, 20) + '…' : r.equipment_code,
        full: r.equipment_code,
        rul:  r.rul_jours,
        statut: r.statut,
        couleur: STATUT_CFG[r.statut].color,
      }))
  }, [tousResultats])

  // Comparaison par machine (system_equipment)
  const parMachine = useMemo(() => {
    const byMachine: Record<string, { CRITIQUE: number; URGENT: number; SURVEILLANCE: number; OK: number; total: number }> = {}
    tousResultats.forEach(r => {
      const m = r.system_equipment ?? '—'
      if (!byMachine[m]) byMachine[m] = { CRITIQUE: 0, URGENT: 0, SURVEILLANCE: 0, OK: 0, total: 0 }
      byMachine[m][r.statut]++
      byMachine[m].total++
    })
    return Object.entries(byMachine)
      .map(([machine, c]) => ({
        machine,
        ...c,
        problematiques: c.CRITIQUE + c.URGENT,
      }))
      .sort((a, b) => b.problematiques - a.problematiques)
      .slice(0, 15)
  }, [tousResultats])

  // Comparaison par zone
  const parZone = useMemo(() => {
    const byZone: Record<string, { CRITIQUE: number; URGENT: number; SURVEILLANCE: number; OK: number; total: number }> = {}
    tousResultats.forEach(r => {
      const z = r.zone ?? r.pole ?? '—'
      if (!byZone[z]) byZone[z] = { CRITIQUE: 0, URGENT: 0, SURVEILLANCE: 0, OK: 0, total: 0 }
      byZone[z][r.statut]++
      byZone[z].total++
    })
    return Object.entries(byZone)
      .map(([zone, c]) => ({ zone, ...c, problematiques: c.CRITIQUE + c.URGENT }))
      .sort((a, b) => b.problematiques - a.problematiques)
  }, [tousResultats])

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Prédictions ML</h1>
            <p className="text-sm text-gray-500">Lance le modèle pour prédire le RUL de chaque composant</p>
          </div>
        </div>
      </div>

      {/* ── BLOC LANCEMENT ───────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">

          <div>
            <div className="flex items-center gap-2 text-xs uppercase font-semibold text-gray-500 mb-2">
              <Brain className="w-3 h-3" /> Modèle actif
            </div>
            {modeleActif ? (
              <>
                <div className="text-lg font-bold text-gray-900">
                  {modeleActif.type_modele} — {modeleActif.version}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{modeleActif.nom}</div>
                <div className="flex gap-3 mt-2 text-xs">
                  {modeleActif.metrics?.r2 != null && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">R² {modeleActif.metrics.r2.toFixed(2)}</span>
                  )}
                  {modeleActif.metrics?.mae != null && (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded">MAE {modeleActif.metrics.mae.toFixed(2)}j</span>
                  )}
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">{modeleActif.num_composants} composants</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-amber-600">Aucun modèle actif</div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase font-semibold text-gray-500 mb-2">Type de modèle</div>
            <div className="grid grid-cols-3 gap-2">
              {(['AUTO', 'GRU', 'LSTM'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setModelType(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                    modelType === t
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {t === 'AUTO' ? 'Modèle actif' : t}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {modelType === 'AUTO'
                ? 'Utilise le modèle actuellement actif.'
                : `Active automatiquement le dernier modèle ${modelType} avant le lancement.`}
            </p>
          </div>

          <div className="flex flex-col justify-end">
            <button
              onClick={handleLancer}
              disabled={lancer.isPending || !modeleActif}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lancer.isPending
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Prédiction en cours…</>
                : <><Play className="w-5 h-5" /> Lancer la prédiction</>}
            </button>
            {lancer.isError && (
              <p className="text-xs text-red-600 mt-2">
                {(lancer.error as any)?.response?.data?.detail ?? (lancer.error as any)?.message}
              </p>
            )}
            {lancer.isPending && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Première fois : 1-3 min (chargement TensorFlow + 33 composants × 12 prédictions).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      {runCourant && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={<AlertOctagon className="w-4 h-4" />}
                     label="Critiques" value={runCourant.nb_critiques ?? 0}
                     color="text-red-600" bg="bg-red-50"
                     onClick={() => { setFiltre('CRITIQUE'); setTab('RESULTATS') }} />
            <KpiCard icon={<AlertTriangle className="w-4 h-4" />}
                     label="Urgents" value={runCourant.nb_urgents ?? 0}
                     color="text-orange-600" bg="bg-orange-50"
                     onClick={() => { setFiltre('URGENT'); setTab('RESULTATS') }} />
            <KpiCard icon={<Eye className="w-4 h-4" />}
                     label="Surveillance" value={runCourant.nb_surveillance ?? 0}
                     color="text-amber-600" bg="bg-amber-50"
                     onClick={() => { setFiltre('SURVEILLANCE'); setTab('RESULTATS') }} />
            <KpiCard icon={<CheckCircle2 className="w-4 h-4" />}
                     label="OK" value={runCourant.nb_ok ?? 0}
                     color="text-emerald-600" bg="bg-emerald-50"
                     onClick={() => { setFiltre('OK'); setTab('RESULTATS') }} />
          </div>

          <div className="flex items-center flex-wrap gap-4 text-xs text-gray-500 px-1">
            <span>Run #{runCourant.id_run}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
              {new Date(runCourant.launched_at).toLocaleString('fr-FR')}
            </span>
            {runCourant.duree_ms != null && <span>Durée : {(runCourant.duree_ms / 1000).toFixed(1)}s</span>}
            <span>{tousResultats.length} composants analysés</span>
            {runCourant.pole && <span>Pôle : {runCourant.pole}</span>}
          </div>

          {/* ── TABS ───────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 flex overflow-x-auto">
              <TabBtn active={tab === 'RESULTATS'} onClick={() => setTab('RESULTATS')}
                      icon={<Layers className="w-4 h-4" />} label="Résultats"
                      count={tousResultats.length} />
              <TabBtn active={tab === 'GRAPHES'}   onClick={() => setTab('GRAPHES')}
                      icon={<BarChart3 className="w-4 h-4" />} label="Graphes & Analyses" />
              <TabBtn active={tab === 'MACHINES'}  onClick={() => setTab('MACHINES')}
                      icon={<Factory className="w-4 h-4" />} label="Machines & Zones" />
              <TabBtn active={tab === 'COMPARAISON'} onClick={() => { setTab('COMPARAISON'); comparaison.refetch() }}
                      icon={<GitCompare className="w-4 h-4" />} label="Comparaison LSTM / GRU" />
            </div>

            {/* ── TAB RÉSULTATS ─────────────────────────────────────────── */}
            {tab === 'RESULTATS' && (
              <>
                {alertesStock.length > 0 && (
                  <div className="m-4 bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-5 h-5 text-red-600" />
                      <h3 className="font-semibold text-red-900">Alertes stock ({alertesStock.length})</h3>
                    </div>
                    <p className="text-xs text-red-700 mb-3">
                      Composants critiques ou urgents avec stock insuffisant.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {alertesStock.slice(0, 6).map(r => (
                        <div
                          key={r.id_resultat ?? r.equipment_code}
                          onClick={() => router.push(`/predictions/composant/${encodeURIComponent(r.equipment_code)}`)}
                          className="cursor-pointer bg-white border border-red-200 rounded-lg p-3 hover:shadow"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-mono text-xs font-bold truncate">{r.equipment_code}</div>
                              <div className="text-xs text-gray-500 truncate">{r.equipment_desc}</div>
                            </div>
                            {r.alerte_stock && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${STOCK_CFG[r.alerte_stock].bg}`}>
                                {STOCK_CFG[r.alerte_stock].label}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between mt-2 text-xs">
                            <span>RUL : <strong style={{ color: STATUT_CFG[r.statut].color }}>{r.rul_jours}j</strong></span>
                            <span className="text-gray-500">Stock : {r.stock_disponible ?? '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {alertesStock.length > 6 && (
                      <p className="text-xs text-red-600 mt-2">+{alertesStock.length - 6} autres dans le tableau.</p>
                    )}
                  </div>
                )}

                <div className="px-5 py-3 border-y border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-medium text-gray-700">
                    {resultatsFiltres.length} / {tousResultats.length} composants
                  </p>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text" placeholder="Code, description, machine…"
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded-md w-56"
                      />
                    </div>
                    <select value={filtreStatut} onChange={e => setFiltre(e.target.value as any)}
                            className="text-xs px-2 py-1.5 border border-gray-300 rounded-md">
                      <option value="TOUS">Tous statuts</option>
                      <option value="CRITIQUE">Critique</option>
                      <option value="URGENT">Urgent</option>
                      <option value="SURVEILLANCE">Surveillance</option>
                      <option value="OK">OK</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0 uppercase text-[10px] text-gray-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Machine / Zone</th>
                        <th className="px-3 py-2 text-center">RUL</th>
                        <th className="px-3 py-2 text-center">Statut</th>
                        <th className="px-3 py-2 text-center">Conf.</th>
                        <th className="px-3 py-2 text-center">Panne prévue</th>
                        <th className="px-3 py-2 text-center">Stock</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {resultatsFiltres.length === 0 ? (
                        <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">Aucun résultat</td></tr>
                      ) : resultatsFiltres.map(r => (
                        <ResultRow key={r.id_resultat ?? r.equipment_code} r={r}
                                   onOpen={c => router.push(`/predictions/composant/${encodeURIComponent(c)}`)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── TAB GRAPHES ───────────────────────────────────────────── */}
            {tab === 'GRAPHES' && (
              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Donut statut */}
                <ChartCard title="Distribution par statut" icon={<PieIcon className="w-4 h-4" />}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={distStatut}
                        dataKey="count"
                        nameKey="label"
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={95}
                        paddingAngle={2}
                        label={({ count, label }) => `${label} ${count}`}
                      >
                        {distStatut.map(d => <Cell key={d.statut} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Histogramme RUL */}
                <ChartCard title="Distribution des RUL" icon={<BarChart3 className="w-4 h-4" />}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={distRul}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 12 }}
                               formatter={(v: any) => [`${v} composant(s)`, '']} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {distRul.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Top 10 critiques */}
                <div className="lg:col-span-2">
                  <ChartCard title="Top 10 — Composants les plus critiques" icon={<TrendingUp className="w-4 h-4" />}>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={top10Critiques} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="code" tick={{ fontSize: 10 }} width={170} />
                        <Tooltip contentStyle={{ fontSize: 12 }}
                                 formatter={(v: any) => [`${v} jours`, 'RUL']}
                                 labelFormatter={(_, p: any) => p?.[0]?.payload?.full ?? ''} />
                        <Bar dataKey="rul" radius={[0, 4, 4, 0]}>
                          {top10Critiques.map((d, i) => <Cell key={i} fill={d.couleur} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </div>
            )}

            {/* ── TAB MACHINES & ZONES ──────────────────────────────────── */}
            {tab === 'MACHINES' && (
              <div className="p-5 space-y-5">
                <ChartCard title="Top 15 machines avec composants à risque" icon={<Factory className="w-4 h-4" />}
                           subtitle="Empilage Critique + Urgent + Surveillance + OK">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={parMachine} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="machine" tick={{ fontSize: 10 }} width={180} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="CRITIQUE"     stackId="a" fill="#dc2626" />
                      <Bar dataKey="URGENT"       stackId="a" fill="#ea580c" />
                      <Bar dataKey="SURVEILLANCE" stackId="a" fill="#ca8a04" />
                      <Bar dataKey="OK"           stackId="a" fill="#16a34a" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {parZone.length > 0 && (
                  <ChartCard title="Comparaison par zone" icon={<MapPin className="w-4 h-4" />}>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={parZone}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="zone" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={70} interval={0} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="CRITIQUE"     stackId="z" fill="#dc2626" />
                        <Bar dataKey="URGENT"       stackId="z" fill="#ea580c" />
                        <Bar dataKey="SURVEILLANCE" stackId="z" fill="#ca8a04" />
                        <Bar dataKey="OK"           stackId="z" fill="#16a34a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Cartes machines détaillées */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Détail par machine</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {parMachine.map((m, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate" title={m.machine}>{m.machine}</div>
                            <div className="text-xs text-gray-500">{m.total} composant(s) test</div>
                          </div>
                          <span className={`text-lg font-bold ${m.problematiques > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {m.problematiques}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
                          <Stat lbl="Crit." val={m.CRITIQUE}     col="bg-red-100 text-red-700" />
                          <Stat lbl="Urg."  val={m.URGENT}       col="bg-orange-100 text-orange-700" />
                          <Stat lbl="Surv." val={m.SURVEILLANCE} col="bg-amber-100 text-amber-700" />
                          <Stat lbl="OK"    val={m.OK}           col="bg-emerald-100 text-emerald-700" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB COMPARAISON LSTM/GRU ──────────────────────────────── */}
            {tab === 'COMPARAISON' && (
              <ComparaisonTab data={comparaison.data} loading={comparaison.isLoading} onRefresh={() => comparaison.refetch()} />
            )}
          </div>
        </>
      )}

      {/* ── HISTORIQUE COMPLET ──────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Historique des prédictions</h2>
          <span className="ml-auto text-xs text-gray-500">{historique.length} run(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 uppercase text-[10px] text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Run</th>
                <th className="px-3 py-2 text-left">Lancé le</th>
                <th className="px-3 py-2 text-left">Pôle</th>
                <th className="px-3 py-2 text-center">Statut</th>
                <th className="px-3 py-2 text-center">Composants</th>
                <th className="px-3 py-2 text-center">Crit.</th>
                <th className="px-3 py-2 text-center">Urg.</th>
                <th className="px-3 py-2 text-center">Surv.</th>
                <th className="px-3 py-2 text-center">OK</th>
                <th className="px-3 py-2 text-center">Durée</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historique.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">Aucun run</td></tr>
              ) : historique.map(h => (
                <tr key={h.id_run}
                    className={`hover:bg-gray-50 ${activeRunId === h.id_run ? 'bg-indigo-50' : ''}`}>
                  <td className="px-4 py-2 font-semibold">#{h.id_run}</td>
                  <td className="px-3 py-2">{new Date(h.launched_at).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2">{h.pole ?? <span className="text-gray-400">tous</span>}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      h.statut === 'TERMINE' ? 'bg-emerald-100 text-emerald-700' :
                      h.statut === 'ERREUR'  ? 'bg-red-100 text-red-700' :
                                               'bg-amber-100 text-amber-700'
                    }`}>{h.statut}</span>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{h.nb_composants ?? '—'}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-red-600 font-semibold">{h.nb_critiques ?? '—'}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-orange-600">{h.nb_urgents ?? '—'}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-amber-600">{h.nb_surveillance ?? '—'}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-emerald-600">{h.nb_ok ?? '—'}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-500">
                    {h.duree_ms != null ? `${(h.duree_ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => setActiveRun(h.id_run)} disabled={h.statut !== 'TERMINE'}
                            className="text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-30">
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!runCourant && historique.length === 0 && !lancer.isPending && (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
          <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Aucun run. Clique sur <strong>Lancer la prédiction</strong> pour commencer.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, bg, onClick }: {
  icon: React.ReactNode; label: string; value: any; color: string; bg: string; onClick?: () => void
}) {
  return (
    <button onClick={onClick}
            className={`text-left ${bg} border border-gray-200 rounded-xl p-4 hover:shadow transition`}>
      <div className={`flex items-center gap-1.5 ${color} mb-1 text-xs uppercase font-semibold`}>
        {icon} {label}
      </div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
    </button>
  )
}

function TabBtn({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number
}) {
  return (
    <button onClick={onClick}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              active
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}>
      {icon} {label}
      {count != null && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
          active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
        }`}>{count}</span>
      )}
    </button>
  )
}

function ChartCard({ title, icon, subtitle, children }: {
  title: string; icon?: React.ReactNode; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-indigo-600">{icon}</span>}
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Stat({ lbl, val, col }: { lbl: string; val: number; col: string }) {
  return (
    <div className={`${col} rounded px-1.5 py-1`}>
      <div className="font-bold text-xs">{val}</div>
      <div className="text-[9px] opacity-75">{lbl}</div>
    </div>
  )
}

// ── Comparaison LSTM vs GRU ─────────────────────────────────────────────────
function ComparaisonTab({ data, loading, onRefresh }: { data: any; loading: boolean; onRefresh: () => void }) {
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState<'TOUS' | 'DESACCORD' | 'LSTM_PIRE' | 'GRU_PIRE'>('TOUS')

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement de la comparaison…
      </div>
    )
  }

  if (!data || (!data.lstm_run && !data.gru_run)) {
    return (
      <div className="p-10 text-center">
        <GitCompare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 mb-1">Aucune comparaison disponible.</p>
        <p className="text-xs text-gray-400 mb-4">
          Lance d'abord <strong>une prédiction GRU</strong> puis <strong>une prédiction LSTM</strong> pour pouvoir les comparer.
        </p>
      </div>
    )
  }

  if (!data.lstm_run || !data.gru_run) {
    const manquant = !data.lstm_run ? 'LSTM' : 'GRU'
    const present  = data.lstm_run ? 'LSTM' : 'GRU'
    return (
      <div className="p-10 text-center">
        <AlertOctagon className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <p className="text-sm text-gray-700 mb-1">
          Run <strong>{present}</strong> trouvé, mais aucun run <strong>{manquant}</strong>.
        </p>
        <p className="text-xs text-gray-500">
          Relance une prédiction en choisissant le modèle <strong>{manquant}</strong> pour pouvoir comparer.
        </p>
      </div>
    )
  }

  const filteredComparaison = (data.comparaison ?? []).filter((c: any) => {
    if (search) {
      const q = search.toLowerCase()
      if (!c.equipment_code.toLowerCase().includes(q)
          && !(c.equipment_desc?.toLowerCase().includes(q))) return false
    }
    if (filtre === 'DESACCORD') return c.lstm && c.gru && !c.meme_statut
    if (filtre === 'LSTM_PIRE') return c.plus_critique === 'LSTM'
    if (filtre === 'GRU_PIRE')  return c.plus_critique === 'GRU'
    return true
  })

  return (
    <div className="p-5 space-y-5">

      {/* Bandeau runs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RunBanner label="LSTM" color="purple" run={data.lstm_run} />
        <RunBanner label="GRU"  color="cyan"   run={data.gru_run}  />
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CompStat label="Composants en commun"      value={data.nb_composants_communs}
                  color="text-indigo-600" bg="bg-indigo-50" />
        <CompStat label="Écart RUL moyen"            value={data.stats?.ecart_moyen_rul != null ? `${data.stats.ecart_moyen_rul}j` : '—'}
                  color="text-amber-600" bg="bg-amber-50" />
        <CompStat label="Statuts identiques"         value={data.stats?.taux_accord_pct != null ? `${data.stats.taux_accord_pct}%` : '—'}
                  color={data.stats?.taux_accord_pct >= 70 ? 'text-emerald-600' : 'text-orange-600'}
                  bg={data.stats?.taux_accord_pct >= 70 ? 'bg-emerald-50' : 'bg-orange-50'} />
        <CompStat label="LSTM / GRU plus critique"
                  value={`${data.stats?.nb_lstm_plus_critique ?? 0} / ${data.stats?.nb_gru_plus_critique ?? 0}`}
                  color="text-purple-600" bg="bg-purple-50" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher composant…"
                 value={search} onChange={e => setSearch(e.target.value)}
                 className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded-md" />
        </div>
        <select value={filtre} onChange={e => setFiltre(e.target.value as any)}
                className="text-xs px-2 py-1.5 border border-gray-300 rounded-md">
          <option value="TOUS">Tous ({data.comparaison?.length ?? 0})</option>
          <option value="DESACCORD">Statuts différents</option>
          <option value="LSTM_PIRE">LSTM plus critique</option>
          <option value="GRU_PIRE">GRU plus critique</option>
        </select>
        <button onClick={onRefresh}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50">
          Actualiser
        </button>
      </div>

      {/* Tableau comparatif */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 uppercase text-[10px] text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Composant</th>
                <th className="px-3 py-2 text-center bg-purple-50">LSTM<br/>RUL</th>
                <th className="px-3 py-2 text-center bg-purple-50">LSTM<br/>Statut</th>
                <th className="px-3 py-2 text-center bg-cyan-50">GRU<br/>RUL</th>
                <th className="px-3 py-2 text-center bg-cyan-50">GRU<br/>Statut</th>
                <th className="px-3 py-2 text-center">Écart</th>
                <th className="px-3 py-2 text-center">Accord</th>
                <th className="px-3 py-2 text-center">Plus critique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredComparaison.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Aucun composant</td></tr>
              ) : filteredComparaison.map((c: any) => {
                const lstmCfg = c.lstm ? STATUT_CFG[c.lstm.statut as StatutRUL] : null
                const gruCfg  = c.gru  ? STATUT_CFG[c.gru.statut  as StatutRUL] : null
                return (
                  <tr key={c.equipment_code} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="font-mono text-[11px] font-semibold text-gray-900">{c.equipment_code}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[200px]" title={c.equipment_desc}>{c.equipment_desc}</div>
                    </td>
                    <td className="px-3 py-2 text-center font-bold tabular-nums bg-purple-50/40"
                        style={{ color: lstmCfg?.color ?? '#9ca3af' }}>
                      {c.lstm?.rul_jours ?? '—'}{c.lstm && 'j'}
                    </td>
                    <td className="px-3 py-2 text-center bg-purple-50/40">
                      {lstmCfg ? <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lstmCfg.bg}`}>{lstmCfg.label}</span> : '—'}
                    </td>
                    <td className="px-3 py-2 text-center font-bold tabular-nums bg-cyan-50/40"
                        style={{ color: gruCfg?.color ?? '#9ca3af' }}>
                      {c.gru?.rul_jours ?? '—'}{c.gru && 'j'}
                    </td>
                    <td className="px-3 py-2 text-center bg-cyan-50/40">
                      {gruCfg ? <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${gruCfg.bg}`}>{gruCfg.label}</span> : '—'}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {c.ecart_rul != null ? (
                        <span className={c.ecart_rul <= 2 ? 'text-emerald-600' : c.ecart_rul <= 5 ? 'text-amber-600' : 'text-red-600 font-bold'}>
                          {c.ecart_rul}j
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.meme_statut === true ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle2 className="w-3 h-3" /> Oui</span>
                      ) : c.meme_statut === false ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium"><AlertTriangle className="w-3 h-3" /> Non</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.plus_critique === 'LSTM' && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">LSTM</span>}
                      {c.plus_critique === 'GRU'  && <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 text-[10px] font-bold">GRU</span>}
                      {c.plus_critique === 'EGAL' && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold inline-flex items-center gap-1"><Equal className="w-2.5 h-2.5" /> Égal</span>}
                      {c.plus_critique == null && <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Comparaison entre le run LSTM #{data.lstm_run?.id_run} et le run GRU #{data.gru_run?.id_run}
        {data.nb_lstm_seul > 0 && <> · {data.nb_lstm_seul} composant(s) uniquement dans LSTM</>}
        {data.nb_gru_seul > 0  && <> · {data.nb_gru_seul} composant(s) uniquement dans GRU</>}
      </p>
    </div>
  )
}

function RunBanner({ label, color, run }: { label: string; color: 'purple'|'cyan'; run: any }) {
  const palette = color === 'purple'
    ? { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }
    : { bg: 'bg-cyan-50',   border: 'border-cyan-200',   text: 'text-cyan-700'   }
  return (
    <div className={`${palette.bg} border ${palette.border} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`text-sm font-bold ${palette.text} flex items-center gap-2`}>
          <Brain className="w-4 h-4" /> Run {label}
        </div>
        <span className="text-[10px] text-gray-500">#{run.id_run}</span>
      </div>
      <div className="text-xs text-gray-600">
        {run.launched_at && (
          <div>Lancé le {new Date(run.launched_at).toLocaleString('fr-FR')}</div>
        )}
        <div>Durée : {run.duree_ms != null ? `${(run.duree_ms / 1000).toFixed(1)}s` : '—'}</div>
      </div>
      <div className="grid grid-cols-4 gap-1 mt-3 text-center text-[10px]">
        <div className="bg-red-100 text-red-700 rounded px-1 py-1">
          <div className="font-bold text-sm">{run.nb_critiques ?? 0}</div>
          <div>Crit.</div>
        </div>
        <div className="bg-orange-100 text-orange-700 rounded px-1 py-1">
          <div className="font-bold text-sm">{run.nb_urgents ?? 0}</div>
          <div>Urg.</div>
        </div>
        <div className="bg-amber-100 text-amber-700 rounded px-1 py-1">
          <div className="font-bold text-sm">{run.nb_surveillance ?? 0}</div>
          <div>Surv.</div>
        </div>
        <div className="bg-emerald-100 text-emerald-700 rounded px-1 py-1">
          <div className="font-bold text-sm">{run.nb_ok ?? 0}</div>
          <div>OK</div>
        </div>
      </div>
    </div>
  )
}

function CompStat({ label, value, color, bg }: { label: string; value: any; color: string; bg: string }) {
  return (
    <div className={`${bg} border border-gray-200 rounded-xl p-4`}>
      <div className={`text-xs uppercase font-semibold tracking-wider ${color} mb-1`}>{label}</div>
      <div className={`text-2xl font-bold ${color} tabular-nums`}>{value}</div>
    </div>
  )
}

function ResultRow({ r, onOpen }: { r: PredictionResultat; onOpen: (code: string) => void }) {
  const cfg = STATUT_CFG[r.statut]
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 font-mono text-[11px] font-semibold">{r.equipment_code}</td>
      <td className="px-3 py-2 max-w-[220px] truncate" title={r.equipment_desc ?? ''}>{r.equipment_desc ?? '—'}</td>
      <td className="px-3 py-2">
        <div className="truncate max-w-[140px]" title={r.system_equipment ?? ''}>{r.system_equipment ?? '—'}</div>
        <div className="text-[10px] text-gray-500 truncate max-w-[140px]">
          {r.zone ?? r.pole ?? ''}
        </div>
      </td>
      <td className="px-3 py-2 text-center font-bold tabular-nums" style={{ color: cfg.color }}>
        {r.rul_jours} j
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bg}`}>{cfg.label}</span>
      </td>
      <td className="px-3 py-2 text-center text-gray-500 tabular-nums">
        {r.confiance_pct != null ? `${r.confiance_pct}%` : '—'}
      </td>
      <td className="px-3 py-2 text-center tabular-nums">
        {r.date_panne_prevue ? new Date(r.date_panne_prevue).toLocaleDateString('fr-FR') : '—'}
      </td>
      <td className="px-3 py-2 text-center">
        {r.alerte_stock ? (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STOCK_CFG[r.alerte_stock].bg}`}>
            {STOCK_CFG[r.alerte_stock].label}
            {r.stock_disponible != null && ` (${r.stock_disponible})`}
          </span>
        ) : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2 text-center">
        <button onClick={() => onOpen(r.equipment_code)}
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium">
          Détail <ChevronRight className="w-3 h-3" />
        </button>
      </td>
    </tr>
  )
}
