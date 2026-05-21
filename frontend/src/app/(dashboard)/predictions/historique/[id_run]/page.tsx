'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Loader2, Search, X, Cpu, Clock, History,
  Package, AlertOctagon, Factory, Calendar, CheckCircle2,
} from 'lucide-react'
import api from '@/services/axiosInstance'

interface ResultatRun {
  id_resultat:       number
  ref_date?:         string | null
  equipment_code:    string
  equipment_desc?:   string | null
  system_equipment?: string | null
  pole?:             string | null
  zone?:             string | null
  comp_level?:       number | null
  rul_jours:         number
  statut:            'CRITIQUE' | 'URGENT' | 'SURVEILLANCE' | 'OK'
  date_panne_prevue: string | null
  confiance_pct:     number | null
  source:            'ML' | 'SIMULATION'
  stock_disponible:  number | null
  alerte_stock:      'OK' | 'FAIBLE' | 'ABSENT' | null
  ot_predictif_existant?: { id_ot: number; numero_ot: string; statut: string; date_prevue: string | null } | null
}

interface RunDetail {
  id_run:           number
  id_modele:        number
  pole:             string | null
  statut:           string
  nb_composants:    number
  nb_critiques:     number
  nb_urgents:       number
  nb_surveillance:  number
  nb_ok:            number
  duree_ms:         number | null
  launched_at:      string
  finished_at:      string | null
  resultats:        ResultatRun[]
}

