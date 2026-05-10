'use client'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { RootState } from '@/store/store'
import { logout } from '@/store/slices/authSlice'
import { Sun, Moon, Bell, User, LogOut, ChevronDown, X } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'

const ROLE_LABELS: Record<string, string> = {
  ADMIN       : 'Administrateur',
  METHODISTE  : 'Méthodiste',
  CHEF_POLE   : 'Chef de Pôle',
  CHEF_EQUIPE : "Chef d'Équipe",
  MECANICIEN  : 'Mécanicien',
  TECHNICIEN  : 'Technicien',
  HSE         : 'HSE',
}

interface Notif {
  id      : number
  message : string
  lu      : boolean
  time    : string
  type?   : string
}

interface TopBarProps {
  darkMode   : boolean
  toggleDark : () => void
}

export default function TopBar({ darkMode, toggleDark }: TopBarProps) {
  const dispatch = useDispatch()
  const router   = useRouter()
  const user     = useSelector((s: RootState) => s.auth.user)

  const [now,        setNow]       = useState(new Date())
  const [notifs,     setNotifs]    = useState<Notif[]>([])
  const [showNotifs, setShowNotifs]= useState(false)
  const [showProfil, setShowProfil]= useState(false)

  const nonLues = notifs.filter(n => !n.lu).length

  // Mise à jour de l'heure toutes les 60s (pas chaque seconde → évite re-render excessif)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Notifications WebSocket
  useWebSocket((msg) => {
    const types = [
      'NOUVEL_UTILISATEUR', 'UTILISATEUR_MODIFIE', 'UTILISATEUR_SUPPRIME',
      'DEMANDE_ECHANGE_CREE', 'DEMANDE_ECHANGE_ACCEPTEE', 'DEMANDE_ECHANGE_REFUSEE',
      'CONFIG_PLANNING_MISE_A_JOUR', 'EQUIPE_CONFIGUREE',
      'nouvelle_di',
    ]
    let message = ''
    if (msg.type === 'nouvelle_di') {
      message = `Nouvelle DI: ${msg.numero_di} - ${msg.equipement}`
    } else {
      message = msg.message || `${msg.type} - ${JSON.stringify(msg.payload || {})}`
    }
    if (types.includes(msg.type)) {
      setNotifs(prev => [{
        id      : Date.now(),
        message : message,
        lu      : false,
        time    : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type    : msg.type,
      }, ...prev].slice(0, 20))
    }
  })

  const marquerLues    = () => setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
  const supprimerNotif = (id: number) => setNotifs(prev => prev.filter(n => n.id !== id))
  const handleLogout   = () => { dispatch(logout()); router.push('/login') }

  const initiales = user
    ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
    : 'U'

  const avatarColors = [
    'bg-blue-600','bg-purple-600','bg-green-600',
    'bg-orange-500','bg-teal-600','bg-red-600','bg-indigo-600'
  ]
  const couleur = user ? avatarColors[user.id_user % avatarColors.length] : 'bg-blue-600'

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 flex-shrink-0 relative z-30
                       bg-white dark:bg-gray-900
                       border-gray-200 dark:border-gray-800">

      {/* Gauche - Message bienvenue */}
      <div>
        <p className="text-gray-900 dark:text-white text-sm font-medium">
          Bonjour, <span className="text-blue-600 dark:text-blue-400">{user?.prenom} {user?.nom}</span> 👋
        </p>
        <p className="text-gray-400 text-[11px]">Bienvenue sur Optima</p>
      </div>

      {/* Droite - Actions */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* Badge Pôle */}
        {user?.nom_pole && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                              bg-blue-50 dark:bg-blue-900/20
                              border border-blue-200 dark:border-blue-800">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"/>
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {user.nom_pole}
            </span>
          </div>
        )}

        {/* Date + Heure */}
        <div className="hidden lg:flex items-center gap-2 text-[11px]
                          text-gray-500 dark:text-gray-400
                          bg-gray-50 dark:bg-gray-800
                          border border-gray-200 dark:border-gray-700
                          rounded-xl px-3 py-1.5">
          <span>
            {now.toLocaleDateString('fr-FR', {
              weekday: 'short', day: '2-digit', month: 'short'
            })}
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-blue-600 dark:text-blue-400 font-mono font-medium">
            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Dark mode */}
        <button onClick={toggleDark}
          className="w-8 h-8 rounded-xl flex items-center justify-center
                     bg-gray-50 dark:bg-gray-800
                     border border-gray-200 dark:border-gray-700
                     text-gray-500 dark:text-gray-400
                     hover:text-gray-900 dark:hover:text-white transition-all">
          {darkMode ? <Sun size={15}/> : <Moon size={15}/>}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => {
            setShowNotifs(!showNotifs)
            setShowProfil(false)
            if (!showNotifs) marquerLues()
          }}
            className="relative w-8 h-8 rounded-xl flex items-center justify-center
                       bg-gray-50 dark:bg-gray-800
                       border border-gray-200 dark:border-gray-700
                       text-gray-500 dark:text-gray-400
                       hover:text-gray-900 dark:hover:text-white transition-all">
            <Bell size={15}/>
            {nonLues > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500
                             rounded-full text-white text-[10px] font-bold
                             flex items-center justify-center">
                {nonLues > 9 ? '9+' : nonLues}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-10 w-80 rounded-2xl shadow-xl
                              bg-white dark:bg-gray-900
                              border border-gray-200 dark:border-gray-800 z-50">
              <div className="flex items-center justify-between px-4 py-3
                              border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Notifications
                </h3>
                {notifs.length > 0 && (
                  <button onClick={() => setNotifs([])}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    Tout effacer
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2"/>
                    <p className="text-gray-400 text-sm">Aucune notification</p>
                  </div>
                ) : (
                  notifs.map(n => (
                    <div key={n.id}
                      className="flex items-start gap-3 px-4 py-3 border-b
                                 border-gray-50 dark:border-gray-800/50
                                 hover:bg-gray-50 dark:hover:bg-gray-800/50
                                 transition-colors group">
                      <div className="w-8 h-8 rounded-full bg-blue-100
                                              dark:bg-blue-900/30 flex items-center
                                              justify-center flex-shrink-0 mt-0.5">
                        <Bell size={13} className="text-blue-500"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                      <button onClick={() => supprimerNotif(n.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400
                                   hover:text-red-500 transition-all flex-shrink-0">
                        <X size={13}/>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar + Dropdown */}
        <div className="relative">
          <button onClick={() => { setShowProfil(!showProfil); setShowNotifs(false) }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl
                       bg-gray-50 dark:bg-gray-800
                       border border-gray-200 dark:border-gray-700
                       hover:border-gray-300 dark:hover:border-gray-600 transition-all">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center
                              text-white text-xs font-bold ${couleur}`}>
              {initiales}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-gray-900 dark:text-white text-xs font-medium leading-tight">
                {user?.prenom} {user?.nom}
              </p>
              <p className="text-gray-400 text-[10px]">
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
              </p>
            </div>
            <ChevronDown size={13} className={`text-gray-400 transition-transform ${
              showProfil ? 'rotate-180' : ''
            }`}/>
          </button>

          {showProfil && (
            <div className="absolute right-0 top-11 w-56 rounded-2xl shadow-xl
                              bg-white dark:bg-gray-900
                              border border-gray-200 dark:border-gray-800 z-50 overflow-hidden">
              {/* En-tête profil */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                  text-white text-sm font-bold ${couleur}`}>
                    {initiales}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {user?.prenom} {user?.nom}
                    </p>
                    <p className="text-xs text-gray-400">
                      {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                    </p>
                    {user?.nom_pole && (
                      <p className="text-xs text-blue-500 mt-0.5">
                        {user.nom_pole}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-2">
                <button onClick={() => { router.push('/profil'); setShowProfil(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                             text-gray-700 dark:text-gray-300
                             hover:bg-gray-50 dark:hover:bg-gray-800
                             transition-all text-left">
                  <User size={15} className="text-gray-400"/>
                  Mon profil
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                             text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                             transition-all text-left">
                  <LogOut size={15}/>
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlay pour fermer les dropdowns */}
      {(showNotifs || showProfil) && (
        <div className="fixed inset-0 z-20"
          onClick={() => { setShowNotifs(false); setShowProfil(false) }}/>
      )}
    </header>
  )
}
