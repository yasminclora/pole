import { useEffect, useCallback } from 'react'

type EventCallback = () => void
const listeners: Record<string, EventCallback[]> = {}

export function emitEvent(event: string) {
  if (listeners[event]) {
    listeners[event].forEach(cb => cb())
  }
}

export function useEventListener(event: string, callback: EventCallback) {
  useEffect(() => {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(callback)
    return () => {
      listeners[event] = listeners[event].filter(cb => cb !== callback)
    }
  }, [event, callback])
}

export function useDIChangeRefresh() {
  const refresh = useCallback(() => emitEvent('di_count_refresh'), [])
  return refresh
}