'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { setCredentials } from '@/store/slices/authSlice'
import { authService } from '@/services/authService'
import { Eye, EyeOff, Loader2, Zap, KeyRound, X, Check, ArrowLeft } from 'lucide-react'
import api from '@/services/axiosInstance'

type Vue = 'login' | 'reinit' | 'succes'

export default function LoginPage() {
  const dispatch = useDispatch()
  const router   = useRouter()

  // ── Login ──
  const [email,       setEmail]      = useState('')
  const [motDePasse,  setMotDePasse] = useState('')
  const [showPass,    setShowPass]   = useState(false)
  const [loading,     setLoading]    = useState(false)
  const [erreur,      setErreur]     = useState('')

  // ── Réinitialisation ──
  const [vue,         setVue]        = useState<Vue>('login')
  const [emailReinit, setEmailReinit]= useState('')
  const [loadingReinit, setLoadingReinit] = useState(false)
  const [erreurReinit,  setErreurReinit]  = useState('')
  const [mdpRetrouve,   setMdpRetrouve]   = useState('')

  // Animation d'entrée
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErreur('')
    try {
      const data = await authService.login(email, motDePasse)
      dispatch(setCredentials({ user: data.user, token: data.access_token }))
      router.push('/dashboard')
    } catch {
      setErreur('Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  const handleReinit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingReinit(true)
    setErreurReinit('')
    try {
      const res = await api.post('/auth/reinitialiser-mdp', {
        email: emailReinit.trim().toLowerCase()
      })
      setMdpRetrouve(res.data.mdp_initial ?? '')
      setVue('succes')
    } catch (err: any) {
      setErreurReinit(
        err.response?.data?.detail ?? 'Une erreur est survenue'
      )
    } finally {
      setLoadingReinit(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative">
      {/* Fond animé */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 animate-gradient-xy" style={{ backgroundSize: '200% 200%' }} />
      <div className="absolute inset-0 bg-black/20" />

      {/* Contenu */}
      <div className={`relative z-10 w-full max-w-md px-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* Logo animé */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm mb-4 shadow-2xl animate-bounce-slow">
            <Zap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Optima Maintenance
          </h1>
          <p className="text-blue-100 text-sm mt-1 tracking-wide">
            Plateforme G-MAO · Cevital
          </p>
        </div>

        {/* ══════════ VUE LOGIN ══════════ */}
        {vue === 'login' && (
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 dark:border-gray-700/50 transition-all duration-500 hover:shadow-3xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Connexion
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Accédez à votre espace de travail
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 transition-colors group-focus-within:text-blue-600">
                  Adresse email
                </label>
                <input type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="prenom.nom@optima.dz"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-50/50 dark:bg-gray-800/50
                             text-gray-900 dark:text-white text-sm
                             placeholder:text-gray-400 dark:placeholder:text-gray-500
                             focus:outline-none focus:ring-2 focus:ring-blue-500
                             focus:border-transparent transition-all duration-300
                             hover:border-gray-300 dark:hover:border-gray-600" />
              </div>

              {/* Mot de passe */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={motDePasse}
                    onChange={e => setMotDePasse(e.target.value)}
                    placeholder="••••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                               bg-gray-50/50 dark:bg-gray-800/50
                               text-gray-900 dark:text-white text-sm
                               placeholder:text-gray-400
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               focus:border-transparent transition-all pr-12" />
                  <button type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2
                               text-gray-400 hover:text-gray-600
                               dark:hover:text-gray-300 transition-colors duration-200">
                    {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>

              {/* Erreur */}
              {erreur && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20
                               border border-red-200 dark:border-red-800
                               text-red-600 dark:text-red-400 text-sm
                               animate-shake">
                  ⚠ {erreur}
                </div>
              )}

              {/* Bouton connexion */}
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2
                           bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700
                           text-white font-medium rounded-xl py-3 text-sm
                           transition-all duration-300 transform hover:scale-[1.02]
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg hover:shadow-xl">
                {loading && <Loader2 size={16} className="animate-spin"/>}
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>

              {/* Lien mot de passe oublié */}
              <div className="text-center pt-2">
                <button type="button"
                  onClick={() => {
                    setVue('reinit')
                    setEmailReinit(email)
                    setErreur('')
                  }}
                  className="text-sm text-blue-500 hover:text-blue-600
                             hover:underline transition-colors duration-200">
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══════════ VUE RÉINITIALISATION ══════════ */}
        {vue === 'reinit' && (
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 dark:border-gray-700/50 transition-all duration-500">
            {/* En-tête */}
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => { setVue('login'); setErreurReinit('') }}
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700
                           flex items-center justify-center
                           text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800
                           transition-all duration-200">
                <ArrowLeft size={15}/>
              </button>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Réinitialiser le mot de passe
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Entrez votre email professionnel
                </p>
              </div>
            </div>

            {/* Icône */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30
                                  flex items-center justify-center
                                  animate-pulse">
                <KeyRound size={28} className="text-amber-500"/>
              </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              Le système remettra automatiquement votre mot de passe à sa valeur initiale
              <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                {' '}Optima@JJMMAAAA
              </span>
            </p>

            <form onSubmit={handleReinit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Votre adresse email
                </label>
                <input type="email"
                  value={emailReinit}
                  onChange={e => setEmailReinit(e.target.value)}
                  placeholder="prenom.nom@optima.dz"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-50/50 dark:bg-gray-800/50
                             text-gray-900 dark:text-white text-sm
                             placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-amber-500
                             focus:border-transparent transition-all duration-300" />
              </div>

              {erreurReinit && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20
                               border border-red-200 dark:border-red-800
                               text-red-600 dark:text-red-400 text-sm">
                  ⚠ {erreurReinit}
                </div>
              )}

              <button type="submit" disabled={loadingReinit || !emailReinit}
                className="w-full flex items-center justify-center gap-2
                           bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600
                           disabled:opacity-50 disabled:cursor-not-allowed
                           text-white font-medium rounded-xl py-3 text-sm
                           transition-all duration-300 transform hover:scale-[1.02]
                           shadow-lg">
                {loadingReinit
                  ? <><Loader2 size={16} className="animate-spin"/> Réinitialisation...</>
                  : <><KeyRound size={16}/> Réinitialiser mon mot de passe</>
                }
              </button>
            </form>
          </div>
        )}

        {/* ══════════ VUE SUCCÈS ══════════ */}
        {vue === 'succes' && (
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 dark:border-gray-700/50 transition-all duration-500">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30
                                  flex items-center justify-center mx-auto mb-6
                                  animate-scale-in">
                <Check size={36} className="text-green-500"/>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Mot de passe réinitialisé !
              </h2>

              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                Votre mot de passe a été remis à sa valeur initiale
              </p>

              {/* Afficher le mot de passe retrouvé */}
              <div className="bg-amber-50 dark:bg-amber-900/20
                             border border-amber-200 dark:border-amber-800
                             rounded-2xl p-5 mb-8
                             animate-fade-in">
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-1.5 font-medium">
                  VOTRE NOUVEAU MOT DE PASSE
                </p>
                <p className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-300
                          tracking-wider">
                  {mdpRetrouve}
                </p>
                <p className="text-xs text-amber-500 dark:text-amber-400 mt-3">
                  Pensez à le changer depuis votre profil après connexion
                </p>
              </div>

              <button onClick={() => {
                setVue('login')
                setEmailReinit('')
                setMdpRetrouve('')
              }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600
                           hover:from-blue-700 hover:to-purple-700
                           text-white text-sm font-medium transition-all duration-300
                           transform hover:scale-[1.02] shadow-lg">
                Retour à la connexion
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-blue-100/70 text-xs mt-8">
          © 2026 Cevital · Optima v1.0
        </p>
      </div>

      {/* Styles pour les animations personnalisées */}
      <style>{`
        @keyframes gradient-xy {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-xy {
          background-size: 200% 200%;
          animation: gradient-xy 15s ease infinite;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes scale-in {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.7s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
