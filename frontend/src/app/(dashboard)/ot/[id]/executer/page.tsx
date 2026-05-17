'use client'

/**
 * Page d'exécution d'un OT pour le Maintenancier.
 * Route : /dashboard/ot/[id]/executer
 *
 * Fonctionnalités :
 *  1. Voir les détails de l'OT assigné
 *  2. Démarrer l'OT (ASSIGNE → EN_COURS)
 *  3. Réserver des pièces de stock
 *  4. Voir ses réservations en cours
 *  5. Saisir le feedback de l'intervention
 *  6. Terminer l'OT (EN_COURS → TERMINE)
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import {
  ArrowLeft, Play, Package, CheckCircle, Loader2,
  Search, Plus, ClipboardList, AlertCircle, Wrench, X,
  AlertTriangle, Calendar, RotateCcw,
} from 'lucide-react'

import api                     from '@/services/axiosInstance'
import { otService }           from '@/services/otService'
import { interventionService } from '@/services/interventionService'
import { stockService }        from '@/services/stockService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PieceStock {
  id_piece         : number
  code_stock       : string
  designation      : string
  description      ?: string
  quantite         : number
  unite            : string
  seuil_alerte     : number
  composantes_liees?: { equipment_code: string; description: string; level: number; machine_racine_code?: string; machine_racine_desc?: string }[]
}

interface Reservation {
  id_reservation  : number
  id_piece        : number
  code_piece      : string
  designation     : string
  quantite_demandee: number
  quantite_livree ?: number
  statut          : 'EN_ATTENTE' | 'VALIDEE' | 'LIVREE' | 'ANNULEE'
  date_demande    : string
}

const STATUT_RESA: Record<string, { label: string; color: string }> = {
  EN_ATTENTE: { label: 'En attente',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  VALIDEE   : { label: 'Validée',     color: 'text-blue-600  bg-blue-50  border-blue-200'  },
  LIVREE    : { label: 'Livrée ✓',    color: 'text-green-600 bg-green-50 border-green-200' },
  ANNULEE   : { label: 'Annulée',     color: 'text-gray-500  bg-gray-50  border-gray-200'  },
}

// ─── Composant principal ───────────────────────────────────────────────────────

export default function ExecuterOTPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const idOT   = Number(id)

  // Auth
  const user = useSelector((s: any) => s.auth.user)

  // OT
  const [ot,      setOT]      = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Actions
  const [showModalDemarrer, setShowModalDemarrer] = useState(false)
  const [demarrantOT,       setDemarrantOT]       = useState(false)
  const [soumettantFB,      setSoumettantFB]      = useState(false)

  // Réservations
  const [reservations,   setReservations]   = useState<Reservation[]>([])
  const [loadingResas,   setLoadingResas]   = useState(false)
  const [searchPiece,    setSearchPiece]    = useState('')
  const [resultsPiece,   setResultsPiece]   = useState<PieceStock[]>([])
  const [searchingPiece, setSearchingPiece] = useState(false)
  const [pieceSelectee,  setPieceSelectee]  = useState<PieceStock | null>(null)
  const [qteResa,        setQteResa]        = useState(1)
  const [notesResa,      setNotesResa]      = useState('')
  const [reservant,      setReservant]      = useState(false)
  const [msgResa,        setMsgResa]        = useState<string | null>(null)

  // Feedback
  const [descTravail,      setDescTravail]      = useState('')
  const [observations,     setObservations]     = useState('')
  const [pieceRemplacee,   setPieceRemplacee]   = useState(false)

  // État du verrou (calculé par le backend)
  const [peutDemarrerInfo, setPeutDemarrerInfo] = useState<{
    peut_demarrer: boolean
    statut_ok    : boolean
    date_ok      : boolean
    pieces_ok    : boolean
    raisons      : string[]
    reservations : any[]
  } | null>(null)

  // ── Chargement initial ─────────────────────────────────────────────────────
  const chargerOT = useCallback(async () => {
    try {
      setLoading(true)
      const data = await otService.getById(idOT)
      setOT(data)
      // Préremplir feedback si déjà saisi
      if (data?.intervention?.description_travail) setDescTravail(data.intervention.description_travail)
      if (data?.intervention?.observations)        setObservations(data.intervention.observations)
    } catch {
      setError('Impossible de charger cet OT.')
    } finally {
      setLoading(false)
    }
  }, [idOT])

  const chargerPeutDemarrer = useCallback(async () => {
    try {
      const res = await api.get(`/ot/${idOT}/peut-demarrer`)
      setPeutDemarrerInfo(res.data)
    } catch {
      // silencieux
    }
  }, [idOT])

  const chargerReservations = useCallback(async () => {
    try {
      setLoadingResas(true)
      const data = await stockService.listReservations({ id_ot: idOT, limit: 50 })
      setReservations(data?.data ?? [])
    } catch {
      // silencieux
    } finally {
      setLoadingResas(false)
    }
  }, [idOT])

  useEffect(() => {
    chargerOT()
    chargerReservations()
    chargerPeutDemarrer()
  }, [chargerOT, chargerReservations, chargerPeutDemarrer])

  // Re-fetch quand reservations changent
  useEffect(() => {
    chargerPeutDemarrer()
  }, [reservations, chargerPeutDemarrer])

  // ── Recherche de piece ─────────────────────────────────────────────────────
  useEffect(() => {
    // Pas de recherche si moins de 2 caracteres
    if (searchPiece.length < 2) { setResultsPiece([]); return }
    
    const t = setTimeout(async () => {
      try {
        setSearchingPiece(true)
        const data = await stockService.search(searchPiece)
        setResultsPiece(data ?? [])
      } catch {
        setResultsPiece([])
      } finally {
        setSearchingPiece(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [searchPiece])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDemarrer = async () => {
    if (!user) return
    if (!descTravail.trim()) {
      alert('Veuillez decrire le travail realise.')
      return
    }
    try {
      setDemarrantOT(true)
      await otService.demarrer(idOT, {
        id_realisateur      : user.id_user,
        type_travail        : ot.type_ot,
        description_travail : descTravail.trim(),
        observations        : observations.trim() || undefined,
        composante_remplacee: pieceRemplacee && ot?.equipement?.id_equipement ? ot.equipement.id_equipement : undefined,
      })
      setShowModalDemarrer(false)
      await chargerOT()
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Erreur lors du demarrage de l'OT"
      alert(msg)
    } finally {
      setDemarrantOT(false)
    }
  }

  const reserverPiece = async () => {
    if (!pieceSelectee || !user) return
    try {
      setReservant(true)
      setMsgResa(null)
      await interventionService.reserverPiece(idOT, {
        id_piece          : pieceSelectee.id_piece,
        id_mecanicien     : user.id_user,
        quantite_demandee : qteResa,
        notes             : notesResa,
      })
      setPieceSelectee(null)
      setSearchPiece('')
      setResultsPiece([])
      setQteResa(1)
      setNotesResa('')
      setMsgResa('✓ Réservation envoyée au gestionnaire de stock.')
      await chargerReservations()
    } catch {
      setMsgResa('✗ Erreur lors de la réservation.')
    } finally {
      setReservant(false)
    }
  }

  const terminerOT = async () => {
    if (!user) return
    if (!descTravail.trim()) {
      alert('Veuillez décrire le travail réalisé avant de terminer.')
      return
    }
    if (!window.confirm("Confirmer la soumission ? L'OT passera au statut « Terminé » et sera envoyé au chef d'équipe."))
      return

    try {
      setSoumettantFB(true)
      await interventionService.soumettreFeedback(idOT, {
        id_realisateur     : user.id_user,
        type_travail       : ot.type_ot,
        description_travail: descTravail.trim(),
        observations       : observations.trim() || undefined,
      })
      await chargerOT()
    } catch {
      alert("Erreur lors de la soumission du feedback.")
    } finally {
      setSoumettantFB(false)
    }
  }

  const resoumettre = async () => {
    if (!user || !descTravail.trim()) {
      alert('Veuillez décrire le travail réalisé.')
      return
    }
    if (!window.confirm('Confirmer la re-soumission ? Votre chef d\'équipe sera notifié pour re-valider.')) return
    try {
      setSoumettantFB(true)
      await api.post(`/interventions/ot/${idOT}/resoumettre`, {
        description_travail : descTravail.trim(),
        observations        : observations.trim() || undefined,
        type_travail        : ot.type_ot,
      })
      await chargerOT()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la re-soumission.')
    } finally {
      setSoumettantFB(false)
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-blue-500" size={40} />
    </div>
  )

  if (error || !ot) return (
    <div className="p-6 text-center text-red-500">
      <AlertCircle className="mx-auto mb-2" size={40} />
      <p>{error ?? 'OT introuvable.'}</p>
      <button onClick={() => router.back()} className="mt-4 text-blue-600 underline">
        Retour
      </button>
    </div>
  )

  const estAssigne  = ot.statut === 'ASSIGNE'
  const estEnCours  = ot.statut === 'EN_COURS'
  const estRework   = ot.statut === 'REWORK'
  const estTermine  = ['TERMINE', 'VALIDE_CE', 'VALIDE_HSE', 'ARCHIVE'].includes(ot.statut)
  const peutAgir    = estAssigne || estEnCours || estRework

  // Verrou : peut-on démarrer ?
  // Backend = source de vérité. Tant qu'on n'a pas reçu sa réponse, on bloque.
  const peutDemarrer       = peutDemarrerInfo?.peut_demarrer === true
  const raisonsDeBlocage   = peutDemarrerInfo?.raisons ?? []
  const datePrevueObj      = ot?.date_prevue ? new Date(ot.date_prevue) : null

  return (
    <div className="space-y-6 pb-6">

      {/* ── En-tête bleu ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#003B7A]/20 rounded-full blur-3xl"/>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Wrench size={32} className="text-white"/>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-white/10 transition">
                  <ArrowLeft size={18} />
                </button>
                <h1 className="text-2xl font-bold tracking-tight">Exécution — {ot.numero_ot}</h1>
              </div>
              <p className="text-blue-200 text-sm mt-1">
                {ot.equipement?.description ?? ot.equipement?.equipment_code ?? '—'}
              </p>
              {ot.equipement?.machine_racine_code && (
                <p className="text-blue-300 text-xs mt-0.5">
                  Machine racine : {ot.equipement.machine_racine_code}{ot.equipement.machine_racine_desc ? ` — ${ot.equipement.machine_racine_desc}` : ''}
                </p>
              )}
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border border-white/20 backdrop-blur-sm ${
            ot.statut === 'ASSIGNE'  ? 'bg-blue-500/30 text-blue-100'   :
            ot.statut === 'EN_COURS' ? 'bg-purple-500/30 text-purple-100' :
            ot.statut === 'TERMINE'  ? 'bg-amber-500/30 text-amber-100'  :
            'bg-white/10 text-blue-200'
          }`}>
            {ot.statut?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* ── Infos OT ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        {[
          ['Classe',         ot.classe],
          ['Priorité',       ot.priorite],
          ['Type OT',        ot.type_ot],
          ['Composante',     ot.equipement ? `${ot.equipement.equipment_code} — ${ot.equipement.description}` : '—'],
          ['Machine Racine', ot.equipement?.machine_racine_code ? `${ot.equipement.machine_racine_code} — ${ot.equipement.machine_racine_desc}` : '—'],
          ['Date prévue',    ot.date_prevue ? new Date(ot.date_prevue).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'],
          ['Durée estim.',   ot.duree_estimee ? `${ot.duree_estimee} min` : '—'],
          ['Description',    ot.description_ot ?? '—'],
        ].map(([label, val]) => (
          <div key={label as string}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="font-medium text-gray-800">{val ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* ── Banner REWORK ── */}
      {estRework && ot.motif_rejet && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} className="text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-red-800">Intervention à reprendre</p>
              <p className="text-sm text-red-700 mt-0.5">
                Votre intervention a été rejetée. Corrigez votre saisie ci-dessous puis re-soumettez.
              </p>
              <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Motif</p>
                <p className="text-sm text-gray-800">{ot.motif_rejet}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bouton Démarrer (ASSIGNE) ── */}
      {estAssigne && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                peutDemarrer ? 'bg-emerald-50' : 'bg-amber-50'
              }`}>
                <Play size={22} className={peutDemarrer ? 'text-emerald-600' : 'text-amber-600'} />
              </div>
              <div className="flex-1">
                <p className={`font-bold text-lg ${peutDemarrer ? 'text-gray-800' : 'text-gray-700'}`}>
                  {peutDemarrer ? 'Prêt à commencer' : 'Conditions non remplies'}
                </p>

                {/* Checklist de prérequis */}
                <div className="mt-3 space-y-1.5 text-sm">
                  {peutDemarrerInfo && (
                    <>
                      <div className="flex items-center gap-2">
                        {peutDemarrerInfo.date_ok ? (
                          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                        ) : (
                          <Calendar size={16} className="text-amber-600 shrink-0" />
                        )}
                        <span className={peutDemarrerInfo.date_ok ? 'text-gray-700' : 'text-amber-700 font-medium'}>
                          {peutDemarrerInfo.date_ok
                            ? `Date prévue atteinte (${datePrevueObj?.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })})`
                            : `OT prévu le ${datePrevueObj?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {peutDemarrerInfo.pieces_ok ? (
                          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                        ) : (
                          <Package size={16} className="text-amber-600 shrink-0" />
                        )}
                        <span className={peutDemarrerInfo.pieces_ok ? 'text-gray-700' : 'text-amber-700 font-medium'}>
                          {peutDemarrerInfo.pieces_ok
                            ? (peutDemarrerInfo.reservations?.length > 0
                                ? `${peutDemarrerInfo.reservations.length} pièce(s) livrée(s)`
                                : 'Aucune pièce nécessaire')
                            : `${peutDemarrerInfo.reservations?.filter((r:any) => !r.livree).length ?? 0} pièce(s) en attente de livraison`
                          }
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowModalDemarrer(true)}
              disabled={!peutDemarrer}
              title={!peutDemarrer ? raisonsDeBlocage.join(' • ') : ''}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm shrink-0 ${
                peutDemarrer
                  ? 'bg-[#003B7A] hover:bg-[#002a5a] text-white hover:shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Play size={16} />
              Commencer
            </button>
          </div>
        </div>
      )}

      {/* ── Modal Demarrer ── */}
      {showModalDemarrer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Play size={18} className="text-[#003B7A]" />
                Commencer l&apos;intervention
              </h2>
              <button onClick={() => setShowModalDemarrer(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Composante concernée</label>
              <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-800 border border-gray-200">
                {ot.equipement?.equipment_code ?? '—'} — {ot.equipement?.description ?? ''}
                {ot.equipement?.machine_racine_code && (
                  <span className="text-gray-400 ml-2">| Machine: {ot.equipement.machine_racine_code}</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Type de travail</label>
              <p className="px-3 py-2 bg-blue-50 rounded-lg text-sm font-bold text-[#003B7A] border border-blue-200 uppercase tracking-wider">
                {ot.type_ot ?? '—'}
              </p>
            </div>

            <label className="flex items-center gap-2.5 text-sm cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
              <input
                type="checkbox"
                checked={pieceRemplacee}
                onChange={e => setPieceRemplacee(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#003B7A] focus:ring-[#003B7A]"
              />
              <span className="text-gray-700 font-medium">Marquer cette composante comme remplacée</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Description du travail réalisé <span className="text-red-500">*</span>
              </label>
              <textarea
                value={descTravail}
                onChange={e => setDescTravail(e.target.value)}
                rows={4}
                placeholder="Décrivez précisément ce qui a été fait..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Observations (optionnel)</label>
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                rows={2}
                placeholder="Anomalies observées, recommandations..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModalDemarrer(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">
                Annuler
              </button>
              <button onClick={handleDemarrer} disabled={demarrantOT || !descTravail.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-[#003B7A] hover:bg-[#002a5a] text-white rounded-lg font-bold text-sm transition disabled:opacity-50 shadow-sm">
                {demarrantOT ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Démarrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Réservation de pièces ── */}
      {(estAssigne || estEnCours) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Package size={18} className="text-[#003B7A]" />
            Pièces disponibles en stock
          </h2>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-gray-400" />
            <input type="text"
              placeholder="Rechercher par code, désignation..."
              value={searchPiece} onChange={e => setSearchPiece(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003B7A]/20 focus:border-[#003B7A] focus:bg-white transition-all"
            />
            {searchingPiece && <Loader2 size={14} className="absolute right-3 top-3 text-gray-400 animate-spin" />}
          </div>

          {resultsPiece.length > 0 && !pieceSelectee && (
            <ul className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {resultsPiece.map(p => (
                <li key={p.id_piece}
                  onClick={() => { setPieceSelectee(p); setSearchPiece(p.designation) }}
                  className="px-3 py-2.5 cursor-pointer hover:bg-blue-50 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-800">{p.designation}</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Stock: <span className="font-mono">{p.code_stock}</span>
                        {p.composantes_liees && p.composantes_liees.length > 0 && (
                          <span className="ml-2 text-blue-600">
                            | {p.composantes_liees.map(c => 
                              c.machine_racine_code 
                                ? `${c.equipment_code} (${c.machine_racine_code})` 
                                : c.equipment_code
                            ).join(', ')}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`text-xs font-mono whitespace-nowrap ${p.quantite === 0 ? 'text-red-500' : p.quantite <= p.seuil_alerte ? 'text-orange-500' : 'text-gray-600'}`}>
                      Qte: {p.quantite}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pieceSelectee && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-800">{pieceSelectee.designation}</p>
                  <p className="text-xs text-blue-600 mt-0.5">{pieceSelectee.code_stock} — Stock dispo : {pieceSelectee.quantite}</p>
                </div>
                <button onClick={() => { setPieceSelectee(null); setSearchPiece('') }} className="text-blue-400 hover:text-blue-600">✕</button>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-700 font-medium whitespace-nowrap">Quantité :</label>
                <input type="number" min={1} max={pieceSelectee.quantite} value={qteResa} onChange={e => setQteResa(Number(e.target.value))}
                  className="w-20 px-2 py-1 border border-blue-300 rounded-lg text-sm text-center bg-white" />
              </div>
              <textarea placeholder="Notes (optionnel)..." value={notesResa} onChange={e => setNotesResa(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm resize-none bg-white" />
              <button onClick={reserverPiece} disabled={reservant || pieceSelectee.quantite === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#003B7A] hover:bg-[#002a5a] text-white rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-sm">
                {reservant ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {pieceSelectee.quantite === 0 ? 'Rupture de stock' : 'Envoyer la réservation'}
              </button>
            </div>
          )}

          {msgResa && (
            <p className={`text-sm font-medium ${msgResa.startsWith('✓') ? 'text-blue-600' : 'text-red-600'}`}>
              {msgResa}
            </p>
          )}

          {reservations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mes réservations</p>
              <ul className="space-y-2">
                {reservations.map(r => {
                  const s = STATUT_RESA[r.statut] ?? { label: r.statut, color: 'text-gray-500 bg-gray-50 border-gray-200' }
                  return (
                    <li key={r.id_reservation} className="flex items-center justify-between text-sm border border-gray-200 rounded-xl px-4 py-2.5">
                      <span className="font-medium text-gray-800">{r.designation}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">×{r.quantite_demandee}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>{s.label}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Compte rendu (EN_COURS ou REWORK) ── */}
      {(estEnCours || estRework) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            {estRework ? <RotateCcw size={18} className="text-orange-600" /> : <ClipboardList size={18} className="text-[#003B7A]" />}
            {estRework ? 'Reprise de l\'intervention' : 'Compte rendu d\'intervention'}
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Type de travail</label>
            <p className="px-3 py-2 bg-blue-50 rounded-lg text-sm font-bold text-[#003B7A] border border-blue-200 uppercase tracking-wider">
              {ot.type_ot ?? '—'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Description du travail réalisé <span className="text-red-500">*</span>
            </label>
            <textarea value={descTravail} onChange={e => setDescTravail(e.target.value)} rows={4}
              placeholder="Décrivez précisément ce qui a été fait..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003B7A]/20 focus:border-[#003B7A] focus:bg-white transition-all resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Observations (optionnel)</label>
            <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2}
              placeholder="Anomalies observées, recommandations..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003B7A]/20 focus:border-[#003B7A] focus:bg-white transition-all resize-none" />
          </div>

          <button
            onClick={estRework ? resoumettre : terminerOT}
            disabled={soumettantFB || !descTravail.trim()}
            className={`w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl font-bold text-sm transition disabled:opacity-50 shadow-sm ${
              estRework ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[#003B7A] hover:bg-[#002a5a]'
            }`}
          >
            {soumettantFB ? <Loader2 size={16} className="animate-spin" /> : (estRework ? <RotateCcw size={16} /> : <CheckCircle size={16} />)}
            {estRework ? 'Re-soumettre la saisie corrigée' : 'Terminer et soumettre pour validation'}
          </button>
        </div>
      )}

      {/* ── État final ── */}
      {estTermine && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center space-y-3 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#003B7A]/10 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-[#003B7A]" />
          </div>
          <p className="font-bold text-lg text-gray-800">OT soumis</p>
          <p className="text-sm text-gray-500">En attente de validation du chef d&apos;équipe.</p>
          <p className="text-xs text-gray-400">Statut actuel : <strong className="text-[#003B7A]">{ot.statut?.replace('_', ' ')}</strong></p>
          <button onClick={() => router.push('/ot/mes-ot')}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#003B7A] hover:bg-[#002a5a] text-white rounded-xl font-bold text-sm transition shadow-sm mt-2">
            Retour à mes OT
          </button>
        </div>
      )}

      {/* ── Non actionnable ── */}
      {!peutAgir && !estTermine && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
          <Wrench className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 text-sm font-medium">
            Cet OT n&apos;est pas dans un état qui permet une action
          </p>
          <p className="text-xs text-gray-400 mt-1">Statut : {ot.statut}</p>
          <button onClick={() => router.back()} className="mt-4 text-[#003B7A] font-semibold text-sm hover:underline">
            Retour
          </button>
        </div>
      )}
    </div>
  )
}
