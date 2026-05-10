'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { otService } from '@/services/otService'
import { ArrowLeft, Loader2, Package, Download, Printer } from 'lucide-react'

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CREE: { label: 'Créé', color: 'text-gray-600', bg: 'bg-gray-100' },
  ASSIGNE: { label: 'Assigné', color: 'text-blue-600', bg: 'bg-blue-100' },
  EN_COURS: { label: 'En cours', color: 'text-purple-600', bg: 'bg-purple-100' },
  TERMINE: { label: 'Soumis', color: 'text-amber-600', bg: 'bg-amber-100' },
  VALIDE_CE: { label: 'Validé CE', color: 'text-teal-600', bg: 'bg-teal-100' },
  VALIDE_HSE: { label: 'Validé HSE', color: 'text-green-600', bg: 'bg-green-100' },
  ARCHIVE: { label: 'Archivé', color: 'text-gray-400', bg: 'bg-gray-100' },
  REJETE: { label: 'Rejeté', color: 'text-red-600', bg: 'bg-red-100' },
}

const URGENCE_LABELS: Record<string, { label: string; color: string }> = {
  NIVEAU_1: { label: 'Niveau 1', color: 'text-green-600' },
  NIVEAU_2: { label: 'Niveau 2', color: 'text-orange-600' },
  NIVEAU_3: { label: 'Niveau 3', color: 'text-red-600' },
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
  const statutConfig = STATUT_CONFIG[ot.statut] || STATUT_CONFIG.CREE

  return (
    <div className="max-w-6xl mx-auto pb-8 px-4">
      {/* Header with OT ID in blue box */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-6 text-white shadow-xl mb-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20">
              <ArrowLeft size={20} className="text-white"/>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <span className="px-4 py-1.5 bg-white text-[#003B7A] rounded-lg font-bold text-lg font-mono">
                  {ot.numero_ot}
                </span>
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${statutConfig.bg} ${statutConfig.color}`}>
                  {statutConfig.label}
                </span>
              </div>
              <p className="text-blue-200 text-sm mt-1">Créé le {formatDate(ot.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-4">
              <p className="text-xs text-blue-200">Type</p>
              <p className="font-bold">{ot.type_ot}</p>
            </div>
            {/* Boutons export */}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/ot/${ot.id_ot}/export/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              title="Imprimer / Exporter PDF"
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
            >
              <Printer size={16} className="text-white" />
            </a>
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Classe</p>
          <p className="font-bold text-[#003B7A]">{ot.classe}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Priorité</p>
          <p className={`font-bold ${ot.priorite === 'CRITIQUE' ? 'text-red-600' : ot.priorite === 'HAUTE' ? 'text-orange-600' : 'text-blue-600'}`}>{ot.priorite}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Zone</p>
          <p className="font-bold text-red-600">{equip.nom_zone || '—'}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">N° DI</p>
          <p className="font-mono font-bold text-[#003B7A]">{di.numero_di || '—'}</p>
        </div>
      </div>

      {/* Equipment Hierarchy */}
      <div className="bg-white border rounded-xl p-4 mb-4">
        <h3 className="text-sm font-bold text-[#003B7A] mb-3">Hiérarchie Équipement</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase">Machine Racine (L1)</p>
            <p className="font-mono font-bold text-[#003B7A]">{equip.machine_racine_code || '—'}</p>
            <p className="text-[10px] text-gray-500 truncate">{equip.machine_racine_desc || ''}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase">Machine Niveau 2 (L2)</p>
            <p className="font-mono font-bold text-[#00A651]">{equip.parent_code || '—'}</p>
            <p className="text-[10px] text-gray-500 truncate">{equip.parent_desc || ''}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase">Composante (L3)</p>
            <p className="font-mono font-bold text-purple-700">{equip.equipment_code || '—'}</p>
            <p className="text-[10px] text-gray-500 truncate">{equip.description || ''}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* DI Section */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-bold text-[#003B7A] mb-3 border-b pb-2">Demande Intervention (DI)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Urgence:</span>
              <span className={`font-bold ${URGENCE_LABELS[di.urgence]?.color || 'text-gray-600'}`}>{di.urgence || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Statut:</span>
              <span className="font-medium">{di.statut || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Déclarant:</span>
              <span className="font-medium">{di.declarant || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Email:</span>
              <span className="text-xs text-gray-500">{di.email_declarant || '—'}</span>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-400 mb-1">Description:</p>
              <p className="text-gray-700 text-xs">{di.description || '—'}</p>
            </div>
          </div>
        </div>

        {/* Intervention Section */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-bold text-[#003B7A] mb-3 border-b pb-2">Intervention</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Type:</span>
              <span className="font-medium">{inter.type_travail || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Réalisateur:</span>
              <span className="font-medium">{inter.realisateur || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Email:</span>
              <span className="text-xs text-gray-500">{inter.email_realisateur || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Date début:</span>
              <span className="font-medium">{formatDateTime(inter.date_debut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Date fin:</span>
              <span className="font-medium">{formatDateTime(inter.date_fin)}</span>
            </div>
            {inter.composante_remplacee && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-orange-600">
                  <Package size={14}/>
                  <span className="text-xs font-bold">Pièce changée:</span>
                  <span className="font-mono text-xs">{inter.composante_remplacee}</span>
                </div>
                <p className="text-[10px] text-gray-400 ml-6">{inter.composante_remplacee_desc}</p>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-400 mb-1">Description travail:</p>
              <p className="text-gray-700 text-xs">{inter.description_travail || '—'}</p>
            </div>
            {inter.observations && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Observations:</p>
                <p className="text-gray-600 text-xs italic">{inter.observations}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Créateur OT */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-bold text-[#003B7A] mb-3 border-b pb-2">Créateur OT</h3>
          <div className="text-sm">
            <p className="font-medium">{ot.methodiste?.nom || '—'}</p>
            <p className="text-xs text-gray-400">Méthodiste</p>
            <p className="text-xs text-gray-500 mt-1">{ot.methodiste?.email}</p>
          </div>
        </div>

        {/* Exécutant(s) */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-bold text-purple-700 mb-3 border-b pb-2">Exécutant(s)</h3>
          <div className="text-sm space-y-2">
            <div>
              <p className="font-medium">{ot.assigne?.nom || '—'}</p>
              <p className="text-xs text-gray-400">{ot.assigne?.role}</p>
              <p className="text-xs text-gray-500">{ot.assigne?.email}</p>
            </div>
            {ot.assigne_2 && (
              <div className="pt-2 border-t">
                <p className="font-medium text-green-600">{ot.assigne_2.nom}</p>
                <p className="text-xs text-gray-400">{ot.assigne_2.role} (Superviseur)</p>
                <p className="text-xs text-gray-500">{ot.assigne_2.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-bold text-[#003B7A] mb-3 border-b pb-2">Dates</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Prévue:</span>
              <span className="font-medium">{formatDate(ot.date_prevue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Assignation:</span>
              <span className="font-medium">{formatDate(ot.date_assignation)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Début réel:</span>
              <span className="font-medium text-purple-600">{formatDate(ot.date_debut_reelle)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fin réel:</span>
              <span className="font-medium text-green-600">{formatDate(ot.date_fin_reelle)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-400">Durée estimée:</span>
              <span className="font-medium">{fmtDuree(ot.duree_estimee)}</span>
            </div>
            {ot.duree_reelle && (
              <div className="flex justify-between text-[#00A651] font-bold">
                <span>Durée réelle:</span>
                <span>{fmtDuree(ot.duree_reelle)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-gray-50 border rounded-xl p-4">
        <h3 className="text-sm font-bold text-[#003B7A] mb-2">Description OT</h3>
        <p className="text-sm text-gray-700">{ot.description || '—'}</p>
        {ot.observations && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-400 mb-1">Observations:</p>
            <p className="text-sm text-gray-600">{ot.observations}</p>
          </div>
        )}
        {ot.motif_rejet && (
          <div className="mt-3 pt-3 border-t text-red-600">
            <p className="text-sm font-bold">Motif du rejet:</p>
            <p className="text-sm">{ot.motif_rejet}</p>
          </div>
        )}
      </div>
    </div>
  )
}