'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { otService } from '@/services/otService'
import { Loader2, Search, X, RefreshCw, Eye, ClipboardList, UserPlus, Printer, MapPin, Users as UsersIcon, Filter, Calendar, AlertCircle } from 'lucide-react'
import AssignModal from '@/components/AssignModal'
import api from '@/services/axiosInstance'

interface OT {
  id_ot: number
  numero_ot: string
  type_ot: string
  classe: string
  priorite: string
  statut: string
  description: string
  date_prevue?: string | null
  created_at: string
  equipement?: { equipment_code: string; description: string; machine_racine_code?: string; machine_racine_desc?: string }
  assigne?: { id: number; nom: string; role: string } | null
  methodiste?: { id: number; nom: string } | null
}

const STATUT_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  CREE: { label: 'Créé', cls: 'bg-gray-100 text-gray-700 border-gray-300', dot: 'bg-gray-500' },
  ASSIGNE: { label: 'Assigné', cls: 'bg-blue-50 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  EN_COURS: { label: 'En cours', cls: 'bg-purple-50 text-purple-800 border-purple-300', dot: 'bg-purple-500' },
  TERMINE: { label: 'Soumis', cls: 'bg-amber-50 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  VALIDE_CE: { label: 'Validé CE', cls: 'bg-teal-50 text-teal-800 border-teal-300', dot: 'bg-teal-500' },
  VALIDE_HSE: { label: 'Validé HSE', cls: 'bg-green-50 text-green-800 border-green-300', dot: 'bg-green-500' },
  ARCHIVE: { label: 'Archivé', cls: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
}

const PRIORITE_CFG: Record<string, { label: string; cls: string }> = {
  HAUTE: { label: 'Haute', cls: 'bg-red-100 text-red-800 border-red-200' },
  MOYENNE: { label: 'Moyenne', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  BASSE: { label: 'Basse', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
}

type SortKey = 'numero_ot' | 'statut' | 'created_at'
type SortDir = 'asc' | 'desc'

function StatutBadge({ v }: { v: string }) {
  const c = STATUT_CFG[v] ?? STATUT_CFG.CREE
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-black border whitespace-nowrap shadow-sm ${c.cls}`}>
      <span className={`w-2 h-2 rounded-full animate-pulse ${c.dot}`}/>
      {c.label}
    </span>
  )
}

function SortIcon({ col, k, d }: { col: SortKey; k: SortKey; d: SortDir }) {
  if (col !== k) return null
  return (
    <span className="inline-flex flex-col ml-1.5">
      <span className={`text-[9px] ${d === 'asc' ? 'text-white font-black' : 'text-white/40'}`}>▲</span>
      <span className={`text-[9px] -mt-0.5 ${d === 'desc' ? 'text-white font-black' : 'text-white/40'}`}>▼</span>
    </span>
  )
}

export default function ListeOTPage() {
  const router = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idPole = Number(authUser?.id_pole)
  const role = authUser?.role || ''

  const [ots, setOts] = useState<OT[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('TOUS')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedOT, setSelectedOT] = useState<OT | null>(null)

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const data = await otService.liste({ id_pole: idPole })
      setOts(Array.isArray(data) ? data : [])
    } catch { setOts([]) }
    finally { setLoading(false) }
  }, [idPole])

  useEffect(() => { charger() }, [charger])

  const openAssignModal = (ot: OT, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedOT(ot)
    setAssignModalOpen(true)
  }

  const handleAssignSuccess = () => { charger() }

  // ── Impression ─────────────────────────────────────────────────────
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printGroupement, setPrintGroupement] = useState<'statut' | 'zone' | 'equipe' | 'priorite' | 'type' | 'mois'>('statut')
  const [printIncludeFiltre, setPrintIncludeFiltre] = useState(true)
  const [printing, setPrinting] = useState(false)

  const handleImprimer = async () => {
    setPrinting(true)
    try {
      const params: any = { id_pole: idPole, groupement: printGroupement }
      if (printIncludeFiltre && filtre !== 'TOUS') {
        params.statut = filtre
      }
      const res = await api.get('/ot/liste/imprimer', { params, responseType: 'text' })
      const win = window.open('', '_blank')
      if (!win) {
        alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez le bloqueur de pop-ups.")
        return
      }
      win.document.open()
      win.document.write(res.data as any)
      win.document.close()
      setShowPrintModal(false)
    } catch (err: any) {
      alert(`Erreur impression : ${err?.response?.data?.detail ?? err.message}`)
    } finally {
      setPrinting(false)
    }
  }

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const counts = ots.reduce((acc, o) => { acc[o.statut] = (acc[o.statut] || 0) + 1; return acc }, {} as Record<string, number>)

  const otsFiltrees = ots
    .filter(o => {
      const q = search.toLowerCase()
      const matchS = !search || 
        o.numero_ot.toLowerCase().includes(q) ||
        o.equipement?.equipment_code?.toLowerCase().includes(q) ||
        o.equipement?.description?.toLowerCase().includes(q) ||
        o.assigne?.nom?.toLowerCase().includes(q)
      const matchF = filtre === 'TOUS' || o.statut === filtre
      return matchS && matchF
    })
    .sort((a, b) => {
      const m = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'numero_ot') return m * a.numero_ot.localeCompare(b.numero_ot)
      if (sortKey === 'statut') return m * a.statut.localeCompare(b.statut)
      if (sortKey === 'created_at') return m * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      return 0
    })

  return (
    <div className="space-y-6 pb-8">

      {/* ── HERO HEADER EN PLUS GRAND ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#0052a3] to-[#003B7A] p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>

        <div className="relative flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <ClipboardList size={38} className="text-white"/>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">Ordres de Travail</h1>
              <p className="text-blue-100 text-base md:text-lg mt-2 font-medium">
                {authUser?.nom_pole || 'Cevital'} &middot; <span className="bg-white/20 px-2.5 py-0.5 rounded-md font-bold">{ots.length} OT au total</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 bg-black/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
            <div className="text-right">
              <p className="text-3xl font-black text-purple-300">{ots.filter(o => o.statut === 'EN_COURS').length}</p>
              <p className="text-xs uppercase tracking-wider text-blue-200 font-bold mt-1">En cours</p>
            </div>
            <div className="w-px h-12 bg-white/20"/>
            <div className="text-right">
              <p className="text-3xl font-black text-amber-300">{ots.filter(o => o.statut === 'TERMINE').length}</p>
              <p className="text-xs uppercase tracking-wider text-blue-200 font-bold mt-1">Soumis</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRE DE FILTRES STYLE HAUTE VISIBILITÉ ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          
          {/* Recherche Blanche avec bordures épaisses (Style TopBar demandé) */}
          <div className="relative flex-1 min-w-[300px] group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={20} className="text-slate-400 group-focus-within:text-[#003B7A] transition-colors"/>
            </div>
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par N° OT, équipement, assigné..."
              className="w-full pl-12 pr-12 py-3.5 text-base border-2 border-gray-200 rounded-xl
                bg-white text-slate-900 placeholder-slate-400 font-bold shadow-sm
                focus:outline-none focus:border-[#003B7A] focus:ring-4 focus:ring-[#003B7A]/10 transition-all duration-200"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-red-500 transition-colors">
                <X size={20}/>
              </button>
            )}
          </div>

          {/* Selecteur de filtrage de statut grand format */}
          <div className="relative min-w-[180px]">
            <select
              value={filtre}
              onChange={e => setFiltre(e.target.value)}
              className="w-full appearance-none pl-5 pr-12 py-3.5 rounded-xl border-2 border-gray-200
                bg-white text-slate-800 text-base font-black cursor-pointer shadow-sm
                focus:border-[#003B7A] focus:ring-4 focus:ring-[#003B7A]/10 focus:outline-none transition-all duration-200"
            >
              <option value="TOUS">Tous ({ots.length})</option>
              {Object.entries(counts).map(([k, v]) => (
                <option key={k} value={k}>{STATUT_CFG[k]?.label ?? k} ({v})</option>
              ))}
            </select>
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#003B7A] pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>

          {/* Boutons d'actions plus spacieux */}
          <button onClick={charger}
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl border-2 border-gray-200
              text-slate-700 text-base font-bold hover:border-[#003B7A] hover:text-[#003B7A]
              hover:bg-blue-50/50 transition-all duration-200 shadow-sm">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
            Actualiser
          </button>

          <button onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#003B7A] text-white text-base font-black
              hover:bg-[#002a5a] transition-all duration-200 shadow-md hover:shadow-lg">
            <Printer size={18}/>
            Imprimer
          </button>
        </div>

        {/* Raccourcis de badges de filtres horizontaux */}
        {Object.keys(counts).length > 0 && (
          <div className="flex gap-2 pt-3 border-t border-gray-100 flex-wrap">
            {Object.entries(counts).map(([k, v]) => (
              <button 
                key={k} 
                onClick={() => setFiltre(filtre === k ? 'TOUS' : k)}
                className={`px-4 py-2 rounded-xl text-xs font-black border transition-all duration-200
                  ${filtre === k
                    ? 'bg-[#003B7A] text-white border-[#003B7A] shadow-md'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                {STATUT_CFG[k]?.label ?? k} ({v})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── TABLEAU PRINCIPAL AGRANDI ET INTERACTIF ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md">
        {loading ? (
          /* Ajout d'un squelette d'attente (Skeleton Loader) pour un effet plus premium */
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl w-full" />
            ))}
          </div>
        ) : otsFiltrees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 bg-slate-50/50">
            <ClipboardList size={56} className="text-slate-300 mb-4"/>
            <p className="text-xl font-black text-slate-700 mb-2">Aucun ordre de travail trouvé</p>
            <p className="text-sm text-slate-400">Modifier vos mots-clés ou changer le filtre de statut actuel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#003B7A] text-white uppercase text-xs font-black tracking-wider">
                <tr>
                  <th className="px-5 py-4 cursor-pointer hover:bg-[#002a5a] transition-colors select-none" onClick={() => toggleSort('numero_ot')}>
                    <div className="flex items-center">N° OT <SortIcon col="numero_ot" k={sortKey} d={sortDir}/></div>
                  </th>
                  <th className="px-5 py-4">Machine Racine</th>
                  <th className="px-5 py-4">Équipement</th>
                  <th className="px-5 py-4">Intervenant Assigné</th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-[#002a5a] transition-colors select-none" onClick={() => toggleSort('statut')}>
                    <div className="flex items-center">Statut actuel <SortIcon col="statut" k={sortKey} d={sortDir}/></div>
                  </th>
                  <th className="px-5 py-4 text-right pr-6">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-sm">
                {otsFiltrees.map(ot => (
                  <tr 
                    key={ot.id_ot}
                    onClick={() => router.push(`/ot/${ot.id_ot}`)}
                    className="hover:bg-blue-50/60 transition-all duration-150 cursor-pointer group"
                  >
                    {/* Colonne Numéro OT + Type + Badge Priorité Dynamique */}
                    <td className="px-5 py-4">
                      <span className="font-mono text-base font-black text-[#003B7A] group-hover:underline">{ot.numero_ot}</span>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">{ot.type_ot} &middot; {ot.classe}</p>
                      {/* Affichage direct de la priorité si disponible pour accélérer la prise de décision */}
                      {ot.priorite && (
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          PRIORITE_CFG[ot.priorite]?.cls ?? PRIORITE_CFG.BASSE.cls
                        }`}>
                          {PRIORITE_CFG[ot.priorite]?.label ?? ot.priorite}
                        </span>
                      )}
                    </td>

                    {/* Machine Racine */}
                    <td className="px-5 py-4 max-w-[200px]">
                      {ot.equipement?.machine_racine_code ? (
                        <div>
                          <p className="font-mono text-xs font-black text-slate-800">{ot.equipement.machine_racine_code}</p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">{ot.equipement.machine_racine_desc}</p>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    {/* Équipement cible */}
                    <td className="px-5 py-4 max-w-[200px]">
                      {ot.equipement ? (
                        <div>
                          <p className="font-mono text-xs font-black text-slate-800">{ot.equipement.equipment_code}</p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">{ot.equipement.description}</p>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    {/* Assignation */}
                    <td className="px-5 py-4 font-bold text-slate-700">
                      {ot.assigne?.nom ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span>{ot.assigne.nom}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border bg-amber-50 text-amber-800 border-amber-200">
                          <AlertCircle size={12}/> Non assigné
                        </span>
                      )}
                    </td>

                    {/* Badge Statut */}
                    <td className="px-5 py-4"><StatutBadge v={ot.statut}/></td>

                    {/* Boutons d'actions à droite */}
                    <td className="px-5 py-4 text-right pr-6" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2.5">
                        {!ot.assigne && (role === 'ADMIN' || role === 'METHODISTE') && (
                          <button
                            onClick={(e) => openAssignModal(ot, e)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black
                              bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm hover:shadow"
                          >
                            <UserPlus size={14} /> Assigner
                          </button>
                        )}
                        <button 
                          onClick={() => router.push(`/ot/${ot.id_ot}`)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black
                            bg-slate-100 text-slate-800 hover:bg-[#003B7A] hover:text-white transition-all border border-slate-200 shadow-sm"
                        >
                          <Eye size={14}/> Détail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer du Tableau récapitulatif */}
        {!loading && otsFiltrees.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between font-bold text-slate-600">
            <p className="text-sm">Affichage de {otsFiltrees.length} OT filtré{otsFiltrees.length !== 1 ? 's' : ''}</p>
            <div className="text-sm text-slate-400">
              Total du pôle : <span className="text-slate-800 font-black">{ots.length} OT</span>
            </div>
          </div>
        )}
      </div>

      {/* Modale d'assignation d'équipe */}
      <AssignModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        ot={selectedOT}
        idPole={idPole}
        onAssignSuccess={handleAssignSuccess}
      />

      {/* ── MODAL IMPRESSION STYLE CEVITAL PREMIUM ── */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all border border-slate-100">
            <div className="bg-gradient-to-r from-[#003B7A] to-[#002a5a] text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Printer size={24}/>
                <div>
                  <h3 className="font-black text-lg">Imprimer la liste des OT</h3>
                  <p className="text-xs text-blue-200 font-medium">Format officiel CEVITAL d'exportation</p>
                </div>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="p-1.5 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors">
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-4 text-sm text-blue-900">
                <p className="font-black mb-1.5 text-blue-950">Périmètre d'export :</p>
                <ul className="space-y-1 text-xs font-bold text-blue-800">
                  <li>&bull; Entité / Pôle : <span className="text-slate-900 font-black">{authUser?.nom_pole ?? '—'}</span></li>
                  <li>&bull; Statut ciblé : <span className="bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-black">{filtre === 'TOUS' ? 'Tous les statuts' : (STATUT_CFG[filtre]?.label ?? filtre)}</span></li>
                </ul>
              </div>

              <label className="flex items-center gap-3 text-sm text-slate-700 font-bold cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={printIncludeFiltre}
                  onChange={e => setPrintIncludeFiltre(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#003B7A] focus:ring-[#003B7A]"
                />
                Restreindre au filtre statut courant
              </label>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Grouper et trier les documents par :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'statut',   label: 'Statut',    icon: <Filter size={13}/> },
                    { key: 'zone',     label: 'Zone',     icon: <MapPin size={13}/> },
                    { key: 'equipe',   label: 'Équipe',    icon: <UsersIcon size={13}/> },
                    { key: 'priorite', label: 'Priorité',  icon: <Filter size={13}/> },
                    { key: 'type',     label: 'Type',     icon: <ClipboardList size={13}/> },
                    { key: 'mois',     label: 'Mois',     icon: <Calendar size={13}/> },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setPrintGroupement(opt.key)}
                      className={`flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl border-2 text-xs font-black transition-all ${
                        printGroupement === opt.key
                          ? 'border-[#003B7A] bg-blue-50/50 text-[#003B7A]'
                          : 'border-gray-200 text-slate-600 hover:border-gray-300 hover:bg-slate-50'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleImprimer} 
                  disabled={printing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#003B7A] to-[#002a5a] text-white rounded-xl font-black shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {printing && <Loader2 size={16} className="animate-spin"/>}
                  {printing ? 'Génération en cours…' : 'Générer le PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}