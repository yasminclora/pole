'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  History, ArrowLeft, ArrowRight, Cpu, Clock, Calendar,
  Loader2, Search, X, Filter,
} from 'lucide-react'
import api from '@/services/axiosInstance'

interface RunSummary {
  id_run:           number
  id_modele:        number
  model_type:       'LSTM' | 'GRU'
  model_version:    string
  model_nom?:       string
  pole:             string | null
  statut:           'EN_COURS' | 'TERMINE' | 'ERREUR'
  nb_composants:    number | null
  nb_critiques:     number | null
  nb_urgents:       number | null
  nb_surveillance:  number | null
  nb_ok:            number | null
  duree_ms:         number | null
  launched_at:      string
  finished_at:      string | null
  date_panne_prevue_min: string | null
  date_panne_prevue_max: string | null
  ref_date_min:          string | null
  ref_date_max:          string | null
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'2-digit' }) : '—'

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

export default function HistoriquePredictionsPage() {
  const router = useRouter()

  const [runs, setRuns]               = useState<RunSummary[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filtreModele, setFiltreModele] = useState<'TOUS' | 'LSTM' | 'GRU'>('TOUS')
  const [dateDebut, setDateDebut]       = useState<string>('')
  const [dateFin, setDateFin]           = useState<string>('')

  const charger = () => {
    setLoading(true)
    const params: any = {}
    if (filtreModele !== 'TOUS') params.model_type = filtreModele
    if (dateDebut)                params.date_debut = dateDebut
    if (dateFin)                  params.date_fin   = dateFin

    api.get('/predictions/historique', { params })
      .then(r => setRuns(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { charger() }, [filtreModele, dateDebut, dateFin])

  const runsFiltres = useMemo(() => {
    if (!search) return runs
    const q = search.toLowerCase()
    return runs.filter(r =>
      String(r.id_run).includes(q) ||
      (r.pole?.toLowerCase().includes(q) ?? false) ||
      r.model_type.toLowerCase().includes(q) ||
      r.model_version.toLowerCase().includes(q)
    )
  }, [runs, search])

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">

      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>

        <div className="relative flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-4">
            <button onClick={() => router.push('/predictions')}
              className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/20 transition-all">
              <ArrowLeft size={18}/>
            </button>
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
              <History size={28} className="text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Historique des prédictions</h1>
              <p className="text-blue-200 text-sm mt-1">
                {runs.length} run{runs.length > 1 ? 's' : ''} · cliquez sur un run pour voir le détail
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTRES */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              type="text"
              placeholder="Rechercher par ID, pôle, type modèle…"
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

          <span className="text-xs text-gray-500 ml-auto">
            {runsFiltres.length} / {runs.length} run{runsFiltres.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-100">
          {/* Filtre Modèle */}
          <div className="flex items-center gap-1.5">
            <Cpu size={13} className="text-gray-400"/>
            <span className="text-xs text-gray-500">Modèle</span>
            {(['TOUS', 'LSTM', 'GRU'] as const).map(t => (
              <button key={t}
                onClick={() => setFiltreModele(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filtreModele === t
                    ? 'bg-[#003B7A] text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Filtre date */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
            <Calendar size={13} className="text-gray-400"/>
            <span className="text-xs text-gray-500">Lancé entre</span>
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

          <button onClick={charger}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#003B7A] border border-gray-200 hover:border-[#003B7A] hover:bg-blue-50">
            <Filter size={12}/> Appliquer
          </button>
        </div>
      </div>

      {/* TABLEAU */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="animate-spin text-[#003B7A]"/>
            <span className="text-sm text-gray-500">Chargement…</span>
          </div>
        ) : runsFiltres.length === 0 ? (
          <div className="py-16 text-center">
            <History size={48} className="text-gray-300 mx-auto mb-3"/>
            <p className="text-sm text-gray-500">Aucun run pour ces filtres.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#003B7A' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100">Run</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100">Modèle</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100">Lancé le</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100">Pôle</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">Composants</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">🔴 Rouge</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">🟠 Orange</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">🟢 Vert</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-blue-100">Durée</th>
                  <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-blue-100 pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runsFiltres.map(r => (
                  <tr key={r.id_run}
                      onClick={() => router.push(`/predictions/historique/${r.id_run}`)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-bold text-[#003B7A]">#{r.id_run}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.model_type === 'GRU' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'
                        }`}>
                          {r.model_type}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{r.model_version}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} className="text-gray-400"/>
                        <span className="font-semibold">{fmtDateTime(r.launched_at)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700">
                      {r.pole ?? <span className="text-gray-400">tous</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-sm font-semibold text-gray-700">{r.nb_composants ?? '—'}</td>
                    <td className="px-3 py-3 text-center font-bold text-red-600">{r.nb_critiques ?? 0}</td>
                    <td className="px-3 py-3 text-center font-bold text-orange-600">{r.nb_urgents ?? 0}</td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-600">{r.nb_ok ?? 0}</td>
                    <td className="px-3 py-3 text-center text-xs text-gray-500 tabular-nums">
                      {r.duree_ms != null ? `${(r.duree_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right pr-4" onClick={e => e.stopPropagation()}>
                      <button onClick={() => router.push(`/predictions/historique/${r.id_run}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#003B7A] border border-[#003B7A] hover:bg-[#003B7A] hover:text-white transition-all">
                        Détail <ArrowRight size={11}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
