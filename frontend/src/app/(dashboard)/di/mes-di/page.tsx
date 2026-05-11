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

function exportCsv(dis: DI[], pole: string) {
  const header = ['N° DI', 'Machine Racine', 'Machine Racine Desc', 'Equipement', 'Equipement Desc', 'Statut', 'Date', 'Declarant']
  const rows = dis.map(d => [
    d.numero_di,
    d.equipement?.machine_racine_code || '',
    d.equipement?.machine_racine_desc || '',
    d.equipement?.equipment_code || '',
    d.equipement?.description || '',
    STATUT_CFG[d.statut]?.label || d.statut,
    d.created_at?.split('T')[0] || '',
    d.declarant?.nom || '',
  ])
  const csv = ['\uFEFF', `CEVITAL;${pole};;`, `Liste des Demandes d\'Intervention;${new Date().toLocaleDateString('fr-FR')};;`, header.join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `MesDI_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

function importer(dis: DI[], user: AuthUser | null) {
  const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const dateCourt = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const counts = dis.reduce((acc, d) => { acc[d.statut] = (acc[d.statut] || 0) + 1; return acc }, {} as Record<string, number>)
  const rows = dis.map(d => `
    <tr>
      <td class="num">${d.numero_di}</td>
      <td><span class="racine">${d.equipement?.machine_racine_code || '—'}</span><div class="desc">${d.equipement?.machine_racine_desc || ''}</div></td>
      <td><span class="code">${d.equipement?.equipment_code || '—'}</span><div class="desc">${d.equipement?.description || ''}</div></td>
      <td><span class="statut ${d.statut}">${STATUT_CFG[d.statut]?.label || d.statut}</span></td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <style>
      @page{size:A4 landscape;margin:12mm 15mm}
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#1a1a1a;background:#fff}
      .print-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #003B7A}
      .print-top-left{width:130px}
      .print-top-left img{width:130px;height:auto}
      .print-top-right{text-align:right;font-size:9px;color:#333;line-height:1.5}
      .print-top-right .company-name{font-size:18px;font-weight:bold;color:#003B7A}
      .print-banner{background:#003B7A;color:white;padding:7px 12px;text-align:center;font-size:12px;font-weight:bold;margin-bottom:12px}
      .info-bar{display:flex;flex-wrap:wrap;justify-content:space-between;margin-bottom:12px;font-size:9px;padding:8px 12px;border:1px solid #ddd}
      .info-row{display:flex;gap:30px;width:100%;margin-bottom:3px}
      .info-item{display:flex;gap:3px}
      .info-label{font-weight:600;color:#003B7A}
      table{width:100%;border-collapse:collapse;font-size:9px}
      thead{background:#003B7A;color:#fff}
      thead th{padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;border-right:1px solid #ffffff33}
      thead th:last-child{border-right:none}
      tbody tr{border-bottom:1px solid #ddd}
      tbody td{padding:4px 6px;text-align:left;vertical-align:middle;border-right:1px solid #eee}
      tbody td:last-child{border-right:none}
      .num{font-family:'Consolas',monospace;font-weight:700;color:#003B7A;font-size:8px}
      .code{font-family:'Consolas',monospace;font-size:7px;font-weight:600;color:#003B7A}
      .racine{font-family:'Consolas',monospace;font-size:7px;font-weight:600;color:#333}
      .desc{font-size:7px;color:#666;margin-top:1px}
      .statut{font-size:7px;font-weight:600;padding:2px 5px;border:1px solid #ccc;color:#333}
      .summary{display:flex;gap:12px;margin-top:8px;padding:6px 10px;border:1px solid #ddd}
      .summary-item{font-size:8px;color:#555}
      .summary-item span{font-weight:700;color:#003B7A}
      .print-footer{display:flex;justify-content:space-between;margin-top:16px;padding-top:8px;font-size:9px;color:#555;border-top:1px solid #999}
      .sig-line{display:flex;flex-direction:column;gap:2px}
    </style></head><body>
    <div class="print-top">
      <div class="print-top-left"><img src="/cevital-logo.svg" alt="CEVITAL"/></div>
      <div class="print-top-right">
        <div class="company-name">CEVITAL</div>
        <div>Illot D, N° 6 ZHUN Garidi II</div>
        <div>Bejaia 16005 - Alger - Algerie</div>
        <div>Tel: 023 56 38 02 / 023 56 38 86</div>
        <div>Email: contact@cevital.com</div>
      </div>
    </div>
    <div class="print-banner">Liste de mes Demandes d'Intervention</div>
    <div class="info-bar">
      <div class="info-row">
        <div class="info-item"><span class="info-label">Nom:</span><span>${user?.prenom || ''} ${user?.nom || ''}</span></div>
        <div class="info-item"><span class="info-label">Pole:</span><span>${user?.nom_pole || ''}</span></div>
        <div class="info-item"><span class="info-label">Email:</span><span>${user?.email || ''}</span></div>
      </div>
      <div class="info-row">
        <div class="info-item"><span class="info-label">Tel:</span><span>${user?.telephone || ''}</span></div>
        <div class="info-item"><span class="info-label">Role:</span><span>${user?.role || ''}</span></div>
        <div class="info-item"><span class="info-label">Total:</span><span>${dis.length} DI</span></div>
      </div>
    </div>
    <table>
      <thead><tr><th style="width:12%">N° DI</th><th style="width:25%">Machine Racine</th><th style="width:25%">Equipement</th><th style="width:10%">Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      ${Object.entries(counts).map(([k, v]) => `<div class="summary-item">${STATUT_CFG[k]?.label || k}: <span>${v}</span></div>`).join('')}
    </div>
    <div class="print-footer">
      <div class="sig-line"><span>Date: ${dateCourt}</span><span>Signature:</span></div>
      <div class="sig-line" style="text-align:right"><span>Nom: ${user?.prenom || ''} ${user?.nom || ''}</span><span>Pole: ${user?.nom_pole || ''}</span></div>
    </div>
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
    <div className="space-y-6 pb-6 max-w-full mx-auto px-0">
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
          <div className="relative flex-1">
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
          <button onClick={() => exportCsv(disFiltrees, authUser?.nom_pole || '')} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2 hover:bg-gray-50 text-green-600">
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
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Machine Racine</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Équipement</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-blue-100">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase text-blue-100">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {disFiltrees.map(di => {
                  const statut = STATUT_CFG[di.statut] || STATUT_CFG.EN_ATTENTE
                  return (
                    <tr key={di.id_di} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[#003B7A]">{di.numero_di}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-[#003B7A]">{di.equipement?.machine_racine_code || '—'}</span>
                          <span className="text-xs text-gray-500">{di.equipement?.machine_racine_desc || ''}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-mono text-xs text-[#003B7A]">{di.equipement?.equipment_code || '—'}</span>
                          <p className="text-xs text-gray-500">{di.equipement?.description || ''}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statut.bg} ${statut.color}`}>{statut.label}</span>
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