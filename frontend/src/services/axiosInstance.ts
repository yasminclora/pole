import axios from 'axios'

const api = axios.create({
  baseURL : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001',
  headers : { 'Content-Type': 'application/json' },
  timeout : 15_000,   // 15 secondes max par requête
})

// Injecter le token automatiquement dans chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si token expiré (401) → rediriger vers login
// Si accès refusé (403) → afficher un message clair
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (status === 403) {
      // Action non autorisée pour ce rôle — on propage l'erreur avec message clair
      const detail = error.response?.data?.detail ?? "Accès refusé."
      return Promise.reject(new Error(detail))
    }
    return Promise.reject(error)
  }
)

export default api