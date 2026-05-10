'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { otService } from '@/services/otService'
import { Loader2, Search, X, RefreshCw, Eye, CheckCircle, AlertTriangle, ClipboardCheck, FileText } from 'lucide-react'

interface OT {
  id_ot: number
  numero_ot: string
  type_ot: string
  classe: string
  priorite: string
  statut: string
  description: string
  date_prevue?: string | null
  date_debut?: string | null
  created_at: string
  equipement?: { equipment_code: string; description: string }
  assigne?: { id: number; nom: string; role: string } | null
  methodiste?: { id: number; nom: string } | null
}

const URGENCE_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  FAIBLE: { label: 'Faible', cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  NORMALE: { label: 'Normale', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  HAUTE: { label: 'Haute', cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  CRITIQUE: { label: 'Critique', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
}

const STATUT_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  CREE: { label: 'Créé', cls: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-500' },
  ASSIGNE: { label: 'Assigné', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  EN_COURS: { label: 'En cours', cls: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  TERMINE: { label: 'Soumis', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  VALIDE_CE: { label: 'Validé CE', cls: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  VALIDE_HSE: { label: 'Validé HSE', cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  ARCHIVE: { label: 'Archivé', cls: 'bg-gray-50 text-gray-400 border-gray-200', dot: 'bg-gray-400' },
  REJETE: { label: 'Rejeté', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
}

function UrgBadge({ v }: { v: string }) {
  const c = URGENCE_CFG[v] ?? URGENCE_CFG.NORMALE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
      {c.label}
    </span>
  )
}

function StatutBadge({ v }: { v: string }) {
  const c = STATUT_CFG[v] ?? STATUT_CFG.CREE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}/>
      {c.label}
    </span>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function AValiderOTPage() {
  const router = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idUser = Number(authUser?.id_user)
  const idPole = Number(authUser?.id_pole)
  const role = authUser?.role || ''

  const [ots, setOts] = useState<OT[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const data = await otService.liste({ id_pole: idPole })
      setOts(Array.isArray(data) ? data : [])
    } catch { setOts([]) }
    finally { setLoading(false) }
  }, [idPole])

  useEffect(() => { charger() }, [charger])

  const otsAValiderCE = ots.filter(o => o.statut === 'TERMINE')
  const otsAValiderHSE = ots.filter(o => o.statut === 'VALIDE_CE')

  const otsFiltrees = ots.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.numero_ot.toLowerCase().includes(q) ||
      o.equipement?.equipment_code?.toLowerCase().includes(q) ||
      o.assigne?.nom?.toLowerCase().includes(q) ||
      o.statut.toLowerCase().includes(q)
  })

  const otsFiltreesHSE = otsAValiderHSE.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.numero_ot.toLowerCase().includes(q) ||
      o.equipement?.equipment_code?.toLowerCase().includes(q) ||
      o.assigne?.nom?.toLowerCase().includes(q)
  })

  const peutValiderCE = role === 'CHEF_EQUIPE' || role === 'CHEF_POLE'
  const peutValiderHSE = role === 'HSE' || role === 'ADMIN'

  return (
    <div className="space-y-6 pb-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#003B7A]/20 rounded-full blur-3xl"/>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ClipboardCheck size={32} className="text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {peutValiderHSE ? 'Gestion des OT' : 'Validation OT'}
              </h1>
              <p className="text-blue-200 text-sm mt-1">Cevital · {ots.length} OT au total</p>
            </div>
          </div>
          {peutValiderHSE && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">{otsAValiderHSE.length}</p>
                <p className="text-xs text-blue-200">À valider HSE</p>
              </div>
              <div className="w-px h-10 bg-white/20"/>
              <div className="text-right">
                <p className="text-2xl font-bold">{ots.filter(o => o.statut === 'VALIDE_HSE').length}</p>
                <p className="text-xs text-blue-200">Validés HSE</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par N° OT, équipement, assigné..."
            className="w-full pl-10 pr-10 py-3 text-sm border-2 border-gray-100 rounded-xl 
              bg-gray-50 text-gray-800 placeholder-gray-400 
              focus:outline-none focus:border-[#003B7A] focus:bg-white 
              focus:ring-4 focus:ring-[#003B7A]/10 transition-all duration-200"/>
          {search && (
            <button onClick={() => setSearch('')} 
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-red-500">
              <X size={18}/>
            </button>
          )}
        </div>
      </div>

      {peutValiderHSE && otsAValiderHSE.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-green-200 overflow-hidden shadow-sm">
          <div className="bg-green-50 px-6 py-4 border-b border-green-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="text-green-600" size={20}/>
              </div>
              <div>
                <h2 className="font-bold text-green-800">À valider par HSE</h2>
                <p className="text-sm text-green-600">{otsAValiderHSE.length} OT en attente</p>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead style={{backgroundColor:'#003B7A'}}>
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">N° OT</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Équipement</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Assigné à</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Validé CE</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Priorité</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Date</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-blue-100 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {otsFiltreesHSE.map(ot => (
                    <tr key={ot.id_ot} className="hover:bg-green-50/50 cursor-pointer" onClick={() => router.push(`/ot/${ot.id_ot}`)}>
                      <td className="px-3 py-3"><p className="font-mono font-bold text-[#003B7A]">{ot.numero_ot}</p></td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-xs">{ot.equipement?.equipment_code || '—'}</p>
                        <p className="text-xs text-gray-400">{ot.equipement?.description}</p>
                      </td>
                      <td className="px-3 py-3 text-sm">{ot.assigne?.nom || '—'}</td>
                      <td className="px-3 py-3 text-xs text-green-600">✓ Validée</td>
                      <td className="px-3 py-3"><UrgBadge v={ot.priorite}/></td>
                      <td className="px-3 py-3 text-xs text-gray-500">{fmtDate(ot.created_at)}</td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600">
                          Valider
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {peutValiderCE && otsAValiderCE.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden shadow-sm">
          <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <CheckCircle className="text-amber-600" size={20}/>
              </div>
              <div>
                <h2 className="font-bold text-amber-800">À valider par Chef Équipe</h2>
                <p className="text-sm text-amber-600">{otsAValiderCE.length} OT en attente</p>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead style={{backgroundColor:'#003B7A'}}>
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">N° OT</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Équipement</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Assigné à</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Priorité</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-blue-100">Date</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-blue-100 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {otsAValiderCE.filter(o => {
                    if (!search) return true
                    const q = search.toLowerCase()
                    return o.numero_ot.toLowerCase().includes(q) ||
                      o.equipement?.equipment_code?.toLowerCase().includes(q) ||
                      o.assigne?.nom?.toLowerCase().includes(q)
                  }).map(ot => (
                    <tr key={ot.id_ot} className="hover:bg-amber-50/50 cursor-pointer" onClick={() => router.push(`/ot/${ot.id_ot}`)}>
                      <td className="px-3 py-3"><p className="font-mono font-bold text-[#003B7A]">{ot.numero_ot}</p></td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-xs">{ot.equipement?.equipment_code || '—'}</p>
                        <p className="text-xs text-gray-400">{ot.equipement?.description}</p>
                      </td>
                      <td className="px-3 py-3 text-sm">{ot.assigne?.nom || '—'}</td>
                      <td className="px-3 py-3"><UrgBadge v={ot.priorite}/></td>
                      <td className="px-3 py-3 text-xs text-gray-500">{fmtDate(ot.created_at)}</td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600">
                          Valider
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <FileText size={20} className="text-[#003B7A]"/>
          <h2 className="font-bold text-gray-900">Tous les Ordres de Travail</h2>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="animate-spin text-[#003B7A]"/>
            <span className="text-sm text-gray-400">Chargement...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead style={{backgroundColor:'#003B7A'}}>
                <tr>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase text-blue-100 whitespace-nowrap">N° OT</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase text-blue-100 whitespace-nowrap">Équipement</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase text-blue-100 whitespace-nowrap">Assigné à</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase text-blue-100 whitespace-nowrap">Priorité</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase text-blue-100 whitespace-nowrap">Statut</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase text-blue-100 whitespace-nowrap">Date</th>
                  <th className="px-3 py-3 text-right text-[10px] font-bold uppercase text-blue-100 whitespace-nowrap pr-4">Action</th>
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
                      {ot.equipement ? (
                        <>
                          <p className="font-mono text-xs font-semibold text-[#003B7A]">{ot.equipement.equipment_code}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ot.equipement.description}</p>
                        </>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600">
                      {ot.assigne?.nom || <span className="text-amber-500">Non assigné</span>}
                    </td>
                    <td className="px-3 py-4"><UrgBadge v={ot.priorite}/></td>
                    <td className="px-3 py-4"><StatutBadge v={ot.statut}/></td>
                    <td className="px-3 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {ot.created_at?.split('T')[0] || '—'}
                    </td>
                    <td className="px-4 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => router.push(`/ot/${ot.id_ot}`)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold 
                          bg-[#003B7A] text-white hover:bg-[#002a5a] transition-all shadow-sm hover:shadow-md">
                        <Eye size={14}/>Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">Affichage de {otsFiltrees.length} résultat{otsFiltrees.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>Total: {ots.length} OT</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}