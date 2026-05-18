'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { otService } from '@/services/otService'
import { ArrowLeft, Loader2, Package, Printer, Wrench } from 'lucide-react'

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={40} className="animate-spin text-[#003B7A]" />
      </div>
    )
  }

  if (!ot) return <div className="text-center py-20">OT introuvable</div>

  const equip = ot.equipement || {}
  const di = ot.di || {}
  const inter = ot.intervention || {}
  const statutLabel = STATUT_LABEL[ot.statut] || 'Créé'

  return (
    <div className="max-w-5xl mx-auto px-6 space-y-3 pb-4">

      {/* ── En-tête bleu ── */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] px-5 py-3 text-white shadow-md">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shrink-0">
              <Wrench size={18} className="text-white"/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button onClick={() => router.back()} className="p-0.5 rounded hover:bg-white/10 transition">
                  <ArrowLeft size={14} />
                </button>
                <h1 className="text-base font-bold tracking-tight">{ot.numero_ot}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/20 backdrop-blur-sm bg-white/10 text-blue-100">
                  {statutLabel}
                </span>
              </div>
              <p className="text-blue-200 text-[11px] mt-0.5">
                {ot.type_ot} · {ot.classe} · {formatDate(ot.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'}/ot/${ot.id_ot}/export/pdf`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-[11px] font-semibold hover:bg-white/20 transition">
              <Printer size={11} />
              PDF
            </a>
            {(ot.statut === 'ASSIGNE' || ot.statut === 'EN_COURS') && (
              <button onClick={() => router.push(`/ot/${ot.id_ot}/executer`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#003B7A] text-[11px] font-bold hover:bg-blue-50 transition shadow-sm">
                <Wrench size={11} />
                Exécuter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Infos rapides ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <div className="grid grid-cols-4 gap-3">
          {[
            ['Classe', ot.classe, ''],
            ['Priorité', ot.priorite, ''],
            ['Zone', equip.nom_zone || '—', ''],
            ['N° DI', di.numero_di || '—', 'text-[#003B7A] font-bold'],
          ].map(([label, val, cls]) => (
            <div key={label as string}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
              <p className={`font-semibold text-gray-800 text-sm ${cls}`}>{val as string}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Hiérarchie Équipement ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <h3 className="font-bold text-gray-800 text-sm mb-2">Hiérarchie</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['L1 · Racine', equip.machine_racine_code, equip.machine_racine_desc],
            ['L2 · Système', equip.parent_code, equip.parent_desc],
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

      {/* ── DI & Intervention ── */}
      <div className="grid grid-cols-2 gap-3">
        {ot.type_ot === 'PREDICTIF' ? (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 px-4 py-3 opacity-70">
            <h3 className="font-bold text-gray-500 text-sm mb-2 pb-2 border-b border-gray-200">
              Demande Intervention
            </h3>
            <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)] text-center py-4">
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                <Wrench size={16} className="text-gray-400" />
              </div>
              <p className="text-xs font-semibold text-gray-500">Non applicable</p>
              <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                Cet OT est <span className="font-semibold">prédictif</span> — il provient d'une prédiction ML et n'est pas associé à une demande d'intervention.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
            <h3 className="font-bold text-gray-800 text-sm mb-2 pb-2 border-b border-gray-100">Demande Intervention</h3>
            <div className="space-y-1.5">
              {[
                ['Urgence', di.urgence],
                ['Statut', di.statut],
                ['Déclarant', di.declarant],
                ['Email', di.email_declarant],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-xs">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-gray-800">{val || '—'}</span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-0.5 font-semibold">Description</p>
                <p className="text-gray-600 text-xs leading-relaxed">{di.description || '—'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <h3 className="font-bold text-gray-800 text-sm mb-2 pb-2 border-b border-gray-100">Intervention</h3>
          <div className="space-y-1.5">
            {[
              ['Type', inter.type_travail],
              ['Réalisateur', inter.realisateur],
              ['Date début', formatDateTime(inter.date_debut)],
              ['Date fin', formatDateTime(inter.date_fin)],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between text-xs">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium text-gray-800">{val || '—'}</span>
              </div>
            ))}
            {inter.composante_remplacee && (
              <div className="pt-1.5 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs">
                  <Package size={11} className="text-blue-500"/>
                  <span className="text-gray-400">Pièce changée:</span>
                  <span className="font-bold text-[#003B7A] text-xs">{inter.composante_remplacee}</span>
                </div>
                <p className="text-[10px] text-gray-400 ml-5">{inter.composante_remplacee_desc}</p>
              </div>
            )}
            <div className="pt-1.5 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 mb-0.5 font-semibold">Description travail</p>
              <p className="text-gray-600 text-xs leading-relaxed">{inter.description_travail || '—'}</p>
            </div>
            {inter.observations && (
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5 font-semibold">Observations</p>
                <p className="text-gray-500 text-xs leading-relaxed">{inter.observations}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Créateur / Exécutants / Dates ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <h3 className="font-bold text-gray-800 text-sm mb-2 pb-2 border-b border-gray-100">Créateur</h3>
          <p className="font-semibold text-gray-800 text-sm">{ot.methodiste?.nom || '—'}</p>
          <p className="text-[10px] text-gray-400">Méthodiste</p>
          <p className="text-[10px] text-gray-500 truncate">{ot.methodiste?.email}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <h3 className="font-bold text-gray-800 text-sm mb-2 pb-2 border-b border-gray-100">Exécutant(s)</h3>
          <div className="space-y-2">
            <div>
              <p className="font-semibold text-gray-800 text-sm">{ot.assigne?.nom || '—'}</p>
              <p className="text-[10px] text-gray-400">{ot.assigne?.role}</p>
              <p className="text-[10px] text-gray-500 truncate">{ot.assigne?.email}</p>
            </div>
            {ot.assigne_2 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="font-semibold text-gray-800 text-sm">{ot.assigne_2.nom}</p>
                <p className="text-[10px] text-gray-400">{ot.assigne_2.role}</p>
                <p className="text-[10px] text-gray-500 truncate">{ot.assigne_2.email}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <h3 className="font-bold text-gray-800 text-sm mb-2 pb-2 border-b border-gray-100">Dates</h3>
          <div className="space-y-1">
            {[
              ['Prévue', formatDate(ot.date_prevue)],
              ['Assignation', formatDate(ot.date_assignation)],
              ['Début réel', formatDate(ot.date_debut_reelle)],
              ['Fin réel', formatDate(ot.date_fin_reelle)],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between text-xs">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium text-gray-800">{val}</span>
              </div>
            ))}
            <div className="pt-1 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-400">Durée estimée</span>
              <span className="font-medium text-gray-800">{fmtDuree(ot.duree_estimee)}</span>
            </div>
            {ot.duree_reelle && (
              <div className="flex justify-between text-xs font-bold text-[#003B7A]">
                <span>Durée réelle</span>
                <span>{fmtDuree(ot.duree_reelle)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Description OT ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <h3 className="font-bold text-gray-800 text-sm mb-1">Description</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{ot.description || '—'}</p>
        {ot.observations && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Observations</p>
            <p className="text-sm text-gray-500">{ot.observations}</p>
          </div>
        )}
        {ot.motif_rejet && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-800">Motif du rejet</p>
            <p className="text-sm text-gray-500 mt-0.5">{ot.motif_rejet}</p>
          </div>
        )}
      </div>
    </div>
  )
}