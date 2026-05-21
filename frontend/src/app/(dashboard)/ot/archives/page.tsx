'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector as useReduxSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { otService } from '@/services/otService'
import { zonesService } from '@/services/zonesService'
import {
  Loader2, Search, X, Eye, Archive, Filter,
  Download, MapPin, Printer, FileText
} from 'lucide-react'

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
  methodiste?: { nom: string } | null
}

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ArchivesOTPage() {
  const router = useRouter()
  const authUser = useReduxSelector((s: RootState) => s.auth.user)
  const idPole = Number(authUser?.id_pole)

  const [ots, setOts] = useState<OT[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filtreZone, setFiltreZone] = useState<number | ''>('')
  const [filtreType, setFiltreType] = useState<string>('')
  const [mois, setMois] = useState<number | ''>(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())

  const [showPrintModal, setShowPrintModal] = useState(false)
  const [perimetreImpression, setPerimetreImpression] = useState<'tous' | 'zone_uniquement'>('tous')
  const [printing, setPrinting] = useState(false)

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

  // ── IMPRESSION ET EXPORT PDF AVEC EN-TÊTE PROFESSIONNEL ET SIGNATURE ÉPURÉE ──
  const handleImprimerChantier = async () => {
    setPrinting(true)
    try {
      const listeAImprimer = perimetreImpression === 'zone_uniquement' && filtreZone
        ? otsFiltrees.filter(o => o.equipement?.nom_zone === zones.find(z => z.id_zone === filtreZone)?.nom_zone)
        : otsFiltrees

      const win = window.open('', '_blank')
      if (!win) {
        alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez vos pop-ups.")
        return
      }

      const tableRowsHtml = listeAImprimer.map(o => `
        <tr>
          <td class="font-mono" style="font-weight: bold; color: #003B7A;">${o.numero_ot}</td>
          <td><span class="badge-type">${o.type_ot}</span></td>
          <td><span class="badge-priorite ${o.priorite === 'URGENT' ? 'prio-urgent' : ''}">${o.priorite || 'NORMALE'}</span></td>
          <td>
            <strong>${o.equipement?.machine_racine_code || '—'}</strong>
            ${o.equipement?.machine_racine_desc ? `<br/><small style="color: #475569; font-size: 10px;">${o.equipement.machine_racine_desc}</small>` : ''}
          </td>
          <td>
            <strong>${o.equipement?.equipment_code || '—'}</strong>
            <br/><small style="color: #64748b; font-size: 10px;">${o.equipement?.description || ''}</small>
          </td>
          <td><span style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 10px;">${o.equipement?.nom_zone || 'Général'}</span></td>
          <td>${o.methodiste?.nom || '—'}</td>
          <td>${o.assigne?.nom || 'Non assigné'}</td>
        </tr>
      `).join('')

      const documentStructure = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <title>CEVITAL - Registre Officiel des Archives OT</title>
          <style>
            @page { size: A4 landscape; margin: 15mm 15mm 25mm 15mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #ffffff; margin: 0; padding: 0; font-size: 11px; line-height: 1.5; }
            
            /* En-tête Supérieur Corporate */
            .header-table { width: 100%; border-collapse: collapse; border-bottom: 3px solid #003B7A; padding-bottom: 12px; margin-bottom: 25px; }
            .header-logo-cell { vertical-align: middle; width: 40%; }
            .logo-flex-container { display: flex; align-items: center; gap: 12px; }
            .logo-img { max-height: 42px; display: block; }
            .logo-corporate-text { font-size: 26px; font-weight: 900; color: #003B7A; letter-spacing: -0.5px; font-family: 'Arial Black', sans-serif; }
            
            .header-meta-cell { width: 60%; text-align: right; vertical-align: middle; font-size: 11px; color: #334155; font-weight: 500; line-height: 1.4; }
            .address-highlight { color: #003B7A; font-weight: bold; }

            /* Titre Principal */
            .title-container { text-align: center; margin-top: 35px; margin-bottom: 35px; }
            .doc-main-title { font-size: 24px; font-weight: 900; color: #003B7A; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }
            .doc-sub-title { font-size: 12px; color: #475569; font-weight: 600; margin-top: 8px; }
            
            /* Profil de l'Émetteur */
            .profile-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 18px; margin-bottom: 35px; }
            .profile-grid { display: table; width: 100%; }
            .profile-col { display: table-cell; width: 33.33%; font-size: 11px; color: #334155; }
            .profile-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; margin-bottom: 2px; }
            .profile-value { font-size: 12px; font-weight: 700; color: #0f172a; }

            /* Tableau Principal */
            table.data-table { width: 100%; border-collapse: collapse; }
            table.data-table th { background-color: #003B7A; color: #ffffff; font-weight: 800; text-align: left; padding: 11px 10px; border: 1px solid #003B7A; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; }
            table.data-table td { padding: 10px 10px; border: 1px solid #e2e8f0; vertical-align: middle; font-size: 11px; }
            table.data-table tr:nth-child(even) td { background-color: #f8fafc; }
            
            /* Badges */
            .badge-type { font-weight: bold; color: #1e40af; background: #dbeafe; padding: 3px 7px; border-radius: 4px; font-size: 9.5px; text-transform: uppercase; }
            .badge-priorite { font-weight: bold; color: #334155; background: #e2e8f0; padding: 3px 7px; border-radius: 4px; font-size: 9.5px; text-transform: uppercase; }
            .prio-urgent { color: #991b1b; background: #fee2e2; }
            
            /* Bas de page épuré avec ligne de signature ouverte sans cadre */
            .footer-signature-container { position: fixed; bottom: 30px; left: 0; width: 100%; display: table; font-size: 11px; }
            .footer-info-cell { display: table-cell; width: 65%; vertical-align: bottom; color: #64748b; font-size: 9.5px; }
            .signature-cell { display: table-cell; width: 35%; text-align: right; vertical-align: bottom; }
            .signature-area { display: inline-block; width: 220px; text-align: left; }
            .signature-title { font-weight: 800; text-transform: uppercase; font-size: 10px; color: #003B7A; letter-spacing: 0.5px; margin-bottom: 55px; }
            .signature-line { border-bottom: 1px dashed #94a3b8; width: 100%; }
          </style>
        </head>
        <body>
          
          <table class="header-table">
            <tr>
              <td class="header-logo-cell">
                <div class="logo-flex-container">
                  <img src="/cevital-logo.svg" class="logo-img" alt="Logo" onerror="this.style.display='none';"/>
                  <span class="logo-corporate-text">CEVITAL</span>
                </div>
              </td>
              <td class="header-meta-cell">
                <strong>CEVITAL S.p.A. &middot; Direction Industrielle</strong><br/>
                Unité Centrale de Maintenance & Logistique &middot; Support GMAO<br/>
                <span class="address-highlight">Nouveau Quai, Port de Béjaïa, Béjaïa 06000, Algérie</span>
              </td>
            </tr>
          </table>

          <div class="title-container">
            <h1 class="doc-main-title">Registre des Ordres de Travail Clôturés</h1>
            <div class="doc-sub-title">Extrait Historique des Archives Générales</div>
          </div>

          <div class="profile-card">
            <div class="profile-grid">
              <div class="profile-col">
                <span class="profile-label">Émetteur (Méthodiste)</span>
                <span class="profile-value">${authUser?.nom || 'Non spécifié'}</span>
              </div>
              <div class="profile-col">
                <span class="profile-label">Adresse Électronique</span>
                <span class="profile-value">${authUser?.email || '—'}</span>
              </div>
              <div class="profile-col">
                <span class="profile-label">Périmètre / Pôle</span>
                <span class="profile-value">${authUser?.nom_pole || 'Division Cevital'} &middot; ${mois ? MOIS[mois - 1] : 'Année'} ${annee}</span>
              </div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 11%;">N° OT</th>
                <th style="width: 10%;">Type</th>
                <th style="width: 10%;">Priorité</th>
                <th style="width: 20%;">Machine Racine (Nom)</th>
                <th style="width: 21%;">Composante Cible</th>
                <th style="width: 10%;">Zone/Atelier</th>
                <th style="width: 9%;">Méthodiste</th>
                <th style="width: 9%;">Exécutant</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml || '<tr><td colspan="8" style="text-align:center; padding: 30px; color:#64748b; font-weight: bold;">Aucune donnée archivée trouvée pour les critères définis.</td></tr>'}
            </tbody>
          </table>

          <div class="footer-signature-container">
            <div class="footer-info-cell">
              <strong>Généré à Béjaïa, le ${new Date().toLocaleDateString('fr-FR')}</strong><br/>
              <span style="font-weight: bold; text-transform: uppercase; font-size: 8.5px; display: inline-block; margin-top: 2px; letter-spacing: 0.5px;">Document Interne Confidentiel &bull; Propriété Cevital</span>
            </div>
            
            <div class="signature-cell">
              <div class="signature-area">
                <div class="signature-title">Visa & Cachet Méthodiste :</div>
                <div class="signature-line"></div>
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 400);
            };
          </script>
        </body>
        </html>
      `

      win.document.open()
      win.document.write(documentStructure)
      win.document.close()
      setShowPrintModal(false)
    } catch (err: any) {
      alert(`Erreur génération document : ${err.message}`)
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
    <div className="space-y-6 pb-8">

      {/* ── BANNIÈRE HERO ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>
        <div className="relative flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Archive size={36} className="text-white"/>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">Archives Historiques</h1>
              <p className="text-blue-100 text-base mt-2 font-medium">
                Registre global des ordres de travail clôturés et validés
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-black/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
            <div className="text-right">
              <p className="text-4xl font-black text-[#003B7A] bg-white px-4 py-1 rounded-xl shadow-sm">{ots.length}</p>
              <p className="text-xs uppercase tracking-wider text-blue-200 font-extrabold mt-2">Fichiers Archivés</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRE DE CONTROLES ET FILTRES ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          
          {/* Recherche textuelle */}
          <div className="relative flex-1 min-w-[300px] group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400 group-focus-within:text-[#003B7A] transition-colors"/>
            </div>
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par N° OT, composante, machine..."
              className="w-full pl-12 pr-12 py-3.5 text-base border-2 border-gray-200 rounded-xl bg-white
                text-slate-900 placeholder-slate-400 font-bold shadow-sm
                focus:outline-none focus:border-[#003B7A] focus:ring-4 focus:ring-[#003B7A]/10 transition-all duration-200"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-red-500">
                <X size={18}/>
              </button>
            )}
          </div>

          {/* Zone */}
          <div className="relative min-w-[160px]">
            <select 
              value={filtreZone} 
              onChange={e => setFiltreZone(e.target.value ? Number(e.target.value) : '')}
              className="w-full appearance-none pl-10 pr-10 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-black cursor-pointer text-slate-800
                focus:border-[#003B7A] focus:ring-4 focus:ring-[#003B7A]/10 focus:outline-none transition-all"
            >
              <option value="">Toutes zones</option>
              {zones.map(z => <option key={z.id_zone} value={z.id_zone}>{z.nom_zone}</option>)}
            </select>
            <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#003B7A] pointer-events-none"/>
          </div>

          {/* Type */}
          <div className="relative min-w-[150px]">
            <select 
              value={filtreType} 
              onChange={e => setFiltreType(e.target.value)}
              className="w-full appearance-none pl-10 pr-10 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-black cursor-pointer text-slate-800
                focus:border-[#003B7A] focus:ring-4 focus:ring-[#003B7A]/10 focus:outline-none transition-all"
            >
              <option value="">Tous types</option>
              <option value="CORRECTIF">Correctif</option>
              <option value="PREDICTIF">Prédictif</option>
            </select>
            <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#003B7A] pointer-events-none"/>
          </div>

          {/* Mois */}
          <div className="relative">
            <select 
              value={mois} 
              onChange={e => setMois(e.target.value ? Number(e.target.value) : '')}
              className="appearance-none pl-5 pr-10 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-black cursor-pointer text-slate-800 focus:border-[#003B7A] focus:outline-none transition-all"
            >
              <option value="">Tous les mois</option>
              {MOIS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>

          {/* Année */}
          <div className="relative">
            <select 
              value={annee} 
              onChange={e => setAnnee(Number(e.target.value))}
              className="appearance-none pl-5 pr-10 py-3.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-black cursor-pointer text-slate-800 focus:border-[#003B7A] focus:outline-none transition-all"
            >
              {annees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Rafraîchir */}
          <button 
            onClick={charger}
            className="flex items-center justify-center p-3.5 rounded-xl border-2 border-gray-200 text-slate-600 hover:border-[#003B7A] hover:text-[#003B7A] hover:bg-blue-50/50 transition-all shadow-sm"
          >
            <Loader2 size={18} className={loading ? 'animate-spin' : ''}/>
          </button>

          {/* CSV */}
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-700 text-white text-sm font-black hover:bg-slate-800 transition-all shadow-md"
          >
            <Download size={16}/> CSV
          </button>

          {/* IMPRIMER / PDF MULTIFONCTION SYSTEME */}
          <button 
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#003B7A] text-white text-sm font-black hover:bg-[#002a5a] transition-all shadow-md"
          >
            <Printer size={16}/> Imprimer / PDF
          </button>
        </div>

        {otsFiltrees.length > 0 && (
          <div className="text-xs text-slate-400 font-bold bg-slate-50 p-2.5 rounded-xl inline-block border border-slate-100">
            Filtre actif : <span className="text-slate-800 font-extrabold">{otsFiltrees.length} OT ciblés</span>
            {filtreZone && ` · Zone: ${zones.find(z => z.id_zone === filtreZone)?.nom_zone}`}
            {filtreType && ` · Type: ${filtreType}`}
            {` · ${mois ? MOIS[mois as number - 1] : 'Année Globale'} ${annee}`}
          </div>
        )}
      </div>

      {/* ── GRILLE DES ARCHIVES ── */}
      {loading ? (
        <div className="p-8 space-y-4 bg-white border border-gray-200 rounded-2xl animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl w-full" />
          ))}
        </div>
      ) : otsFiltrees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border border-gray-200 shadow-md">
          <Archive size={56} className="text-slate-200 mb-4"/>
          <p className="text-xl font-black text-slate-700 mb-1">Aucune archive correspondante</p>
          <p className="text-sm text-slate-400">Ajustez vos filtres temporels ou de zone.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#003B7A] text-white uppercase text-xs font-black tracking-wider">
                <tr>
                  <th className="px-5 py-4 whitespace-nowrap">N° OT</th>
                  <th className="px-5 py-4 whitespace-nowrap">Composante / Équipement</th>
                  <th className="px-5 py-4 whitespace-nowrap">Machine Racine</th>
                  <th className="px-5 py-4 whitespace-nowrap">Zone / Secteur</th>
                  <th className="px-5 py-4 whitespace-nowrap">Date Archivage</th>
                  <th className="px-5 py-4 whitespace-nowrap">Type</th>
                  <th className="px-5 py-4 text-right pr-6 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {otsFiltrees.map(ot => (
                  <tr 
                    key={ot.id_ot}
                    className="hover:bg-blue-50/50 transition-all duration-150 cursor-pointer group"
                    onClick={() => router.push(`/ot/archives/${ot.id_ot}`)}
                  >
                    <td className="px-5 py-4">
                      <p className="font-mono font-black text-base text-[#003B7A] group-hover:underline">{ot.numero_ot}</p>
                    </td>
                    <td className="px-5 py-4 max-w-[240px]">
                      <p className="font-black text-slate-800">{ot.equipement?.equipment_code || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">{ot.equipement?.description || ''}</p>
                    </td>
                    <td className="px-5 py-4 max-w-[220px]">
                      <p className="font-mono font-bold text-slate-700">{ot.equipement?.machine_racine_code || '—'}</p>
                      {ot.equipement?.machine_racine_desc && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">{ot.equipement.machine_racine_desc}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">{ot.equipement?.nom_zone || '—'}</span>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-600 whitespace-nowrap">
                      {fmtDate(ot.date_archive)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-black border uppercase ${
                        ot.type_ot === 'CORRECTIF'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {ot.type_ot === 'CORRECTIF' ? 'Correctif' : 'Prédictif'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right pr-6" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => router.push(`/ot/archives/${ot.id_ot}`)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border border-slate-200 bg-slate-50 text-slate-700 hover:bg-[#003B7A] hover:text-white transition-all shadow-sm"
                      >
                        <Eye size={14}/> Consulter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-between font-bold text-slate-500">
            <p className="text-sm">{otsFiltrees.length} document{otsFiltrees.length !== 1 ? 's' : ''} listés</p>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIGURATION D'IMPRESSION & EXPORT PDF ── */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 transform transition-all">
            <div className="bg-gradient-to-r from-[#003B7A] to-[#002a5a] text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Printer size={24}/>
                <div>
                  <h3 className="font-black text-lg">Export Documentaire</h3>
                  <p className="text-xs text-blue-200 font-medium">Impression ou Génération du fichier PDF</p>
                </div>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="p-1.5 hover:bg-white/10 rounded-xl text-white/80 transition-colors">
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-4 text-xs text-blue-900 font-bold">
                <p className="font-black mb-1.5 text-blue-950 text-sm">Périmètre sélectionné :</p>
                <ul className="space-y-1 text-blue-800">
                  <li>&bull; Pôle actif : <span className="text-slate-900 font-black">{authUser?.nom_pole || 'Cevital'}</span></li>
                  <li>&bull; Période définie : <span className="bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-black">{mois ? `${MOIS[mois as number - 1]} ${annee}` : `Année ${annee}`}</span></li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Données à include dans le PDF :
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setPerimetreImpression('tous')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-xs font-black transition-all ${
                      perimetreImpression === 'tous'
                        ? 'border-[#003B7A] bg-blue-50/50 text-[#003B7A]'
                        : 'border-gray-200 text-slate-600 hover:border-gray-300 hover:bg-slate-50'
                    }`}
                  >
                    <FileText size={16}/>
                    <div>
                      <p>Tous les OT archivés de la liste</p>
                      <span className="text-[10px] font-medium text-slate-400">Total : {otsFiltrees.length} documents</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setPerimetreImpression('zone_uniquement')}
                    disabled={!filtreZone}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-xs font-black transition-all ${
                      !filtreZone ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''
                    } ${
                      perimetreImpression === 'zone_uniquement'
                        ? 'border-[#003B7A] bg-blue-50/50 text-[#003B7A]'
                        : 'border-gray-200 text-slate-600 hover:border-gray-300 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin size={16}/>
                    <div>
                      <p>Uniquement la zone ciblée</p>
                      <span className="text-[10px] font-medium text-slate-400">
                        {filtreZone ? `Zone : ${zones.find(z => z.id_zone === filtreZone)?.nom_zone}` : 'Sélectionnez une zone sur l\'écran principal'}
                      </span>
                    </div>
                  </button>
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
                  onClick={handleImprimerChantier} 
                  disabled={printing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#003B7A] to-[#002a5a] text-white rounded-xl font-black shadow-md disabled:opacity-50"
                >
                  {printing && <Loader2 size={16} className="animate-spin"/>}
                  {printing ? 'Traitement…' : 'Générer le PDF / Imprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}