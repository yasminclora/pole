'use client'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { RootState } from '@/store/store'
import { logout } from '@/store/slices/authSlice'
import { Sun, Moon, Bell, User, LogOut, ChevronDown, X, Search, Loader2 } from 'lucide-react'
import { useGlobalNotifications } from '@/hooks/useGlobalNotifications'
import { otService } from '@/services/otService'
import { diService } from '@/services/diService'

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
  link?   : string
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
  const [showNotifs, setShowNotifs]= useState(false)
  const [showProfil, setShowProfil]= useState(false)
  
  // Recherche
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [searchResults, setSearchResults] = useState<{type: string, text: string, href: string}[]>([])
  const [searching, setSearching] = useState(false)

  // Recherche en temps réel
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    const timer = setTimeout(async () => {
      setSearching(true)
      const results: {type: string, text: string, href: string}[] = []
      const q = searchQuery.toLowerCase()
      
      try {
        const ots = await otService.liste({})
        if (Array.isArray(ots)) {
          ots.filter(o => o.numero_ot?.toLowerCase().includes(q)).slice(0, 3).forEach(o => {
            results.push({ type: 'OT', text: o.numero_ot, href: `/ot/${o.id_ot}` })
          })
        }
      } catch {}
      
      try {
        const dis = await diService.liste({})
        if (Array.isArray(dis)) {
          dis.filter(d => d.numero_di?.toLowerCase().includes(q)).slice(0, 3).forEach(d => {
            results.push({ type: 'DI', text: d.numero_di, href: `/di/${d.id_di}` })
          })
        }
      } catch {}
      
      setSearchResults(results)
      setSearching(false)
    }, 400)
    
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Utiliser les notifications globales
  const { notifications, nonLues, marquerLue, marquerToutesLues, supprimerNotification, viderNotifications } = useGlobalNotifications()

  // Mise à jour de l'heure toutes les 60s
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const handleLogout = () => { dispatch(logout()); router.push('/login') }

  const initiales = user
    ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
    : 'U'

  const avatarColors = [
    'bg-blue-600','bg-purple-600','bg-green-600',
    'bg-orange-500','bg-teal-600','bg-red-600','bg-indigo-600'
  ]
  const couleur = user ? avatarColors[user.id_user % avatarColors.length] : 'bg-blue-600'

  return (
    <header className="h-18 border-b flex items-center justify-between px-6 md:px-8 flex-shrink-0 relative z-30
                       bg-[#0d2848]/80 backdrop-blur-sm
                       border-blue-900/30">

      {/* Gauche - Message bienvenue avec logo industriel */}
      <div className="flex items-center gap-4">
        {/* Logo industriel schéma */}
        <div className="w-10 h-10">
          <svg viewBox="0 0 48 48" className="w-full h-full">
            <circle cx="24" cy="24" r="10" fill="none" stroke="#3b82f6" strokeWidth="2"/>
            <circle cx="24" cy="24" r="5" fill="rgba(59,130,246,0.4)" stroke="#3b82f6" strokeWidth="1.5"/>
            {[0,60,120,180,240,300].map((angle, i) => (
              <line key={i} x1="24" y1="13" x2="24" y2="8" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" transform={`rotate(${angle} 24 24)`}/>
            ))}
            <circle cx="35" cy="35" r="4" fill="none" stroke="#60a5fa" strokeWidth="1.5"/>
            <circle cx="35" cy="35" r="1.5" fill="#60a5fa"/>
            <line x1="28" y1="28" x2="31" y2="31" stroke="#60a5fa" strokeWidth="1.5"/>
          </svg>
        </div>
        <div>
          <p className="text-white text-xl font-bold">Bienvenue sur Optima</p>
          <p className="text-blue-400/60 text-xs">Gestion de Maintenance</p>
        </div>
      </div>

      {/* Centre - Barre de recherche rapide */}
      <div className="hidden md:flex flex-1 max-w-md mx-8 relative">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"/>
          <input
            type="text"
            placeholder="Rechercher OT, DI, équipement..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                router.push(`/ot/liste?search=${encodeURIComponent(searchQuery)}`)
              }
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-blue-900/30 border border-blue-500/30 
                     text-white text-sm placeholder-white/40
                     focus:outline-none focus:border-blue-400 focus:bg-blue-900/50 transition-all"
          />
          
          {/* Résultats dropdown */}
          {showResults && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d2848] border border-blue-500/30 rounded-xl shadow-xl overflow-hidden z-50">
              {searching ? (
                <div className="p-4 flex items-center justify-center gap-2 text-white/60">
                  <Loader2 size={16} className="animate-spin"/> Recherche...
                </div>
              ) : searchResults.length > 0 ? (
                <div className="py-2">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        router.push(r.href)
                        setShowResults(false)
                        setSearchQuery('')
                      }}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-blue-500/20 transition-colors"
                    >
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.type === 'OT' ? 'bg-blue-500/30 text-blue-400' : 'bg-amber-500/30 text-amber-400'
                      }`}>
                        {r.type}
                      </span>
                      <span className="text-white text-sm">{r.text}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      router.push(`/ot/liste?search=${encodeURIComponent(searchQuery)}`)
                      setShowResults(false)
                    }}
                    className="w-full px-4 py-2 text-center text-blue-400 text-sm border-t border-blue-500/30 hover:bg-blue-500/10"
                  >
                    Voir tous les résultats →
                  </button>
                </div>
              ) : (
                <div className="p-4 text-white/40 text-sm text-center">
                  Aucun résultat trouvé
                </div>
              )}
            </div>
          )}
        </div>
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
            if (!showNotifs) marquerToutesLues()
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
                {notifications.length > 0 && (
                  <button onClick={() => viderNotifications()}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    Tout effacer
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2"/>
                    <p className="text-gray-400 text-sm">Aucune notification</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id}
                      onClick={() => {
                        if (n.link) {
                          router.push(n.link)
                          setShowNotifs(false)
                        }
                      }}
                      className={`flex items-start gap-3 px-4 py-3 border-b
                                 border-gray-50 dark:border-gray-800/50
                                 hover:bg-gray-50 dark:hover:bg-gray-800/50
                                 transition-colors group cursor-pointer ${n.link ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center
                                              justify-center flex-shrink-0 mt-0.5 ${['nouvelle_di', 'OT_ASSIGNE'].includes(n.type) ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                        <Bell size={13} className={`${['nouvelle_di', 'OT_ASSIGNE'].includes(n.type) ? 'text-orange-500' : 'text-blue-500'}`}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); supprimerNotification(n.id) }}
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
