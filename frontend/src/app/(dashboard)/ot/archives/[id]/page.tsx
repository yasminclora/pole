'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { otService } from '@/services/otService'
import {
  ArrowLeft, Loader2, Wrench, MapPin, User, Clock, Calendar,
  CheckCircle, Package, Printer, FileText, AlertCircle, Archive,
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

function fmtDuree(minutes: number | null | undefined) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
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
      <Loader2 size={40} className="animate-spin text-[#003B7A]" />
    </div>
  )

  if (!ot) return (
    <div className="text-center py-20 text-red-500">
      <AlertCircle className="mx-auto mb-2" size={40} />
      <p>Archive introuvable</p>
      <button onClick={() => router.back()} className="mt-4 text-[#003B7A] underline text-sm">Retour</button>
    </div>
  )

  const equip = ot.equipement || {}
  const inter = ot.intervention || {}
  const assigne = ot.assigne || {}
  const assigne_2 = ot.assigne_2 || {}

  return (
    <div className="max-w-5xl mx-auto px-6 space-y-4 pb-6">

      {/* ── Header bleu ── */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] px-5 py-4 text-white shadow-md">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-white/10 transition">
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shrink-0">
              <Archive size={20} className="text-white"/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">{ot.numero_ot}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/20 backdrop-blur-sm bg-white/10 text-blue-100">
                  Archivé
                </span>
              </div>
              <p className="text-blue-200 text-xs mt-0.5">
                {ot.type_ot === 'CORRECTIF' ? 'Correctif' : 'Prédictif'} · {ot.classe} · {equip.nom_zone || ''}
              </p>
            </div>
          </div>
       
        </div>
      </div>

      {/* ── Hiérarchie équipement ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <h3 className="font-bold text-gray-800 text-sm mb-3">Hiérarchie équipement</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['L1 · Machine racine', equip.machine_racine_code, equip.machine_racine_desc],
            ['L2 · Sous-système', equip.parent_code, equip.parent_desc],
            ['L3 · Composante', equip.equipment_code, equip.description],
          ].map(([hdr, code, desc]) => (
            <div key={hdr as string} className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{hdr}</p>
              <p className="font-bold text-gray-800 text-sm mt-0.5">{code || '—'}</p>
              {desc && <p className="text-[11px] text-gray-500 truncate">{desc as string}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Intervention & Équipe ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Intervention */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <h3 className="font-bold text-gray-800 text-sm mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
            <Wrench size={14} className="text-[#003B7A]"/> Intervention
          </h3>
          <div className="space-y-2">
            {[
              ['Type travail', inter.type_travail],
              ['Description', inter.description_travail],
              ['Observations', inter.observations],
              ['Début', fmtDateTime(inter.date_debut)],
              ['Fin', fmtDateTime(inter.date_fin)],
            ].map(([label, val]) => (
              <div key={label as string} className={label === 'Description' || label === 'Observations' ? '' : 'flex justify-between text-xs'}>
                {label === 'Description' || label === 'Observations' ? (
                  <>
                    <p className="text-[10px] text-gray-400 font-semibold mb-0.5">{label}</p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{val || '—'}</p>
                  </>
                ) : (
                  <>
                    <span className="text-gray-400">{label}</span>
                    <span className="font-medium text-gray-800">{val || '—'}</span>
                  </>
                )}
              </div>
            ))}
            {inter.composante_remplacee && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs">
                  <Package size={12} className="text-[#003B7A]"/>
                  <span className="text-gray-400">Pièce remplacée:</span>
                  <span className="font-bold text-[#003B7A]">{inter.composante_remplacee}</span>
                </div>
                {inter.composante_remplacee_desc && (
                  <p className="text-[10px] text-gray-400 ml-5 mt-0.5">{inter.composante_remplacee_desc}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Équipe d'exécution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <h3 className="font-bold text-gray-800 text-sm mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
            <User size={14} className="text-[#003B7A]"/> Équipe d&apos;exécution
          </h3>
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Intervenant principal</p>
              <p className="font-bold text-gray-800 text-sm">{assigne.nom || '—'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded border border-blue-100">{assigne.role}</span>
                {assigne.nom_equipe && <span className="text-[10px] text-gray-400">{assigne.nom_equipe}</span>}
              </div>
            </div>
            {assigne_2.id && (
              <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Second intervenant</p>
                <p className="font-bold text-gray-800 text-sm">{assigne_2.nom}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500">{assigne_2.role}</span>
                  {assigne_2.nom_equipe && <span className="text-[10px] text-gray-400">{assigne_2.nom_equipe}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Validations ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <h3 className="font-bold text-gray-800 text-sm mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
          <CheckCircle size={14} className="text-[#003B7A]"/> Validations
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Chef d&apos;équipe</p>
            <p className="text-xs text-gray-500 mt-0.5">CE</p>
            <p className="font-semibold text-gray-800 text-sm mt-1">{ot.date_validation_ce ? fmtDateTime(ot.date_validation_ce) : '—'}</p>
          </div>
          <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">HSE</p>
            <p className="text-xs text-gray-500 mt-0.5">Sécurité</p>
            <p className="font-semibold text-gray-800 text-sm mt-1">{ot.date_validation_hse ? fmtDateTime(ot.date_validation_hse) : '—'}</p>
          </div>
          <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Archivage</p>
            <p className="text-xs text-gray-500 mt-0.5">Final</p>
            <p className="font-semibold text-gray-800 text-sm mt-1">{ot.date_archive ? fmtDateTime(ot.date_archive) : '—'}</p>
          </div>
        </div>
      </div>

      {/* ── Informations générales ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <h3 className="font-bold text-gray-800 text-sm mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
          <FileText size={14} className="text-[#003B7A]"/> Informations générales
        </h3>
        <div className="grid grid-cols-4 gap-4 text-xs">
          {[
            ['Créé par', ot.methodiste?.nom || '—', ot.methodiste?.email],
            ['Date création', fmtDateTime(ot.created_at)],
            ['Date prévue', fmtDate(ot.date_prevue)],
            ['Priorité', ot.priorite],
          ].map(([label, val, sub]) => (
            <div key={label as string}>
              <p className="text-gray-400 mb-0.5">{label}</p>
              <p className="font-semibold text-gray-800">{val as string}</p>
              {sub && <p className="text-[10px] text-gray-400">{sub as string}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
