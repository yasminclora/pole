'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { diService } from '@/services/diService'
import {
  Plus, Loader2, Search, X, RefreshCw, Eye,
  Factory, User, Clock, MapPin, FileText, CheckCircle,
  Download, Printer
} from 'lucide-react'

const URGENCE_CFG: Record<string, { label: string; color: string }> = {
  NIVEAU_1: { label: 'Niveau 1', color: 'text-green-600' },
  NIVEAU_2: { label: 'Niveau 2', color: 'text-orange-600' },
  NIVEAU_3: { label: 'Niveau 3', color: 'text-red-600' },
  FAIBLE: { label: 'Faible', color: 'text-green-600' },
  NORMALE: { label: 'Normale', color: 'text-blue-600' },
  HAUTE: { label: 'Haute', color: 'text-orange-600' },
  CRITIQUE: { label: 'Critique', color: 'text-red-600' },
}

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  EN_ATTENTE: { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-100' },
  VERIFIE: { label: 'Vérifié', color: 'text-blue-600', bg: 'bg-blue-100' },
  VALIDEE: { label: 'Validée', color: 'text-green-600', bg: 'bg-green-100' },
  REJETEE: { label: 'Rejetée', color: 'text-red-600', bg: 'bg-red-100' },
}

interface DI {
  id_di: number
  numero_di: string
  statut: string
  urgence: string
  description_panne: string
  motif_rejet?: string
  created_at: string
  date_verification?: string
  id_ot_genere?: number | null
  ot?: { numero_ot: string; date_prevue?: string; date_validation_ce?: string; date_validation_hse?: string; date_archive?: string }
  equipement?: {
    equipment_code: string
    description: string
    hierarchy_level?: number
    nom_zone?: string
    code_zone?: string
    machine_racine_code?: string
    machine_racine_desc?: string
    machine_niveau2_code?: string
    machine_niveau2_desc?: string
  }
  declarant?: { id?: number; nom: string; role: string }
  methodiste?: { id?: number; nom: string }
}

interface AuthUser {
  id_user: number
  nom: string
  prenom: string
  email: string
  telephone?: string
  role: string
  id_pole: number | null
  nom_pole?: string
}

