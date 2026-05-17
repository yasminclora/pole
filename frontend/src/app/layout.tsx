'use client'
import { store } from '@/store/store'
import { Provider } from 'react-redux'
import { NotificationProvider } from '@/hooks/useGlobalNotifications'
import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-950 transition-colors duration-300">
        <Provider store={store}>
          <QueryProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </QueryProvider>
        </Provider>
      </body>
    </html>
  )
}