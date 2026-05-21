'use client'

import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import {
  Upload, CheckCircle2, Trash2, Plus, X, Loader2, Brain,
  BarChart2, Download, RefreshCw, Database,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { RootState } from '@/store/store'
import { modelesMLService, type ModeleML, type UploadModeleParams } from '@/services/modelesMLService'
import api from '@/services/axiosInstance'

interface Apercu {
  nb_total: number
  nb_corr: number
  nb_prev: number
  last_export_at: string | null
}
interface ExportFile {
  filename: string
  size_kb: number
  created_at: string
}

export default function ModelesMLPage() {
  const router = useRouter()
  const user   = useSelector((s: RootState) => s.auth.user) // États globaux
  const [modeles, setModeles]     = useState<ModeleML[]>([])
  const [loading, setLoading]     = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError]         = useState<string | null>(null)

  // États Comparaison
  const [compareData, setCompareData] = useState<any[]>([])
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [apercu, setApercu]         = useState<Apercu | null>(null)
  const [loadingApercu, setLoadingApercu] = useState(false)
  const [exporting, setExporting]   = useState(false)
  const [exportFiles, setExportFiles] = useState<ExportFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [exportMsg, setExportMsg]   = useState<string | null>(null)
  
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.replace('/dashboard')
      return
    }
    void chargerTout()
  }, [user])

  async function chargerTout() {
    setLoading(true)
    setError(null)
    try {
      const [modelesRes, compareRes, apercuRes, fichiersRes] = await Promise.all([
        modelesMLService.lister(),
        api.get('/modeles-ml/comparer').catch(() => ({ data: [] })),
        api.get('/data-export/apercu').catch(() => ({ data: null })),
        api.get('/data-export/historique').catch(() => ({ data: [] }))
      ])

      setModeles(modelesRes)
      setCompareData(compareRes.data)
      setApercu(apercuRes.data)
      setExportFiles(fichiersRes.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }
  
  async function rafraichirApercu() {
    setLoadingApercu(true)
    try {
      const res = await api.get('/data-export/apercu')
      setApercu(res.data)
    } catch { setApercu(null) } finally { setLoadingApercu(false) }
  }

  async function rafraichirFichiers() {
    setLoadingFiles(true)
    try {
      const res = await api.get('/data-export/historique')
      setExportFiles(res.data)
    } catch { setExportFiles([]) } finally { setLoadingFiles(false) }
  }

  async function handleActiver(id: number) {
    setActionLoading(id)
    try {
      await modelesMLService.activer(id)
      const [mRes, cRes] = await Promise.all([
        modelesMLService.lister(),
        api.get('/modeles-ml/comparer').catch(() => ({ data: [] }))
      ])
      setModeles(mRes)
      setCompareData(cRes.data)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e.message ?? 'Erreur')
    } finally { setActionLoading(null) }
  }
  
  async function handleSupprimer(id: number, version: string) {
    if (!confirm(`Supprimer définitivement le modèle ${version} ?`)) return
    setActionLoading(id)
    try {
      await modelesMLService.supprimer(id)
      const [mRes, cRes] = await Promise.all([
        modelesMLService.lister(),
        api.get('/modeles-ml/comparer').catch(() => ({ data: [] }))
      ])
      setModeles(mRes)
      setCompareData(cRes.data)
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e.message ?? 'Erreur')
    } finally { setActionLoading(null) }
  }
  
  async function handleExporter() {
    setExporting(true); setExportMsg(null)
    try {
      const res = await api.post('/data-export/exporter', {}, { responseType: 'blob', timeout: 60_000 })
      const blob   = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url    = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      const fname  = res.headers['content-disposition']?.match(/filename="(.+?)"/)?.[1] ?? 'export.csv'
      a.href = url; a.download = fname; a.click()
      URL.revokeObjectURL(url)
      const nb = res.headers['x-nb-lignes']
      setExportMsg(`Export réussi — ${nb ?? '?'} lignes téléchargées.`)
      await rafraichirApercu(); await rafraichirFichiers()
    } catch (e: any) {
      const detail = e?.response?.data ? await e.response.data.text?.() : e.message
      alert(detail ?? 'Erreur lors de l\'export')
    } finally { setExporting(false) }
  }

  async function handleTelecharger(filename: string) {
    try {
      const res = await api.get(`/data-export/telecharger/${encodeURIComponent(filename)}`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Erreur téléchargement') }
  }

  if (user && user.role !== 'ADMIN') return null

  const chartCompare = compareData.map(m => ({
    name    : m.version,
    'R²'    : m.metrics?.r2    != null ? +(m.metrics.r2    * 100).toFixed(1) : null,
    'MAE'   : m.metrics?.mae   != null ? +m.metrics.mae.toFixed(2) : null,
    'Recall': m.metrics?.recall != null ? +(m.metrics.recall * 100).toFixed(1) : null,
    'F1'    : m.metrics?.f1    != null ? +(m.metrics.f1    * 100).toFixed(1) : null,
    active  : m.is_active,
  }))

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-10 p-4">
      
      {/* ON GARDE TON BEAU BLEU ICI */}
      <div className="relative overflow-hidden w-full bg-[#1e3a67] text-white rounded-2xl p-8 shadow-md border border-slate-800/20 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:16px_16px]">
        <div className="flex items-center justify-between relative z-10 flex-wrap gap-4">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
              <Brain size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-white">
                Console Administration Machine Learning
              </h1>
              <p className="text-base text-slate-200 mt-1 font-sans flex items-center gap-2">
                <span className="text-blue-200">Supervision globale des modèles LSTM/GRU, métriques de performance et exports</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void chargerTout()}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all border border-white/10"
              title="Tout actualiser"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all text-sm border border-blue-500/20"
            >
              <Plus className="w-5 h-5" /> Uploader un modèle
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">{error}</div>
      )}

      {loading ? (
        <div className="p-24 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">Chargement complet de la console ML...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      
            {/* TABLEAU DES MODÈLES (Effet de flottaison discret et fond blanc/gris épuré) */}
            <div className="xl:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" /> Modèles déployés
                </h2>
              </div>
              <div className="bg-slate-50/60 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                {modeles.length === 0 ? (
                  <div className="p-16 text-center text-gray-500 text-base">Aucun modèle disponible.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-base">
                      <thead className="bg-gray-100/80 dark:bg-gray-800/50 text-left text-gray-600 dark:text-gray-300 uppercase text-xs font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Version</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Statut</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800">
                        {modeles.map(m => (
                          <tr key={m.id_modele} className="hover:bg-white/80 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-5 font-mono font-bold text-lg text-gray-900 dark:text-white">{m.version}</td>
                            <td className="px-6 py-5">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${
                                m.type_modele === 'LSTM' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                              }`}>{m.type_modele}</span>
                            </td>
                          
                            <td className="px-6 py-5">
                              {m.is_active ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md text-xs font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Actif
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-gray-200/60 dark:bg-gray-800 text-gray-500 rounded-md text-xs font-medium">Inactif</span>
                              )}
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex items-center justify-end gap-3">
                                {!m.is_active && (
                                  <button
                                    onClick={() => handleActiver(m.id_modele)}
                                    disabled={actionLoading === m.id_modele}
                                    className="px-3.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg disabled:opacity-50 font-bold transition-all"
                                  >
                                    {actionLoading === m.id_modele ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Activer'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleSupprimer(m.id_modele, m.version)}
                                  disabled={actionLoading === m.id_modele || m.is_active}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                  title={m.is_active ? 'Désactivez avant de supprimer' : 'Supprimer'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* PIPELINE DE NOUVELLES DONNÉES (Fond gris/blanc moderne avec flottaison) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-600" /> Nouvelles Données (Pipeline)
                </h2>
                <button onClick={rafraichirApercu} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50/60 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                {apercu ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700 shadow-sm">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{apercu.nb_total}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">Total</p>
                      </div>
                      {/* Passé du rouge/vert d'origine à un gris/bleu sobre façon maquette */}
                      <div className="bg-gray-100 dark:bg-gray-850 rounded-xl p-3 border border-gray-200/60">
                        <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{apercu.nb_corr}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">Corr.</p>
                      </div>
                      <div className="bg-blue-50/60 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-100/30">
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{apercu.nb_prev}</p>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mt-0.5">Prév.</p>
                      </div>
                    </div>

                    {exportMsg && (
                      <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> {exportMsg}
                      </div>
                    )}

                    <button
                      onClick={handleExporter}
                      disabled={exporting || apercu.nb_total === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-all text-sm disabled:opacity-50"
                    >
                      {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                      {exporting ? 'Exportation...' : `Exporter ${apercu.nb_total} lignes`}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Données d'aperçu indisponibles.</p>
                )}
              </div>
            </div>

          </div>

          {/* ANALYSE COMPARATIVE (Fonds gris épurés + Flottaison) */}
          <div className="space-y-4 pt-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" /> Analyse comparative des précisions
            </h2>
            
            {compareData.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border border-gray-200 rounded-2xl text-gray-400">Aucun modèle à analyser graphiquement.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-50/60 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <p className="text-base font-bold text-gray-800 dark:text-gray-200 mb-6">Fidélité Générale : R² et Recall (%)</p>
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={chartCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                      <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Legend />
                      <Bar dataKey="R²"     fill="#2563eb" radius={[4,4,0,0]} barSize={28} />
                      <Bar dataKey="Recall" fill="#10b981" radius={[4,4,0,0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-50/60 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <p className="text-base font-bold text-gray-800 dark:text-gray-200 mb-6">Marge d'erreur : MAE (Jours) — Le plus bas est le meilleur</p>
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={chartCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                      <YAxis unit=" j" tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: any) => `${v} jours`} />
                      <Legend />
                      <Bar dataKey="MAE" fill="#f97316" radius={[4,4,0,0]} barSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* MATRICE DÉTAILLÉE */}
          <div className="space-y-4 pt-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-emerald-600" /> Matrice détaillée des hyperparamètres et scores
            </h2>
            <div className="bg-slate-50/60 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-base text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-xs uppercase font-bold text-gray-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Version</th>
                      <th className="px-6 py-4">Architecture</th>
                      <th className="px-6 py-4 text-center">R² Score</th>
                      <th className="px-6 py-4 text-center">MAE (Erreur)</th>
                      <th className="px-6 py-4 text-center">Recall</th>
                      <th className="px-6 py-4 text-center">Score F1</th>
                      <th className="px-6 py-4 text-center">Composants</th>
                      <th className="px-6 py-4 text-center">Statut Production</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800 font-medium">
                    {compareData.map(m => (
                      <tr key={m.id_modele} className={`hover:bg-white/80 dark:hover:bg-gray-800/50 transition-colors ${m.is_active ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}>
                        <td className="px-6 py-5 font-mono font-bold text-lg text-gray-900 dark:text-white">{m.version}</td>
                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold ${m.type_modele === 'LSTM' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'}`}>
                            {m.type_modele}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center font-bold text-gray-800 dark:text-gray-200">{m.metrics?.r2 != null ? m.metrics.r2.toFixed(3) : '—'}</td>
                        <td className="px-6 py-5 text-center text-gray-700 dark:text-gray-300">{m.metrics?.mae != null ? `${m.metrics.mae.toFixed(2)} j` : '—'}</td>
                        <td className="px-6 py-5 text-center text-gray-700 dark:text-gray-300">{m.metrics?.recall != null ? `${(m.metrics.recall * 100).toFixed(1)}%` : '—'}</td>
                        <td className="px-6 py-5 text-center text-gray-700 dark:text-gray-300">{m.metrics?.f1 != null ? `${(m.metrics.f1 * 100).toFixed(1)}%` : '—'}</td>
                        <td className="px-6 py-5 text-center font-mono text-gray-600">{m.num_composants}</td>
                        <td className="px-6 py-5 text-center">
                          {m.is_active ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                              Actif
                            </span>
                          ) : <span className="text-gray-400 text-sm">Disponibles</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* HISTORIQUE ET ARCHIVES (Fonds gris épurés + Flottaison) */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                Archives & Historique des téléchargements CSV
              </h2>
              <button onClick={rafraichirFichiers} className="p-1.5 text-gray-400 hover:text-gray-600">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-50/60 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              {exportFiles.length === 0 ? (
                <div className="p-10 text-center text-gray-400">Aucun fichier archivé.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Nom de l'archive</th>
                        <th className="px-6 py-3 text-center">Taille</th>
                        <th className="px-6 py-3 text-center">Généré le</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800">
                      {exportFiles.map(f => (
                        <tr key={f.filename} className="hover:bg-white/80 dark:hover:bg-gray-800/50">
                          <td className="px-6 py-3.5 font-mono text-gray-600 dark:text-gray-400">{f.filename}</td>
                          <td className="px-6 py-3.5 text-center text-gray-500">{f.size_kb} Ko</td>
                          <td className="px-6 py-3.5 text-center text-gray-500">{new Date(f.created_at).toLocaleString('fr-FR')}</td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              onClick={() => handleTelecharger(f.filename)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold transition-all text-sm"
                            >
                              <Download className="w-3.5 h-3.5" /> Récupérer
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
        </>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); void chargerTout() }}
        />
      )}
    </div>
  )
}

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [version,     setVersion]  = useState('')
  const [typeModele,  setType]     = useState<'LSTM' | 'GRU'>('GRU')
  const [nom,         setNom]      = useState('')
  const [description, setDesc]     = useState('')
  const [modelKeras,  setKeras]    = useState<File | null>(null)
  const [scalerX,     setScalerX]  = useState<File | null>(null)
  const [scalerY,     setScalerY]  = useState<File | null>(null)
  const [submitting,  setSubmitting] = useState(false)
  const [err,         setErr]      = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!modelKeras || !scalerX || !scalerY) {
      setErr('Tous les fichiers sont requis.')
      return
    }
    const payload: UploadModeleParams = {
      version, type_modele: typeModele, nom,
      description: description || undefined,
      model_keras: modelKeras, scaler_x: scalerX, scaler_y: scalerY,
    }
    setSubmitting(true)
    try {
      await modelesMLService.upload(payload)
      onSuccess()
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e.message ?? 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Upload className="w-6 h-6 text-blue-500" /> Uploader un nouveau modèle
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div> 
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">{err}</div>} 
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">Version *</label>
              <input
                type="text" required value={version} onChange={e => setVersion(e.target.value)}
                placeholder="v3-GRU"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />  
            </div> 
            <div>
              <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">Type *</label>
              <select
                value={typeModele} onChange={e => setType(e.target.value as 'LSTM' | 'GRU')}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" >
                <option value="GRU">GRU</option>
                <option value="LSTM">LSTM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">Nom *</label>
            <input
              type="text" required value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex: GRU Champion v3 — R²=0.76"
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={description} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="Détails du modèle, hyperparamètres..."
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="space-y-4 pt-2">
            <FileInput label="Modèle (.keras)" accept=".keras" file={modelKeras} onChange={setKeras} />
            <FileInput label="Scaler X (.pkl)" accept=".pkl"   file={scalerX}    onChange={setScalerX} />
            <FileInput label="Scaler Y (.pkl)" accept=".pkl"   file={scalerY}    onChange={setScalerY} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all text-sm font-bold">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-50">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FileInput({ label, accept, file, onChange }: {
  label: string; accept: string; file: File | null; onChange: (f: File | null) => void
}) {
  return (
    <div>
      <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">{label} *</label>
      <input  type="file" accept={accept} required
        onChange={e => onChange(e.target.files?.[0] ?? null)}
        className="w-full text-sm text-gray-500 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950/40 dark:file:text-blue-400 transition-all cursor-pointer"
      />
      {file && <p className="text-xs text-gray-400 mt-1 font-mono">✓ {file.name} — {(file.size / (1024 * 1024)).toFixed(2)} Mo</p>}
    </div>
  )
}