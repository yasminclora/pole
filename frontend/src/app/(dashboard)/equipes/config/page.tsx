'use client'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { planningService } from '@/services/planningService'
import { equipesService  } from '@/services/equipesService'
import { useWebSocket    } from '@/hooks/useWebSocket'
import { QUART_MAP, JOURS_COURTS, getQuartInfo } from '@/utils/planning'
import { Settings, Check, Loader2, AlertTriangle, ArrowLeftRight, X } from 'lucide-react'

interface Config {
  date_debut     : string
  position_alpha : number
}

interface Demande {
  id                   : number
  id_equipe_demandeur  : number
  nom_equipe_demandeur : string
  date_echange         : string
  quart_souhaite       : string
  motif                : string | null
  statut               : string
  motif_refus          : string | null
  nom_equipe_cible     : string | null
}

interface Equipe {
  id_equipe               : number
  nom_equipe              : string
  id_pole                 : number
  date_reference_cycle    : string | null
  position_initiale_cycle : number
}

const POSITIONS = [
  { value: 0, label: '☀ Matin'       },
  { value: 2, label: '🌅 Après-midi' },
  { value: 4, label: '🌙 Nuit'       },
  { value: 6, label: '— Repos'       },
]

const inputClass = `w-full px-3 py-2.5 rounded-xl border
  border-gray-200 dark:border-gray-700
  bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`

