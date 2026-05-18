'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { otService } from '@/services/otService'
import { Loader2, Search, X, RefreshCw, Eye, ClipboardList, UserPlus, Printer, MapPin, Users as UsersIcon, Filter, Calendar } from 'lucide-react'
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
  CREE: { label: 'Créé', cls: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-500' },
  ASSIGNE: { label: 'Assigné', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  EN_COURS: { label: 'En cours', cls: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  TERMINE: { label: 'Soumis', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  VALIDE_CE: { label: 'Validé CE', cls: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  VALIDE_HSE: { label: 'Validé HSE', cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  ARCHIVE: { label: 'Archivé', cls: 'bg-gray-50 text-gray-400 border-gray-200', dot: 'bg-gray-400' },
}

type SortKey = 'numero_ot' | 'statut'
type SortDir = 'asc' | 'desc'

function StatutBadge({ v }: { v: string }) {
  const c = STATUT_CFG[v] ?? STATUT_CFG.CREE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
      {c.label}
    </span>
  )
}

function SortIcon({ col, k, d }: { col: SortKey; k: SortKey; d: SortDir }) {
  if (col !== k) return null
  return (
    <span className="inline-flex flex-col ml-1">
      <span className={`text-[8px] ${d === 'asc' ? 'text-white' : 'text-white/50'}`}>▲</span>
      <span className={`text-[8px] -mt-0.5 ${d === 'desc' ? 'text-white' : 'text-white/50'}`}>▼</span>
    </span>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
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

  // Modal state
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

  const handleAssignSuccess = () => {
    charger()
  }

  // ── Impression ─────────────────────────────────────────────────────
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printGroupement, setPrintGroupement] = useState<'statut' | 'zone' | 'equipe' | 'priorite' | 'type' | 'mois'>('statut')
  const [printIncludeFiltre, setPrintIncludeFiltre] = useState(true)   // applique le filtre statut courant
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

  const counts = ots.reduce((acc, o) => { acc[o.statut]=(acc[o.statut]||0)+1; return acc }, {} as Record<string,number>)

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

  const thBase = "px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap"
  const thSort = `${thBase} cursor-pointer hover:text-indigo-600 transition-colors select-none`

  return (
    <div className="space-y-6 pb-6">

      {/* ── HERO HEADER (style CEVITAL bleu) ─────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#003B7A]/20 rounded-full blur-3xl"/>

        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ClipboardList size={30} className="text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ordres de Travail</h1>
              <p className="text-blue-200 text-sm mt-1">{authUser?.nom_pole || 'Cevital'} · {ots.length} OT</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold">{ots.filter(o => o.statut === 'EN_COURS').length}</p>
              <p className="text-xs text-blue-200">En cours</p>
            </div>
            <div className="w-px h-10 bg-white/20"/>
            <div className="text-right">
              <p className="text-2xl font-bold">{ots.filter(o => o.statut === 'TERMINE').length}</p>
              <p className="text-xs text-blue-200">Soumis</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER BAR ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400 group-focus-within:text-[#003B7A] transition-colors"/>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par N° OT, équipement, assigné..."
              className="w-full pl-12 pr-10 py-3 text-sm border-2 border-gray-100 rounded-xl
                bg-gray-50 text-gray-800 placeholder-gray-400
                focus:outline-none focus:border-[#003B7A] focus:bg-white
                focus:ring-4 focus:ring-[#003B7A]/10 transition-all duration-200"/>
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-red-500 transition-colors">
                <X size={18}/>
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={filtre}
              onChange={e => setFiltre(e.target.value)}
              className="appearance-none pl-5 pr-12 py-3 rounded-xl border-2 border-gray-200
                bg-white text-gray-700 text-sm font-semibold cursor-pointer
                focus:border-[#003B7A] focus:ring-4 focus:ring-[#003B7A]/10 focus:outline-none
                transition-all duration-200"
            >
              <option value="TOUS">Tous ({ots.length})</option>
              {Object.entries(counts).map(([k, v]) => (
                <option key={k} value={k}>{STATUT_CFG[k]?.label ?? k} ({v})</option>
              ))}
            </select>
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#003B7A] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </div>

          <button onClick={charger}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200
              text-gray-600 text-sm font-semibold hover:border-[#003B7A] hover:text-[#003B7A]
              hover:bg-blue-50 transition-all duration-200">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Actualiser
          </button>

          <button onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#003B7A] text-white text-sm font-semibold
              hover:bg-[#002a5a] transition-all duration-200 shadow-sm">
            <Printer size={16}/>Imprimer
          </button>
        </div>

        {Object.keys(counts).length > 0 && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap">
            {Object.entries(counts).map(([k, v]) => (
              <button key={k} onClick={() => setFiltre(filtre === k ? 'TOUS' : k)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
                  ${filtre === k
                    ? 'bg-[#003B7A] text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {STATUT_CFG[k]?.label ?? k}: {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── TABLE CARD ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 size={28} className="animate-spin" style={{color:'#003B7A'}}/>
            <span className="text-sm text-gray-400">Chargement...</span>
          </div>
        ) : otsFiltrees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <ClipboardList size={48} className="text-gray-200 mb-4"/>
            <p className="text-lg font-medium text-gray-500 mb-2">Aucun OT trouvé</p>
            <p className="text-sm text-gray-400">
              {search || filtre !== 'TOUS' ? 'Essayez de modifier vos critères de recherche' : 'Aucun ordre de travail'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead style={{backgroundColor:'#003B7A'}}>
                <tr>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap cursor-pointer hover:text-white"
                      onClick={() => toggleSort('numero_ot')}>
                    <div className="flex items-center gap-1">N° OT<SortIcon col="numero_ot" k={sortKey} d={sortDir}/></div>
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">Machine Racine</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">Équipement</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">Assigné à</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap cursor-pointer hover:text-white"
                      onClick={() => toggleSort('statut')}>
                    <div className="flex items-center gap-1">Statut<SortIcon col="statut" k={sortKey} d={sortDir}/></div>
                  </th>
                  <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap pr-4">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {otsFiltrees.map(ot => (
                  <tr key={ot.id_ot}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/ot/${ot.id_ot}`)}>

                    <td className="px-3 py-4">
                      <p className="font-mono text-sm font-bold" style={{color:'#003B7A'}}>{ot.numero_ot}</p>
                      <p className="text-xs text-gray-400">{ot.type_ot} · {ot.classe}</p>
                    </td>

                    <td className="px-3 py-4 min-w-[140px]">
                      {ot.equipement?.machine_racine_code ? (
                        <>
                          <p className="font-mono text-xs font-semibold text-[#003B7A]">{ot.equipement.machine_racine_code}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ot.equipement.machine_racine_desc}</p>
                        </>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    <td className="px-3 py-4 min-w-[140px]">
                      {ot.equipement ? (
                        <>
                          <p className="font-mono text-xs font-semibold text-[#003B7A]">{ot.equipement.equipment_code}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ot.equipement.description}</p>
                        </>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    <td className="px-3 py-4 text-sm text-gray-600">
                      {ot.assigne?.nom || (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                          Non assigné
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-4"><StatutBadge v={ot.statut}/></td>

                    <td className="px-4 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {!ot.assigne && (role === 'ADMIN' || role === 'METHODISTE') && (
                          <button
                            onClick={(e) => openAssignModal(ot, e)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold
                              bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-sm hover:shadow-md"
                          >
                            <UserPlus size={14} />Assigner
                          </button>
                        )}
                        <button onClick={() => router.push(`/ot/${ot.id_ot}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold
                            bg-[#003B7A] text-white hover:bg-[#002a5a] transition-all shadow-sm">
                          <Eye size={14}/>Détail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && otsFiltrees.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">Affichage de {otsFiltrees.length} résultat{otsFiltrees.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>Total: {ots.length} OT</span>
            </div>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      <AssignModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        ot={selectedOT}
        idPole={idPole}
        onAssignSuccess={handleAssignSuccess}
      />

      {/* ── Modal Impression Liste OT ───────────────────────────── */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#003B7A] to-[#002a5a] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Printer size={22}/>
                <div>
                  <h3 className="font-bold text-lg">Imprimer la liste des OT</h3>
                  <p className="text-xs text-white/80">Document CEVITAL prêt à imprimer</p>
                </div>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="p-1 hover:bg-white/20 rounded">
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <p className="font-semibold mb-1">Périmètre :</p>
                <ul className="space-y-0.5 text-blue-700">
                  <li>• Pôle : {authUser?.nom_pole ?? '—'}</li>
                  <li>• Statut filtré : <strong>{filtre === 'TOUS' ? 'Tous' : (STATUT_CFG[filtre]?.label ?? filtre)}</strong></li>
                </ul>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox"
                  checked={printIncludeFiltre}
                  onChange={e => setPrintIncludeFiltre(e.target.checked)}
                  className="rounded text-[#003B7A]"/>
                Appliquer le filtre statut courant
              </label>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Grouper les OT par :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'statut',   label: 'Statut',   icon: <Filter size={14}/> },
                    { key: 'zone',     label: 'Zone',     icon: <MapPin size={14}/> },
                    { key: 'equipe',   label: 'Équipe',   icon: <UsersIcon size={14}/> },
                    { key: 'priorite', label: 'Priorité', icon: <Filter size={14}/> },
                    { key: 'type',     label: 'Type',     icon: <ClipboardList size={14}/> },
                    { key: 'mois',     label: 'Mois',     icon: <Calendar size={14}/> },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setPrintGroupement(opt.key)}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                        printGroupement === opt.key
                          ? 'border-[#003B7A] bg-blue-50 text-[#003B7A]'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
                  Annuler
                </button>
                <button onClick={handleImprimer} disabled={printing}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#003B7A] to-[#002a5a] text-white rounded-lg font-semibold shadow disabled:opacity-50">
                  {printing && <Loader2 size={14} className="animate-spin"/>}
                  {printing ? 'Génération…' : 'Générer le document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}