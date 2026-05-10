import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { logout } from '@/store/slices/authSlice'
import { useRouter } from 'next/navigation'

const INACTIVITY_LIMIT = 30 * 60 * 1000 // 30 minutes en ms

export function useSessionTimeout(isAuthenticated: boolean) {
  const dispatch = useDispatch()
  const router = useRouter()
  const timerRef = useRef<number>()

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      dispatch(logout())
      router.push('/login')
    }, INACTIVITY_LIMIT)
  }

  useEffect(() => {
    if (!isAuthenticated) return

    // Événements à écouter pour l'activité
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    const handleActivity = () => resetTimer()

    // Initialiser le timer
    resetTimer()

    // Ajouter les écouteurs
    events.forEach(event => {
      window.addEventListener(event, handleActivity)
    })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [isAuthenticated])
}
