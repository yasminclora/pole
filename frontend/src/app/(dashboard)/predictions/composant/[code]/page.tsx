'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, AlertOctagon, Wrench, Calendar, Loader2, X,
  CheckCircle2, History, Sparkles, BarChart3, Brain,
  Package, Server, Cog, MapPin, ExternalLink, Factory,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useComposantDetailML, useGenererOT } from '@/hooks/usePredictions'
import type { OTPredictifPayload, StatutRUL } from '@/types/prediction'

// ── Configuration 3 niveaux ──────────────────────────────────────────────────
const STATUT_CFG: Record<string, { c: string; bg: string; text: string; label: string }> = {
  CRITIQUE: { c: '#dc2626', bg: 'bg-red-50',     text: 'text-red-700',     label: 'ROUGE' },
  URGENT:   { c: '#ea580c', bg: 'bg-orange-50',  text: 'text-orange-700',  label: 'ORANGE' },
  OK:       { c: '#16a34a', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'VERT' },
  // compat anciennes valeurs
  SURVEILLANCE: { c: '#ca8a04', bg: 'bg-amber-50', text: 'text-amber-700', label: 'AMBRE' },
}

const fmtDA = (n: number | null | undefined) => {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M DA`
  if (n >= 1_000) return `${Math.round(n / 1_000)} K DA`
  return `${Math.round(n)} DA`
}
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const monthKey = (iso: string) => {
  const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ComposantDetailPage() {
  const { code }      = useParams<{ code: string }>()
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const fromHistorique = searchParams.get('from') === 'historique'
  const fromRun       = searchParams.get('from_run')

  const decoded = decodeURIComponent(code)
  const { data: c, isLoading, error } = useComposantDetailML(decoded)
  const [showOTModal, setShowOTModal] = useState(false)

  // Bouton retour : selon l'origine de navigation
  const handleRetour = () => {
    if (fromRun) {
      router.push(`/predictions/historique/${fromRun}`)
    } else if (fromHistorique) {
      router.push('/predictions/historique')
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/predictions')
    }
  }

  // ── HISTOGRAMME : Réelles vs Prédites par mois (avec date exacte au survol) ─
  const histoComparatif = useMemo(() => {
    if (!c) return []
    const buckets: Record<string, { mois: string; reelles: number; predites: number; dates_reelles: string[]; dates_predites: string[] }> = {}
    const ensure = (key: string) => {
      if (!buckets[key]) buckets[key] = { mois: key, reelles: 0, predites: 0, dates_reelles: [], dates_predites: [] }
      return buckets[key]
    }
    for (const p of c.historique_pannes ?? []) {
      if (p.date_declaration) {
        const b = ensure(monthKey(p.date_declaration))
        b.reelles++
        b.dates_reelles.push(p.date_declaration)
      }
    }
    for (const p of c.historique_predictions ?? []) {
      if (p.date_panne_prevue) {
        const b = ensure(monthKey(p.date_panne_prevue))
        b.predites++
        b.dates_predites.push(p.date_panne_prevue)
      }
    }
    return Object.values(buckets).sort((a, b) => a.mois.localeCompare(b.mois))
  }, [c])

  // ── TABLEAU COMPARATIF : pannes + prédictions ───────────────────────────────
  const evenementsCompares = useMemo(() => {
    if (!c) return []
    const list: any[] = []
    for (const p of c.historique_pannes ?? []) {
      if (!p.date_declaration) continue
      list.push({
        type:    'Réelle',
        date:    p.date_declaration,
        rul:     null,
        statut:  null,
        cout:    p.cout,
        source:  'Historique CORR',
        ot_associe: p.ot_associe ?? null,
      })
    }
    for (const p of c.historique_predictions ?? []) {
      if (!p.date_panne_prevue) continue
      list.push({
        type:    'Prédite',
        date:    p.date_panne_prevue,
        rul:     p.rul_jours,
        statut:  p.statut,
        cout:    null,
        source:  'Prédictive',
        ot_associe: p.ot_associe ?? null,
      })
    }
    return list.sort((a, b) => b.date.localeCompare(a.date))
  }, [c])

  // ⚠ TOUS les hooks doivent être déclarés AVANT les returns conditionnels
  // Si AU MOINS UN OT prédictif existe pour ce composant → bouton grisé.
  const otExistantPourCetteRUL = useMemo(() => {
    if (!c) return null
    const otsPredictifs: any[] = c.ots_predictifs ?? []
    return otsPredictifs.length > 0 ? otsPredictifs[0] : null
  }, [c])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  )

  if (error || !c) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <AlertOctagon className="w-12 h-12 text-red-500" />
      <p className="text-gray-700">Composant introuvable.</p>
      <button onClick={handleRetour} className="text-indigo-600 hover:underline">Retour</button>
    </div>
  )

  const pred       = c.derniere_prediction
  const hasPred    = pred && pred.rul_jours != null
  const statutCfg  = hasPred ? (STATUT_CFG[pred.statut as string] ?? STATUT_CFG.OK) : null
  const otDejaCree = !!otExistantPourCetteRUL

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">

        <button onClick={handleRetour}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#003B7A] transition-colors">
          <ArrowLeft className="w-4 h-4"/>
          {fromRun ? `Retour ` :
           fromHistorique ? 'Retour à l\'historique' :
                            'Retour aux prédictions'}
        </button>

        {/* ── HEADER unifié style CEVITAL ──────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-6 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>

          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg flex-shrink-0">
                <Cog className="w-7 h-7"/>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-2xl font-bold tracking-tight truncate">{c.equipment_code}</div>
                <p className="text-blue-100 mt-1 truncate">{c.description}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                  <span className="px-2 py-1 rounded-md bg-white/10 backdrop-blur-sm">{c.system_equipment}</span>
                  <span className="px-2 py-1 rounded-md bg-white/10 backdrop-blur-sm">Pôle {c.pole}</span>
                  {c.zone_code && (
                    <span className="px-2 py-1 rounded-md bg-white/10 backdrop-blur-sm flex items-center gap-1">
                      <MapPin size={10}/> {c.zone_code}
                    </span>
                  )}
                  {c.comp_level != null && (
                    <span className="px-2 py-1 rounded-md bg-white/10 backdrop-blur-sm">Niveau {c.comp_level}</span>
                  )}
                  <span className="px-2 py-1 rounded-md bg-indigo-500/40 flex items-center gap-1">
                    <Brain size={10}/> Prédiction ML
                  </span>
                </div>
              </div>
            </div>

            {hasPred && statutCfg && (
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-blue-200 mb-1">RUL prédit</div>
                <div className="text-5xl font-bold tabular-nums">{pred.rul_jours}<span className="text-xl ml-1">j</span></div>
                <div className="text-sm text-blue-100 mt-1">
                  Panne prévue : <strong>{fmtDate(pred.date_panne_prevue)}</strong>
                </div>
                <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-bold bg-white/15 backdrop-blur-sm border border-white/20`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: statutCfg.c }}/>
                  {statutCfg.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── ACTIONS PRINCIPALES (en HAUT pour ergonomie) ─────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Sparkles size={16} className="text-[#003B7A]"/>
            {hasPred ? (
              <span>
                <strong>Recommandation :</strong>
                {pred.statut === 'CRITIQUE' && ' Intervention immédiate requise (≤5j)'}
                {pred.statut === 'URGENT'   && ' Planifier une intervention sous 15 jours'}
                {pred.statut === 'OK'       && ' État stable, surveillance préventive'}
              </span>
            ) : (
              <span className="text-amber-600">Aucune prédiction ML pour ce composant.</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/predictions/historique')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:border-[#003B7A] hover:text-[#003B7A] hover:bg-blue-50 transition-all">
              <History size={14}/> Historique
            </button>

            {otDejaCree ? (
              <button onClick={() => router.push(`/ot/${otExistantPourCetteRUL.id_ot}`)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all
                           bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800">
                <CheckCircle2 size={14}/> OT déjà créé : {otExistantPourCetteRUL.numero_ot}
              </button>
            ) : (
              <button onClick={() => setShowOTModal(true)} disabled={!hasPred}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all
                           bg-gradient-to-r from-[#003B7A] to-[#004a8f] hover:from-[#002a5a] hover:to-[#003B7A]
                           disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none">
                <Wrench size={14}/> Générer OT prédictif
              </button>
            )}
          </div>
        </div>

        {/* ── HIERARCHIE COMPLETE ──────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#003B7A] to-[#004a8f] rounded-lg">
              <Factory className="w-4 h-4 text-white"/>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Hiérarchie de l'équipement</h3>
              <p className="text-xs text-gray-500">Depuis la machine racine jusqu'au composant</p>
            </div>
          </div>
          <div className="p-5">
            {!c.hierarchie || c.hierarchie.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Hiérarchie non disponible (composant non listé dans Equipement).</p>
            ) : (
              <div className="space-y-2">
                {[...c.hierarchie].reverse().map((h: any, i: number, arr: any[]) => {
                  const isRacine = h.is_racine
                  const isComp = i === arr.length - 1
                  return (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${
                      isComp ? 'bg-emerald-50 border border-emerald-200' :
                      isRacine ? 'bg-blue-50 border border-blue-200' :
                                 'bg-gray-50 border border-gray-200'
                    }`}>
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold flex-shrink-0 ${
                        isRacine ? 'bg-blue-600 text-white' :
                        isComp   ? 'bg-emerald-600 text-white' :
                                   'bg-gray-500 text-white'
                      }`}>
                        {isRacine ? 'MACHINE RACINE' : isComp ? 'COMPOSANT' : `NIVEAU ${h.level}`}
                      </span>
                      <span className="font-mono text-sm font-bold text-[#003B7A]">{h.code}</span>
                      <span className="text-sm text-gray-700 truncate flex-1">{h.description}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── KPIs simplifiés : juste Nb pannes + Coût ──────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <KpiCard icon={<AlertOctagon className="w-4 h-4"/>} label="Nb pannes historiques"
                   value={c.kpis?.nb_pannes ?? 0} color="text-red-600"/>
          <KpiCard icon={<Package className="w-4 h-4"/>} label="Coût total historique"
                   value={fmtDA(c.kpis?.cout_total)} color="text-purple-600"/>
        </div>

        {/* ── STOCK ────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              c.stock?.alerte_globale === 'ABSENT' ? 'bg-gradient-to-br from-red-500 to-red-700' :
              c.stock?.alerte_globale === 'FAIBLE' ? 'bg-gradient-to-br from-orange-500 to-orange-700' :
              c.stock?.alerte_globale === 'OK'     ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' :
                                                     'bg-gradient-to-br from-slate-400 to-slate-600'
            }`}>
              <Package className="w-4 h-4 text-white"/>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Stock pièces de rechange</h3>
              <p className="text-xs text-gray-500">{c.stock?.total_pieces ?? 0} pièce(s) liée(s)</p>
            </div>
          </div>
          <div className="p-5">
            {!c.stock ? (
              <p className="text-sm text-gray-500 italic">Ce composant n'est pas géré dans le module Stock.</p>
            ) : c.stock.total_pieces === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Aucune pièce de rechange liée à ce composant.</p>
            ) : (
              <div className="space-y-2">
                {c.stock.pieces.map((p: any, i: number) => {
                  const cfg = p.alerte === 'ABSENT' ? 'bg-red-50 text-red-700' :
                              p.alerte === 'FAIBLE' ? 'bg-orange-50 text-orange-700' :
                                                      'bg-emerald-50 text-emerald-700'
                  return (
                    <div key={i} className={`${cfg} rounded-lg p-3 text-xs flex items-center gap-3`}>
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        p.alerte === 'ABSENT' ? 'bg-red-200 text-red-800' :
                        p.alerte === 'FAIBLE' ? 'bg-orange-200 text-orange-800' :
                                                'bg-emerald-200 text-emerald-800'
                      }`}>{p.alerte}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] font-bold">{p.code_stock}</div>
                        <div className="text-[11px] truncate">{p.designation}</div>
                        {p.emplacement && <div className="text-[10px] text-gray-500">📍 {p.emplacement}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums">{p.quantite} {p.unite ?? 'pcs'}</div>
                        <div className="text-[10px] text-gray-500">seuil {p.seuil_alerte}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── HISTOGRAMME (avec dates exactes au survol) ──────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
              <BarChart3 className="w-4 h-4 text-white"/>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Pannes réelles vs Pannes prédites par mois</h3>
              <p className="text-xs text-gray-500">Survolez une barre pour voir les dates exactes</p>
            </div>
          </div>
          <div className="p-4">
            {histoComparatif.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">
                Aucune donnée à comparer
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={histoComparatif} margin={{ top: 10, right: 20, bottom: 50, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb"/>
                  <XAxis dataKey="mois" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0}
                    tickFormatter={(v: string) => {
                      const [y, m] = v.split('-')
                      return new Date(Number(y), Number(m)-1, 1).toLocaleDateString('fr-FR', { month:'short', year:'2-digit' })
                    }}/>
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false}/>
                  <Tooltip content={<HistoTooltip/>}/>
                  <Legend wrapperStyle={{ fontSize: 12 }}
                    formatter={v => v === 'reelles' ? 'Pannes réelles' : 'Pannes prédites'}/>
                  <Bar dataKey="reelles"  fill="#dc2626" name="reelles"  radius={[3,3,0,0]}/>
                  <Bar dataKey="predites" fill="#0891b2" name="predites" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── TABLEAU PANNES + PRÉDICTIONS ─────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
              <History className="w-4 h-4 text-white"/>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Historique pannes & prédictions</h3>
              <p className="text-xs text-gray-500">
                {evenementsCompares.length} ligne(s) · classées du plus récent au plus ancien
              </p>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 uppercase text-[10px] text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-3 py-3 text-left">Date</th>
                  <th className="px-3 py-3 text-center">RUL (j)</th>
                  <th className="px-3 py-3 text-center">Statut</th>
                  <th className="px-3 py-3 text-right">Coût</th>
                  <th className="px-3 py-3 text-center">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {evenementsCompares.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Aucun événement</td></tr>
                ) : evenementsCompares.map((ev, i) => {
                  const isReel = ev.type === 'Réelle'
                  const statutCfg = ev.statut ? STATUT_CFG[ev.statut as string] : null
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isReel ? 'bg-red-100 text-red-700' : 'bg-cyan-100 text-cyan-700'
                        }`}>
                          {isReel ? 'RÉELLE' : 'PRÉDITE'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        <Calendar size={11} className="inline mr-1 text-gray-400"/>
                        {fmtDate(ev.date)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {ev.rul != null ? (
                          <span className="font-bold tabular-nums" style={{ color: statutCfg?.c ?? '#374151' }}>{ev.rul}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {statutCfg
                          ? <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statutCfg.bg} ${statutCfg.text}`}>{statutCfg.label}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {ev.cout != null ? fmtDA(ev.cout) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-600 font-medium">{ev.source}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {showOTModal && hasPred && statutCfg && (
        <OTPredictifModal
          code={c.equipment_code}
          rulJours={pred.rul_jours}
          statut={pred.statut as string}
          onClose={() => setShowOTModal(false)}
        />
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: any; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className={`inline-flex items-center gap-1.5 ${color} mb-2`}>
        {icon}
        <span className="text-xs uppercase font-semibold tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

function HistoTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  if (!data) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs max-w-xs">
      <div className="font-bold text-gray-900 mb-2">
        {(() => {
          const [y, m] = data.mois.split('-')
          return new Date(Number(y), Number(m)-1, 1).toLocaleDateString('fr-FR', { month:'long', year:'numeric' })
        })()}
      </div>
      {data.reelles > 0 && (
        <div className="text-red-700 mb-1">
          <div className="font-bold">🔴 {data.reelles} panne(s) réelle(s)</div>
          {data.dates_reelles.map((d: string, i: number) => (
            <div key={i} className="text-[10px] ml-3">· {new Date(d).toLocaleDateString('fr-FR')}</div>
          ))}
        </div>
      )}
      {data.predites > 0 && (
        <div className="text-cyan-700">
          <div className="font-bold">🔵 {data.predites} panne(s) prédite(s)</div>
          {data.dates_predites.map((d: string, i: number) => (
            <div key={i} className="text-[10px] ml-3">· {new Date(d).toLocaleDateString('fr-FR')}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function OTPredictifModal({ code, rulJours, statut, onClose }: {
  code: string; rulJours: number; statut: string; onClose: () => void
}) {
  const mut = useGenererOT(code)

  const dateRecommandee = new Date(Date.now() + Math.max(1, rulJours - 2) * 86400_000).toISOString().slice(0, 16)
  const prioriteAuto =
    statut === 'CRITIQUE' ? 'CRITIQUE' :
    statut === 'URGENT'   ? 'HAUTE'    : 'NORMALE'

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-gradient-to-r from-[#003B7A] to-[#004a8f] text-white p-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Wrench size={18}/>
                <h2 className="text-lg font-bold">Générer un OT Prédictif</h2>
              </div>
              <p className="text-sm text-blue-100 mt-1 font-mono">{code}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <X size={20}/>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Classe">
              <select value={payload.classe} onChange={e => setPayload(p => ({ ...p, classe: e.target.value as any }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <option value="MECANIQUE">Mécanique</option>
                <option value="ELECTRIQUE">Électrique</option>
                <option value="GLOBALE">Mécano-électrique</option>
              </select>
            </Field>
            <Field label="Priorité">
              <select value={payload.priorite} onChange={e => setPayload(p => ({ ...p, priorite: e.target.value as any }))}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <option value="FAIBLE">Faible</option>
                <option value="NORMALE">Normale</option>
                <option value="HAUTE">Haute</option>
                <option value="CRITIQUE">Critique</option>
              </select>
            </Field>
          </div>
          <Field label="Date et heure prévues">
            <input type="datetime-local" value={payload.date_prevue}
              onChange={e => setPayload(p => ({ ...p, date_prevue: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" required/>
          </Field>
          <Field label="Durée estimée (minutes)">
            <input type="number" min={15} step={15} value={payload.duree_estimee}
              onChange={e => setPayload(p => ({ ...p, duree_estimee: parseInt(e.target.value || '0', 10) }))}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" required/>
          </Field>
          <Field label="Description">
            <textarea rows={3} value={payload.description}
              onChange={e => setPayload(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" required/>
          </Field>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
              Annuler
            </button>
            <button type="submit" disabled={mut.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#003B7A] to-[#004a8f] hover:from-[#002a5a] hover:to-[#003B7A] text-white rounded-lg font-bold shadow disabled:opacity-50">
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin"/>}
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
