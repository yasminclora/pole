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
 * Hook WebSocket sécurisé.
 * - Passe le JWT en query param `?token=...` (requis par le backend)
 * - Backoff exponentiel sur la reconnexion (3s → 6s → 12s … max 30s)
 * - Erreurs JSON logguées (non silencieuses)
 */
export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const user        = useSelector((s: RootState) => s.auth.user)
  const accessToken = useSelector((s: RootState) => s.auth.accessToken)
  const cbRef       = useRef(onMessage)
  const wsRef       = useRef<WebSocket | null>(null)
  const timer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actif       = useRef(true)
  const delay       = useRef(3000)   // backoff initial 3 s

  cbRef.current = onMessage

  useEffect(() => {
    if (!user?.id_user || !accessToken) return
    actif.current = true
    delay.current = 3000

    const connect = () => {
      if (!actif.current) return

      const url = `${WS_BASE}/ws/${user.id_user}?token=${encodeURIComponent(accessToken)}`
      const ws  = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        delay.current = 3000   // reset backoff on successful connect
      }

      ws.onmessage = (e) => {
        try {
          cbRef.current(JSON.parse(e.data) as WsMessage)
        } catch (err) {
          console.warn('[WS] Message JSON invalide :', e.data, err)
        }
      }

      ws.onclose = () => {
        if (!actif.current) return
        timer.current = setTimeout(() => {
          delay.current = Math.min(delay.current * 2, 30_000)  // max 30s
          connect()
        }, delay.current)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      actif.current = false
      if (timer.current) clearTimeout(timer.current)
      wsRef.current?.close()
    }
  }, [user?.id_user, accessToken])
}