function getHierarchyLabel(level?: number) {
  if (!level) return ''
  if (level === 1) return 'Machine racine'
  if (level === 2) return 'Machine système'
  if (level === 3) return 'Niveau 3'
  if (level === 4) return 'Niveau 4'
  return `Niveau ${level}`
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function exportCsv(dis: DI[]) {
  const header = ['N° DI', 'Composante', 'Machine L2', 'Machine L1', 'Zone', 'Urgence', 'Statut', 'Date création', 'Demandeur', 'Validateur', 'N° OT', 'Date validation']
  const rows = dis.map(d => [
    d.numero_di,
    d.equipement?.equipment_code || '—',
    d.equipement?.machine_niveau2_code || '—',
    d.equipement?.machine_racine_code || '—',
    d.equipement?.nom_zone || '—',
    d.urgence,
    d.statut,
    fmtDateShort(d.created_at),
    d.declarant?.nom || '—',
    d.methodiste?.nom || '—',
    d.ot?.numero_ot || '—',
    d.ot?.date_validation_hse ? fmtDate(d.ot.date_validation_hse) : '—',
  ])
  const csv = [header, ...rows].map(r => r.join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `MesDI_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

function importer(dis: DI[], user: AuthUser | null) {
  const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const counts = dis.reduce((acc, d) => { acc[d.statut] = (acc[d.statut] || 0) + 1; return acc }, {} as Record<string, number>)
  const rows = dis.map(d => `
    <tr>
      <td class="num">${d.numero_di}</td>
      <td><span class="code">${d.equipement?.equipment_code || '—'}</span></td>
      <td class="l2">${d.equipement?.machine_niveau2_code || '—'}</td>
      <td class="l1">${d.equipement?.machine_racine_code || '—'}</td>
      <td class="zone">${d.equipement?.nom_zone || '—'}</td>
      <td><span class="urgence ${d.urgence}">${d.urgence}</span></td>
      <td><span class="statut ${d.statut}">${d.statut}</span></td>
      <td class="sub">${d.created_at?.split('T')[0] || '—'}</td>
      <td class="sub">${d.declarant?.nom || '—'}</td>
      <td class="sub">${d.methodiste?.nom || '—'}</td>
      <td class="ot">${d.ot?.numero_ot || '—'}</td>
      <td class="sub" title="${d.description_panne || ''}">${(d.description_panne || '').substring(0, 30)}${(d.description_panne || '').length > 30 ? '...' : ''}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <style>
      @page{size:A4 landscape;margin:10mm}
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:9px;color:#1a1a1a;background:#fff}
      .hdr{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:3px solid #003B7A;margin-bottom:12px}
      .logo{font-size:22px;font-weight:900;color:#003B7A;letter-spacing:1px}
      .logo small{display:block;font-size:7px;font-weight:400;color:#666;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
      .hdr-r{text-align:right}
      .hdr-r .pole{font-size:12px;font-weight:700;color:#003B7A}
      .hdr-r .title{font-size:10px;color:#333;margin-top:2px}
      .hdr-r .date{font-size:8px;color:#888;margin-top:2px}
      .info-bar{display:flex;gap:20px;background:#f5f7fa;border-left:4px solid #00A651;padding:8px 12px;margin-bottom:12px}
      .info-item{flex:1}
      .info-item .label{font-size:7px;color:#888;text-transform:uppercase;margin-bottom:2px}
      .info-item .value{font-size:9px;font-weight:600;color:#1a1a1a}
      .info-item .value.green{color:#00A651}
      h1{font-size:14px;font-weight:700;color:#003B7A;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e5e7eb}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      thead{background:linear-gradient(180deg,#003B7A 0%,#002a5a 100%);color:#fff}
      thead th{padding:6px 5px;text-align:left;font-size:7px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-right:1px solid #ffffff33}
      thead th:last-child{border-right:none}
      tbody tr{border-bottom:1px solid #e5e7eb}
      tbody tr:nth-child(even){background:#f9fafb}
      tbody tr:hover{background:#f0f4f8}
      tbody td{padding:5px;text-align:left;vertical-align:middle;border-right:1px solid #e5e7eb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      tbody td:last-child{border-right:none}
      .num{font-family:'Consolas',monospace;font-weight:700;color:#003B7A;font-size:8px}
      .code{font-family:'Consolas',monospace;font-size:7px;font-weight:600;color:#003B7A;background:#e8f4fd;padding:1px 4px;border-radius:2px}
      .l2{font-family:'Consolas',monospace;font-size:7px;color:#00A651}
      .l1{font-family:'Consolas',monospace;font-size:7px;color:#7c3aed}
      .zone{font-size:7px;font-weight:700;color:#dc2626;background:#fef2f2;padding:1px 4px;border-radius:2px}
      .urgence{font-size:7px;font-weight:600;padding:2px 6px;border-radius:3px}
      .urgence.NIVEAU_1{background:#dcfce7;color:#166534}
      .urgence.NIVEAU_2{background:#fed7aa;color:#9a3412}
      .urgence.NIVEAU_3{background:#fee2e2;color:#dc2626}
      .statut{font-size:7px;font-weight:600;padding:2px 6px;border-radius:3px}
      .statut.EN_ATTENTE{background:#fef3c7;color:#d97706}
      .statut.VERIFIE{background:#dbeafe;color:#2563eb}
      .statut.VALIDEE{background:#d1fae5;color:#059669}
      .statut.REJETEE{background:#fee2e2;color:#dc2626}
      .sub{font-size:7px;color:#6b7280}
      .ot{font-family:'Consolas',monospace;font-size:7px;font-weight:600;color:#00A651;background:#f0fdf4;padding:1px 4px;border-radius:2px}
      .summary{display:flex;gap:15px;margin-top:10px;padding:8px;background:#f8fafc;border-radius:4px}
      .summary-item{font-size:8px}
      .summary-item span{font-weight:700;color:#003B7A}
      .footer{margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:7px;color:#94a3b8}
    </style></head><body>
    <div class="hdr">
      <div><div class="logo">CEVITAL<small>Groupe Industriel</small></div></div>
      <div class="hdr-r"><div class="pole">${user?.nom_pole || 'Cevital'}</div><div class="title">Liste des Demandes d'Intervention</div><div class="date">Édité le ${now}</div></div>
    </div>
    <div class="info-bar">
      <div class="info-item"><div class="label">Utilisateur</div><div class="value">${user?.prenom || ''} ${user?.nom || ''}</div></div>
      <div class="info-item"><div class="label">Fonction</div><div class="value">${user?.role || '—'}</div></div>
      <div class="info-item"><div class="label">Email</div><div class="value">${user?.email || '—'}</div></div>
      <div class="info-item"><div class="label">Téléphone</div><div class="value">${user?.telephone || '—'}</div></div>
      <div class="info-item"><div class="label">Total DI</div><div class="value green">${dis.length}</div></div>
    </div>
    <h1>Demandes d'Intervention</h1>
    <table>
      <thead><tr><th style="width:8%">N° DI</th><th style="width:12%">Composante</th><th style="width:10%">Machine L2</th><th style="width:10%">Machine L1</th><th style="width:8%">Zone</th><th style="width:7%">Urgence</th><th style="width:8%">Statut</th><th style="width:8%">Date</th><th style="width:12%">Demandeur</th><th style="width:12%">Validateur</th><th style="width:8%">N° OT</th><th style="width:7%">Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div class="summary-item">En attente: <span>${counts['EN_ATTENTE'] || 0}</span></div>
      <div class="summary-item">Vérifiées: <span>${counts['VERIFIE'] || 0}</span></div>
      <div class="summary-item">Validées: <span>${counts['VALIDEE'] || 0}</span></div>
      <div class="summary-item">Rejetées: <span>${counts['REJETEE'] || 0}</span></div>
    </div>
    <div class="footer"><span>CEVITAL — Document confidentiel — Service Maintenance</span><span>${now}</span></div>
    <script>window.onload=()=>window.print()</script>
  </body></html>`

  const w = window.open('', '_blank', 'width=1100,height=700')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

export default function MesDIPage() {
  const router = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user) as AuthUser | null
  const idUser = Number(authUser?.id_user)
  const idPole = Number(authUser?.id_pole)

  const [dis, setDis] = useState<DI[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('TOUS')
  const [selectedDI, setSelectedDI] = useState<DI | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const data = await diService.liste({ id_pole: idPole, id_user: idUser })
      setDis(Array.isArray(data) ? data : [])
    } catch { setDis([]) }
    finally { setLoading(false) }
  }, [idPole, idUser])

  useEffect(() => { charger() }, [charger])

  const counts = dis.reduce((acc, d) => { acc[d.statut] = (acc[d.statut] || 0) + 1; return acc }, {} as Record<string, number>)

  const disFiltrees = dis
    .filter(d => {
      const q = search.toLowerCase()
      const matchS = !search || d.numero_di.toLowerCase().includes(q) ||
        d.equipement?.equipment_code?.toLowerCase().includes(q) ||
        d.description_panne.toLowerCase().includes(q)
      const matchF = filtre === 'TOUS' || d.statut === filtre
      return matchS && matchF
    })

  const handleShowDetail = (di: DI) => {
    setSelectedDI(di)
    setShowDetail(true)
  }

  return (
    <div className="space-y-6 pb-6 max-w-6xl mx-auto px-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileText size={24} className="text-white"/>
            </div>
            <div>
              <h1 className="text-xl font-bold">Mes Demandes d'Intervention</h1>
              <p className="text-blue-200 text-sm">{authUser?.nom_pole || 'Cevital'} · {dis.length} DI</p>
            </div>
          </div>
          <button onClick={() => router.push('/di/creer')} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium">
            + Nouvelle DI
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-10 py-2 text-sm border rounded-lg"/>
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14}/></button>}
          </div>

          <select value={filtre} onChange={e => setFiltre(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg bg-white">
            <option value="TOUS">Tous ({dis.length})</option>
            {Object.entries(counts).map(([k, v]) => (
              <option key={k} value={k}>{STATUT_CFG[k]?.label || k} ({v})</option>
            ))}
          </select>

          <button onClick={charger} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
          </button>
          <button onClick={() => exportCsv(disFiltrees)} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 hover:bg-gray-50 text-green-600">
            <Download size={14}/>
          </button>
          <button onClick={() => importer(disFiltrees, authUser)} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 hover:bg-gray-50 text-blue-600">
            <Printer size={14}/>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#003B7A]"/></div>
        ) : disFiltrees.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Aucune DI trouvée</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#003B7A' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">N° DI</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Équipement</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Niveau</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Urgence</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Créée</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-blue-100">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {disFiltrees.map(di => {
                  const statut = STATUT_CFG[di.statut] || STATUT_CFG.EN_ATTENTE
                  const urgence = URGENCE_CFG[di.urgence] || URGENCE_CFG.NORMALE
                  return (
                    <tr key={di.id_di} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[#003B7A]">{di.numero_di}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-mono text-xs text-[#003B7A]">{di.equipement?.equipment_code || '—'}</span>
                          <p className="text-xs text-gray-500 truncate max-w-[120px]">{di.equipement?.description || ''}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {getHierarchyLabel(di.equipement?.hierarchy_level)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {di.equipement?.nom_zone || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${urgence.color}`}>{urgence.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statut.bg} ${statut.color}`}>{statut.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {fmtDateShort(di.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleShowDetail(di)} className="p-1.5 rounded bg-[#003B7A] text-white hover:bg-[#002a5a]">
                          <Eye size={14}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDetail && selectedDI && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#003B7A] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={20}/>
                <h2 className="text-lg font-bold">Détails de la DI</h2>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-white/80 hover:text-white"><X size={20}/></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">N° DI</p>
                  <p className="font-mono font-bold text-[#003B7A]">{selectedDI.numero_di}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Statut</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUT_CFG[selectedDI.statut]?.bg || 'bg-gray-100'} ${STATUT_CFG[selectedDI.statut]?.color || 'text-gray-600'}`}>
                    {STATUT_CFG[selectedDI.statut]?.label || selectedDI.statut}
                  </span>
                </div>
              </div>

              {selectedDI.id_ot_genere && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">N° OT Généré</p>
                  <p className="font-mono font-bold text-[#003B7A]">{selectedDI.ot?.numero_ot || `OT-${selectedDI.id_ot_genere}`}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">Demandeur</p>
                <div className="flex items-center gap-2">
                  <User size={16} className="text-[#003B7A]"/>
                  <span className="text-sm font-medium">{selectedDI.declarant?.nom || '—'}</span>
                  <span className="text-xs text-gray-400">({selectedDI.declarant?.role || '—'})</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">Validé par</p>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600"/>
                  <span className="text-sm font-medium">{selectedDI.methodiste?.nom || 'En attente'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 mb-1">Date création</p>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400"/>
                    <span className="text-sm">{fmtDate(selectedDI.created_at)}</span>
                  </div>
                </div>
                {selectedDI.date_verification && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">Date vérification</p>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-blue-500"/>
                      <span className="text-sm">{fmtDate(selectedDI.date_verification)}</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedDI.ot && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedDI.ot.date_prevue && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Date prévue OT</p>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-orange-500"/>
                        <span className="text-sm">{fmtDate(selectedDI.ot.date_prevue)}</span>
                      </div>
                    </div>
                  )}
                  {selectedDI.ot.date_validation_ce && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Validé CE le</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-teal-500"/>
                        <span className="text-sm">{fmtDate(selectedDI.ot.date_validation_ce)}</span>
                      </div>
                    </div>
                  )}
                  {selectedDI.ot.date_validation_hse && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Validé HSE le</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500"/>
                        <span className="text-sm">{fmtDate(selectedDI.ot.date_validation_hse)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedDI.equipement && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-xs text-gray-400 mb-2">Hiérarchie de l'équipement</p>
                  
                  {/* Composante (current) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20">Composante:</span>
                    <span className="font-mono text-sm font-bold text-[#003B7A]">{selectedDI.equipement.equipment_code}</span>
                    <span className="text-xs text-gray-500">- {selectedDI.equipement.description}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 w-20"></span>
                    <span className="text-gray-500">{getHierarchyLabel(selectedDI.equipement.hierarchy_level)}</span>
                  </div>
                  
                  {/* Machine Niveau 2 */}
                  {selectedDI.equipement.machine_niveau2_code && (
                    <>
                      <div className="w-full h-px bg-gray-200"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-20">Machine L2:</span>
                        <span className="font-mono text-sm font-semibold text-gray-700">{selectedDI.equipement.machine_niveau2_code}</span>
                        <span className="text-xs text-gray-500">- {selectedDI.equipement.machine_niveau2_desc}</span>
                      </div>
                    </>
                  )}
                  
                  {/* Machine Racine */}
                  {selectedDI.equipement.machine_racine_code && (
                    <>
                      <div className="w-full h-px bg-gray-200"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-20">Machine L1:</span>
                        <span className="font-mono text-sm font-semibold text-gray-700">{selectedDI.equipement.machine_racine_code}</span>
                        <span className="text-xs text-gray-500">- {selectedDI.equipement.machine_racine_desc}</span>
                      </div>
                    </>
                  )}
                  
                  {/* Zone */}
                  {selectedDI.equipement.nom_zone && (
                    <>
                      <div className="w-full h-px bg-gray-200"></div>
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-[#00A651]"/>
                        <span className="text-xs text-gray-500 w-20">Zone:</span>
                        <span className="text-sm font-medium text-[#00A651]">{selectedDI.equipement.nom_zone}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-2">Description de la panne</p>
                <p className="text-sm text-gray-700">{selectedDI.description_panne}</p>
              </div>

              {selectedDI.motif_rejet && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-xs text-red-400 mb-1">Motif du rejet</p>
                  <p className="text-sm text-red-600">{selectedDI.motif_rejet}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}