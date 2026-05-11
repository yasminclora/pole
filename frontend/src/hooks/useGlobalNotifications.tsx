'use client'
import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'

export interface Notification {
  id: number
  message: string
  type: string
  link?: string
  time: string
  lu: boolean
}

interface NotificationContextType {
  notifications: Notification[]
  ajouterNotification: (notif: Omit<Notification, 'id' | 'time' | 'lu'>) => void
  marquerLue: (id: number) => void
  marquerToutesLues: () => void
  supprimerNotification: (id: number) => void
  viderNotifications: () => void
  nonLues: number
}

const NotificationContext = createContext<NotificationContextType | null>(null)

let wsInstance: WebSocket | null = null

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const accessToken = useSelector((s: RootState) => s.auth.accessToken)
  const user = useSelector((s: RootState) => s.auth.user)
  const ajouterNotifRef = useRef<((notif: Omit<Notification, 'id' | 'time' | 'lu'>) => void) | null>(null)

  console.log('[NotifProvider] Render - user:', user?.id_user, 'accessToken:', !!accessToken, 'notifications:', notifications.length, 'ref:', !!ajouterNotifRef.current)

  const nonLues = notifications.filter(n => !n.lu).length

  const ajouterNotification = useCallback((notif: Omit<Notification, 'id' | 'time' | 'lu'>) => {
    console.log('[NotifProvider] ajouterNotification appelee:', notif)
    const newNotif: Notification = {
      ...notif,
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      lu: false,
    }
    setNotifications(prev => {
      return [newNotif, ...prev].slice(0, 50)
    })
    console.log('[NotifProvider] Notification ajoutee a la liste:', newNotif.message)
  }, [])

  useEffect(() => {
    ajouterNotifRef.current = ajouterNotification
  }, [ajouterNotification])

  const marquerLue = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }, [])

  const marquerToutesLues = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
  }, [])

  const supprimerNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const viderNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // WebSocket
  useEffect(() => {
    console.log('[NotifProvider] WS Effect START - user:', user?.id_user, 'accessToken:', accessToken ? 'yes' : 'no')
    
    if (!user?.id_user) {
      console.log('[NotifProvider] Pas de user')
      return
    }
    if (!accessToken) {
      console.log('[NotifProvider] Pas de accessToken')
      return
    }

    console.log('[NotifProvider] Creation connexion WebSocket...')
    console.log('[NotifProvider] Callback ref exists:', !!ajouterNotifRef.current)

    // Si deja connecte, ne pas recreer
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
      console.log('[NotifProvider] WS deja connecte')
      return
    }

    // Fermer l'ancienne connexion
    if (wsInstance) {
      wsInstance.close()
      wsInstance = null
    }

    const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8001'
    const url = `${WS_BASE}/ws/${user.id_user}?token=${encodeURIComponent(accessToken)}`
    
    console.log('[NotifProvider] Creating WebSocket:', url)
    const ws = new WebSocket(url)
    wsInstance = ws

    ws.onopen = () => {
      console.log('[NotifProvider] WS connecte!')
    }
    ws.onerror = (e) => {
      console.error('[NotifProvider] WS erreur:', e)
    }
    ws.onclose = (e) => {
      console.log('[NotifProvider] WS ferme:', e.code)
      wsInstance = null
    }

    ws.onmessage = (e) => {
      console.log('[NotifProvider] WS message recu:', e.data)
      try {
        const msg = JSON.parse(e.data)
        console.log('[NotifProvider] Message parse:', msg.type, msg)
        console.log('[NotifProvider] callback ref:', !!ajouterNotifRef.current, ajouterNotifRef.current)

        if (!ajouterNotifRef.current) {
          console.log('[NotifProvider] ERREUR: callback null!')
          return
        }

        // Filtrer par rôle
        const userRole = user?.role
        if (msg.type === 'nouvelle_di' && userRole !== 'METHODISTE') {
          console.log('[NotifProvider] Ignore nouvelle_di pour non-methodiste:', userRole)
          return
        }
        if (msg.type === 'RESERVATION_PIECE' && userRole !== 'GESTIONNAIRE_STOCK' && userRole !== 'ADMIN') {
          console.log('[NotifProvider] Ignore RESERVATION_PIECE pour non-gestionnaire:', userRole)
          return
        }

        let notificationMsg = ''
        let link = ''

switch (msg.type) {
          case 'nouvelle_di':
            notificationMsg = `Nouvelle DI a valider: ${msg.numero_di}`
            link = '/di/valider'
            break
          case 'OT_ASSIGNE':
            notificationMsg = `OT vous a ete assigne: ${msg.numero_ot || msg.numero}`
            link = '/ot/mes-ot'
            break
          case 'OT_TERMINE':
            notificationMsg = `OT termine en attente: ${msg.numero_ot}`
            link = '/ot/a-valider'
            break
          case 'OT_VALIDE_CE':
            notificationMsg = `OT valide par CE, validation HSE requise: ${msg.numero_ot}`
            link = '/ot/a-valider'
            break
          case 'OT_VALIDE_HSE':
            notificationMsg = `OT valide HSE: ${msg.numero_ot}`
            link = '/ot/archives'
            break
          case 'DI_VALIDEE':
            notificationMsg = `Votre DI a ete validee - OT: ${msg.numero_ot}`
            link = '/di/mes-di'
            break
          case 'DI_REJETEE':
            notificationMsg = `Votre DI a ete rejetee: ${msg.numero_di}`
            link = '/di/mes-di'
            break
          case 'PIECE_LIVREE':
            notificationMsg = `Piece disponible: ${msg.code_piece}`
            link = '/ot/mes-ot'
            break
          case 'RESERVATION_PIECE':
            notificationMsg = `Nouvelle reservation: ${msg.code_piece} (OT ${msg.id_ot})`
            link = '/stock/reservation'
            break
          default:
            notificationMsg = msg.message || msg.description || `${msg.type}`
        }

        if (notificationMsg) {
          ajouterNotifRef.current({ message: notificationMsg, type: msg.type, link })
        }
      } catch (err) {
        console.error('[Notif] Parse error:', err)
      }
    }
  }, [user?.id_user, accessToken])

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