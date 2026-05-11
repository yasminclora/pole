'use client'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { planningService } from '@/services/planningService'
import { useWebSocket    } from '@/hooks/useWebSocket'
import { QUART_MAP } from '@/utils/planning'
import {
  ArrowLeftRight, Check, Loader2, Clock,
  X, Plus, AlertTriangle
} from 'lucide-react'

interface Demande {
  id                   : number
  date_echange         : string
  quart_souhaite       : string
  motif                : string | null
  statut               : string
  motif_refus          : string | null
  nom_equipe_cible     : string | null
  created_at           : string
}

const QUARTS = ['Matin','Après-midi','Nuit','Repos']

const inputClass = `w-full px-3 py-2.5 rounded-xl border
  border-gray-200 dark:border-gray-700
  bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`

export default function DemandesPage() {
  const authUser   = useSelector((s: RootState) => s.auth.user)
  const idEquipe   = Number(authUser?.id_equipe)

  const [demandes,   setDemandes]   = useState<Demande[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)

  // Formulaire
  const [dateEchange,   setDateEchange]    = useState('')
  const [quartSouhaite, setQuartSouhaite]  = useState('Matin')
  const [motif,         setMotif]          = useState('')
  const [saving,        setSaving]         = useState(false)
  const [erreur,        setErreur]         = useState('')

  const charger = async () => {
    setLoading(true)
    try {
      const data = await planningService.mesDemandes(idEquipe)
      setDemandes(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (idEquipe) charger() }, [idEquipe])

  useWebSocket((msg) => {
    if (
      msg.type === 'DEMANDE_ECHANGE_ACCEPTEE' ||
      msg.type === 'DEMANDE_ECHANGE_REFUSEE'
    ) {
      charger()
    }
  })

  const handleSubmit = async () => {
    if (!dateEchange) { setErreur('La date est obligatoire'); return }
    setSaving(true); setErreur('')
    try {
      await planningService.creerDemande({
        id_equipe_demandeur : idEquipe,
        date_echange        : dateEchange,
        quart_souhaite      : quartSouhaite,
        motif               : motif || undefined,
      })
      setShowForm(false)
      setDateEchange(''); setQuartSouhaite('Matin'); setMotif('')
      await charger()
    } catch (err: any) {
      setErreur(err.response?.data?.detail ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const enAttente  = demandes.filter(d => d.statut === 'EN_ATTENTE')
  const traitees   = demandes.filter(d => d.statut !== 'EN_ATTENTE')

  const StatutBadge = ({ statut }: { statut: string }) => {
    if (statut === 'EN_ATTENTE') return (
      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                       font-medium bg-amber-100 dark:bg-amber-900/30
                       text-amber-700 dark:text-amber-300">
        <Clock size={10}/> En attente
      </span>
    )
    if (statut === 'ACCEPTE') return (
      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                       font-medium bg-green-100 dark:bg-green-900/30
                       text-green-700 dark:text-green-300">
        <Check size={10}/> Acceptée
      </span>
    )
    return (
      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                       font-medium bg-red-100 dark:bg-red-900/30
                       text-red-700 dark:text-red-300">
        <X size={10}/> Refusée
      </span>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600
                          flex items-center justify-center">
            <ArrowLeftRight size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Demandes d'échange
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Demandez un échange de quart à votre chef de pôle
            </p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl
                     bg-indigo-600 hover:bg-indigo-700 text-white
                     text-sm font-medium transition-all">
          <Plus size={15}/>
          Nouvelle demande
        </button>
      </div>

      {/* Formulaire nouvelle demande */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Nouvelle demande
            </h2>
            <button onClick={() => setShowForm(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center
                         text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={16}/>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Date souhaitée
              </label>
              <input type="date" value={dateEchange}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setDateEchange(e.target.value)}
                className={inputClass}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Quart souhaité
              </label>
              <select value={quartSouhaite}
                onChange={e => setQuartSouhaite(e.target.value)}
                className={inputClass}>
                {QUARTS.map(q => {
                  const info = QUART_MAP[q]
                  return (
                    <option key={q} value={q}>
                      {info.icone} {q}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700
                              dark:text-gray-300 mb-1.5">
              Motif
              <span className="text-gray-400 font-normal ml-1 text-xs">
                (optionnel mais recommandé)
              </span>
            </label>
            <textarea value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Expliquez la raison de votre demande..."
              rows={3}
              className={inputClass}/>
          </div>

          {/* Aperçu */}
          {quartSouhaite && (
            <div className={`flex items-center gap-3 p-3 rounded-xl border
                            ${QUART_MAP[quartSouhaite]?.bg}
                            ${QUART_MAP[quartSouhaite]?.border}`}>
              <span className="text-2xl">{QUART_MAP[quartSouhaite]?.icone}</span>
              <div>
                <p className={`text-sm font-medium ${QUART_MAP[quartSouhaite]?.couleur}`}>
                  Vous demandez le quart : {quartSouhaite}
                </p>
                {dateEchange && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Le {new Date(dateEchange).toLocaleDateString('fr-FR',{
                      weekday:'long', day:'numeric', month:'long'
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {erreur && <p className="text-red-500 text-xs">⚠ {erreur}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border border-gray-200
                         dark:border-gray-700 text-gray-600 dark:text-gray-400
                         text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
              Annuler
            </button>
            <button onClick={handleSubmit}
              disabled={saving || !dateEchange}
              className="flex items-center gap-2 px-5 py-2 rounded-xl
                         bg-indigo-600 hover:bg-indigo-700 text-white text-sm
                         font-medium disabled:opacity-40 transition-all">
              {saving
                ? <><Loader2 size={14} className="animate-spin"/> Envoi...</>
                : <><ArrowLeftRight size={14}/> Envoyer la demande</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Demandes en attente */}
      {enAttente.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              En attente
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs
                               bg-amber-100 dark:bg-amber-900/30
                               text-amber-700 dark:text-amber-300">
                {enAttente.length}
              </span>
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {enAttente.map(d => (
              <div key={d.id}
                className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center
                                  justify-center text-lg border
                                  ${QUART_MAP[d.quart_souhaite]?.bg}
                                  ${QUART_MAP[d.quart_souhaite]?.border}`}>
                    {QUART_MAP[d.quart_souhaite]?.icone}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {d.quart_souhaite} — {new Date(d.date_echange).toLocaleDateString('fr-FR')}
                    </p>
                    {d.motif && (
                      <p className="text-xs text-gray-400">{d.motif}</p>
                    )}
                  </div>
                </div>
                <StatutBadge statut={d.statut}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique */}
      {traitees.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Historique
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {traitees.map(d => (
              <div key={d.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center
                                    justify-center border
                                    ${QUART_MAP[d.quart_souhaite]?.bg}
                                    ${QUART_MAP[d.quart_souhaite]?.border}`}>
                      <span className={`text-sm font-bold
                                       ${QUART_MAP[d.quart_souhaite]?.couleur}`}>
                        {QUART_MAP[d.quart_souhaite]?.lettre}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {d.quart_souhaite} — {new Date(d.date_echange).toLocaleDateString('fr-FR')}
                      </p>
                      {d.statut === 'ACCEPTE' && d.nom_equipe_cible && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          ⇄ Échange avec {d.nom_equipe_cible}
                        </p>
                      )}
                      {d.statut === 'REFUSE' && d.motif_refus && (
                        <p className="text-xs text-red-500">
                          Motif : {d.motif_refus}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatutBadge statut={d.statut}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="text-blue-500 animate-spin"/>
        </div>
      )}

      {!loading && demandes.length === 0 && !showForm && (
        <div className="text-center py-16 bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-800 rounded-2xl">
          <ArrowLeftRight size={36}
            className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Aucune demande d'échange
          </p>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                       bg-indigo-600 hover:bg-indigo-700 text-white text-sm
                       font-medium mx-auto transition-all">
            <Plus size={15}/> Faire une demande
          </button>
        </div>
      )}
    </div>
  )
}