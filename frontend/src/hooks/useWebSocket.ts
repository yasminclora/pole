'use client'
import { useEffect, useRef } from 'react'

export interface WsMessage {
  type    : string
  message?: string
  [key: string]: any
}

/**
 * Hook qui s'abonne aux messages WebSocket reçus par NotificationProvider.
 *
 * Le NotificationProvider dispatche un CustomEvent 'app:ws-message' sur window
 * pour chaque message reçu. Ce hook s'y abonne et nettoie au démontage.
 *
 * Usage :
 *   useWebSocket((msg) => {
 *     if (msg.type === 'NOUVEL_UTILISATEUR') refetchUsers()
 *   })
 */
export function useWebSocket(onMessage?: (msg: WsMessage) => void) {
  const cbRef = useRef(onMessage)
  useEffect(() => { cbRef.current = onMessage }, [onMessage])

  useEffect(() => {
    if (!cbRef.current) return
    const handler = (e: Event) => {
      const ce = e as CustomEvent<WsMessage>
      cbRef.current?.(ce.detail)
    }
    window.addEventListener('app:ws-message', handler as EventListener)
    return () => window.removeEventListener('app:ws-message', handler as EventListener)
  }, [])
}
