import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'

export interface WsMessage {
  type    : string
  message : string
  [key: string]: any
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'

/**
 * Hook WebSocket sécurisé - connexion retardée pour ne pas bloquer le rendu.
 */
export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const user        = useSelector((s: RootState) => s.auth.user)
  const accessToken = useSelector((s: RootState) => s.auth.accessToken)
  const cbRef       = useRef(onMessage)
  const wsRef       = useRef<WebSocket | null>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actifRef    = useRef(true)
  const delayRef    = useRef(3000)

  cbRef.current = onMessage

  useEffect(() => {
    if (!user?.id_user || !accessToken) return
    
    actifRef.current = true
    delayRef.current = 3000

    const connect = () => {
      if (!actifRef.current) return
      
      // Ne pas crasher si erreur - try/catch autour de WebSocket
      let ws: WebSocket | null = null
      try {
        const url = `${WS_BASE}/ws/${user.id_user}?token=${encodeURIComponent(accessToken)}`
        ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          delayRef.current = 3000
        }

        ws.onmessage = (e) => {
          try {
            cbRef.current(JSON.parse(e.data) as WsMessage)
          } catch { /* ignore */ }
        }

        ws.onclose = () => {
          if (!actifRef.current) return
          timerRef.current = setTimeout(() => {
            delayRef.current = Math.min(delayRef.current * 2, 30_000)
            connect()
          }, delayRef.current)
        }

        ws.onerror = () => {
          ws?.close()
        }
      } catch (err) {
        console.warn('[WS] Connexion echouee:', err)
      }
    }

    // Retarder la connexion de 2 secondes pour ne pas bloquer le rendu initial
    const initTimeout = setTimeout(connect, 2000)

    return () => {
      actifRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      clearTimeout(initTimeout)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [user?.id_user, accessToken])
}