export default function ConfigPage() {
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idPole   = Number(authUser?.id_pole)
  const idUser   = Number(authUser?.id_user)

  const [config,        setConfig]        = useState<Config | null>(null)
  const [equipes,       setEquipes]       = useState<Equipe[]>([])
  const [demandes,      setDemandes]      = useState<Demande[]>([])
  const [loading,       setLoading]       = useState(true)
  const [dateDebut,     setDateDebut]     = useState('')
  const [positionAlpha, setPositionAlpha] = useState(0)
  const [savingConfig,  setSavingConfig]  = useState(false)
  const [succesConfig,  setSuccesConfig]  = useState(false)
  const [errConfig,     setErrConfig]     = useState('')
  const [demandeRefus,  setDemandeRefus]  = useState<Demande | null>(null)
  const [motifRefus,    setMotifRefus]    = useState('')
  const [savingRefus,   setSavingRefus]   = useState(false)
  const [savingAccept,  setSavingAccept]  = useState<number | null>(null)

  const charger = async () => {
    setLoading(true)
    try {
      const [cfg, eqs, dems] = await Promise.all([
        planningService.getConfig(idPole),
        equipesService.parPole(idPole),
        planningService.demandesPole(idPole),
      ])
      setConfig(cfg)
      setEquipes(eqs)
      setDemandes(dems)
      if (cfg) {
        setDateDebut(cfg.date_debut)
        setPositionAlpha(cfg.position_alpha)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (idPole) charger() }, [idPole])

  useWebSocket((msg) => {
    if (msg.type === 'DEMANDE_ECHANGE_CREEE' && msg.payload.id_pole === idPole) {
      charger()
    }
    if (msg.type === 'CONFIG_PLANNING_MISE_A_JOUR' && msg.payload.id_pole === idPole) {
      setConfig({ date_debut: msg.payload.date_debut, position_alpha: msg.payload.position_alpha })
      if (msg.payload?.equipes) {
        setEquipes(prev => prev.map(eq => {
          const updated = msg.payload.equipes.find((e: any) => e.id_equipe === eq.id_equipe)
          return updated ? {
            ...eq,
            date_reference_cycle    : updated.date_reference_cycle,
            position_initiale_cycle : updated.position_initiale_cycle,
          } : eq
        }))
      }
    }
    if (
      msg.type === 'DEMANDE_ECHANGE_ACCEPTEE' ||
      msg.type === 'DEMANDE_ECHANGE_REFUSEE'
    ) {
      charger()
    }
  })

  const handleSaveConfig = async () => {
    if (!dateDebut) { setErrConfig('La date de référence est obligatoire'); return }
    setSavingConfig(true); setErrConfig('')
    try {
      const res = await planningService.creerConfig(idPole, {
        date_debut     : dateDebut,
        position_alpha : positionAlpha,
        cree_par       : idUser,
      })
      setConfig(res.config)
      if (res.equipes) {
        setEquipes(prev => prev.map(eq => {
          const updated = res.equipes.find((e: any) => e.id_equipe === eq.id_equipe)
          return updated ? {
            ...eq,
            date_reference_cycle    : updated.date_reference_cycle,
            position_initiale_cycle : updated.position_initiale_cycle,
          } : eq
        }))
      }
      setSuccesConfig(true)
      setTimeout(() => setSuccesConfig(false), 2000)
    } catch (err: any) {
      setErrConfig(err.response?.data?.detail ?? 'Erreur')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleAccepter = async (demande: Demande) => {
    setSavingAccept(demande.id)
    try {
      await planningService.accepterDemande(demande.id, {
        traite_par       : idUser,
        pour_chef_equipe : demande.id_equipe_demandeur,
      })
      await charger()
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erreur')
    } finally {
      setSavingAccept(null)
    }
  }

  const handleRefuser = async () => {
    if (!demandeRefus) return
    setSavingRefus(true)
    try {
      await planningService.refuserDemande(demandeRefus.id, {
        traite_par  : idUser,
        motif_refus : motifRefus,
      })
      setDemandeRefus(null); setMotifRefus('')
      await charger()
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erreur')
    } finally {
      setSavingRefus(false)
    }
  }

  // Aperçu 8 jours
  const apercu = dateDebut ? Array.from({ length: 8 }, (_, i) => {
    const d = new Date(dateDebut)
    d.setDate(d.getDate() + i)
    return {
      date   : d,
      equipes: equipes.map(eq => ({
        equipe: eq,
        info  : getQuartInfo(
          { date_debut: dateDebut, position_alpha: positionAlpha },
          eq, d, [], equipes
        )
      }))
    }
  }) : []

  const demandesEnAttente = demandes.filter(d => d.statut === 'EN_ATTENTE')
  const historiqueTraite  = demandes.filter(d => d.statut !== 'EN_ATTENTE')

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="text-blue-500 animate-spin"/>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Modal refus */}
      {demandeRefus && (
        <div className="fixed inset-0 bg-black/50 flex items-center
                        justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6
                          max-w-md w-full border border-gray-200
                          dark:border-gray-700 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Refuser la demande
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {demandeRefus.nom_equipe_demandeur} —{' '}
              {new Date(demandeRefus.date_echange).toLocaleDateString('fr-FR')}
            </p>
            <textarea value={motifRefus}
              onChange={e => setMotifRefus(e.target.value)}
              placeholder="Motif du refus (optionnel)..."
              rows={3}
              className={inputClass}/>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setDemandeRefus(null); setMotifRefus('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200
                           dark:border-gray-700 text-gray-600 dark:text-gray-400
                           text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Annuler
              </button>
              <button onClick={handleRefuser} disabled={savingRefus}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600
                           text-white text-sm font-medium disabled:opacity-40">
                {savingRefus
                  ? <Loader2 size={14} className="animate-spin mx-auto"/>
                  : 'Refuser'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600
                        flex items-center justify-center">
          <Settings size={22} className="text-white"/>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Configuration du planning
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Gérez le planning et les demandes d'échange
          </p>
        </div>
      </div>

      {/* Badge demandes en attente */}
      {demandesEnAttente.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl
                        bg-amber-50 dark:bg-amber-900/20
                        border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0"/>
          <p className="text-amber-700 dark:text-amber-300 text-sm font-medium">
            {demandesEnAttente.length} demande{demandesEnAttente.length > 1 ? 's' : ''} d'échange en attente
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Config de base ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Planning de base
            </h2>
            {config && (
              <span className="flex items-center gap-1.5 text-xs
                               bg-green-50 dark:bg-green-900/20
                               text-green-700 dark:text-green-300
                               px-2.5 py-1 rounded-lg border
                               border-green-200 dark:border-green-800">
                <Check size={12}/> Configuré
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Date de référence
              </label>
              <input type="date" value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
                className={inputClass}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Équipe Alpha commence en
              </label>
              <select value={positionAlpha}
                onChange={e => setPositionAlpha(Number(e.target.value))}
                className={inputClass}>
                {POSITIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Résultat du jour */}
          {dateDebut && equipes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500
                            dark:text-gray-400 mb-2">
                Quarts ce jour-là :
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {equipes
                  .slice()
                  .sort((a, b) => {
                    const ordre = ["Alpha","Bravo","Charlie","Delta"]
                    const na = a.nom_equipe.split(' ').pop() ?? ''
                    const nb = b.nom_equipe.split(' ').pop() ?? ''
                    return ordre.indexOf(na) - ordre.indexOf(nb)
                  })
                  .map(eq => {
                    const d    = new Date(dateDebut)
                    const info = getQuartInfo(
                      { date_debut: dateDebut, position_alpha: positionAlpha },
                      eq, d, [], equipes
                    )
                    return (
                      <div key={eq.id_equipe}
                        className={`flex flex-col items-center p-3 rounded-xl
                                   border ${info.bg} ${info.border}`}>
                        <span className={`text-xs font-medium mb-1 ${info.couleur}`}>
                          {eq.nom_equipe.split(' ').pop()}
                        </span>
                        <span className={`text-xl ${info.couleur}`}>
                          {info.icone}
                        </span>
                        <span className={`text-xs font-bold mt-0.5 ${info.couleur}`}>
                          {info.lettre}
                        </span>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          )}

          {/* Aperçu 8 jours */}
          {apercu.length > 0 && equipes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500
                            dark:text-gray-400 mb-2">
                Aperçu cycle (8 jours) :
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-gray-500 pb-1 pr-3 font-medium">
                        Équipe
                      </th>
                      {apercu.map(({ date }, i) => (
                        <th key={i} className="text-center text-gray-500 pb-1 px-1 font-medium">
                          <div>
                            {JOURS_COURTS[date.getDay() === 0 ? 6 : date.getDay() - 1]}
                          </div>
                          <div className="text-gray-700 dark:text-gray-300 font-bold">
                            {date.getDate()}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {equipes
                      .slice()
                      .sort((a, b) => {
                        const ordre = ["Alpha","Bravo","Charlie","Delta"]
                        const na = a.nom_equipe.split(' ').pop() ?? ''
                        const nb = b.nom_equipe.split(' ').pop() ?? ''
                        return ordre.indexOf(na) - ordre.indexOf(nb)
                      })
                      .map(eq => (
                        <tr key={eq.id_equipe}>
                          <td className="pr-3 py-1 text-gray-600 dark:text-gray-400
                                         font-medium whitespace-nowrap">
                            {eq.nom_equipe.split(' ').pop()}
                          </td>
                          {apercu.map(({ date }, i) => {
                            const info = getQuartInfo(
                              { date_debut: dateDebut, position_alpha: positionAlpha },
                              eq, date, [], equipes
                            )
                            return (
                              <td key={i} className="px-0.5 py-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center
                                               justify-center font-bold text-sm
                                               border ${info.bg} ${info.couleur}
                                               ${info.border}`}>
                                  {info.lettre}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {errConfig && (
            <p className="text-red-500 text-xs">⚠ {errConfig}</p>
          )}
          {succesConfig && (
            <div className="flex items-center gap-2 p-3 rounded-lg
                            bg-green-50 dark:bg-green-900/20
                            border border-green-200 dark:border-green-800
                            text-green-600 dark:text-green-400 text-sm">
              <Check size={14}/> Planning enregistré avec succès !
            </div>
          )}

          <button onClick={handleSaveConfig}
            disabled={savingConfig || !dateDebut}
            className="w-full flex items-center justify-center gap-2
                       py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium
                       disabled:opacity-40 transition-all">
            {savingConfig
              ? <><Loader2 size={14} className="animate-spin"/> Enregistrement...</>
              : <><Check size={14}/> Enregistrer le planning</>
            }
          </button>
        </div>

        {/* ── Demandes d'échange ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Demandes d'échange
            {demandesEnAttente.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs
                               bg-amber-100 dark:bg-amber-900/30
                               text-amber-700 dark:text-amber-300">
                {demandesEnAttente.length}
              </span>
            )}
          </h2>

          {/* En attente */}
          {demandesEnAttente.length === 0 ? (
            <div className="text-center py-8">
              <ArrowLeftRight size={32}
                className="text-gray-300 dark:text-gray-600 mx-auto mb-2"/>
              <p className="text-gray-400 text-sm">Aucune demande en attente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {demandesEnAttente.map(d => {
                const quartInfo = QUART_MAP[d.quart_souhaite]
                return (
                  <div key={d.id}
                    className="border border-gray-200 dark:border-gray-700
                               rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {d.nom_equipe_demandeur}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Le {new Date(d.date_echange).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      {quartInfo && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1
                                         rounded-lg text-xs font-medium border
                                         ${quartInfo.bg} ${quartInfo.couleur}
                                         ${quartInfo.border}`}>
                          {quartInfo.icone} {d.quart_souhaite}
                        </span>
                      )}
                    </div>
                    {d.motif && (
                      <p className="text-xs text-gray-500 dark:text-gray-400
                                   bg-gray-50 dark:bg-gray-800 p-2 rounded-lg italic">
                        "{d.motif}"
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => handleAccepter(d)}
                        disabled={savingAccept === d.id}
                        className="flex-1 flex items-center justify-center gap-1.5
                                   py-2 rounded-xl bg-green-500 hover:bg-green-600
                                   text-white text-xs font-medium
                                   disabled:opacity-40 transition-all">
                        {savingAccept === d.id
                          ? <Loader2 size={12} className="animate-spin"/>
                          : <><Check size={12}/> Accepter</>
                        }
                      </button>
                      <button onClick={() => setDemandeRefus(d)}
                        className="flex-1 flex items-center justify-center gap-1.5
                                   py-2 rounded-xl border border-red-200
                                   dark:border-red-800
                                   bg-red-50 dark:bg-red-900/20
                                   hover:bg-red-100 dark:hover:bg-red-900/30
                                   text-red-600 dark:text-red-400
                                   text-xs font-medium transition-all">
                        <X size={12}/> Refuser
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Historique */}
          {historiqueTraite.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-xs font-medium text-gray-500
                            dark:text-gray-400 uppercase tracking-wider mb-3">
                Historique
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {historiqueTraite.map(d => (
                  <div key={d.id}
                    className="flex items-center justify-between text-xs
                               p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {d.nom_equipe_demandeur}
                      </span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {d.quart_souhaite}
                      </span>
                      <span className="text-gray-400 ml-1">
                        ({new Date(d.date_echange).toLocaleDateString('fr-FR')})
                      </span>
                      {d.statut === 'ACCEPTE' && d.nom_equipe_cible && (
                        <span className="text-green-600 dark:text-green-400 ml-1">
                          ⇄ {d.nom_equipe_cible}
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      d.statut === 'ACCEPTE'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {d.statut === 'ACCEPTE' ? '✓ Accepté' : '✗ Refusé'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}