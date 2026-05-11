'use client'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { equipesService } from '@/services/equipesService'
import { polesService   } from '@/services/polesService'
import { useWebSocket   } from '@/hooks/useWebSocket'
import { getQuartInfo   } from '@/utils/planning'
import { Users, Building2, Loader2, AlertTriangle } from 'lucide-react'

interface Membre {
  id_user : number
  nom     : string
  prenom  : string
  role    : string
  genre   : string
  email   : string
}

interface Equipe {
  id_equipe               : number
  nom_equipe              : string
  id_pole                 : number
  date_reference_cycle    : string | null
  position_initiale_cycle : number
  nb_membres              : number
  a_chef                  : boolean
  membres                 : Membre[]
}

interface Pole { id_pole: number; nom_pole: string }

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', METHODISTE: 'Méthodiste', CHEF_POLE: 'Chef Pôle',
  CHEF_EQUIPE: 'Chef Équipe', MECANICIEN: 'Mécanicien',
  TECHNICIEN: 'Technicien', HSE: 'HSE',
}

const ROLE_COLORS: Record<string, string> = {
  CHEF_EQUIPE : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  MECANICIEN  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  TECHNICIEN  : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  HSE         : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  METHODISTE  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  CHEF_POLE   : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
}

const avatarColors = [
  'bg-blue-500','bg-purple-500','bg-green-500',
  'bg-orange-500','bg-teal-500','bg-red-500','bg-indigo-500'
]

