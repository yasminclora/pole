'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '@/store/store'
import { logout } from '@/store/slices/authSlice'
import { NAV_SECTIONS, DIRECT_LINKS, Role } from '@/config/navigation'
import { useEventListener } from '@/hooks/useEvent'
import { useGlobalNotifications } from '@/hooks/useGlobalNotifications'
import { diService } from '@/services/diService'
import { otService } from '@/services/otService'
import {
  ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp,
  Zap, LogOut, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const dispatch  = useDispatch()
  const user      = useSelector((s: RootState) => s.auth.user)
  const role      = useSelector((s: RootState) => s.auth.user?.role) as Role | undefined
  const idPole    = useSelector((s: RootState) => s.auth.user?.id_pole)
  const idUser    = useSelector((s: RootState) => s.auth.user?.id_user)

  const [collapsed,    setCollapsed]  = useState(false)
  const [mobileOpen,  setMobileOpen] = useState(false)
  const [openSections, setOpen]       = useState<string[]>(['Ordres de travail', "Demandes d'intervention", 'Equipements', 'Equipes', 'Stock'])
  const [nbDINotifs,   setNbDINotifs]   = useState(0)
  const [nbOTAssignes, setNbOTAssignes] = useState(0)

  const { notifications } = useGlobalNotifications()

  // Auto-ouvrir la section active au chargement
  useEffect(() => {
    const activeSection = visibleSections.find(section => 
      section.items.some(item => pathname.startsWith(item.href))
    )
    if (activeSection) {
      setOpen([activeSection.title])
    }
  }, [pathname])

  const refreshDINotifs = useCallback(() => {
    if (!idPole || role !== 'METHODISTE') return
    diService.liste({ id_pole: Number(idPole), statut: 'EN_ATTENTE' })
      .then(data => setNbDINotifs(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [idPole, role])

  const refreshOTAssignes = useCallback(() => {
    if (!idUser || !['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'].includes(role || '')) return
    otService.liste({ id_assigne: Number(idUser), statut: 'ASSIGNE' })
      .then(data => setNbOTAssignes(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [idUser, role])

  useEffect(() => { refreshDINotifs()   }, [refreshDINotifs])
  useEffect(() => { refreshOTAssignes() }, [refreshOTAssignes])

  useEffect(() => {
    const derniere = notifications[0]
    if (!derniere) return
    if (derniere.type === 'nouvelle_di' && role === 'METHODISTE') {
      refreshDINotifs()
    }
    if (derniere.type === 'OT_ASSIGNE' && ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'].includes(role || '')) {
      refreshOTAssignes()
    }
  }, [notifications])

  useEventListener('di_count_refresh', refreshDINotifs)

  useEffect(() => {
    NAV_SECTIONS.forEach(section => {
      const hasActive = section.items.some(i => pathname.startsWith(i.href))
      if (hasActive && !openSections.includes(section.title)) {
        setOpen(prev => [...prev, section.title])
      }
    })
  }, [pathname])

  if (!role) return <div className="p-4 text-red-500">Pas de role defini</div>

  const visibleSections = NAV_SECTIONS
  .filter(section => section.allowedRoles.includes(role as Role))
  .map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.allowedRoles.includes(role as Role)
    )
  }))
  .filter(section => section.items.length > 0 || DIRECT_LINKS[section.title])

  const toggleSection = (title: string) => {
    setOpen(prev =>
      prev.includes(title) 
        ? prev.filter(t => t !== title) 
        : [title] // Only one section open at a time
    )
  }

  const handleLogout = () => {
    dispatch(logout())
    router.push('/login')
  }

  const SidebarContent = () => (
    <>
      <div className={cn(
        'flex items-center gap-3 px-5 py-5 border-b border-blue-900/30 flex-shrink-0',
        collapsed && 'justify-center px-0'
      )}>
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
          <Zap size={20} className="text-white"/>
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-base">CEVITAL</p>
            <p className="text-blue-400 text-xs">Optima</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {visibleSections.map(section => {
          const Icon     = section.icon
          const isDirect = section.items.length === 0
          const href     = DIRECT_LINKS[section.title] ?? '#'

          if (isDirect) {
            const isActive = pathname === href
            return (
              <Link key={section.title} href={href}
                className={cn(
                  'flex items-center gap-4 px-5 py-4 rounded-xl text-base font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#1d6fd4] text-white shadow-lg shadow-blue-500/20'
                    : 'text-white/60 hover:bg-blue-500/20 hover:text-white',
                  collapsed && 'justify-center px-0 w-16'
                )}>
                <Icon size={22} className="flex-shrink-0"/>
                {!collapsed && <span>{section.title}</span>}
              </Link>
            )
          }

          const hasActiveChild = section.items.some(i => pathname.startsWith(i.href))
          const expanded       = openSections.includes(section.title)

          return (
            <div key={section.title} className={hasActiveChild ? 'bg-blue-500/10 -mx-2 px-2 rounded-xl' : ''}>
              <button
                onClick={() => !collapsed && toggleSection(section.title)}
                className={cn(
                  'w-full flex items-center gap-4 px-5 py-4 rounded-xl text-base font-medium transition-all duration-200',
                  hasActiveChild
                    ? 'bg-[#1d6fd4] text-white shadow-lg shadow-blue-500/20'
                    : 'text-white/60 hover:bg-blue-500/20 hover:text-white',
                  collapsed && 'justify-center px-0 w-16'
                )}>
                <Icon size={22} className={cn('flex-shrink-0', hasActiveChild && 'text-blue-200')}/>
                {!collapsed && (
                  <>
                    <span className={cn('flex-1 text-left', hasActiveChild && 'font-semibold')}>{section.title}</span>
                    {expanded
                      ? <ChevronUp   size={18} className="opacity-60"/>
                      : <ChevronDown size={18} className="opacity-60"/>
                    }
                  </>
                )}
              </button>

              {!collapsed && expanded && (
                <ul className="mt-2 ml-6 pl-4 border-l-2 border-blue-500/30 space-y-2">
                  {section.items.map(item => {
                    const isItemActive = pathname.startsWith(item.href)
                    const showBadgeDI  = item.href === '/di/valider' && nbDINotifs   > 0 && role === 'METHODISTE'
                    const showBadgeOT  = item.href === '/ot/mes-ot'  && nbOTAssignes > 0 && ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'].includes(role || '')
                    const showBadge    = showBadgeDI || showBadgeOT
                    const badgeCount   = showBadgeDI ? nbDINotifs : nbOTAssignes
                    return (
                      <li key={item.href}>
                        <Link href={item.href}
                          className={cn(
                            'block px-5 py-3 rounded-lg text-sm transition-all duration-200',
                            isItemActive
                              ? 'text-blue-400 font-semibold bg-blue-500/20'
                              : 'text-white/50 hover:bg-blue-500/10 hover:text-white'
                          )}>
                          <span className="flex items-center justify-between">
                            {item.label}
                            {showBadge && (
                              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                {badgeCount > 9 ? '9+' : badgeCount}
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

      <div className={cn(
        'border-t border-blue-900/30 p-3',
        collapsed && 'flex justify-center'
      )}>
        <button onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
            'text-red-400 hover:bg-red-500/20',
            'transition-all duration-200 w-full',
            collapsed && 'justify-center w-auto px-2'
          )}>
          <LogOut size={18} className="flex-shrink-0"/>
          {!collapsed && <span>Deconnexion</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-xl bg-[#1d6fd4] border border-blue-400/30 flex items-center justify-center shadow-lg"
      >
        {mobileOpen ? <X size={18} className="text-white"/> : <Menu size={18} className="text-white"/>}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)}/>
      )}

      <aside className={cn(
        'hidden lg:flex flex-col h-screen transition-all duration-300',
        'bg-[#0a1628] border-r border-blue-900/30',
        collapsed ? 'w-20' : 'w-80'
      )}>
        <SidebarContent/>
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-28 w-8 h-8 rounded-full flex items-center justify-center
                     bg-[#1d6fd4] border border-blue-400/30
                     text-white shadow-sm
                     transition-all duration-200 z-10">
          {collapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
        </button>
      </aside>

      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-80 flex flex-col transition-transform duration-300 lg:hidden',
        'bg-[#0a1628] border-r border-blue-900/30',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent/>
      </aside>
    </>
  )
}