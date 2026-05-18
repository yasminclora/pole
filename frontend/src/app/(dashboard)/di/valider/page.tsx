'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { diService } from '@/services/diService'
import { useGlobalNotifications } from '@/hooks/useGlobalNotifications'
import { useDIChangeRefresh } from '@/hooks/useEvent'
import api from '@/services/axiosInstance'
import { Loader2, RefreshCw, X, Check, Bell, Eye, FileText, MapPin, Factory, User, Clock, AlertCircle, Search, Download, Printer } from 'lucide-react'

const CLASSES = [
  { value: 'MECANIQUE', label: 'Mecanique' },
  { value: 'ELECTRIQUE', label: 'Electrique' },
  { value: 'GLOBALE', label: 'Electro-mecano' },
]

// Niveau d'urgence : on garde le terme "niveau" cohérent avec la DI du mécanicien.
// Backend mappe automatiquement NIVEAU_1/2/3 → priorité OT (NORMALE/HAUTE/CRITIQUE).
const NIVEAUX_URGENCE = [
  { value: 'NIVEAU_1', label: 'Niveau 1 — Faible', color: 'bg-green-100 text-green-700' },
  { value: 'NIVEAU_2', label: 'Niveau 2 — Moyen',  color: 'bg-orange-100 text-orange-700' },
  { value: 'NIVEAU_3', label: 'Niveau 3 — Élevé',  color: 'bg-red-100 text-red-700' },
]

// Mapping des valeurs legacy de la DI vers NIVEAU_1/2/3 (pour pré-remplir)
const URGENCE_TO_NIVEAU: Record<string, string> = {
  NIVEAU_1: 'NIVEAU_1',
  NIVEAU_2: 'NIVEAU_2',
  NIVEAU_3: 'NIVEAU_3',
  FAIBLE  : 'NIVEAU_1',
  NORMALE : 'NIVEAU_1',
  HAUTE   : 'NIVEAU_2',
  CRITIQUE: 'NIVEAU_3',
}

const URGENCE_LABELS: Record<string, { label: string; color: string }> = {
  NIVEAU_1: { label: 'Niveau 1', color: 'text-green-600' },
  NIVEAU_2: { label: 'Niveau 2', color: 'text-orange-600' },
  NIVEAU_3: { label: 'Niveau 3', color: 'text-red-600' },
  FAIBLE: { label: 'Faible', color: 'text-green-600' },
  NORMALE: { label: 'Normale', color: 'text-blue-600' },
  HAUTE: { label: 'Haute', color: 'text-orange-600' },
  CRITIQUE: { label: 'Critique', color: 'text-red-600' },
}

interface DI {
  id_di: number
  numero_di: string
  statut: string
  urgence: string
  description_panne: string
  created_at: string
  date_verification?: string
  equipement?: { id_equipement: number; equipment_code: string; description: string; hierarchy_level?: number; nom_zone?: string; code_zone?: string; machine_racine_code?: string; machine_racine_desc?: string }
  declarant?: { nom: string; role: string }
}

