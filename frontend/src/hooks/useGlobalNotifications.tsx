'use client'
import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import api from '@/services/axiosInstance'

export interface Notification {
  id           : number
  id_backend  ?: number       // id_notification côté BDD (pour marquer lu en REST)
  message      : string
  titre       ?: string
  type         : string
  link        ?: string
  time         : string
  lu           : boolean
  payload     ?: any
}

interface NotificationContextType {
  notifications        : Notification[]
  ajouterNotification  : (notif: Omit<Notification, 'id' | 'time' | 'lu'>) => void
  marquerLue           : (id: number) => void
  marquerToutesLues    : () => void
  supprimerNotification: (id: number) => void
  viderNotifications   : () => void
  nonLues              : number
}

const NotificationContext = createContext<NotificationContextType | null>(null)

let wsInstance: WebSocket | null = null

// ───────────────────────────────────────────────────────────────
//  Types d'événements "silencieux" — diffusés en WS pour permettre
//  aux pages de se rafraîchir, mais N'apparaissent PAS dans le
//  centre de notifications (pas pertinents pour l'utilisateur final).
// ───────────────────────────────────────────────────────────────
const SILENT_EVENTS = new Set<string>([
  'NOUVEL_UTILISATEUR',
  'UTILISATEUR_MODIFIE',
  'UTILISATEUR_SUPPRIME',
  'CONFIG_PLANNING_MISE_A_JOUR',
  'EQUIPE_MISE_A_JOUR',
  'DEMANDE_ECHANGE_CREEE',
  'DEMANDE_ECHANGE_TRAITEE',
])

// ───────────────────────────────────────────────────────────────
//  Mapping type → texte fallback + lien (utilisé si pas de message)
// ───────────────────────────────────────────────────────────────
function routeForType(type: string): string {
  switch (type) {
    case 'nouvelle_di'       : return '/di/valider'
    case 'DI_VALIDEE'        :
    case 'DI_REJETEE'        : return '/di/mes-di'
    case 'OT_ASSIGNE'        :
    case 'PIECE_LIVREE'      :
    case 'RESERVATION_VALIDEE':
    case 'OT_REWORK'         : return '/ot/mes-ot'
    case 'OT_TERMINE'        :
    case 'OT_VALIDE_CE'      :
    case 'OT_REJETE_HSE'     :
    case 'OT_RESOUMIS'       : return '/ot/a-valider'
    case 'OT_VALIDE_HSE'     :
    case 'OT_ARCHIVE'        : return '/ot/archives'
    case 'RESERVATION_PIECE' : return '/stock/reservation'
    case 'MON_OT_VALIDE_CE'  :
    case 'MON_OT_VALIDE_HSE' :
    case 'OT_REJETE_DEFINITIF':
    case 'MON_OT_REJETE_HSE' : return '/ot/mes-ot'
    default                  : return ''
  }
}

