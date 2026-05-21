'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
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
  Zap, LogOut, Menu, X, Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fontStyle = { fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const dispatch  = useDispatch()
  const role      = useSelector((s: RootState) => s.auth.user?.role) as Role | undefined
  const idPole    = useSelector((s: RootState) => s.auth.user?.id_pole)
  const idUser    = useSelector((s: RootState) => s.auth.user?.id_user)

  const [collapsed,    setCollapsed]  = useState(false)
  const [mobileOpen,  setMobileOpen] = useState(false)
  // On initialise uniquement avec les sections principales que l'on veut ouvertes par défaut
  const [openSections, setOpen]       = useState<string[]>(['Ordres de travail', "Demandes d'intervention"])
  const [nbDINotifs,   setNbDINotifs]   = useState(0)
  const [nbOTAssignes, setNbOTAssignes] = useState(0)

  const { notifications } = useGlobalNotifications()

  // CORRECTION BUG : Gestion propre de l'auto-ouverture au chargement initial
  useEffect(() => {
    const activeSection = visibleSections.find(section => 
      section.items.some(item => {
        // Si c'est la racine, on compare strictement pour éviter que "/" match avec tout
        if (item.href === '/') return pathname === '/'
        return pathname.startsWith(item.href)
      })
    )
    if (activeSection && !openSections.includes(activeSection.title)) {
      setOpen([activeSection.title]) // N'ouvre que celle-ci et ferme les autres
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

  if (!role) return <div className="p-4 text-red-500 font-bold" style={fontStyle}>Pas de role defini</div>

  const visibleSections = NAV_SECTIONS
  .filter(section => section.allowedRoles.includes(role as Role))
  .map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.allowedRoles.includes(role as Role)
    )
  }))
  .filter(section => section.items.length > 0 || DIRECT_LINKS[section.title])

  // ACTION DE CLIC : Force la fermeture des autres dossiers (accordéon strict)
  const toggleSection = (title: string) => {
    setOpen(prev => prev.includes(title) ? [] : [title])
  }

  const handleLogout = () => {
    dispatch(logout())
    router.push('/login')
  }

  const SidebarContent = () => {
    return (
      <div className="flex flex-col h-full">
        
        {/* ════════════ HEADER LOGO ════════════ */}
        <div className={cn(
          'flex items-center gap-4 px-6 py-7 border-b border-slate-800 flex-shrink-0 relative bg-[#071322]',
          collapsed && 'justify-center px-0'
        )}>
          <div className="relative flex-shrink-0 w-14 h-14 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-xl flex items-center justify-center shadow-xl shadow-blue-600/10">
            <Zap size={28} className="text-white drop-shadow-md"/>
          </div>
          {!collapsed && (
            <div className="relative">
              <p className="text-white font-black text-2xl tracking-normal leading-none" style={{ fontFamily: '"Arial Black", sans-serif' }}>Cevital</p>
              <p className="text-blue-400 font-bold text-xs tracking-wider uppercase mt-1.5" style={fontStyle}>Optima · GMAO</p>
            </div>
          )}
        </div>

        {/* ════════════ NAVIGATION ÉPURÉE (SANS GROUPES) ════════════ */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-3 bg-[#0a192f]">
          {visibleSections.map((section) => {
            const Icon     = section.icon
            const isDirect = section.items.length === 0
            const href     = DIRECT_LINKS[section.title] ?? '#'

            // ── Liens Directs ──
            const renderDirect = () => {
              const isActive = pathname === href
              return (
                <Link
                  href={href}
                  style={fontStyle}
                  className={cn(
                    'group relative flex items-center gap-5 px-5 py-4 rounded-xl text-lg font-bold transition-all duration-200',
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 ring-1 ring-blue-400/30'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white',
                    collapsed && 'justify-center px-0 w-16'
                  )}
                >
                  <Icon size={24} className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-white group-hover:scale-105')}/>
                  {!collapsed && <span>{section.title}</span>}
                </Link>
              )
            }

            // ── Dossiers Déroulants ──
            const renderExpandable = () => {
              const hasActiveChild = section.items.some(i => {
                if (i.href === '/') return pathname === '/'
                return pathname.startsWith(i.href)
              })
              const expanded = openSections.includes(section.title)

              return (
                <div className="space-y-1">
                  <button
                    onClick={() => !collapsed && toggleSection(section.title)}
                    style={fontStyle}
                    className={cn(
                      'group relative w-full flex items-center gap-5 px-5 py-4 rounded-xl text-lg font-bold transition-all duration-200',
                      hasActiveChild
                        ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white',
                      collapsed && 'justify-center px-0 w-16'
                    )}
                  >
                    <Icon size={24} className={cn('flex-shrink-0', hasActiveChild ? 'text-blue-400' : 'text-slate-400 group-hover:text-white')}/>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{section.title}</span>
                        {expanded
                          ? <ChevronUp   size={22} className="text-white"/>
                          : <ChevronDown size={22} className="text-white"/>
                        }
                      </>
                    )}
                  </button>

                  {!collapsed && expanded && (
                    <ul className="mt-1 ml-6 pl-4 border-l-2 border-slate-700 space-y-2">
                      {section.items.map(item => {
                        const isItemActive = pathname.startsWith(item.href)
                        const showBadgeDI  = item.href === '/di/valider' && nbDINotifs   > 0 && role === 'METHODISTE'
                        const showBadgeOT  = item.href === '/ot/mes-ot'  && nbOTAssignes > 0 && ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE'].includes(role || '')
                        const showBadge    = showBadgeDI || showBadgeOT
                        const badgeCount   = showBadgeDI ? nbDINotifs : nbOTAssignes
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              style={fontStyle}
                              className={cn(
                                'group relative block px-4 py-3 rounded-lg text-base font-bold transition-all duration-200',
                                isItemActive
                                  ? 'text-cyan-400 bg-blue-955/30'
                                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                              )}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-3">
                                  {isItemActive && (
                                    <Circle size={8} fill="currentColor" className="text-cyan-400 flex-shrink-0"/>
                                  )}
                                  {item.label}
                                </span>
                                {showBadge && (
                                  <span className="px-2.5 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full min-w-[24px] text-center shadow-md">
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
            }

            return (
              <Fragment key={section.title}>
                {isDirect ? renderDirect() : renderExpandable()}
              </Fragment>
            )
          })}
        </nav>

        {/* ════════════ FOOTER : BOUTON BLEU ════════════ */}
        <div className={cn(
          'border-t border-slate-800 p-4 flex-shrink-0 bg-[#071322]',
          collapsed && 'flex justify-center'
        )}>
          <button
            onClick={handleLogout}
            style={fontStyle}
            className={cn(
              'group flex items-center gap-4 px-5 py-4 rounded-xl text-lg font-bold w-full',
              'text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/10 transition-all duration-200',
              collapsed && 'justify-center px-2 w-auto'
            )}
            title="Déconnexion"
          >
            <LogOut size={22} className="flex-shrink-0 group-hover:translate-x-1 transition-transform"/>
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-2xl"
      >
        {mobileOpen ? <X size={26} className="text-white"/> : <Menu size={26} className="text-white"/>}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 lg:hidden" onClick={() => setMobileOpen(false)}/>
      )}

      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen transition-all duration-300 relative border-r border-slate-800 shadow-2xl',
          collapsed ? 'w-24' : 'w-86'
        )}
      >
        <SidebarContent/>
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-4 top-28 w-9 h-9 rounded-full flex items-center justify-center
                     bg-blue-600 text-white shadow-xl hover:scale-110 transition-all duration-200 z-10">
          {collapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
        </button>
      </aside>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-86 flex flex-col transition-transform duration-300 lg:hidden border-r border-slate-800',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent/>
      </aside>
    </>
  )
}