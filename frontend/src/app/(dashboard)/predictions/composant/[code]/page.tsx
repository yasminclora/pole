'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, AlertOctagon, Wrench, Calendar, Loader2, X,
  CheckCircle2, History, Sparkles, Activity, BarChart3, Brain, TrendingDown,
  Package, Server, Cog,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { useComposantDetailML, useGenererOT } from '@/hooks/usePredictions'
import type { OTPredictifPayload, StatutRUL } from '@/types/prediction'

// ── Couleurs par statut ML ────────────────────────────────────────────────────
const STATUT_CFG: Record<StatutRUL, { c: string; bg: string; text: string; label: string }> = {
  CRITIQUE:     { c: '#dc2626', bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-700 dark:text-red-300',     label: 'Critique' },
  URGENT:       { c: '#ea580c', bg: 'bg-orange-50 dark:bg-orange-950/30',text: 'text-orange-700 dark:text-orange-300', label: 'Urgent' },
  SURVEILLANCE: { c: '#ca8a04', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', label: 'Surveillance' },
  OK:           { c: '#16a34a', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'OK' },
}

const fmtDA = (n: number | null | undefined) => {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M DA`
  if (n >= 1_000) return `${Math.round(n / 1_000)} K DA`
  return `${Math.round(n)} DA`
}
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const moisKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const moisLabel = (key: string) => {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ComposantDetailPage() {
  const { code }   = useParams<{ code: string }>()
  const router     = useRouter()
  const decoded    = decodeURIComponent(code)
  const { data: c, isLoading, error } = useComposantDetailML(decoded)
  const [showOTModal, setShowOTModal] = useState(false)

  // ── HISTOGRAMME : Pannes réelles vs prédites par mois ─────────────────────
  const histoComparatif = useMemo(() => {
    if (!c) return []
    const buckets: Record<string, { mois: string; reelles: number; predites: number }> = {}

    const ensure = (key: string) => {
      if (!buckets[key]) buckets[key] = { mois: key, reelles: 0, predites: 0 }
      return buckets[key]
    }

    for (const p of c.historique_pannes ?? []) {
      if (p.date_declaration) ensure(moisKey(p.date_declaration)).reelles++
    }
    for (const p of c.historique_predictions ?? []) {
      if (p.date_panne_prevue) ensure(moisKey(p.date_panne_prevue)).predites++
    }

    return Object.values(buckets).sort((a, b) => a.mois.localeCompare(b.mois))
  }, [c])

  // ── TABLEAU COMPARATIF : toutes les pannes (réelles + prédites) ──────────
  const evenementsCompares = useMemo(() => {
    if (!c) return []
    const list: any[] = []

    for (const p of c.historique_pannes ?? []) {
      if (!p.date_declaration) continue
      list.push({
        type:    'REELLE',
        date:    p.date_declaration,
        rul:     null,
        statut:  null,
        cout:    p.cout,
        duree:   p.date_fin
          ? Math.max(0, Math.floor((new Date(p.date_fin).getTime() - new Date(p.date_declaration).getTime()) / 86400000))
          : null,
        source:  p.source ?? null,
      })
    }
    for (const p of c.historique_predictions ?? []) {
      if (!p.date_panne_prevue) continue
      list.push({
        type:    'PREDITE',
        date:    p.date_panne_prevue,
        rul:     p.rul_jours,
        statut:  p.statut,
        cout:    null,
        duree:   null,
        source:  'ML',
      })
    }
    return list.sort((a, b) => b.date.localeCompare(a.date))   // récent en premier
  }, [c])

  // ── Stats comparatives ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!c) return null
    return {
      nb_reelles:   c.historique_pannes?.length ?? 0,
      nb_predites:  c.historique_predictions?.length ?? 0,
      ecart:        (c.historique_predictions?.length ?? 0) - (c.historique_pannes?.length ?? 0),
    }
  }, [c])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error || !c) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <AlertOctagon className="w-12 h-12 text-red-500" />
        <p className="text-gray-700 dark:text-gray-300">Composant introuvable.</p>
        <button onClick={() => router.back()} className="text-indigo-600 hover:underline">Retour</button>
      </div>
    )
  }

  const pred       = c.derniere_prediction
  const hasPred    = pred && pred.rul_jours != null
  const statutCfg  = hasPred ? STATUT_CFG[pred.statut as StatutRUL] : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">

        <button
          onClick={() => router.push('/predictions')}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="w-4 h-4" /> Retour aux prédictions
        </button>

        {/* ── HEADER + BIG RUL ────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-white to-slate-50 dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div
                className="p-3 rounded-2xl shadow-lg"
                style={{ background: `linear-gradient(135deg, ${statutCfg?.c ?? '#6366f1'}, ${statutCfg?.c ?? '#6366f1'}cc)` }}
              >
                <AlertOctagon className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="font-mono text-2xl font-bold text-gray-900 dark:text-white">{c.equipment_code}</div>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{c.description}</p>
                <div className="flex items-center gap-3 mt-3 flex-wrap text-xs">
                  <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-md font-medium">{c.system_equipment}</span>
                  <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-md font-medium">Pôle {c.pole}</span>
                  {c.comp_level != null && (
                    <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-md font-medium">Niveau {c.comp_level}</span>
                  )}
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded-md font-medium flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Prédiction ML
                  </span>
                </div>
              </div>
            </div>

            {hasPred && statutCfg ? (
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">RUL prédit</div>
                <div className="text-5xl font-bold tabular-nums" style={{ color: statutCfg.c }}>{pred.rul_jours}</div>
                <div className="text-sm font-medium" style={{ color: statutCfg.c }}>jours</div>
                <div className="text-xs text-gray-500 mt-2">
                  Panne prévue : <span className="font-medium">{fmtDate(pred.date_panne_prevue)}</span>
                </div>
                {pred.confiance_pct != null && (
                  <div className="text-xs text-gray-500">
                    Confiance : <span className="font-semibold">{pred.confiance_pct}%</span>
                  </div>
                )}
                <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-bold ${statutCfg.bg} ${statutCfg.text}`}>
                  {statutCfg.label}
                </span>
              </div>
            ) : (
              <div className="text-right text-sm text-gray-400">
                Aucune prédiction ML pour ce composant.
              </div>
            )}
          </div>

          {hasPred && statutCfg && (
            <div className={`mt-5 p-4 rounded-xl border-l-4 ${statutCfg.bg}`} style={{ borderLeftColor: statutCfg.c }}>
              <div className="flex items-start gap-3">
                <Sparkles className={`w-5 h-5 flex-shrink-0 ${statutCfg.text}`} />
                <div className={`text-sm ${statutCfg.text}`}>
                  <strong className="block mb-0.5">Recommandation</strong>
                  {pred.statut === 'CRITIQUE'     && 'Intervention immédiate requise — risque de panne sous 3 jours.'}
                  {pred.statut === 'URGENT'       && 'Planifier une intervention sous 7 jours.'}
                  {pred.statut === 'SURVEILLANCE' && 'Surveiller — intervention préventive recommandée sous 25 jours.'}
                  {pred.statut === 'OK'           && 'État stable, aucune action nécessaire.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── KPIs ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard icon={<AlertOctagon className="w-4 h-4" />} label="Nb pannes historiques"
                   value={c.kpis?.nb_pannes ?? 0} color="text-red-600" />
          <KpiCard icon={<Activity className="w-4 h-4" />}     label="MTBF"
                   value={c.kpis?.mtbf_jours != null ? `${c.kpis.mtbf_jours} j` : '—'} color="text-indigo-600" />
          <KpiCard icon={<Wrench className="w-4 h-4" />}       label="MTTR"
                   value={c.kpis?.mttr_jours != null ? `${c.kpis.mttr_jours} j` : '—'} color="text-amber-600" />
          <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Disponibilité"
                   value={c.kpis?.disponibilite != null ? `${c.kpis.disponibilite}%` : '—'} color="text-emerald-600" />
          <KpiCard icon={<TrendingDown className="w-4 h-4" />} label="Coût total"
                   value={fmtDA(c.kpis?.cout_total)} color="text-purple-600" />
        </div>

        {/* ── MACHINE RACINE + STOCK ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Machine racine / parente */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-slate-500 to-slate-700 rounded-lg">
                <Server className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Machine racine</h3>
                <p className="text-xs text-gray-500">Équipement et hiérarchie à laquelle ce composant appartient</p>
              </div>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <InfoRow icon={<Cog className="w-3.5 h-3.5" />}
                       label="Système / Machine"
                       value={c.machine_racine?.system_equipment ?? c.system_equipment ?? '—'}
                       mono />
              <InfoRow icon={<Server className="w-3.5 h-3.5" />}
                       label="Pôle"
                       value={c.machine_racine?.action_entity ?? c.pole ?? '—'} />
              {c.machine_racine?.parent_code && (
                <>
                  <InfoRow icon={<ArrowLeft className="w-3.5 h-3.5" />}
                           label="Équipement parent"
                           value={c.machine_racine.parent_code}
                           mono />
                  {c.machine_racine.parent_description && (
                    <InfoRow icon={<Sparkles className="w-3.5 h-3.5" />}
                             label="Description parent"
                             value={c.machine_racine.parent_description} />
                  )}
                  {c.machine_racine.parent_level != null && (
                    <InfoRow icon={<Activity className="w-3.5 h-3.5" />}
                             label="Niveau parent"
                             value={`Niveau ${c.machine_racine.parent_level}`} />
                  )}
                </>
              )}
              <InfoRow icon={<Activity className="w-3.5 h-3.5" />}
                       label="Niveau composant"
                       value={c.comp_level != null ? `Niveau ${c.comp_level}` : '—'} />
            </div>
          </div>

          {/* Stock pièces de rechange — multi-pièces via ComposanteStock */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                c.stock?.alerte_globale === 'ABSENT' ? 'bg-gradient-to-br from-red-500 to-red-700' :
                c.stock?.alerte_globale === 'FAIBLE' ? 'bg-gradient-to-br from-orange-500 to-orange-700' :
                c.stock?.alerte_globale === 'OK'     ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' :
                                                       'bg-gradient-to-br from-slate-400 to-slate-600'
              }`}>
                <Package className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Stock pièces de rechange</h3>
                <p className="text-xs text-gray-500">
                  {c.stock?.total_pieces != null ? `${c.stock.total_pieces} pièce(s) liée(s) à ce composant` : 'Vérification stock'}
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {c.stock == null ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  Ce composant n'est pas géré dans le module Stock.
                </div>
              ) : c.stock.total_pieces === 0 ? (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center gap-3">
                  <AlertOctagon className="w-8 h-8 text-red-500 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-red-700 dark:text-red-300">Aucune pièce associée</div>
                    <p className="text-xs text-red-600 mt-0.5">
                      Le composant existe mais aucune pièce de rechange n'est liée dans ComposanteStock.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Bandeau résumé */}
                  <div className={`p-3 rounded-xl flex items-center justify-between ${
                    c.stock.alerte_globale === 'ABSENT' ? 'bg-red-50 dark:bg-red-950/30' :
                    c.stock.alerte_globale === 'FAIBLE' ? 'bg-orange-50 dark:bg-orange-950/30' :
                                                          'bg-emerald-50 dark:bg-emerald-950/30'
                  }`}>
                    <div>
                      <div className={`text-xs font-medium uppercase tracking-wider ${
                        c.stock.alerte_globale === 'ABSENT' ? 'text-red-700 dark:text-red-300' :
                        c.stock.alerte_globale === 'FAIBLE' ? 'text-orange-700 dark:text-orange-300' :
                                                              'text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {c.stock.alerte_globale === 'ABSENT' ? 'Stock épuisé' :
                         c.stock.alerte_globale === 'FAIBLE' ? 'Stock faible' : 'Disponible'}
                      </div>
                      <div className="text-2xl font-bold tabular-nums mt-0.5">
                        {c.stock.total_quantite} <span className="text-xs font-normal text-gray-500">unités totales</span>
                      </div>
                    </div>
                    {c.stock.alerte_globale === 'OK'
                      ? <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      : <AlertOctagon className="w-8 h-8 text-red-500" />
                    }
                  </div>

                  {/* Liste des pièces */}
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {c.stock.pieces.map((p: any, i: number) => {
                      const al = p.alerte
                      const cfg =
                        al === 'ABSENT' ? { bg: 'bg-red-50 dark:bg-red-950/20',     txt: 'text-red-700 dark:text-red-300' } :
                        al === 'FAIBLE' ? { bg: 'bg-orange-50 dark:bg-orange-950/20',txt: 'text-orange-700 dark:text-orange-300' } :
                                          { bg: 'bg-gray-50 dark:bg-gray-800',      txt: 'text-gray-700 dark:text-gray-300' }
                      return (
                        <div key={i} className={`${cfg.bg} rounded-lg p-2.5 text-xs flex items-center gap-3`}>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            al === 'ABSENT' ? 'bg-red-200 text-red-800' :
                            al === 'FAIBLE' ? 'bg-orange-200 text-orange-800' :
                                              'bg-emerald-200 text-emerald-800'
                          }`}>{al}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[11px] font-semibold truncate">{p.code_stock}</div>
                            <div className={`text-[11px] truncate ${cfg.txt}`}>{p.designation}</div>
                            {p.emplacement && <div className="text-[10px] text-gray-500 truncate">📍 {p.emplacement}</div>}
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <div className="font-bold tabular-nums">{p.quantite} {p.unite ?? 'pcs'}</div>
                            <div className="text-[10px] text-gray-500">seuil {p.seuil_alerte}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── HISTOGRAMME COMPARATIF : RÉELLES vs PRÉDITES ─────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Pannes réelles vs Dernière panne prédite
                </h2>
                <p className="text-xs text-gray-500">
                  Toutes les pannes historiques + uniquement la dernière prédiction faite par le modèle
                </p>
              </div>
            </div>
            {stats && (
              <div className="flex gap-3 text-xs">
                <span className="px-3 py-1.5 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 rounded">
                  {stats.nb_reelles} panne(s) réelle(s)
                </span>
                <span className="px-3 py-1.5 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300 rounded">
                  {stats.nb_predites > 0 ? '1 prédiction (dernière)' : 'Aucune prédiction'}
                </span>
              </div>
            )}
          </div>

          <div className="p-4">
            {histoComparatif.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">
                Aucune donnée à comparer
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={histoComparatif} margin={{ top: 10, right: 20, bottom: 50, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="mois"
                    tick={{ fontSize: 10 }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                    tickFormatter={moisLabel}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={moisLabel}
                    formatter={(v: any, name: any) => [
                      `${v} panne(s)`,
                      name === 'reelles' ? 'Réelles' : 'Prédites',
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={v => v === 'reelles' ? 'Pannes réelles' : 'Pannes prédites'}
                  />
                  <Bar dataKey="reelles"  fill="#dc2626" name="reelles"  radius={[3, 3, 0, 0]} />
                  <Bar dataKey="predites" fill="#0891b2" name="predites" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── TABLEAU COMPARATIF : toutes les pannes ───────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
              <History className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Pannes historiques + Dernière prédiction
              </h3>
              <p className="text-xs text-gray-500">
                Toutes les pannes réelles + uniquement la dernière prédiction faite ·
                {evenementsCompares.length} ligne(s) · classées du plus récent au plus ancien
              </p>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 uppercase text-[10px] text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-center">RUL (j)</th>
                  <th className="px-3 py-2 text-center">Statut</th>
                  <th className="px-3 py-2 text-center">Durée</th>
                  <th className="px-3 py-2 text-right">Coût</th>
                  <th className="px-3 py-2 text-center">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {evenementsCompares.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Aucun événement</td></tr>
                ) : evenementsCompares.map((ev, i) => {
                  const isReel = ev.type === 'REELLE'
                  const statutCfg = ev.statut ? STATUT_CFG[ev.statut as StatutRUL] : null
                  return (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isReel
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300'
                        }`}>
                          {isReel ? 'RÉELLE' : 'PRÉDITE'}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {fmtDate(ev.date)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {ev.rul != null ? (
                          <span className="font-bold tabular-nums" style={{ color: statutCfg?.c ?? '#374151' }}>
                            {ev.rul}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {statutCfg
                          ? <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statutCfg.bg} ${statutCfg.text}`}>{statutCfg.label}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {ev.duree != null ? `${ev.duree}j` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {ev.cout != null ? fmtDA(ev.cout) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-500">{ev.source ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ACTION OT PRÉDICTIF ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Action prédictive</h3>
                <p className="text-xs text-gray-500">
                  Crée un Ordre de Travail anticipé basé sur la prédiction ML
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowOTModal(true)}
              disabled={!hasPred}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wrench className="w-4 h-4" />
              Générer un OT Prédictif
            </button>
          </div>
          {!hasPred && (
            <p className="px-5 pb-4 text-xs text-amber-600">
              Lancez d'abord une prédiction ML pour ce composant depuis la page Prédictions.
            </p>
          )}
        </div>

      </div>

      {showOTModal && hasPred && statutCfg && (
        <OTPredictifModal
          code={c.equipment_code}
          rulJours={pred.rul_jours}
          statut={pred.statut}
          onClose={() => setShowOTModal(false)}
        />
      )}
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: any; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className={`inline-flex items-center gap-1.5 ${color} mb-2`}>
        {icon}
        <span className="text-xs uppercase font-semibold tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function OTPredictifModal({
  code, rulJours, statut, onClose,
}: {
  code: string; rulJours: number; statut: string; onClose: () => void
}) {
  const mut = useGenererOT(code)

  const dateRecommandee = new Date(Date.now() + Math.max(1, rulJours - 2) * 86400_000).toISOString().slice(0, 16)
  const prioriteAuto =
    statut === 'CRITIQUE'     ? 'CRITIQUE' :
    statut === 'URGENT'       ? 'HAUTE'    :
    statut === 'SURVEILLANCE' ? 'NORMALE'  : 'FAIBLE'

  const [payload, setPayload] = useState<OTPredictifPayload>({
    equipment_code: code,
    classe        : 'MECANIQUE',
    priorite      : prioriteAuto as any,
    date_prevue   : dateRecommandee,
    duree_estimee : 120,
    description   : `Intervention prédictive ML — RUL estimé : ${rulJours} jours (${statut})`,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await mut.mutateAsync(payload)
      alert(`OT créé : ${res.numero_ot}`)
      onClose()
    } catch (err: any) {
      alert(`Erreur : ${err?.response?.data?.detail ?? err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                <h2 className="text-lg font-bold">Générer un OT Prédictif</h2>
              </div>
              <p className="text-sm text-white/80 mt-1 font-mono">{code}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Classe">
              <select
                value={payload.classe}
                onChange={e => setPayload(p => ({ ...p, classe: e.target.value as any }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                <option value="MECANIQUE">Mécanique</option>
                <option value="ELECTRIQUE">Électrique</option>
                <option value="GLOBALE">Mécano-électrique</option>
              </select>
            </Field>
            <Field label="Priorité">
              <select
                value={payload.priorite}
                onChange={e => setPayload(p => ({ ...p, priorite: e.target.value as any }))}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                <option value="FAIBLE">Faible</option>
                <option value="NORMALE">Normale</option>
                <option value="HAUTE">Haute</option>
                <option value="CRITIQUE">Critique</option>
              </select>
            </Field>
          </div>

          <Field label="Date et heure prévues">
            <input
              type="datetime-local"
              value={payload.date_prevue}
              onChange={e => setPayload(p => ({ ...p, date_prevue: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              required
            />
          </Field>

          <Field label="Durée estimée (minutes)">
            <input
              type="number" min={15} step={15}
              value={payload.duree_estimee}
              onChange={e => setPayload(p => ({ ...p, duree_estimee: parseInt(e.target.value || '0', 10) }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={3}
              value={payload.description}
              onChange={e => setPayload(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              required
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold shadow disabled:opacity-50"
            >
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {mut.isPending ? 'Création…' : 'Créer l\'OT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function InfoRow({ icon, label, value, mono = false }: {
  icon: React.ReactNode; label: string; value: any; mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1">
      <span className="flex items-center gap-1.5 text-gray-500 text-xs">{icon} {label}</span>
      <span className={`text-right font-medium text-gray-900 dark:text-gray-100 truncate ${mono ? 'font-mono text-xs' : ''}`} title={String(value)}>
        {value ?? '—'}
      </span>
    </div>
  )
}