function shouldShowForRole(type: string, role?: string): boolean {
  // Filtres : qui voit quoi
  if (type === 'nouvelle_di' && role !== 'METHODISTE') return false
  if (type === 'RESERVATION_PIECE' && role !== 'GESTIONNAIRE_STOCK' && role !== 'ADMIN') return false
  return true
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const accessToken = useSelector((s: RootState) => s.auth.accessToken)
  const user        = useSelector((s: RootState) => s.auth.user)
  const ajouterNotifRef = useRef<((notif: Omit<Notification, 'id' | 'time' | 'lu'>) => void) | null>(null)

  const nonLues = notifications.filter(n => !n.lu).length

  const ajouterNotification = useCallback((notif: Omit<Notification, 'id' | 'time' | 'lu'>) => {
    setNotifications(prev => {
      // Anti-doublon par id_backend
      if (notif.id_backend && prev.some(n => n.id_backend === notif.id_backend)) return prev
      const newNotif: Notification = {
        ...notif,
        id  : Date.now() + Math.random(),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        lu  : false,
      }
      return [newNotif, ...prev].slice(0, 100)
    })
  }, [])

  useEffect(() => { ajouterNotifRef.current = ajouterNotification }, [ajouterNotification])

  const marquerLue = useCallback(async (id: number) => {
    const notif = notifications.find(n => n.id === id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
    if (notif?.id_backend) {
      try { await api.put(`/notifications/${notif.id_backend}/lu`) } catch {}
    }
  }, [notifications])

  const marquerToutesLues = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
    try { await api.post('/notifications/me/tout-marquer-lu') } catch {}
  }, [])

  const supprimerNotification = useCallback(async (id: number) => {
    const notif = notifications.find(n => n.id === id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (notif?.id_backend) {
      try { await api.delete(`/notifications/${notif.id_backend}`) } catch {}
    }
  }, [notifications])

  const viderNotifications = useCallback(() => setNotifications([]), [])

  // ─────────────────────────────────────────────────────────────
  //  Rattrapage REST : fetch les non-lues au login / reconnexion
  // ─────────────────────────────────────────────────────────────
  const fetchNonLues = useCallback(async () => {
    if (!user?.id_user) return
    try {
      const res = await api.get('/notifications/me/non-lues')
      const list = Array.isArray(res.data) ? res.data : []
      // Ajoute par ordre chronologique (plus ancien en premier dans state, donc on inverse)
      const mapped: Notification[] = list.map((n: any) => ({
        id        : Date.now() + Math.random() + n.id_notification,
        id_backend: n.id_notification,
        type      : n.type,
        titre     : n.titre,
        message   : n.message,
        link      : routeForType(n.type),
        time      : n.created_at ? new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        lu        : false,
        payload   : n.payload,
      }))
      // Filtrer par rôle au cas où
      const filtered = mapped.filter(m => shouldShowForRole(m.type, user.role))
      setNotifications(prev => {
        // Anti-doublon
        const existingIds = new Set(prev.map(p => p.id_backend).filter(Boolean))
        const newOnes = filtered.filter(m => !existingIds.has(m.id_backend))
        return [...newOnes, ...prev].slice(0, 100)
      })
    } catch (e) {
      console.warn('[Notif] fetch non-lues KO:', e)
    }
  }, [user?.id_user, user?.role])

  // ─────────────────────────────────────────────────────────────
  //  WebSocket (avec rattrapage REST à la connexion)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id_user || !accessToken) return

    // Si déjà connecté pour ce user, ne pas recréer
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
      // Mais on rattrape quand même les non-lues (au cas où on a changé d'onglet)
      fetchNonLues()
      return
    }

    if (wsInstance) { wsInstance.close(); wsInstance = null }

    const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8001'
    const url = `${WS_BASE}/ws/${user.id_user}?token=${encodeURIComponent(accessToken)}`
    const ws = new WebSocket(url)
    wsInstance = ws

    ws.onopen = () => {
      console.log('[Notif] WS connecté')
      // ★ Rattrapage REST des non-lues
      fetchNonLues()
    }

    ws.onerror = (e) => console.warn('[Notif] WS erreur', e)
    ws.onclose = () => { wsInstance = null }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)

        // ① Toujours dispatcher l'event WS pour les pages qui s'y abonnent
        //    via useWebSocket (rafraîchissement temps-réel d'une liste, etc.)
        try {
          window.dispatchEvent(new CustomEvent('app:ws-message', { detail: msg }))
        } catch {}

        // ② Si c'est un événement "silencieux" → on ne l'affiche pas dans le centre
        if (SILENT_EVENTS.has(msg.type)) return

        // ③ Filtrage par rôle
        if (!shouldShowForRole(msg.type, user.role)) return
        if (!ajouterNotifRef.current) return

        const message = msg.message || msg.description || `${msg.type}`
        ajouterNotifRef.current({
          message,
          titre     : msg.titre,
          type      : msg.type,
          link      : routeForType(msg.type),
          id_backend: msg.id_notification,
          payload   : msg,
        })
      } catch (err) {
        console.error('[Notif] parse error', err)
      }
    }
  }, [user?.id_user, user?.role, accessToken, fetchNonLues])

  // ─────────────────────────────────────────────────────────────
  //  Rattrapage périodique (toutes les 60s en filet de sécurité)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id_user) return
    const interval = setInterval(() => { fetchNonLues() }, 60_000)
    return () => clearInterval(interval)
  }, [user?.id_user, fetchNonLues])

  return (
    <NotificationContext.Provider value={{
      notifications,
      ajouterNotification,
      marquerLue,
      marquerToutesLues,
      supprimerNotification,
      viderNotifications,
      nonLues,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useGlobalNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useGlobalNotifications must be used within NotificationProvider')
  }
  return context
}
