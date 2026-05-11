'use client'
import { store } from '@/store/store'
import { Provider } from 'react-redux'
import { NotificationProvider } from '@/hooks/useGlobalNotifications'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </Provider>
  )
}