export default function VueEquipesPage() {
  const authUser     = useSelector((s: RootState) => s.auth.user)
  const isAdmin      = authUser?.role === 'ADMIN'
  const isChefPole   = authUser?.role === 'CHEF_POLE'
  const isChefEquipe = authUser?.role === 'CHEF_EQUIPE'

  const [equipes,    setEquipes]    = useState<Equipe[]>([])
  const [poles,      setPoles]      = useState<Pole[]>([])
  const [filtrePole, setFiltrePole] = useState('')
  const [loading,    setLoading]    = useState(true)

  const charger = async () => {
    setLoading(true)
    try {
      if (isAdmin) {
        const [eqs, ps] = await Promise.all([
          equipesService.lister(),
          polesService.lister(),
        ])
        setEquipes(eqs)
        setPoles(ps)
      } else {
        const idPole = Number(authUser?.id_pole)
        if (idPole) {
          const eqs = await equipesService.parPole(idPole)
          if (isChefEquipe) {
            setEquipes(eqs.filter((e: Equipe) =>
              e.id_equipe === Number(authUser?.id_equipe)
            ))
          } else {
            setEquipes(eqs)
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  useWebSocket((msg) => {
    // Mise à jour config planning → recalcul quarts
    if (msg.type === 'CONFIG_PLANNING_MISE_A_JOUR') {
      if (msg.payload?.equipes) {
        setEquipes(prev => prev.map(eq => {
          const updated = msg.payload.equipes.find(
            (e: any) => e.id_equipe === eq.id_equipe
          )
          return updated ? {
            ...eq,
            date_reference_cycle    : updated.date_reference_cycle,
            position_initiale_cycle : updated.position_initiale_cycle,
          } : eq
        }))
      }
    }
    // Rechargement si membres changent
    if (
      msg.type === 'NOUVEL_UTILISATEUR'   ||
      msg.type === 'UTILISATEUR_MODIFIE'  ||
      msg.type === 'UTILISATEUR_SUPPRIME'
    ) {
      charger()
    }
  })

  const equipesFiltrees = filtrePole
    ? equipes.filter(e => String(e.id_pole) === filtrePole)
    : equipes

  const parPole = poles.reduce((acc, p) => {
    acc[p.id_pole] = {
      pole   : p,
      equipes: equipesFiltrees.filter(e => e.id_pole === p.id_pole),
    }
    return acc
  }, {} as Record<number, { pole: Pole; equipes: Equipe[] }>)

  const today = new Date()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="text-blue-500 animate-spin"/>
    </div>
  )

  const CardEquipe = ({ eq }: { eq: Equipe }) => {
    const estMonEquipe = Number(authUser?.id_equipe) === eq.id_equipe

    // ← Bonne signature getQuartInfo
    const config = eq.date_reference_cycle
      ? { date_debut: eq.date_reference_cycle, position_alpha: eq.position_initiale_cycle }
      : null

    const quartInfo = getQuartInfo(config, eq, today, [], equipes)

    return (
      <div className={`bg-white dark:bg-gray-900 rounded-2xl overflow-hidden
                       transition-all ${
        estMonEquipe
          ? 'border-2 border-blue-500 shadow-lg shadow-blue-500/10'
          : 'border border-gray-200 dark:border-gray-800'
      }`}>

        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                              font-bold text-white text-sm flex-shrink-0
                              ${eq.id_equipe % 2 === 0 ? 'bg-indigo-500' : 'bg-purple-500'}`}>
                {eq.nom_equipe.split(' ').pop()?.[0] ?? 'E'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {eq.nom_equipe}
                  </p>
                  {estMonEquipe && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30
                                     text-blue-700 dark:text-blue-300
                                     px-2 py-0.5 rounded-full font-medium">
                      Mon équipe
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {eq.nb_membres} membre{eq.nb_membres > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {config ? (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl
                              text-xs font-medium border flex-shrink-0
                              ${quartInfo.bg} ${quartInfo.couleur} ${quartInfo.border}`}>
                <span>{quartInfo.icone}</span>
                <span className="hidden sm:inline">{quartInfo.label}</span>
                <span className="sm:hidden font-bold">{quartInfo.lettre}</span>
              </div>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600
                               dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20
                               px-2 py-1 rounded-xl border border-amber-200
                               dark:border-amber-800 flex-shrink-0">
                <AlertTriangle size={11}/> Non configurée
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          {eq.membres.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              Aucun membre assigné
            </p>
          ) : (
            <div className="space-y-2.5">
              {eq.membres.map(m => {
                const initiales = `${m.prenom?.[0] ?? ''}${m.nom?.[0] ?? ''}`.toUpperCase()
                const couleur   = avatarColors[m.id_user % avatarColors.length]
                return (
                  <div key={m.id_user}
                    className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center
                                      justify-center text-white text-xs font-bold
                                      flex-shrink-0 ${couleur}`}>
                        {initiales}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900
                                      dark:text-white truncate">
                          {m.prenom} {m.nom}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {m.genre === 'HOMME' ? '👨' : '👩'} {m.email}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium
                                     flex-shrink-0 whitespace-nowrap
                                     ${ROLE_COLORS[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center
                      justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Vue des équipes
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {isAdmin      ? 'Toutes les équipes'    :
             isChefPole   ? 'Équipes de votre pôle' :
             'Votre équipe'}
          </p>
        </div>

        {isAdmin && poles.length > 0 && (
          <select value={filtrePole}
            onChange={e => setFiltrePole(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200
                       dark:border-gray-700 bg-white dark:bg-gray-900
                       text-gray-900 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tous les pôles</option>
            {poles.map(p => (
              <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>
            ))}
          </select>
        )}
      </div>

      {isAdmin ? (
        <div className="space-y-8">
          {Object.values(parPole)
            .filter(({ equipes: eqs }) => eqs.length > 0)
            .map(({ pole, equipes: eqs }) => (
              <div key={pole.id_pole}>
                <div className="flex items-center gap-2 mb-4">
                  <Building2 size={16} className="text-gray-400"/>
                  <h2 className="text-sm font-semibold text-gray-700
                                 dark:text-gray-300 uppercase tracking-wider">
                    {pole.nom_pole}
                  </h2>
                  <span className="text-xs text-gray-400">
                    ({eqs.length} équipe{eqs.length > 1 ? 's' : ''})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {eqs.map(eq => <CardEquipe key={eq.id_equipe} eq={eq}/>)}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {equipesFiltrees.map(eq => <CardEquipe key={eq.id_equipe} eq={eq}/>)}
        </div>
      )}

      {equipesFiltrees.length === 0 && !loading && (
        <div className="text-center py-20 bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-800 rounded-2xl">
          <Users size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-500 dark:text-gray-400">Aucune équipe trouvée</p>
        </div>
      )}
    </div>
  )
}