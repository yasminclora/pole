'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { otService } from '@/services/otService'
import { zonesService } from '@/services/zonesService'
import {
  Loader2, Search, X, Eye, Archive, Wrench,
  Filter, Download, MapPin, Printer, Users as UsersIcon,
} from 'lucide-react'
import api from '@/services/axiosInstance'

interface Zone {
  id_zone: number
  code_zone: string
  nom_zone: string
}

interface OT {
  id_ot: number
  numero_ot: string
  type_ot: string
  classe: string
  priorite: string
  date_archive?: string | null
  equipement?: {
    equipment_code: string
    description: string
    machine_racine_code?: string | null
    machine_racine_desc?: string | null
    nom_zone?: string | null
  }
  assigne?: { nom: string } | null
}

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ArchivesOTPage() {
  const router = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idPole = Number(authUser?.id_pole)

  const [ots, setOts] = useState<OT[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filtreZone, setFiltreZone] = useState<number | ''>('')
  const [filtreType, setFiltreType] = useState<string>('')
  const [mois, setMois] = useState<number | ''>(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { id_pole: idPole, statut: 'ARCHIVE' }
      if (filtreZone) params.id_zone = filtreZone
      if (filtreType) params.type_ot = filtreType
      if (mois) {
        params.date_debut = `${annee}-${String(mois).padStart(2, '0')}-01`
        const lastDay = new Date(annee, mois as number, 0).getDate()
        params.date_fin = `${annee}-${String(mois).padStart(2, '0')}-${lastDay}`
      } else {
        params.date_debut = `${annee}-01-01`
        params.date_fin = `${annee}-12-31`
      }
      const data = await otService.liste(params)
      setOts(Array.isArray(data) ? data : [])
    } catch { setOts([]) }
    finally { setLoading(false) }
  }, [idPole, filtreZone, filtreType, mois, annee])

  const chargerZones = useCallback(async () => {
    try {
      const data = await zonesService.parPole(idPole)
      setZones(Array.isArray(data) ? data : [])
    } catch { setZones([]) }
  }, [idPole])

  useEffect(() => { charger(); chargerZones() }, [charger, chargerZones])

  const otsFiltrees = ots.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.numero_ot.toLowerCase().includes(q) ||
      o.equipement?.equipment_code?.toLowerCase().includes(q) ||
      o.equipement?.machine_racine_code?.toLowerCase().includes(q) ||
      o.assigne?.nom?.toLowerCase().includes(q)
  })

  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printGroupement, setPrintGroupement] = useState<'zone' | 'equipe' | 'priorite' | 'mois'>('zone')
  const [printing, setPrinting] = useState(false)

  const handleImprimer = async () => {
    setPrinting(true)
    try {
      const params: any = { id_pole: idPole, groupement: printGroupement }
      if (filtreZone) params.id_zone = filtreZone
      if (mois) {
        params.date_debut = `${annee}-${String(mois).padStart(2, '0')}-01`
        const lastDay = new Date(annee, mois as number, 0).getDate()
        params.date_fin = `${annee}-${String(mois).padStart(2, '0')}-${lastDay}`
      } else {
        params.date_debut = `${annee}-01-01`
        params.date_fin = `${annee}-12-31`
      }
      const res = await api.get('/ot/archives/imprimer', { params, responseType: 'text' })
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

  const handleExportCSV = async () => {
    try {
      const params: any = { id_pole: idPole }
      if (filtreZone) params.id_zone = filtreZone
      if (filtreType) params.type_ot = filtreType
      if (mois) {
        params.date_debut = `${annee}-${String(mois).padStart(2, '0')}-01`
        const lastDay = new Date(annee, mois as number, 0).getDate()
        params.date_fin = `${annee}-${String(mois).padStart(2, '0')}-${lastDay}`
      } else {
        params.date_debut = `${annee}-01-01`
        params.date_fin = `${annee}-12-31`
      }
      const res: any = await otService.exportArchivesCSV(params)
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'archives.csv'; a.click()
      window.URL.revokeObjectURL(url)
    } catch { alert('Erreur export CSV') }
  }

  const annees = []
  const curYear = new Date().getFullYear()
  for (let y = curYear; y >= curYear - 5; y--) annees.push(y)

  return (
    <div className="space-y-5 pb-6">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Archive size={28} className="text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Archives Interventions</h1>
              <p className="text-blue-200 text-sm mt-0.5">{ots.length} OT archivés</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold">{ots.length}</p>
              <p className="text-xs text-blue-200">Affichés</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="N° OT, équipement, machine, assigné..."
              className="w-full pl-9 pr-8 py-2 text-sm border-2 border-gray-100 rounded-xl bg-gray-50
                focus:outline-none focus:border-[#003B7A] focus:bg-white focus:ring-4 focus:ring-[#003B7A]/10 transition-all"/>
            {search && <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
              <X size={16}/></button>}
          </div>

          <div className="relative">
            <select value={filtreZone} onChange={e => setFiltreZone(e.target.value ? Number(e.target.value) : '')}
              className="appearance-none pl-9 pr-8 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium
                focus:border-[#003B7A] focus:ring-4 focus:ring-[#003B7A]/10 focus:outline-none transition-all">
              <option value="">Toutes zones</option>
              {zones.map(z => <option key={z.id_zone} value={z.id_zone}>{z.nom_zone}</option>)}
            </select>
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          </div>

          <div className="relative">
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium
                focus:border-[#003B7A] focus:ring-4 focus:ring-[#003B7A]/10 focus:outline-none transition-all">
              <option value="">Tous types</option>
              <option value="CORRECTIF">Correctif</option>
              <option value="PREDICTIF">Prédictif</option>
            </select>
            <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          </div>

          <select value={mois} onChange={e => setMois(e.target.value ? Number(e.target.value) : '')}
            className="appearance-none px-4 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium
              focus:border-[#003B7A] focus:outline-none transition-all">
            <option value="">Tous les mois</option>
            {MOIS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>

          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="appearance-none px-4 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm font-medium
              focus:border-[#003B7A] focus:outline-none transition-all">
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button onClick={charger}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-gray-200 text-sm font-semibold
              text-gray-600 hover:border-[#003B7A] hover:text-[#003B7A] hover:bg-blue-50 transition-all">
            <Loader2 size={14} className={loading ? 'animate-spin' : ''}/>
          </button>

          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003B7A] text-white text-sm font-bold
              hover:bg-[#002a5a] transition-all shadow-sm">
            <Download size={14}/> CSV
          </button>

          <button onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003B7A] text-white text-sm font-bold
              hover:bg-[#002a5a] transition-all shadow-sm">
            <Printer size={14}/> Imprimer
          </button>
        </div>

        {otsFiltrees.length > 0 && (
          <p className="text-xs text-gray-400 mt-3">
            {otsFiltrees.length} résultat{otsFiltrees.length !== 1 ? 's' : ''}
            {filtreZone && ` · ${zones.find(z => z.id_zone === filtreZone)?.nom_zone}`}
            {filtreType && ` · ${filtreType === 'CORRECTIF' ? 'Correctif' : 'Prédictif'}`}
            {` · ${mois ? MOIS[mois as number - 1] : 'Année'} ${annee}`}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-[#003B7A]"/>
          <span className="text-sm text-gray-400">Chargement...</span>
        </div>
      ) : otsFiltrees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <Archive size={48} className="text-gray-200 mb-4"/>
          <p className="text-lg font-medium text-gray-500 mb-1">Aucune archive</p>
          <p className="text-sm text-gray-400">Essayez de modifier les filtres</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead style={{backgroundColor:'#003B7A'}}>
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">N° OT</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">Composante</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">Machine Racine</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">Zone</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">Date archivage</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-blue-100 whitespace-nowrap pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {otsFiltrees.map(ot => (
                  <tr key={ot.id_ot}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/ot/archives/${ot.id_ot}`)}>
                    <td className="px-4 py-3.5">
                      <p className="font-mono font-bold text-sm" style={{color:'#003B7A'}}>{ot.numero_ot}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-gray-800">{ot.equipement?.equipment_code || '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ot.equipement?.description || ''}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-700">{ot.equipement?.machine_racine_code || '—'}</p>
                      {ot.equipement?.machine_racine_desc && (
                        <p className="text-xs text-gray-400 mt-0.5">{ot.equipement.machine_racine_desc}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-600">{ot.equipement?.nom_zone || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                      {fmtDate(ot.date_archive)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        ot.type_ot === 'CORRECTIF'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {ot.type_ot === 'CORRECTIF' ? 'Correctif' : 'Prédictif'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => router.push(`/ot/archives/${ot.id_ot}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all">
                        <Eye size={12}/>Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">{otsFiltrees.length} résultat{otsFiltrees.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* ── Modal Impression ─────────────────────────────────────── */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#003B7A] to-[#002a5a] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Printer size={22}/>
                <div>
                  <h3 className="font-bold text-lg">Imprimer les archives</h3>
                  <p className="text-xs text-white/80">Document CEVITAL prêt à imprimer</p>
                </div>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="p-1 hover:bg-white/20 rounded">
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <p className="font-semibold mb-1">Filtres actifs :</p>
                <ul className="space-y-0.5 text-blue-700">
                  {filtreZone ? <li>• Zone : {zones.find(z => z.id_zone === filtreZone)?.nom_zone}</li> : <li>• Toutes les zones</li>}
                  <li>• Période : {mois ? `${MOIS[mois as number - 1]} ${annee}` : `Année ${annee}`}</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Grouper les OT par :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'zone',     label: 'Zone',     icon: <MapPin size={14}/> },
                    { key: 'equipe',   label: 'Équipe',   icon: <UsersIcon size={14}/> },
                    { key: 'priorite', label: 'Priorité', icon: <Filter size={14}/> },
                    { key: 'mois',     label: 'Mois',     icon: <Archive size={14}/> },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setPrintGroupement(opt.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
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
