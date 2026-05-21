'use client'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { planningService } from '@/services/planningService'
import { equipesService  } from '@/services/equipesService'
import { useWebSocket    } from '@/hooks/useWebSocket'
import { JOURS_COURTS } from '@/utils/planning'
import { Settings, Check, Loader2, Calendar, RefreshCw, Layers, Users } from 'lucide-react'

interface Config {
  date_debut     : string
  position_alpha : number
}

interface Equipe {
  id_equipe               : number
  nom_equipe              : string
  id_pole                 : number
  date_reference_cycle    : string | null
  position_initiale_cycle : number
}

// Les 4 configurations blocs possibles pour l'usine sur un cycle de 8 jours (2 jours par bloc)
const BLOCS_ROTATION = [
  { value: 0, label: 'Bloc 1: Alpha(M) • Bravo(A) • Charlie(N) • Delta(R)' },
  { value: 2, label: 'Bloc 2: Alpha(A) • Bravo(N) • Charlie(R) • Delta(M)' },
  { value: 4, label: 'Bloc 3: Alpha(N) • Bravo(R) • Charlie(M) • Delta(A)' },
  { value: 6, label: 'Bloc 4: Alpha(R) • Bravo(M) • Charlie(A) • Delta(N)' },
]

// Style des badges selon le quart
const QUART_STYLES: Record<string, { bg: string, border: string, text: string, label: string, lettre: string }> = {
  'M': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', label: 'Matin', lettre: 'M' },
  'A': { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', label: 'Après-midi', lettre: 'A' },
  'N': { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', label: 'Nuit', lettre: 'N' },
  'R': { bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-500 dark:text-slate-400', label: 'Repos', lettre: 'R' }
}

export default function ConfigPage() {
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idPole   = Number(authUser?.id_pole)
  const idUser   = Number(authUser?.id_user)

  const [config,        setConfig]        = useState<Config | null>(null)
  const [equipes,       setEquipes]       = useState<Equipe[]>([])
  const [loading,       setLoading]       = useState(true)
  const [dateDebut,     setDateDebut]     = useState('')
  const [positionAlpha, setPositionAlpha] = useState(0)
  const [savingConfig,  setSavingConfig]  = useState(false)
  const [succesConfig,  setSuccesConfig]  = useState(false)
  const [errConfig,     setErrConfig]     = useState('')

  const charger = async () => {
    setLoading(true)
    try {
      const [cfg, eqs] = await Promise.all([
        planningService.getConfig(idPole),
        equipesService.parPole(idPole),
      ])
      setConfig(cfg)
      setEquipes(eqs)
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
    if (msg.type === 'CONFIG_PLANNING_MISE_A_JOUR' && msg.payload.id_pole === idPole) {
      setConfig({ date_debut: msg.payload.date_debut, position_alpha: msg.payload.position_alpha })
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
      setSuccesConfig(true)
      setTimeout(() => setSuccesConfig(false), 3000)
      charger()
    } catch (err: any) {
      setErrConfig(err.response?.data?.detail ?? 'Erreur')
    } finally {
      setSavingConfig(false)
    }
  }

  // Fonction pour calculer la distribution des quarts d'une journée donnée (Séquence collective 2-2-2-2)
  const getQuartsPourDate = (cibleDate: Date) => {
    if (!dateDebut) return {}
    const t1 = Date.UTC(cibleDate.getFullYear(), cibleDate.getMonth(), cibleDate.getDate())
    const d = new Date(dateDebut)
    const t0 = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    
    const millisecondesParJour = 24 * 60 * 60 * 1000
    let deltaJours = Math.floor((t1 - t0) / millisecondesParJour)
    
    // Calcul de l'index dans le cycle global de 8 jours
    let indexCycle = (positionAlpha + deltaJours) % 8
    if (indexCycle < 0) indexCycle += 8

    // Attribution collective basée sur l'avancement du bloc de 2 jours
    if (indexCycle === 0 || indexCycle === 1) {
      return { Alpha: 'M', Bravo: 'A', Charlie: 'N', Delta: 'R' }
    } else if (indexCycle === 2 || indexCycle === 3) {
      return { Alpha: 'A', Bravo: 'N', Charlie: 'R', Delta: 'M' }
    } else if (indexCycle === 4 || indexCycle === 5) {
      return { Alpha: 'N', Bravo: 'R', Charlie: 'M', Delta: 'A' }
    } else {
      return { Alpha: 'R', Bravo: 'M', Charlie: 'A', Delta: 'N' }
    }
  }

  // Génération de l'aperçu complet de 8 jours consécutifs
  const apercu = dateDebut ? Array.from({ length: 8 }, (_, i) => {
    const d = new Date(dateDebut)
    d.setDate(d.getDate() + i)
    return {
      date: d,
      quarts: getQuartsPourDate(d)
    }
  }) : []

  if (loading) return (
    <div className="py-24 flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-gray-950 min-h-screen">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      <p className="text-sm text-gray-500 font-medium">Initialisation des roulements Cevital...</p>
    </div>
  )

  const quartsActuels = dateDebut ? getQuartsPourDate(new Date(dateDebut)) : {}

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950 p-6 space-y-6">

      {/* BANDEAU HISTORIQUE / TITRE — STYLE EXACT CEVITAL OPTIMA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f2547] to-[#1a3a66] shadow-lg border border-[#1e3e6b]">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        <div className="relative px-8 py-7 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-inner">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
           
              <h1 className="text-2xl font-serif font-bold text-white tracking-wide">
                Gestion des Plannings
              </h1>
              
            </div>
          </div>
          <button onClick={charger} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI BLOCS - STATISTIQUES USINE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Date Pivot Sélectionnée</p>
            <p className="text-base font-bold text-slate-800 dark:text-white mt-0.5">{config ? new Date(config.date_debut).toLocaleDateString('fr-FR') : 'Non configurée'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400"><Calendar size={18}/></div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Structure Rotation</p>
            <p className="text-base font-bold text-slate-800 dark:text-white mt-0.5">2J M • 2J A • 2J N • 2J R</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><Layers size={18}/></div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Nombre Équipes</p>
            <p className="text-base font-bold text-slate-800 dark:text-white mt-0.5">{equipes.length} Équipes Actives</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><Users size={18}/></div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Statut Général</p>
            <p className="text-base font-bold text-slate-800 dark:text-white mt-0.5">{config ? 'Synchro OK' : 'En attente'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-gray-400">{config ? <Check size={18}/> : '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* CONFIGURATION FORMULAIRE */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4 h-fit">
          <h2 className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest border-b border-slate-100 dark:border-gray-800 pb-2.5">Paramètres du Pivot</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">Date de départ usine</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all"/>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">Alignement initial de la journée</label>
              <select value={positionAlpha} onChange={e => setPositionAlpha(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white transition-all cursor-pointer">
                {BLOCS_ROTATION.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {errConfig && <p className="text-red-500 text-xs font-bold">⚠ {errConfig}</p>}
          {succesConfig && <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1"><Check size={14}/> Cycle configuré avec succès !</p>}

          <button onClick={handleSaveConfig} disabled={savingConfig || !dateDebut}
            className="w-full py-2.5 rounded-xl bg-[#0f2547] hover:bg-[#15325c] text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40">
            {savingConfig ? <Loader2 size={14} className="animate-spin mx-auto"/> : 'Enregistrer la configuration'}
          </button>
        </div>

        {/* CONTENU DU PLANNING APERÇU */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-6">
          <div>
            <h2 className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest border-b border-slate-100 dark:border-gray-800 pb-2.5 mb-4">Distribution au jour J</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Alpha', 'Bravo', 'Charlie', 'Delta'].map(nom => {
                const quart = (quartsActuels as any)[nom] || 'R'
                const style = QUART_STYLES[quart]
                return (
                  <div key={nom} className={`p-3.5 rounded-xl border ${style.bg} ${style.border} flex flex-col items-center justify-center text-center`}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Équipe</span>
                    <span className={`text-base font-serif font-black ${style.text}`}>{nom}</span>
                    <span className={`mt-1.5 px-2.5 py-0.5 rounded text-[10px] font-black border uppercase bg-white dark:bg-gray-900 shadow-xs ${style.text} ${style.border}`}>
                      {style.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* TABLEAU DE ROTATION SUR 8 JOURS CONTINUS */}
          {apercu.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest border-b border-slate-100 dark:border-gray-800 pb-2.5 mb-4">Vue d'ensemble de la rotation (8 Jours)</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-gray-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-100 dark:border-gray-800">
                    <tr>
                      <th className="p-3 font-bold text-slate-400 dark:text-gray-500 uppercase text-[10px]">Équipe</th>
                      {apercu.map(({ date }, i) => (
                        <th key={i} className="p-2 text-center min-w-[50px]">
                          <div className="text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase">{JOURS_COURTS[date.getDay() === 0 ? 6 : date.getDay() - 1]}</div>
                          <div className="text-xs font-black text-slate-700 dark:text-gray-300">{date.getDate()}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {['Alpha', 'Bravo', 'Charlie', 'Delta'].map(nom => (
                      <tr key={nom} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="p-3 font-serif font-bold text-slate-800 dark:text-gray-200 border-r border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky left-0 z-10">
                          {nom}
                        </td>
                        {apercu.map(({ quarts }, idx) => {
                          const q = (quarts as any)[nom] || 'R'
                          const style = QUART_STYLES[q]
                          return (
                            <td key={idx} className="p-1 text-center">
                              <div className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-xs font-black border shadow-xs ${style.bg} ${style.text} ${style.border}`}>
                                {style.lettre}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}