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
  Search, Plus, ClipboardList, AlertCircle, Wrench,
} from 'lucide-react'

import { otService }           from '@/services/otService'
import { interventionService } from '@/services/interventionService'
import { stockService }        from '@/services/stockService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PieceStock {
  id_piece    : number
  code_stock  : string
  designation : string
  quantite    : number
  unite       : string
  seuil_alerte: number
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

const TYPE_TRAVAIL_OPTIONS = [
  { value: 'VERIFICATION',   label: 'Vérification' },
  { value: 'NETTOYAGE',      label: 'Nettoyage' },
  { value: 'REMPLACEMENT',   label: 'Remplacement de pièce' },
  { value: 'REPARATION',     label: 'Réparation' },
  { value: 'REGLAGE',        label: 'Réglage' },
]

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
  const [demarrantOT,    setDemarrantOT]    = useState(false)
  const [soumettantFB,   setSoumettantFB]   = useState(false)

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
  const [typeTravail,      setTypeTravail]      = useState('REPARATION')
  const [descTravail,      setDescTravail]      = useState('')
  const [observations,     setObservations]     = useState('')

  // ── Chargement initial ─────────────────────────────────────────────────────
  const chargerOT = useCallback(async () => {
    try {
      setLoading(true)
      const data = await otService.getById(idOT)
      setOT(data)
    } catch {
      setError('Impossible de charger cet OT.')
    } finally {
      setLoading(false)
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
  }, [chargerOT, chargerReservations])

  // ── Recherche de pièce ─────────────────────────────────────────────────────
  useEffect(() => {
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

  const demarrerOT = async () => {
    if (!user) return
    try {
      setDemarrantOT(true)
      await otService.demarrer(idOT, user.id_user)
      await chargerOT()
    } catch {
      alert("Erreur lors du démarrage de l'OT.")
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
        type_travail       : typeTravail,
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
  const estTermine  = ['TERMINE', 'VALIDE_CE', 'VALIDE_HSE', 'ARCHIVE'].includes(ot.statut)
  const peutAgir    = estAssigne || estEnCours

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Exécution — {ot.numero_ot}
          </h1>
          <p className="text-sm text-gray-500">
            {ot.equipement_nom ?? ot.equipement_code ?? '—'}
          </p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold border ${
          ot.statut === 'ASSIGNE'  ? 'bg-blue-50   text-blue-700   border-blue-200'   :
          ot.statut === 'EN_COURS' ? 'bg-purple-50 text-purple-700 border-purple-200' :
          ot.statut === 'TERMINE'  ? 'bg-amber-50  text-amber-700  border-amber-200'  :
          'bg-gray-50 text-gray-500 border-gray-200'
        }`}>
          {ot.statut?.replace('_', ' ')}
        </span>
      </div>

      {/* ── Infos OT ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 grid grid-cols-2 gap-4 text-sm">
        {[
          ['Classe',      ot.classe],
          ['Priorité',    ot.priorite],
          ['Type',        ot.type_ot],
          ['Date prévue', ot.date_prevue ? new Date(ot.date_prevue).toLocaleDateString('fr-FR') : '—'],
          ['Durée estim.', ot.duree_estimee ? `${ot.duree_estimee} min` : '—'],
          ['Description', ot.description_ot ?? '—'],
        ].map(([label, val]) => (
          <div key={label as string}>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">{val ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* ── Bouton Démarrer ── */}
      {estAssigne && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-700 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-800 dark:text-blue-300">Prêt à commencer ?</p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Cliquez sur « Démarrer » pour passer l'OT en cours.
            </p>
          </div>
          <button
            onClick={demarrerOT}
            disabled={demarrantOT}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
          >
            {demarrantOT
              ? <Loader2 size={16} className="animate-spin" />
              : <Play size={16} />
            }
            Démarrer
          </button>
        </div>
      )}

      {/* ── Section Réservation de pièces (visible si EN_COURS) ── */}
      {estEnCours && (
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Package size={18} className="text-blue-500" />
            Réserver des pièces
          </h2>

          {/* Recherche */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Chercher par code ou désignation…"
              value={searchPiece}
              onChange={e => setSearchPiece(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {searchingPiece && (
              <Loader2 size={14} className="absolute right-3 top-3 text-gray-400 animate-spin" />
            )}
          </div>

          {/* Résultats de recherche */}
          {resultsPiece.length > 0 && !pieceSelectee && (
            <ul className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
              {resultsPiece.map(p => (
                <li
                  key={p.id_piece}
                  onClick={() => { setPieceSelectee(p); setSearchPiece(p.designation) }}
                  className="px-3 py-2.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 text-sm flex justify-between"
                >
                  <span className="font-medium">{p.designation}</span>
                  <span className={`text-xs font-mono ${p.quantite === 0 ? 'text-red-500' : p.quantite <= p.seuil_alerte ? 'text-orange-500' : 'text-green-600'}`}>
                    {p.code_stock} — Stock : {p.quantite}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Formulaire de réservation */}
          {pieceSelectee && (
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-blue-800 dark:text-blue-300">{pieceSelectee.designation}</p>
                  <p className="text-xs text-blue-600">{pieceSelectee.code_stock} — Stock dispo : {pieceSelectee.quantite}</p>
                </div>
                <button onClick={() => { setPieceSelectee(null); setSearchPiece('') }} className="text-blue-400 hover:text-blue-600 text-lg">✕</button>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm text-blue-700 dark:text-blue-400 font-medium whitespace-nowrap">
                  Quantité :
                </label>
                <input
                  type="number"
                  min={1}
                  max={pieceSelectee.quantite}
                  value={qteResa}
                  onChange={e => setQteResa(Number(e.target.value))}
                  className="w-20 px-2 py-1 border border-blue-300 rounded text-sm text-center"
                />
              </div>
              <textarea
                placeholder="Notes (optionnel)…"
                value={notesResa}
                onChange={e => setNotesResa(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm resize-none"
              />
              <button
                onClick={reserverPiece}
                disabled={reservant || pieceSelectee.quantite === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {reservant ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {pieceSelectee.quantite === 0 ? 'Rupture de stock' : 'Envoyer la réservation'}
              </button>
            </div>
          )}

          {msgResa && (
            <p className={`text-sm font-medium ${msgResa.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
              {msgResa}
            </p>
          )}

          {/* Liste des réservations */}
          {reservations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Mes réservations pour cet OT
              </p>
              <ul className="space-y-2">
                {reservations.map(r => {
                  const s = STATUT_RESA[r.statut] ?? { label: r.statut, color: 'text-gray-500 bg-gray-50 border-gray-200' }
                  return (
                    <li key={r.id_reservation} className="flex items-center justify-between text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                      <span className="font-medium">{r.designation}</span>
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
        </section>
      )}

      {/* ── Section Feedback (visible si EN_COURS) ── */}
      {estEnCours && (
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <ClipboardList size={18} className="text-green-500" />
            Compte rendu d&apos;intervention
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type de travail <span className="text-red-500">*</span>
            </label>
            <select
              value={typeTravail}
              onChange={e => setTypeTravail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {TYPE_TRAVAIL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description du travail réalisé <span className="text-red-500">*</span>
            </label>
            <textarea
              value={descTravail}
              onChange={e => setDescTravail(e.target.value)}
              rows={4}
              placeholder="Décrivez précisément ce qui a été fait…"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Observations (optionnel)
            </label>
            <textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              rows={2}
              placeholder="Anomalies observées, recommandations…"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Bouton Terminer */}
          <button
            onClick={terminerOT}
            disabled={soumettantFB || !descTravail.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition disabled:opacity-50"
          >
            {soumettantFB
              ? <Loader2 size={16} className="animate-spin" />
              : <CheckCircle size={16} />
            }
            Terminer l&apos;OT et soumettre au chef d&apos;équipe
          </button>
        </section>
      )}

      {/* ── État final (OT terminé ou archivé) ── */}
      {estTermine && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-700 rounded-xl p-5 text-center space-y-2">
          <CheckCircle className="mx-auto text-green-500" size={36} />
          <p className="font-semibold text-green-800 dark:text-green-300">
            OT soumis — en attente de validation du chef d&apos;équipe.
          </p>
          <p className="text-sm text-green-600">Statut actuel : <strong>{ot.statut?.replace('_', ' ')}</strong></p>
          <button
            onClick={() => router.push('/dashboard/ot/mes-ot')}
            className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
          >
            Retour à mes OT
          </button>
        </div>
      )}

      {/* OT non actionnable */}
      {!peutAgir && !estTermine && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-center">
          <Wrench className="mx-auto text-gray-400 mb-2" size={32} />
          <p className="text-gray-500 text-sm">
            Cet OT n&apos;est pas dans un état qui permet une action ({ot.statut}).
          </p>
          <button onClick={() => router.back()} className="mt-3 text-blue-600 underline text-sm">
            Retour
          </button>
        </div>
      )}
    </div>
  )
}
