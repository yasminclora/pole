'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { otService } from '@/services/otService'
import {
  ArrowLeft, Loader2, Wrench, User, Clock, Package, FileText, AlertCircle, Archive, Shield, Layers
} from 'lucide-react'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function DetailArchivePage() {
  const router = useRouter()
  const params = useParams()
  const id = Number(params?.id)

  const [ot, setOt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    otService.getById(id)
      .then(data => setOt(data))
      .catch(() => setOt(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={36} className="animate-spin text-[#003B7A]" />
    </div>
  )

  if (!ot) return (
    <div className="text-center py-16 bg-slate-100/80 rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto mt-10">
      <AlertCircle className="mx-auto mb-3 text-red-500" size={36} />
      <p className="text-gray-700 font-medium text-base">Archive introuvable</p>
      <button onClick={() => router.back()} className="mt-3 text-[#003B7A] font-bold text-sm hover:underline">
        Retour aux archives
      </button>
    </div>
  )

  const equip = ot.equipement || {}
  const inter = ot.intervention || {}
  const assigne = ot.assigne || {}
  const assigne_2 = ot.assigne_2 || {}

  return (
    <div className="w-full px-6 py-4 space-y-5 bg-white min-h-screen text-slate-800">

      {/* ── 1. BANNIÈRE EN-TÊTE BLEUE OPTIMA ── */}
      <div className="rounded-xl bg-[#003B7A] px-6 py-4 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight">{ot.numero_ot}</h1>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-white/20 text-white">
                Archivé
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500 text-white">
                {ot.type_ot}
              </span>
            </div>
            <p className="text-blue-200 text-xs mt-1">
              Classe : <span className="text-white font-medium">{ot.classe || '—'}</span>  ·  Zone : <span className="text-white font-medium">{equip.nom_zone || 'Général'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-blue-100 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 self-start sm:self-auto">
          <Archive size={14} /> Historique Optima
        </div>
      </div>

      {/* ── 2. CARTE : STRUCTURE MACHINE (FOND GRIS) ── */}
      <div className="bg-slate-100/70 hover:bg-slate-200/50 rounded-xl border border-slate-200/40 p-5 space-y-3 hover:-translate-y-1 hover:shadow-xs transition-all duration-200">
        <div className="flex items-center gap-2 text-[#003B7A] font-bold border-b border-slate-300/40 pb-2">
          <Layers size={16} />
          <h2 className="text-xs uppercase tracking-wider">Structure Équipement</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pt-1">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase block">L1 · Machine racine</span>
            <p className="font-bold text-slate-700 font-mono mt-0.5">{equip.machine_racine_code || '—'}</p>
            {equip.machine_racine_desc && <p className="text-xs text-slate-500">{equip.machine_racine_desc}</p>}
          </div>
          <div className="md:border-l md:border-slate-300/40 md:pl-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase block">L2 · Sous-système</span>
            <p className="font-bold text-slate-700 font-mono mt-0.5">{equip.parent_code || '—'}</p>
            {equip.parent_desc && <p className="text-xs text-slate-500">{equip.parent_desc}</p>}
          </div>
          <div className="md:border-l md:border-slate-300/40 md:pl-4">
            <span className="text-[11px] font-bold text-[#003B7A] uppercase block">L3 · Composante finale</span>
            <p className="text-base font-extrabold text-slate-900 font-mono mt-0.5">{equip.equipment_code || '—'}</p>
            {equip.description && <p className="text-xs text-slate-700 font-medium">{equip.description}</p>}
          </div>
        </div>
      </div>

      {/* ── 3. CARTE : COMPTE-RENDU TECHNIQUE (FOND GRIS) ── */}
      <div className="bg-slate-100/70 hover:bg-slate-200/50 rounded-xl border border-slate-200/40 p-5 space-y-3 hover:-translate-y-1 hover:shadow-xs transition-all duration-200">
        <div className="flex items-center gap-2 text-[#003B7A] font-bold border-b border-slate-300/40 pb-2">
          <Wrench size={16} />
          <h2 className="text-xs uppercase tracking-wider">Rapport des Travaux Réalisés</h2>
        </div>
        
        <div className="pt-1 space-y-3">
          <p className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-line bg-white/80 p-3.5 rounded-lg border border-slate-200/50">
            {inter.description_travail || 'Aucun descriptif technique rédigé.'}
          </p>

          {inter.observations && (
            <div className="text-xs text-slate-600 italic pl-3 border-l-2 border-amber-500">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider not-italic block mb-0.5">Observations terrain :</span>
              {inter.observations}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. GRILLE : RESSOURCES & TEMPS (FONDS GRIS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Équipe de Maintenance */}
        <div className="bg-slate-100/70 hover:bg-slate-200/50 rounded-xl border border-slate-200/40 p-5 space-y-3 hover:-translate-y-1 hover:shadow-xs transition-all duration-200">
          <div className="flex items-center gap-2 text-[#003B7A] font-bold border-b border-slate-300/40 pb-2">
            <User size={16} />
            <h2 className="text-xs uppercase tracking-wider">Équipe de Maintenance</h2>
          </div>
          
          <div className="space-y-2.5 pt-1 text-sm">
            <div className="flex items-baseline justify-between bg-white/60 px-3 py-2 rounded-lg border border-slate-200/30">
              <span className="font-bold text-slate-800 text-base">{assigne.nom || '—'}</span>
              <span className="text-xs text-slate-500 font-medium">{assigne.role} {assigne.nom_equipe ? `• ${assigne.nom_equipe}` : ''}</span>
            </div>
            {assigne_2.id && (
              <div className="flex items-baseline justify-between bg-white/60 px-3 py-2 rounded-lg border border-slate-200/30">
                <span className="font-semibold text-slate-700">{assigne_2.nom}</span>
                <span className="text-xs text-slate-500 font-medium">{assigne_2.role}</span>
              </div>
            )}
          </div>
        </div>

        {/* Temps et Logistique */}
        <div className="bg-slate-100/70 hover:bg-slate-200/50 rounded-xl border border-slate-200/40 p-5 space-y-3 hover:-translate-y-1 hover:shadow-xs transition-all duration-200">
          <div className="flex items-center gap-2 text-[#003B7A] font-bold border-b border-slate-300/40 pb-2">
            <Clock size={16} />
            <h2 className="text-xs uppercase tracking-wider">Temps & Pièces</h2>
          </div>
          
          <div className="space-y-2 pt-1 text-xs font-medium text-slate-700">
            <div className="flex justify-between items-center bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/40">
              <span className="text-slate-400">Début d&apos;intervention :</span>
              <span className="font-mono text-sm font-semibold text-slate-800">{fmtDateTime(inter.date_debut)}</span>
            </div>
            <div className="flex justify-between items-center bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/40">
              <span className="text-slate-400">Clôture terrain :</span>
              <span className="font-mono text-sm font-semibold text-slate-800">{fmtDateTime(inter.date_fin)}</span>
            </div>

            {inter.composante_remplacee && (
              <div className="flex justify-between items-center bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 mt-2">
                <span className="text-[#003B7A] font-bold flex items-center gap-1">
                  <Package size={13} /> Pièce remplacée :
                </span>
                <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                  {inter.composante_remplacee}
                </span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 5. CARTE : WORKFLOW & TRAÇABILITÉ (FOND GRIS) ── */}
      <div className="bg-slate-100/70 hover:bg-slate-200/50 rounded-xl border border-slate-200/40 p-5 space-y-4 hover:-translate-y-1 hover:shadow-xs transition-all duration-200">
        <div className="flex items-center gap-2 text-[#003B7A] font-bold border-b border-slate-300/40 pb-2">
          <Shield size={16} />
          <h2 className="text-xs uppercase tracking-wider">Workflow de Clôture Systèmes</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex justify-between sm:flex-col sm:justify-start bg-white/80 p-2.5 rounded-lg border border-slate-200/40">
            <span className="text-slate-400">Visa Chef d&apos;Équipe :</span>
            <span className="font-mono font-bold text-slate-700 sm:mt-1">{ot.date_validation_ce ? fmtDateTime(ot.date_validation_ce) : '—'}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:justify-start bg-white/80 p-2.5 rounded-lg border border-slate-200/40">
            <span className="text-slate-400">Visa Sécurité / HSE :</span>
            <span className="font-mono font-bold text-slate-700 sm:mt-1">{ot.date_validation_hse ? fmtDateTime(ot.date_validation_hse) : '—'}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:justify-start bg-white/80 p-2.5 rounded-lg border border-slate-200/40">
            <span className="text-slate-400">Archivage Définitif :</span>
            <span className="font-mono font-bold text-slate-800 sm:mt-1">{ot.date_archive ? fmtDateTime(ot.date_archive) : '—'}</span>
          </div>
        </div>

        {/* Traceur bas de page */}
        <div className="border-t border-slate-300/40 pt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <FileText size={13} className="text-slate-300" />
            <span>Planifié le : <strong className="text-slate-600">{fmtDate(ot.date_prevue)}</strong></span>
          </div>
          <div>
            <span>Créé par : <strong className="text-slate-600">{ot.methodiste?.nom || '—'}</strong> (<span className="font-mono">{fmtDateTime(ot.created_at)}</span>)</span>
          </div>
          <div>
            <span>Priorité : <strong className={`${ot.priorite === 'URGENT' ? 'text-red-500' : 'text-slate-600'}`}>{ot.priorite || 'NORMALE'}</strong></span>
          </div>
        </div>
      </div>

    </div>
  )
}