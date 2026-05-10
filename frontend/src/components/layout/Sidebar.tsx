'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '@/store/store'
import { logout } from '@/store/slices/authSlice'
import { NAV_SECTIONS, DIRECT_LINKS, Role } from '@/config/navigation'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useEventListener } from '@/hooks/useEvent'
import { diService } from '@/services/diService'
import { otService } from '@/services/otService'
import {
  ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp,
  Zap, LogOut, Menu, X, Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const [collapsed,    setCollapsed]  = useState(false)
  const [mobileOpen,  setMobileOpen] = useState(false)
  const [openSections, setOpen]       = useState<string[]>(['Ordres de travail', 'Demandes d\'intervention', 'Équipements', 'Équipes', 'Stock'])
  const pathname  = usePathname()
  const router    = useRouter()
  const dispatch  = useDispatch()
  const user      = useSelector((s: RootState) => s.auth.user)
  const role      = useSelector((s: RootState) => s.auth.user?.role) as Role | undefined
  const idPole    = useSelector((s: RootState) => s.auth.user?.id_pole)
  const idUser    = useSelector((s: RootState) => s.auth.user?.id_user)
  const [nbDINotifs, setNbDINotifs] = useState(0)
  const [nbOTAssignes, setNbOTAssignes] = useState(0)

  // Charger le nombre de DI en attente
  const refreshDINotifs = useCallback(() => {
    if (!idPole || role !== 'METHODISTE') return
    diService.liste({ id_pole: Number(idPole), statut: 'EN_ATTENTE' })
      .then(data => setNbDINotifs(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [idPole, role])

  // Charger le nombre d'OT assignés à l'utilisateur
  const refreshOTAssignes = useCallback(() => {
    if (!idUser || !['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'].includes(role || '')) return
    otService.liste({ id_assigne: Number(idUser), statut: 'ASSIGNE' })
      .then(data => setNbOTAssignes(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [idUser, role])

  useEffect(() => { refreshDINotifs() }, [refreshDINotifs])
  useEffect(() => { refreshOTAssignes() }, [refreshOTAssignes])

  // Écouter les nouvelles DI
  useWebSocket((msg) => {
    if (msg.type === 'nouvelle_di' && role === 'METHODISTE') {
      setNbDINotifs(prev => prev + 1)
    }
  })

  // Écouter les événements de mise à jour DI
  useEventListener('di_count_refresh', refreshDINotifs)

  useEffect(() => {
    NAV_SECTIONS.forEach(section => {
      const hasActive = section.items.some(i => pathname.startsWith(i.href))
      if (hasActive && !openSections.includes(section.title)) {
        setOpen(prev => [...prev, section.title])
      }
    })
  }, [pathname])

  // Debug - afficher le role
  console.log('[Sidebar] Role:', role, 'User:', user)

  if (!role) return <div className="p-4 text-red-500">Pas de rôle défini</div>

  // Afficher TOUTES les sections sans filtrage par rôle
  const visibleSections = NAV_SECTIONS

  const toggleSection = (title: string) => {
    setOpen(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    )
  }

  const handleLogout = () => {
    dispatch(logout())
    router.push('/login')
  }

  const SidebarContent = () => (
    <>
      {/* ── Logo ── */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
          <Zap size={16} className="text-white"/>
        </div>
        {!collapsed && (
          <div>
            <p className="text-gray-900 dark:text-white font-bold text-sm leading-tight">
              CEVITAL
            </p>
            <p className="text-blue-600 dark:text-blue-400 text-xs font-medium">Optima Maintenance</p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {visibleSections.map(section => {
          const Icon     = section.icon
          const isDirect = section.items.length === 0
          const href     = DIRECT_LINKS[section.title] ?? '#'

          if (isDirect) {
            const isActive = pathname === href
            return (
              <Link key={section.title} href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-gray-900 dark:hover:text-white',
                  collapsed && 'justify-center px-0'
                )}>
                <Icon size={18} className="flex-shrink-0"/>
                {!collapsed && <span>{section.title}</span>}
              </Link>
            )
          }

          const hasActiveChild = section.items.some(i => pathname.startsWith(i.href))
          const expanded       = openSections.includes(section.title)

          return (
            <div key={section.title}>
              <button
                onClick={() => !collapsed && toggleSection(section.title)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  hasActiveChild
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-gray-900 dark:hover:text-white',
                  collapsed && 'justify-center px-0'
                )}>
                <Icon size={18} className="flex-shrink-0"/>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{section.title}</span>
                    {expanded
                      ? <ChevronUp   size={14} className="opacity-60"/>
                      : <ChevronDown size={14} className="opacity-60"/>
                    }
                  </>
                )}
              </button>

              {!collapsed && expanded && (
                <ul className="mt-1 ml-4 pl-3 border-l-2 border-blue-100 dark:border-blue-800 space-y-1">
                  {section.items.map(item => {
                    const isItemActive = pathname.startsWith(item.href)
                    const showBadgeDI = item.href === '/di/valider' && nbDINotifs > 0 && role === 'METHODISTE'
                    const showBadgeOT = item.href === '/ot/mes-ot' && nbOTAssignes > 0 && ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'].includes(role || '')
                    const showBadge = showBadgeDI || showBadgeOT
                    const badgeCount = showBadgeDI ? nbDINotifs : showBadgeOT ? nbOTAssignes : 0
                    return (
                      <li key={item.href}>
                        <Link href={item.href}
                          className={cn(
                            'block px-3 py-2 rounded-lg text-sm transition-all duration-200',
                            isItemActive
                              ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/30'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                          )}>
                          <span className="flex items-center justify-between">
                            {item.label}
                            {showBadge && (
                              <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                {nbDINotifs}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Bouton Déconnexion ── */}
      <div className={cn(
        'border-t border-gray-100 dark:border-gray-800 p-3',
        collapsed && 'flex justify-center'
      )}>
        <button onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
            'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
            'transition-all duration-200 w-full',
            collapsed && 'justify-center w-auto px-2'
          )}>
          <LogOut size={18} className="flex-shrink-0"/>
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm"
      >
        {mobileOpen ? <X size={18}/> : <Menu size={18}/>}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)}/>
      )}

      {/* Sidebar desktop */}
      <aside className={cn(
        'hidden lg:flex flex-col h-screen transition-all duration-300',
        'bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800',
        collapsed ? 'w-16' : 'w-64'
      )}>
        <SidebarContent/>
        
        {/* Bouton collapse */}
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center
                     bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                     text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shadow-sm
                     transition-all duration-200 z-10">
          {collapsed ? <ChevronRight size={12}/> : <ChevronLeft size={12}/>}
        </button>
      </aside>

      {/* Sidebar mobile */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-300 lg:hidden',
        'bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent/>
      </aside>
    </>
  )
}
