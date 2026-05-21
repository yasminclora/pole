'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { otService } from '@/services/otService'
import { ArrowLeft, Loader2, Package, Wrench, Layers, AlertCircle } from 'lucide-react'

const STATUT_LABEL: Record<string, string> = {
  CREE: 'Créé',
  ASSIGNE: 'Assigné',
  EN_COURS: 'En cours',
  TERMINE: 'Soumis',
  VALIDE_CE: 'Validé CE',
  VALIDE_HSE: 'Validé HSE',
  ARCHIVE: 'Archivé',
  REJETE: 'Rejeté',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDuree(minutes: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

export default function DetailOTPage() {
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
      <Loader2 size={40} className="animate-spin text-[#003B7A]" />
    </div>
  )

  if (!ot) return (
    <div className="text-center py-20 bg-slate-100/80 rounded-2xl border border-slate-200 max-w-2xl mx-auto mt-10 p-6">
      <AlertCircle className="mx-auto mb-4 text-red-500" size={44} />
      <p className="text-gray-700 text-lg font-semibold">Ordre de travail introuvable</p>
    </div>
  )

  const equip = ot.equipement || {}
  const di = ot.di || {}
  const inter = ot.intervention || {}
  const statutLabel = STATUT_LABEL[ot.statut] || 'Créé'

  return (
    <div className="w-full px-10 py-8 space-y-8 bg-white min-h-screen text-slate-800">

      {/* ── 1. BANNIÈRE EN-TÊTE BLEUE ── */}
      <div className="rounded-xl bg-[#003B7A] px-8 py-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => router.back()} 
            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight">{ot.numero_ot}</h1>
              <span className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-white/20 text-white">
                {statutLabel}
              </span>
              <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${ot.priorite === 'URGENT' ? 'bg-red-500' : 'bg-slate-500'} text-white`}>
                {ot.priorite || 'PRIORITÉ NORMALE'}
              </span>
            </div>
            <p className="text-blue-200 text-sm mt-2 font-medium">
              {ot.type_ot} &middot; Classe : <span className="text-white font-bold">{ot.classe || '—'}</span> &middot; Zone : <span className="text-white font-bold">{equip.nom_zone || 'Général'}</span> {di.numero_di && `· N° DI : ${di.numero_di}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {(ot.statut === 'ASSIGNE' || ot.statut === 'EN_COURS') && (
            <button onClick={() => router.push(`/ot/${ot.id_ot}/executer`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-[#003B7A] text-sm font-black hover:bg-blue-50 transition shadow-xs">
              <Wrench size={16} /> Exécuter
            </button>
          )}
        </div>
      </div>

      {/* ── 2. STRUCTURE MACHINE ── */}
      <div className="bg-slate-100/60 rounded-xl border border-slate-200/40 p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-[#003B7A] font-bold border-b border-slate-200 pb-3">
          <Layers size={18} />
          <h2 className="text-sm uppercase tracking-wider font-extrabold">Équipement Cible</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-base pt-1">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">L1 · Machine Racine</span>
            <p className="font-bold text-slate-700 font-mono text-lg mt-1">{equip.machine_racine_code || '—'}</p>
            {equip.machine_racine_desc && <p className="text-sm text-slate-500 mt-0.5 truncate">{equip.machine_racine_desc}</p>}
          </div>
          <div className="md:border-l md:border-slate-300/40 md:pl-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">L2 · Système</span>
            <p className="font-bold text-slate-700 font-mono text-lg mt-1">{equip.parent_code || '—'}</p>
            {equip.parent_desc && <p className="text-sm text-gray-500 mt-0.5 truncate">{equip.parent_desc}</p>}
          </div>
          <div className="md:border-l md:border-slate-300/40 md:pl-6">
            <span className="text-xs font-bold text-[#003B7A] uppercase tracking-wide block">L3 · Composante</span>
            <p className="text-xl font-black text-slate-900 font-mono mt-0.5">{equip.equipment_code || '—'}</p>
            {equip.description && <p className="text-sm text-slate-700 font-bold mt-0.5">{equip.description}</p>}
          </div>
        </div>
      </div>

      {/* ── 3. COMPTE-RENDU TEXTUEL GRANDS TEXTES + FOND BLEU CLAIR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8 pt-2">
        
        {/* Descriptif Demande (DI) */}
        {ot.type_ot !== 'PREDICTIF' && (
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">
              Constat du Déclarant ({di.declarant || '—'})
            </h3>
            <p className="text-base text-slate-700 leading-relaxed bg-blue-50/50 p-5 rounded-xl border border-blue-100/40 whitespace-pre-line shadow-3xs">
              {di.description || 'Aucun détail textuel saisi dans la demande.'}
            </p>
            <span className="text-xs text-slate-500 block font-medium">Urgence constatée : <strong className="text-slate-700 font-bold">{di.urgence || '—'}</strong></span>
          </div>
        )}

        {/* Descriptif Exécution (Terrain) */}
        <div className="space-y-3 col-span-1 lg:col-span-1">
          <h3 className="text-xs font-extrabold text-[#003B7A] uppercase tracking-widest pb-1 border-b border-slate-100">
            Rapport Technique d&apos;Intervention
          </h3>
          <p className="text-base text-slate-900 font-semibold leading-relaxed bg-blue-50/60 p-5 rounded-xl border border-blue-100/60 whitespace-pre-line shadow-3xs">
            {inter.description_travail || ot.description || 'Aucun compte-rendu technique saisi.'}
          </p>
          
          {inter.composante_remplacee && (
            <div className="inline-flex items-center gap-2.5 text-sm font-bold text-slate-700 bg-blue-50/90 border border-blue-100 px-3 py-1.5 rounded-lg mt-1">
              <Package size={15} className="text-[#003B7A]" />
              <span>Organe remplacé : <strong className="font-mono text-base text-[#003B7A] font-black">{inter.composante_remplacee}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. ACTEURS, LOGISTIQUE & TEMPS ── */}
      <div className="bg-slate-100/60 rounded-xl border border-slate-200/40 p-6 space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm font-medium">
          
          {/* Acteurs */}
          <div className="space-y-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Intervenants</span>
            <div className="space-y-2">
              <p className="text-base font-bold text-slate-800">{ot.assigne?.nom || 'Non assigné'} <span className="text-xs font-normal text-slate-500">({ot.assigne?.role || 'Tech'})</span></p>
              {ot.assigne_2 && <p className="text-base font-bold text-slate-700">{ot.assigne_2.nom} <span className="text-xs font-normal text-slate-500">({ot.assigne_2.role})</span></p>}
            </div>
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-200/60 font-medium">Émis par : <span className="text-slate-700 font-bold">{ot.methodiste?.nom || '—'}</span></p>
          </div>

          {/* Suivi des Dates */}
          <div className="space-y-2 text-slate-600 font-semibold">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Calendrier</span>
            <div className="flex justify-between items-center py-0.5">
              <span>Planifié le :</span> <span className="font-mono text-slate-800 font-bold bg-white/60 px-2 py-0.5 rounded border border-slate-200/40">{formatDate(ot.date_prevue)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span>Début réel :</span> <span className="font-mono text-slate-800 bg-white/40 px-2 py-0.5 rounded">{formatDateTime(inter.date_debut || ot.date_debut_reelle)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span>Fin réelle :</span> <span className="font-mono text-slate-800 bg-white/40 px-2 py-0.5 rounded">{formatDateTime(inter.date_fin || ot.date_fin_reelle)}</span>
            </div>
          </div>

          {/* Durées */}
          <div className="space-y-2 text-slate-600 font-semibold md:border-l md:border-slate-300/40 md:pl-8">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Métrologie Temps</span>
            <div className="flex justify-between items-center py-0.5">
              <span>Estimation :</span> <span className="font-mono text-slate-800">{fmtDuree(ot.duree_estimee)}</span>
            </div>
            <div className="flex justify-between items-center text-base font-black text-[#003B7A] pt-2 mt-2 border-t border-slate-200">
              <span>Durée Réelle :</span> <span className="font-mono text-lg bg-[#003B7A]/5 px-2.5 py-0.5 rounded border border-[#003B7A]/20">{fmtDuree(ot.duree_reelle)}</span>
            </div>
          </div>

        </div>

        {/* Zone Notes de Clôture */}
        {ot.observations && (
          <div className="border-t border-slate-200 pt-4 text-sm">
            <p className="text-slate-600 italic leading-relaxed">
              <span className="not-italic font-extrabold text-xs uppercase text-slate-400 block mb-1 tracking-wide">Note de clôture :</span>
              {ot.observations}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}