const NIVEAU_CFG: Record<string, { label: string; color: string; bg: string; text: string }> = {
  CRITIQUE:     { label: 'ROUGE',  color: '#dc2626', bg: 'bg-red-50',     text: 'text-red-700' },
  URGENT:       { label: 'ORANGE', color: '#ea580c', bg: 'bg-orange-50',  text: 'text-orange-700' },
  SURVEILLANCE: { label: 'AMBRE',  color: '#ca8a04', bg: 'bg-amber-50',   text: 'text-amber-700' },
  OK:           { label: 'VERT',   color: '#16a34a', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR') : '—'

export default function DetailRunPage() {
  const { id_run } = useParams<{ id_run: string }>()
  const router = useRouter()
  const [run, setRun]     = useState<RunDetail | null>(null)
  const [modele, setModele] = useState<{ version: string; type_modele: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtreZone, setFiltreZone] = useState<string>('')
  const [dateDebut, setDateDebut] = useState<string>('')
  const [dateFin, setDateFin]     = useState<string>('')

  useEffect(() => {
    setLoading(true)
    api.get(`/predictions/runs/${id_run}`)
      .then(r => {
        setRun(r.data)
        return api.get('/modeles-ml').catch(() => ({ data: [] }))
      })
      .then(res => {
        if (res?.data && run) {
          const m = res.data.find((x: any) => x.id_modele === run.id_modele)
          if (m) setModele({ version: m.version, type_modele: m.type_modele })
        }
      })
      .catch(err => setError(err?.response?.data?.detail ?? err.message ?? 'Erreur'))
      .finally(() => setLoading(false))
  }, [id_run])

  // Charger info modèle après run
  useEffect(() => {
    if (run) {
      api.get('/modeles-ml').then(r => {
        const m = (r.data ?? []).find((x: any) => x.id_modele === run.id_modele)
        if (m) setModele({ version: m.version, type_modele: m.type_modele })
      }).catch(() => {})
    }
  }, [run])

  const zonesDisponibles = useMemo(() => {
    if (!run) return []
    const set = new Set<string>()
    run.resultats.forEach(r => { if (r.zone) set.add(r.zone) })
    return Array.from(set).sort()
  }, [run])

  const resultatsFiltres = useMemo(() => {
    if (!run) return []
    let list = run.resultats
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.equipment_code.toLowerCase().includes(q) ||
        (r.equipment_desc?.toLowerCase().includes(q) ?? false)
      )
    }
    if (filtreZone) {
      list = list.filter(r => r.zone === filtreZone)
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
  }, [run, search, filtreZone, dateDebut, dateFin])

  if (loading) return (
    <div className="p-6 flex items-center justify-center gap-3 min-h-[400px]">
      <Loader2 size={24} className="animate-spin text-[#003B7A]"/>
      <span className="text-sm text-gray-500">Chargement du run #{id_run}…</span>
    </div>
  )

  if (error || !run) return (
    <div className="p-6 max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl text-center">
      <AlertOctagon size={32} className="text-red-500 mx-auto mb-2"/>
      <p className="text-red-700 mb-3">{error ?? 'Run introuvable.'}</p>
      <button onClick={() => router.push('/predictions/historique')}
        className="text-sm text-[#003B7A] font-bold hover:underline">
        Retour à l'historique
      </button>
    </div>
  )

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>

        <div className="relative flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-4">
            <button onClick={() => router.push('/predictions/historique')}
              className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all">
              <ArrowLeft size={18}/>
            </button>
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
              <History size={28} className="text-white"/>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                {modele && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    modele.type_modele === 'GRU' ? 'bg-indigo-500/30 text-white' : 'bg-violet-500/30 text-white'
                  }`}>
                    {modele.type_modele} · {modele.version}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Résultats du run</h1>
              <p className="text-blue-200 text-sm mt-1">
                Lancé le {fmtDateTime(run.launched_at)}
                {run.duree_ms != null }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Composants prédits" value={run.nb_composants} color="#003B7A" icon={Factory}/>
        <KpiBox label="🔴 Rouge (≤5j)"    value={run.nb_critiques}  color="#dc2626" icon={AlertOctagon}/>
        <KpiBox label="🟠 Orange (≤15j)"  value={run.nb_urgents}    color="#ea580c" icon={AlertOctagon}/>
        <KpiBox label="🟢 Vert (>15j)"    value={run.nb_ok}         color="#16a34a" icon={Package}/>
      </div>

      {/* Filtres */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              type="text"
              placeholder="Rechercher par code composant ou description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50
                focus:outline-none focus:border-[#003B7A] focus:bg-white focus:ring-4 focus:ring-[#003B7A]/10"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                <X size={14}/>
              </button>
            )}
          </div>

          {/* Filtre Zone (codes) */}
          {zonesDisponibles.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
              <span className="text-xs text-gray-500">Zone</span>
              <select value={filtreZone} onChange={e => setFiltreZone(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#003B7A] cursor-pointer focus:outline-none">
                <option value="">Toutes ({zonesDisponibles.length})</option>
                {zonesDisponibles.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              {filtreZone && (
                <button onClick={() => setFiltreZone('')} className="text-gray-400 hover:text-red-500">
                  <X size={12}/>
                </button>
              )}
            </div>
          )}

          {/* Intervalle date panne prévue */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
            <Calendar size={12} className="text-gray-400"/>
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

      {/* Tableau */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#003B7A' }}>
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100">Composant</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100">Machine / Zone</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">RUL</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">Date dernière panne</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">Date prédite</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">Stock</th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">OT</th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-blue-100 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resultatsFiltres.map(r => {
                const cfg = NIVEAU_CFG[r.statut] ?? NIVEAU_CFG.OK
                return (
                  <tr key={r.id_resultat} className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/predictions/composant/${encodeURIComponent(r.equipment_code)}?from_run=${id_run}`)}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-bold text-[#003B7A]">{r.equipment_code}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{r.equipment_desc ?? '—'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-mono text-[11px] font-semibold text-gray-700">{r.system_equipment ?? '—'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {r.pole ?? '—'}
                        {r.zone && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold font-mono text-[10px]">
                            {r.zone}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-lg font-bold tabular-nums" style={{ color: cfg.color }}>{r.rul_jours}</span>
                      <span className="text-[10px] text-gray-400 ml-0.5">j</span>
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${cfg.bg} ${cfg.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }}/>
                          {cfg.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <p className="text-sm font-semibold text-gray-700 tabular-nums">{fmtDate(r.ref_date)}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <p className="text-sm font-bold text-red-700 tabular-nums">{fmtDate(r.date_panne_prevue)}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {r.alerte_stock === 'ABSENT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">ABSENT</span>
                      ) : r.alerte_stock === 'FAIBLE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">FAIBLE ({r.stock_disponible})</span>
                      ) : r.stock_disponible != null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{r.stock_disponible}</span>
                      ) : <span className="text-xs text-gray-400">—</span>}
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
                      <button onClick={() => router.push(`/predictions/composant/${encodeURIComponent(r.equipment_code)}?from_run=${id_run}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#003B7A] border border-[#003B7A] hover:bg-[#003B7A] hover:text-white transition-all">
                        Détail <ArrowRight size={11}/>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {resultatsFiltres.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">Aucun résultat.</div>
        )}
      </div>

    </div>
  )
}

function KpiBox({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
        <Icon size={14} style={{ color }}/>
      </div>
      <div className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  )
}
