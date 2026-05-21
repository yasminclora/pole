'use client'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { RootState } from '@/store/store'
import { logout } from '@/store/slices/authSlice'
import { Bell, User, LogOut, ChevronDown, X, Search, Loader2, Users as UsersIcon } from 'lucide-react'
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

const ROLES_EQUIPE = new Set(['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'])
const fontStyle = { fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }

export default function TopBar() {
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

  const apiBase  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'
  const photoSrc = user?.photo_url
    ? (user.photo_url.startsWith('http') ? user.photo_url : `${apiBase}${user.photo_url}`)
    : null

  return (
    <header style={fontStyle} className="h-24 border-b flex items-center justify-between px-6 md:px-8 flex-shrink-0 relative z-30 bg-[#0a192f] border-slate-800">

      {/* ── GAUCHE : LOGO INDUSTRIEL AGRANDI + BIENVENUE ── */}
      <div className="flex items-center gap-5">
        {/* Logo plus grand (w-14 h-14) et traits épaissis pour un effet technique lourd */}
        <div className="w-14 h-14 flex-shrink-0 bg-blue-950/40 p-1.5 rounded-xl border border-blue-500/20 shadow-lg">
          <svg viewBox="0 0 48 48" className="w-full h-full">
            <circle cx="24" cy="24" r="10" fill="none" stroke="#3b82f6" strokeWidth="2.5"/>
            <circle cx="24" cy="24" r="5" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="2"/>
            {[0,60,120,180,240,300].map((angle, i) => (
              <line key={i} x1="24" y1="13" x2="24" y2="8" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${angle} 24 24)`}/>
            ))}
            <circle cx="35" cy="35" r="4" fill="none" stroke="#60a5fa" strokeWidth="2"/>
            <circle cx="35" cy="35" r="1.5" fill="#60a5fa"/>
            <line x1="28" y1="28" x2="31" y2="31" stroke="#60a5fa" strokeWidth="2"/>
          </svg>
        </div>
        <div>
          <p className="text-white text-2xl font-black leading-none">Bienvenue sur Optima</p>
          <p className="text-cyan-400 font-bold text-sm mt-1.5 tracking-wide uppercase">Gestion de Maintenance</p>
        </div>
      </div>

      {/* ── CENTRE : BARRE DE RECHERCHE BLANCHE, VISIBLE ET LARGE ── */}
      <div className="hidden md:flex flex-1 max-w-lg mx-8 relative">
        <div className="relative w-full">
          {/* Icône passée en gris foncé pour trancher sur le fond blanc */}
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-10"/>
          <input
            type="text"
            placeholder="Rechercher un OT, une DI, un équipement..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            onKeyDown={e => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                router.push(`/ot/liste?search=${encodeURIComponent(searchQuery)}`)
              }
            }}
            /* Fond Blanc Lumineux pour casser l'effet sombre et faire ressortir le composant */
            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border-2 border-transparent 
                     text-slate-900 text-base placeholder-slate-400 font-bold shadow-xl
                     focus:outline-none focus:border-blue-500 transition-all"
          />
          
          {/* Résultats de recherche dropdown style épuré */}
          {showResults && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50">
              {searching ? (
                <div className="p-4 flex items-center justify-center gap-2 text-slate-600 text-sm font-medium">
                  <Loader2 size={16} className="animate-spin text-blue-600"/> Recherche en cours...
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
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className={`px-2.5 py-0.5 rounded font-black text-xs ${
                        r.type === 'OT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.type}
                      </span>
                      <span className="text-slate-800 text-sm font-bold">{r.text}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      router.push(`/ot/liste?search=${encodeURIComponent(searchQuery)}`)
                      setShowResults(false)
                    }}
                    className="w-full px-4 py-3 text-center text-blue-600 text-sm font-black border-t border-slate-100 hover:bg-slate-50"
                  >
                    Voir tous les résultats →
                  </button>
                </div>
              ) : (
                <div className="p-4 text-slate-500 text-sm text-center font-medium">
                  Aucun résultat trouvé
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── DROITE : ACTIONS UTILISATEUR EN PLUS GRAND ── */}
      <div className="flex items-center gap-4">

        {/* Badge Entité */}
        {(() => {
          const showEquipe = user?.role && ROLES_EQUIPE.has(user.role)
          const label = showEquipe ? user?.nom_equipe : user?.nom_pole
          if (!label) return null
          return (
            <div className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700">
              {showEquipe ? <UsersIcon size={16} className="text-cyan-400" /> : <div className="w-2 h-2 rounded-full bg-cyan-400"/>}
              <span className="text-sm font-black text-slate-200">
                {showEquipe ? `Équipe : ${label}` : label}
              </span>
            </div>
          )
        })()}

        {/* Date / Heure */}
        <div className="hidden lg:flex items-center gap-2 text-sm font-black text-slate-300 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5">
          <span className="capitalize">
            {now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 font-mono">
            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Bouton de Notifications */}
        <div className="relative">
          <button onClick={() => {
            setShowNotifs(!showNotifs)
            setShowProfil(false)
            if (!showNotifs) marquerToutesLues()
          }}
            className="relative w-11 h-11 rounded-xl flex items-center justify-center bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all">
            <Bell size={20}/>
            {nonLues > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-md">
                {nonLues > 9 ? '9+' : nonLues}
              </span>
            )}
          </button>

          {/* Menu Déroulant Notifications */}
          {showNotifs && (
            <div className="absolute right-0 top-14 w-80 rounded-xl shadow-2xl bg-[#071322] border border-slate-700 z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Notifications</h3>
                {notifications.length > 0 && (
                  <button onClick={() => viderNotifications()} className="text-xs text-slate-400 hover:text-red-400 transition-colors font-bold">
                    Tout effacer
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell size={24} className="text-slate-600 mx-auto mb-2"/>
                    <p className="text-slate-400 text-sm">Aucune notification</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id}
                      onClick={() => { if (n.link) { router.push(n.link); setShowNotifs(false) } }}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors group cursor-pointer ${n.link ? 'hover:bg-blue-950/20' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${['nouvelle_di', 'OT_ASSIGNE'].includes(n.type) ? 'bg-orange-500/10' : 'bg-blue-500/10'}`}>
                        <Bell size={14} className={['nouvelle_di', 'OT_ASSIGNE'].includes(n.type) ? 'text-orange-400' : 'text-blue-400'}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 leading-snug font-medium">{n.message}</p>
                        <p className="text-xs text-slate-500 mt-1">{n.time}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); supprimerNotification(n.id) }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all flex-shrink-0">
                        <X size={14}/>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profil Dropdown */}
        <div className="relative">
          <button onClick={() => { setShowProfil(!showProfil); setShowNotifs(false) }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-blue-500/20 ${photoSrc ? '' : couleur}`}>
              {photoSrc ? (
                <img src={photoSrc} alt={user?.prenom ?? ''} className="w-full h-full object-cover"/>
              ) : initiales}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-white text-sm font-black leading-tight">{user?.prenom} {user?.nom}</p>
              <p className="text-slate-400 text-xs font-bold mt-0.5">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</p>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${showProfil ? 'rotate-180' : ''}`}/>
          </button>

          {/* Profil déroulant menu */}
          {showProfil && (
            <div className="absolute right-0 top-14 w-56 rounded-xl shadow-2xl bg-[#071322] border border-slate-700 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-blue-500/20 ${photoSrc ? '' : couleur}`}>
                    {photoSrc ? (
                      <img src={photoSrc} alt={user?.prenom ?? ''} className="w-full h-full object-cover"/>
                    ) : initiales}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user?.prenom} {user?.nom}</p>
                    <p className="text-xs text-slate-400 truncate">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</p>
                  </div>
                </div>
              </div>

              <div className="p-2 space-y-1">
                <button onClick={() => { router.push('/profil'); setShowProfil(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-200 hover:bg-slate-800 transition-all text-left font-bold">
                  <User size={16} className="text-slate-400"/>
                  Mon profil
                </button>
                <div className="border-t border-slate-800 my-1"/>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 transition-all text-left font-bold">
                  <LogOut size={16}/>
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(showNotifs || showProfil) && (
        <div className="fixed inset-0 z-20" onClick={() => { setShowNotifs(false); setShowProfil(false) }}/>
      )}
    </header>
  )
}