'use client'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { equipesService } from '@/services/equipesService'
import { polesService   } from '@/services/polesService'
import { useWebSocket   } from '@/hooks/useWebSocket'
import { getQuartInfo   } from '@/utils/planning'
import { 
  Users, Building2, Loader2, AlertTriangle, 
  RefreshCw, Filter, Layers, UsersRound 
} from 'lucide-react'

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

const ROLE_STYLES: Record<string, string> = {
  CHEF_EQUIPE : 'bg-amber-50 text-amber-700 ring-amber-200',
  MECANICIEN  : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  TECHNICIEN  : 'bg-teal-50 text-teal-700 ring-teal-200',
  HSE         : 'bg-rose-50 text-rose-700 ring-rose-200',
  METHODISTE  : 'bg-sky-50 text-sky-700 ring-sky-200',
  CHEF_POLE   : 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

const AVATAR_GRADIENTS = [
  'from-sky-500 to-indigo-600',
  'from-violet-500 to-fuchsia-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-indigo-500 to-purple-600',
]

export default function VueEquipesPage() {
  const authUser     = useSelector((s: RootState) => s.auth.user)
  const isAdmin      = authUser?.role === 'ADMIN'
  const isChefPole   = authUser?.role === 'METHODISTE'
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
  const totalMembres = equipesFiltrees.reduce((acc, current) => acc + (current.nb_membres || 0), 0)

  if (loading) return (
    <div className="py-24 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-50 to-white min-h-screen">
      <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
      <p className="text-sm text-slate-500">Chargement des équipes…</p>
    </div>
  )

  const CardEquipe = ({ eq }: { eq: Equipe }) => {
    const estMonEquipe = Number(authUser?.id_equipe) === eq.id_equipe
    const config = eq.date_reference_cycle
      ? { date_debut: eq.date_reference_cycle, position_alpha: eq.position_initiale_cycle }
      : null

    const quartInfo = getQuartInfo(config, eq, today, [], equipes)
    const gradientAvatar = (id: number) => AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length]

    return (
      <div className={`bg-white rounded-2xl border border-slate-200 transition-all duration-200 overflow-hidden flex flex-col justify-between
        ${estMonEquipe 
          ? 'ring-2 ring-sky-600 shadow-md shadow-sky-600/5' 
          : 'hover:shadow-lg hover:border-slate-300'
        }`}>
        
        {/* En-tête de la Card de l'équipe */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradientAvatar(eq.id_equipe)}
                            flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0`}>
              {eq.nom_equipe.split(' ').pop()?.[0] ?? 'E'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 truncate">{eq.nom_equipe}</p>
                {estMonEquipe && (
                  <span className="px-1.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-700 text-[9px] font-bold uppercase tracking-wider">
                    Mienne
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {eq.nb_membres} collaborateur{eq.nb_membres > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Tag de cycle / quart */}
          {config ? (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0 bg-white
              ${quartInfo.couleur} ${quartInfo.border}`}>
              <span>{quartInfo.icone}</span>
              <span>{quartInfo.label}</span>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
              <AlertTriangle size={11}/> Non config.
            </span>
          )}
        </div>

        {/* Corps : Liste des membres */}
        <div className="p-4 flex-grow">
          {eq.membres.length === 0 ? (
            <p className="text-slate-400 text-xs italic text-center py-4">
              Aucun membre affecté
            </p>
          ) : (
            <div className="space-y-2">
              {eq.membres.map(m => {
                const initiales = `${m.prenom?.[0] ?? ''}${m.nom?.[0] ?? ''}`.toUpperCase()
                return (
                  <div key={m.id_user} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradientAvatar(m.id_user)}
                                      flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
                        {initiales}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{m.prenom} {m.nom}</p>
                        <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md ring-1 text-[10px] font-semibold shrink-0 whitespace-nowrap
                                    ${ROLE_STYLES[m.role] ?? 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 space-y-6">

      {/* HERO BANNER — Style Exact Utilisateurs (Maillage fin + Serif) */}
      <div className="relative overflow-hidden rounded-2xl
                      bg-gradient-to-br from-[#0c2340] via-[#13315a] to-[#1e4976]
                      shadow-xl shadow-slate-900/10">
        {/* Motif décoratif fin */}
        <div className="absolute inset-0 opacity-[0.07]"
             style={{ backgroundImage: 'radial-gradient(circle at 20% 50%,white 1px,transparent 1px)',
                      backgroundSize: '24px 24px' }} />
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-20 w-72 h-72 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative px-8 py-8 flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20
                            flex items-center justify-center shadow-lg">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
           
              <h1 className="text-3xl font-serif font-bold text-white tracking-tight">
                Vue des Équipes
              </h1>
              <div className="mt-2 flex items-center gap-2 text-sm text-sky-200/80">
              
                <p>
                  {isAdmin      ? 'Toutes les équipes'    :
                   isChefPole   ? 'Équipes de votre pôle' :
                   'Votre équipe'}
                </p>
                <span className="text-sky-300/40">·</span>
                <span>{equipesFiltrees.length} groupe{equipesFiltrees.length > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => charger()}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20
                         flex items-center justify-center text-white transition-all"
              title="Actualiser">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs Style épuré */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: 'Total Groupes', v: equipes.length, i: Layers, c: 'sky' },
          { l: 'Groupes affichés', v: equipesFiltrees.length, i: Users, c: 'indigo' },
          { l: 'Collaborateurs suivis', v: totalMembres, i: UsersRound, c: 'emerald' },
          { l: 'Pôles rattachés', v: new Set(equipesFiltrees.map(e => e.id_pole)).size, i: Building2, c: 'amber' },
        ].map((k, i) => (
          <div key={i} className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200
                                  p-5 hover:shadow-lg hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{k.l}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 font-serif">{k.v}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-${k.c}-50 ring-1 ring-${k.c}-100
                              flex items-center justify-center`}>
                <k.i className={`w-5 h-5 text-${k.c}-600`} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#0c2340] to-sky-500
                            scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
          </div>
        ))}
      </div>

      {/* BARRE D'OUTILS FILTRE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-700 font-semibold pr-3 border-r border-slate-200">
            <Filter className="w-4 h-4" />
            <span className="text-sm uppercase tracking-wider">Filtres</span>
          </div>

          {isAdmin && poles.length > 0 ? (
            <select value={filtrePole} onChange={e => setFiltrePole(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all">
              <option value="">Tous les pôles parents</option>
              {poles.map(p => (
                <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-slate-400 italic">Filtrage restreint par vos droits</span>
          )}
        </div>
      </div>

      {/* GRILLE DES CARTES D'ÉQUIPES */}
      {isAdmin ? (
        <div className="space-y-8">
          {Object.values(parPole)
            .filter(({ equipes: eqs }) => eqs.length > 0)
            .map(({ pole, equipes: eqs }) => (
              <div key={pole.id_pole} className="space-y-4">
                
                {/* En-tête de section Pôle */}
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <Building2 size={15} className="text-slate-400"/>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {pole.nom_pole}
                  </h2>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                    {eqs.length} Équipe{eqs.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {eqs.map(eq => <CardEquipe key={eq.id_equipe} eq={eq}/>)}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {equipesFiltrees.map(eq => <CardEquipe key={eq.id_equipe} eq={eq}/>)}
        </div>
      )}

      {/* Empty State */}
      {equipesFiltrees.length === 0 && (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Users className="w-12 h-12 opacity-30" />
          <p className="text-base font-medium">Aucune équipe trouvée</p>
        </div>
      )}

    </div>
  )
}