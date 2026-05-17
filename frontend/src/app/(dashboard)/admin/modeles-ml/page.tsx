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

type Tab = 'modeles' | 'comparer' | 'export'

// ── Data export types ─────────────────────────────────────────────────────────
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

// ═════════════════════════════════════════════════════════════════════════════
export default function ModelesMLPage() {
  const router = useRouter()
  const user   = useSelector((s: RootState) => s.auth.user)

  const [tab, setTab]             = useState<Tab>('modeles')
  const [modeles, setModeles]     = useState<ModeleML[]>([])
  const [loading, setLoading]     = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError]         = useState<string | null>(null)

  // Comparaison
  const [compareData, setCompareData] = useState<any[]>([])
  const [loadingCompare, setLoadingCompare] = useState(false)

  // Export données
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
    void charger()
  }, [user])

  useEffect(() => {
    if (tab === 'comparer') void chargerCompare()
    if (tab === 'export')   { void chargerApercu(); void chargerFichiers() }
  }, [tab])

  async function charger() {
    setLoading(true); setError(null)
    try {
      setModeles(await modelesMLService.lister())
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function chargerCompare() {
    setLoadingCompare(true)
    try {
      const res = await api.get('/modeles-ml/comparer')
      setCompareData(res.data)
    } catch {
      setCompareData([])
    } finally {
      setLoadingCompare(false)
    }
  }

  async function chargerApercu() {
    setLoadingApercu(true)
    try {
      const res = await api.get('/data-export/apercu')
      setApercu(res.data)
    } catch { setApercu(null) } finally { setLoadingApercu(false) }
  }

  async function chargerFichiers() {
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
      await charger()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e.message ?? 'Erreur')
    } finally { setActionLoading(null) }
  }

  async function handleSupprimer(id: number, version: string) {
    if (!confirm(`Supprimer définitivement le modèle ${version} ?`)) return
    setActionLoading(id)
    try {
      await modelesMLService.supprimer(id)
      await charger()
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
      const fname  = res.headers['content-disposition']?.match(/filename="(.+?)"/)?.[1]
                     ?? 'export.csv'
      a.href = url; a.download = fname; a.click()
      URL.revokeObjectURL(url)
      const nb = res.headers['x-nb-lignes']
      setExportMsg(`Export réussi — ${nb ?? '?'} lignes téléchargées.`)
      await chargerApercu(); await chargerFichiers()
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

  // Données graphique comparaison
  const chartCompare = compareData.map(m => ({
    name    : m.version,
    'R²'    : m.metrics?.r2    != null ? +(m.metrics.r2    * 100).toFixed(1) : null,
    'MAE'   : m.metrics?.mae   != null ? +m.metrics.mae.toFixed(2) : null,
    'Recall': m.metrics?.recall != null ? +(m.metrics.recall * 100).toFixed(1) : null,
    'F1'    : m.metrics?.f1    != null ? +(m.metrics.f1    * 100).toFixed(1) : null,
    active  : m.is_active,
  }))

  const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
    { id: 'modeles',  label: 'Modèles',         icon: Brain },
    { id: 'comparer', label: 'Comparaison',      icon: BarChart2 },
    { id: 'export',   label: 'Export données',   icon: Database },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Administration ML</h1>
            <p className="text-sm text-gray-500">Modèles LSTM/GRU, métriques et export de données</p>
          </div>
        </div>
        {tab === 'modeles' && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow"
          >
            <Plus className="w-4 h-4" /> Uploader un modèle
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB : MODÈLES ──────────────────────────────────────────────── */}
      {tab === 'modeles' && (
        <>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : modeles.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Aucun modèle uploadé pour le moment.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-left text-gray-600 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Uploadé le</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {modeles.map(m => (
                    <tr key={m.id_modele} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-mono font-semibold">{m.version}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          m.type_modele === 'LSTM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>{m.type_modele}</span>
                      </td>
                      <td className="px-4 py-3">{m.nom}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{m.description ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(m.uploaded_at).toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-3">
                        {m.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Inactif</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!m.is_active && (
                            <button
                              onClick={() => handleActiver(m.id_modele)}
                              disabled={actionLoading === m.id_modele}
                              className="px-3 py-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded disabled:opacity-50"
                            >
                              {actionLoading === m.id_modele ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Activer'}
                            </button>
                          )}
                          <button
                            onClick={() => handleSupprimer(m.id_modele, m.version)}
                            disabled={actionLoading === m.id_modele || m.is_active}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
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
            )}
          </div>
        </>
      )}

      {/* ── TAB : COMPARAISON ──────────────────────────────────────────── */}
      {tab === 'comparer' && (
        <div className="space-y-6">
          {loadingCompare ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : compareData.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Aucun modèle à comparer.</div>
          ) : (
            <>
              {/* Graphiques métriques */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* R² et Recall (%) */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">R² et Recall (%)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Legend />
                      <Bar dataKey="R²"     fill="#6366f1" radius={[3,3,0,0]} />
                      <Bar dataKey="Recall" fill="#10b981" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* MAE */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">MAE (jours) — plus bas = meilleur</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis unit=" j" tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => `${v} j`} />
                      <Legend />
                      <Bar dataKey="MAE" fill="#f97316" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tableau résumé */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Version</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-center">R²</th>
                      <th className="px-4 py-3 text-center">MAE</th>
                      <th className="px-4 py-3 text-center">Recall</th>
                      <th className="px-4 py-3 text-center">F1</th>
                      <th className="px-4 py-3 text-center">Composants</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {compareData.map(m => (
                      <tr key={m.id_modele} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${m.is_active ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}>
                        <td className="px-4 py-3 font-mono font-semibold">{m.version}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.type_modele === 'LSTM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {m.type_modele}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">
                          {m.metrics?.r2 != null ? m.metrics.r2.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.metrics?.mae != null ? `${m.metrics.mae.toFixed(2)} j` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.metrics?.recall != null ? `${(m.metrics.recall * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.metrics?.f1 != null ? `${(m.metrics.f1 * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">{m.num_composants}</td>
                        <td className="px-4 py-3 text-center">
                          {m.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Actif
                            </span>
                          ) : <span className="text-gray-400 text-xs">Inactif</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB : EXPORT DONNÉES ──────────────────────────────────────── */}
      {tab === 'export' && (
        <div className="space-y-6">
          {/* Aperçu */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-white">Nouvelles données disponibles</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Interventions ajoutées depuis le dernier export — utilisées pour réentraîner le modèle
                </p>
              </div>
              <button
                onClick={() => { void chargerApercu() }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loadingApercu ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            ) : apercu ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-5 py-3 text-center min-w-[100px]">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{apercu.nb_total}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg px-5 py-3 text-center min-w-[100px]">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{apercu.nb_corr}</p>
                    <p className="text-xs text-red-500 mt-0.5">Correctives</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg px-5 py-3 text-center min-w-[100px]">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{apercu.nb_prev}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Préventives</p>
                  </div>
                </div>

                {apercu.last_export_at && (
                  <p className="text-xs text-gray-500">
                    Dernier export : {new Date(apercu.last_export_at).toLocaleString('fr-FR')}
                  </p>
                )}

                {exportMsg && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {exportMsg}
                  </div>
                )}

                <button
                  onClick={handleExporter}
                  disabled={exporting || apercu.nb_total === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Export en cours…</>
                    : <><Download className="w-4 h-4" /> Exporter {apercu.nb_total} ligne(s) en CSV</>
                  }
                </button>
                {apercu.nb_total === 0 && (
                  <p className="text-sm text-gray-400">Aucune nouvelle donnée à exporter.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Impossible de charger l'aperçu.</p>
            )}
          </div>

          {/* Historique exports */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Exports précédents</p>
              <button
                onClick={() => void chargerFichiers()}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {loadingFiles ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
            ) : exportFiles.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Aucun export effectué pour le moment.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Fichier</th>
                    <th className="px-4 py-3 text-center">Taille</th>
                    <th className="px-4 py-3 text-center">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {exportFiles.map(f => (
                    <tr key={f.filename} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{f.filename}</td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs">{f.size_kb} Ko</td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs">
                        {new Date(f.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleTelecharger(f.filename)}
                          className="flex items-center gap-1 ml-auto text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                        >
                          <Download className="w-3.5 h-3.5" /> Télécharger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL UPLOAD ───────────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); void charger() }}
        />
      )}
    </div>
  )
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5" /> Uploader un nouveau modèle
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{err}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Version *</label>
              <input
                type="text" required value={version} onChange={e => setVersion(e.target.value)}
                placeholder="v3-GRU"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select
                value={typeModele} onChange={e => setType(e.target.value as 'LSTM' | 'GRU')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                <option value="GRU">GRU</option>
                <option value="LSTM">LSTM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nom *</label>
            <input
              type="text" required value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex: GRU Champion v3 — R²=0.76"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            />
          </div>

          <FileInput label="Modèle (.keras)" accept=".keras" file={modelKeras} onChange={setKeras} />
          <FileInput label="Scaler X (.pkl)" accept=".pkl"   file={scalerX}    onChange={setScalerX} />
          <FileInput label="Scaler Y (.pkl)" accept=".pkl"   file={scalerY}    onChange={setScalerY} />

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">
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
      <label className="block text-sm font-medium mb-1">{label} *</label>
      <input
        type="file" accept={accept} required
        onChange={e => onChange(e.target.files?.[0] ?? null)}
        className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
      />
      {file && <p className="text-xs text-gray-500 mt-1">{file.name} — {(file.size / (1024 * 1024)).toFixed(2)} Mo</p>}
    </div>
  )
}
