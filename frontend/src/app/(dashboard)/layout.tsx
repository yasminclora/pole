'use client'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { RootState } from '@/store/store'
import { loadFromStorage } from '@/store/slices/authSlice'
import { useSessionTimeout } from '@/hooks/useSessionTimeout'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'



export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const dispatch   = useDispatch()
  const router     = useRouter()
  const isLoggedIn = useSelector((s: RootState) => s.auth.isLoggedIn)
  const [ready,    setReady]    = useState(false)

  useEffect(() => {
    dispatch(loadFromStorage() as any)
    setReady(true)
    // Force le mode clair quoi qu'il arrive (legacy dark mode supprimé)
    document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    if (ready && !isLoggedIn) router.push('/login')
  }, [ready, isLoggedIn])

  // Gestion du timeout de session (30 min d'inactivité)
  useSessionTimeout(isLoggedIn)

  if (!ready || !isLoggedIn) return null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2848 50%, #0a1628 100%)' }}>
      <Sidebar/>
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar/>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}