export default function ValiderDIPage() {
  const router = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idPole = Number(authUser?.id_pole)
  const idUser = Number(authUser?.id_user)
  const nomMethodiste = authUser ? `${authUser.prenom} ${authUser.nom}` : ''
  const printRef = useRef<HTMLDivElement>(null)

  const [dis, setDis] = useState<DI[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('TOUS')
  const [selectedDI, setSelectedDI] = useState<DI | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [stockInfo, setStockInfo] = useState<any>(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [nouvelleDI, setNouvelleDI] = useState<any>(null)
  const [detailDI, setDetailDI] = useState<DI | null>(null)
  const refreshDICount = useDIChangeRefresh()

  const [classe, setClasse] = useState('MECANIQUE')
  const [priorite, setPriorite] = useState('NIVEAU_1')   // niveau d'urgence (NIVEAU_1/2/3)
  const [description, setDescription] = useState('')
  const [datePrevue, setDatePrevue] = useState('')
  const [duree, setDuree] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const charger = useCallback(async () => {
    setLoading(true)
    let enAttente: DI[] = []
    let verifies: DI[] = []

    try { enAttente = await diService.liste({ id_pole: idPole, statut: 'EN_ATTENTE' }) } catch { enAttente = [] }
    try { verifies = await diService.liste({ id_pole: idPole, statut: 'VERIFIE' }) } catch { verifies = [] }

    setDis([...(Array.isArray(enAttente) ? enAttente : []), ...(Array.isArray(verifies) ? verifies : [])])
    setLoading(false)
  }, [idPole])

  useEffect(() => { charger() }, [charger])

  const { notifications } = useGlobalNotifications()

  useEffect(() => {
    const derniere = notifications[0]
    if (!derniere) return
    if (derniere.type === 'nouvelle_di') {
      charger()
      refreshDICount()
    }
  }, [notifications])

  const getStockInfo = async (equipmentCode: string) => {
    setLoadingStock(true)
    setStockInfo(null)
    try {
      const res = await api.get('/stock/by-composante', { params: { equipment_code: equipmentCode } })
      setStockInfo(res.data)
    } catch { setStockInfo(null) }
    finally { setLoadingStock(false) }
  }

  useEffect(() => {
    if (!selectedDI?.equipement?.equipment_code) { setStockInfo(null); return }
    getStockInfo(selectedDI.equipement.equipment_code)
  }, [selectedDI])

  useEffect(() => {
    if (selectedDI) setDescription(selectedDI.description_panne)
  }, [selectedDI])

  const handleShowDetail = (di: DI) => { setDetailDI(di); setShowDetail(true) }

const handleValider = async () => {
    if (!description.trim()) { setError('Description obligatoire'); return }
    setSaving(true)
    setError('')
    let dateFormatee = undefined
    if (datePrevue) {
      dateFormatee = new Date(datePrevue).toISOString()
    }
    try {
      await diService.valider(selectedDI.id_di, {
        id_methodiste: idUser,
        classe,
        priorite,
        description: description.trim(),
        date_prevue: dateFormatee,
        duree_estimee: duree ? Number(duree) : undefined,
      })
      refreshDICount()
      router.push('/ot/liste')
    } catch (err: any) { setError(err.response?.data?.detail || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleVerifier = async (di: DI) => {
    try {
      await diService.verifier(di.id_di, { id_methodiste: idUser })
      charger()
      refreshDICount()
    } catch (err: any) { alert(err.response?.data?.detail || 'Erreur') }
  }

  const getHierarchyLabel = (level?: number) => {
    if (!level) return ''
    if (level === 1) return 'Machine racine'
    if (level === 2) return 'Machine systeme'
    if (level === 3) return 'Niveau 3'
    if (level === 4) return 'Niveau 4'
    return `Niveau ${level}`
  }

  const fmtDate = (iso: string) => {
    if (!iso) return '---'
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const exporterCSV = () => {
    const now = new Date().toLocaleDateString('fr-FR')
    const pole = authUser?.nom_pole || 'Cevital'
    const rows = disFiltrees.map(d => {
      const r = d.equipement
      return [
        d.numero_di,
        r?.machine_racine_code || '',
        r?.equipment_code || '',
        r?.nom_zone || '',
        d.statut === 'VERIFIE' ? 'Verifie' : 'En attente',
        d.declarant?.nom || '',
      ].join(';')
    })
    const csv = [
      '\uFEFF',
      `CEVITAL;${pole};;`,
      `Liste des Demandes d'Intervention;${now};;`,
      'N DI;Machine Racine;Equipement;Zone;Statut;Declarant',
      ...rows,
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `DI_${pole}_${now.replace(/\//g, '-')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const handlePrint = () => window.print()

  const disFiltrees = dis.filter(d => {
    if (!d) return false
    const q = (search || '').toLowerCase()
    const matchS = !q || 
      (d.numero_di || '').toLowerCase().includes(q) || 
      (d.equipement?.equipment_code || '').toLowerCase().includes(q) ||
      (d.equipement?.nom_zone || '').toLowerCase().includes(q) ||
      (d.declarant?.nom || '').toLowerCase().includes(q)
    const matchF = filtre === 'TOUS' || d.statut === filtre
    return matchS && matchF
  })

  const nbEnAttente = dis.filter(d => d.statut === 'EN_ATTENTE').length
  const nbVerifies = dis.filter(d => d.statut === 'VERIFIE').length
  const counts = dis.reduce((acc, d) => { acc[d.statut] = (acc[d.statut] || 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="max-w-full mx-auto pb-8 px-0">
      <style>{`
.print-header, .print-footer, .print-user-info { display: none; }
@media print {
  @page { margin: 12mm 15mm; }
  body * { visibility: hidden; }
  #print-area, #print-area * { visibility: visible; }
  #print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .print-header, .print-footer, .print-user-info { display: block !important; }
  .no-print { display: none !important; }
  #print-area .print-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  #print-area .print-top-left img { width: 130px; height: auto; }
  #print-area .print-top-right { text-align: right; font-size: 10px; color: #333; line-height: 1.5; }
  #print-area .print-top-right .company-name { font-size: 18px; font-weight: bold; color: #003B7A; }
  #print-area .print-banner { background: #003B7A; color: white; padding: 8px 14px; text-align: center; font-size: 13px; font-weight: bold; margin-bottom: 14px; }
  #print-area .print-user-info { display: flex; flex-wrap: wrap; justify-content: space-between; margin-bottom: 14px; font-size: 10px; }
  #print-area .print-user-info .info-row { display: flex; gap: 40px; width: 100%; margin-bottom: 4px; }
  #print-area .print-user-info .info-item { display: flex; gap: 4px; }
  #print-area .print-user-info .info-label { font-weight: 600; color: #003B7A; }
  #print-area table { width: 100%; border-collapse: collapse; font-size: 10px; }
  #print-area th { background: #003B7A !important; color: white !important; padding: 5px 6px; text-align: left; font-size: 9px; white-space: nowrap; }
  #print-area td { padding: 4px 6px; border: 1px solid #ccc; }
  #print-area .print-footer { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 8px; font-size: 10px; color: #555; border-top: 1px solid #999; }
  #print-area .print-footer .sig-line { display: flex; flex-direction: column; gap: 2px; }
}
`}</style>

      {nouvelleDI && (
        <div className="no-print fixed top-20 right-4 z-50 bg-[#003B7A] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
          <Bell size={18}/>
          <div><p className="font-bold text-sm">Nouvelle DI: {nouvelleDI.numero_di}</p><p className="text-xs opacity-80">{nouvelleDI.equipement}</p></div>
        </div>
      )}

      {showDetail && detailDI && (
        <div className="no-print fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#003B7A] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3"><FileText size={20}/><h2 className="text-lg font-bold">Detail DI - {detailDI.numero_di}</h2></div>
              <button onClick={() => setShowDetail(false)} className="text-white/80 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Statut</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${detailDI.statut === 'EN_ATTENTE' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                    {detailDI.statut === 'EN_ATTENTE' ? 'En attente' : 'Verifie'}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Urgence</p>
                  <span className={`text-sm font-medium ${URGENCE_LABELS[detailDI.urgence]?.color || 'text-gray-600'}`}>
                    {URGENCE_LABELS[detailDI.urgence]?.label || detailDI.urgence}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">Declarant</p>
                <div className="flex items-center gap-2"><User size={16} className="text-[#003B7A]"/><span className="text-sm font-medium">{detailDI.declarant?.nom || '---'}</span><span className="text-xs text-gray-400">({detailDI.declarant?.role || '---'})</span></div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">Date de creation</p>
                <div className="flex items-center gap-2"><Clock size={16} className="text-[#003B7A]"/><span className="text-sm">{fmtDate(detailDI.created_at)}</span></div>
              </div>
              {detailDI.equipement && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-gray-400 mb-2">Equipement</p>
                  <div className="flex items-center gap-2"><Factory size={16} className="text-[#003B7A]"/><span className="font-mono font-bold text-[#003B7A]">{detailDI.equipement.equipment_code}</span></div>
                  <p className="text-sm text-gray-600">{detailDI.equipement.description}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-500">Niveau: <span className="font-medium">{getHierarchyLabel(detailDI.equipement.hierarchy_level)}</span></span>
                    {detailDI.equipement.nom_zone && (<><span className="text-gray-500">|</span><span className="text-gray-500">Zone: <span className="font-medium text-[#003B7A]">{detailDI.equipement.nom_zone}</span></span></>)}
                  </div>
                  {(detailDI.equipement.machine_racine_code || detailDI.equipement.machine_racine_desc) && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Machine racine:</span>
                      <span className="font-medium text-[#003B7A]">{detailDI.equipement.machine_racine_code} - {detailDI.equipement.machine_racine_desc}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">Description de la panne</p>
                <p className="text-sm text-gray-700">{detailDI.description_panne}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-6 text-white shadow-xl mb-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Check size={24} className="text-white"/>
            </div>
            <div>
              <h1 className="text-xl font-bold">Validation des DI</h1>
              <p className="text-blue-200 text-sm">{authUser?.nom_pole || 'Cevital'} - {dis.length} DI</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 rounded-lg bg-white/10">
              <p className="text-2xl font-bold">{nbEnAttente}</p>
              <p className="text-xs text-blue-200">A verifier</p>
            </div>
            <div className="text-center px-4 py-2 rounded-lg bg-white/10">
              <p className="text-2xl font-bold">{nbVerifies}</p>
              <p className="text-xs text-blue-200">Verifiees</p>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print bg-white rounded-xl border p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-10 py-2 text-sm border rounded-lg"/>
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14}/></button>}
          </div>
          <select value={filtre} onChange={e => setFiltre(e.target.value)} className="px-3 py-2 text-sm border rounded-lg bg-white">
            <option value="TOUS">Tous ({dis.length})</option>
            <option value="EN_ATTENTE">En attente ({counts.EN_ATTENTE || 0})</option>
            <option value="VERIFIE">Verifies ({counts.VERIFIE || 0})</option>
          </select>
          <button onClick={charger} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
          </button>
          <button onClick={exporterCSV} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-600">
            <Download size={14}/> CSV
          </button>
          <button onClick={handlePrint} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-600">
            <Printer size={14}/> Imprimer
          </button>
        </div>
      </div>

      <div id="print-area" ref={printRef}>
        <div className="print-header">
          <div className="print-top">
            <div className="print-top-left">
              <img src="/cevital-logo.svg" alt="CEVITAL" style={{width:130,height:'auto'}}/>
            </div>
            <div className="print-top-right">
              <div className="company-name">CEVITAL</div>
              <div>Illot D, N° 6 ZHUN Garidi II</div>
              <div>Kouba 16005 - Alger - Algerie</div>
              <div>Tel: 023 56 38 02 / 023 56 38 86</div>
              <div>Email: contact@cevital.com</div>
            </div>
          </div>
          <div className="print-banner">Liste des Demandes d'Intervention a valider</div>
          <div className="print-user-info">
            <div className="info-row">
              <div className="info-item"><span className="info-label">Nom:</span><span>{authUser?.prenom || ''} {authUser?.nom || ''}</span></div>
              <div className="info-item"><span className="info-label">Pole:</span><span>{authUser?.nom_pole || ''}</span></div>
              <div className="info-item"><span className="info-label">Equipe:</span><span>{authUser?.nom_equipe || ''}</span></div>
            </div>
            <div className="info-row">
              <div className="info-item"><span className="info-label">Tel:</span><span>{authUser?.telephone || ''}</span></div>
              <div className="info-item"><span className="info-label">Email:</span><span>{authUser?.email || ''}</span></div>
              <div className="info-item"><span className="info-label">Total DI:</span><span>{disFiltrees.length}</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#003B7A]"/></div>
          ) : disFiltrees.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Aucune DI trouvee</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#003B7A' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">N DI</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Machine Racine</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Equipement</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Declarant</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-blue-100 no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {disFiltrees.map(di => {
                    const isVerifie = di.statut === 'VERIFIE'
                    return (
                      <tr key={di.id_di} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><span className="font-mono font-bold text-[#003B7A]">{di.numero_di}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs text-[#003B7A]">{di.equipement?.machine_racine_code || '---'}</span>
                            <span className="text-xs text-gray-500">{di.equipement?.machine_racine_desc || ''}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><div><span className="font-mono text-xs text-[#003B7A]">{di.equipement?.equipment_code || '---'}</span><p className="text-xs text-gray-500">{di.equipement?.description || ''}</p></div></td>
                        <td className="px-4 py-3 text-xs text-gray-600">{di.equipement?.nom_zone || '---'}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${isVerifie ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>{isVerifie ? 'Verifie' : 'En attente'}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{di.declarant?.nom || '---'}</td>
                        <td className="no-print px-4 py-3"><div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleShowDetail(di)} className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"><Eye size={14}/></button>
                          {!isVerifie && <button onClick={() => handleVerifier(di)} className="px-2 py-1 rounded bg-amber-100 text-amber-600 text-xs font-medium hover:bg-amber-200">Verifier</button>}
                          <button onClick={() => {
  setSelectedDI(di)
  setPriorite(URGENCE_TO_NIVEAU[di.urgence] ?? 'NIVEAU_1')
}} disabled={!isVerifie} className={`px-2 py-1 rounded text-xs font-medium ${isVerifie ? 'bg-[#003B7A] text-white hover:bg-[#002a5a]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>Valider</button>
                        </div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="print-footer">
          <div className="sig-line">
            <span>Date: {new Date().toLocaleDateString('fr-FR')}</span>
            <span>Signature:</span>
          </div>
          <div className="sig-line" style={{textAlign:'right'}}>
            <span>Nom: {authUser?.prenom || ''} {authUser?.nom || ''}</span>
            <span>Pole: {authUser?.nom_pole || ''}</span>
          </div>
        </div>
      </div>

      {selectedDI && (
        <div className="no-print fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="bg-[#003B7A] text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold">Valider DI - {selectedDI.numero_di}</h2>
              <button onClick={() => setSelectedDI(null)} className="text-white/80 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2"><Factory size={16} className="text-[#003B7A]"/><span className="font-mono font-bold text-[#003B7A]">{selectedDI.equipement?.equipment_code}</span></div>
                <p className="text-sm text-gray-600">{selectedDI.equipement?.description}</p>
                {selectedDI.equipement?.nom_zone && <div className="flex items-center gap-2 mt-2 text-xs text-gray-500"><MapPin size={12}/> {selectedDI.equipement.nom_zone}</div>}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Classe d'intervention</label>
                <div className="grid grid-cols-3 gap-2">
                  {CLASSES.map(c => (<button key={c.value} onClick={() => setClasse(c.value)} className={`py-2 rounded-lg text-xs font-medium border-2 ${classe === c.value ? 'border-[#003B7A] bg-blue-50 text-[#003B7A]' : 'border-gray-200 text-gray-600'}`}>{c.label}</button>))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Niveau d'urgence
                  <span className="text-[10px] font-normal text-gray-400 ml-2">
                    (pré-rempli depuis la DI · modifiable)
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {NIVEAUX_URGENCE.map(n => (
                    <button
                      key={n.value}
                      type="button"
                      onClick={() => setPriorite(n.value)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all ${
                        priorite === n.value
                          ? `border-[#003B7A] ${n.color}`
                          : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                      }`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
                {selectedDI.urgence && (
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Niveau initial déclaré par le mécanicien : <strong>{URGENCE_LABELS[selectedDI.urgence]?.label ?? selectedDI.urgence}</strong>
                  </p>
                )}
              </div>
              <div><label className="text-sm font-semibold text-gray-700 block mb-2">Description OT</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border rounded-lg"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold text-gray-700 block mb-2">Date prevue</label><input type="datetime-local" value={datePrevue} onChange={e => setDatePrevue(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg"/></div>
                <div><label className="text-sm font-semibold text-gray-700 block mb-2">Duree (h)</label><input type="number" value={duree} onChange={e => setDuree(e.target.value)} placeholder="Ex: 2" className="w-full px-3 py-2 text-sm border rounded-lg"/></div>
              </div>
              {error && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200"><AlertCircle size={14} className="text-red-500"/><p className="text-sm text-red-600">{error}</p></div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSelectedDI(null)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
                <button onClick={handleValider} disabled={saving} className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium" style={{backgroundColor: '#003B7A'}}>{saving ? <Loader2 size={14} className="animate-spin inline"/> : 'Confirmer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
