'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { setCredentials } from '@/store/slices/authSlice'
import { authService } from '@/services/authService'
import { Eye, EyeOff, Loader2, Zap, Star } from 'lucide-react'
import api from '@/services/axiosInstance'

type Vue = 'login' | 'reinit' | 'succes'

export default function LoginPage() {
  const dispatch = useDispatch()
  const router   = useRouter()

  const [email,       setEmail]      = useState('')
  const [motDePasse,  setMotDePasse] = useState('')
  const [showPass,    setShowPass]   = useState(false)
  const [loading,     setLoading]    = useState(false)
  const [erreur,      setErreur]     = useState('')
  
  // Validation email
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isOptimaEmail = (email: string) => email.toLowerCase().endsWith('@optima.dz')

  const [vue,           setVue]           = useState<Vue>('login')
  const [emailReinit,   setEmailReinit]   = useState('')
  const [loadingReinit, setLoadingReinit] = useState(false)
  const [erreurReinit,  setErreurReinit]  = useState('')
  const [mdpRetrouve,   setMdpRetrouve]   = useState('')

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
    } catch { setErreur('Email ou mot de passe incorrect.') }
    finally { setLoading(false) }
  }

  const handleReinit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingReinit(true)
    setErreurReinit('')
    try {
      const res = await api.post('/auth/reinitialiser-mdp', { email: emailReinit.trim().toLowerCase() })
      setMdpRetrouve(res.data.mdp_initial ?? '')
      setVue('succes')
    } catch (err: any) { setErreurReinit(err.response?.data?.detail ?? 'Erreur') }
    finally { setLoadingReinit(false) }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* ── FOND ANIMÉ ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0d2848] to-[#0a1628]">
        
        {/* Orbes animés */}
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="orb orb3" />
        
        {/* Grille subtile */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
        
        {/* Boules qui flottent */}
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`ball ball-${i + 1}`} />
        ))}
        
        {/* Étoiles qui flottent */}
        {[...Array(8)].map((_, i) => (
          <div key={`star-${i}`} className={`star star-${i + 1}`}>
            <Star size={12} className="text-blue-300/40" fill="currentColor" />
          </div>
        ))}
      </div>

      {/* ── CONTENU CENTRÉ ── */}
      <div className={`relative z-10 w-full max-w-lg transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Logo header */}
        <div className="text-center mb-10">
          <div className="logo-container inline-flex items-center justify-center mb-5">
            <Zap size={36} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Optima</h1>
          <p className="text-blue-400/50 text-xs tracking-[0.3em] uppercase mt-3">Cevital · G-MAO</p>
        </div>

        {/* ══ LOGIN ══ */}
        {vue === 'login' && (
          <div className="form-card">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white">Connexion</h2>
              <p className="text-white/40 text-sm mt-2">Accédez à votre espace de travail</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="input-wrapper">
                <label className="input-label">Adresse email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErreur('') }}
                    placeholder="prenom.nom@optima.dz"
                    required
                    className="input-field pr-20"
                  />
                  {email && isValidEmail(email) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isOptimaEmail(email) ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <span className="text-amber-400 text-xs">!</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="input-wrapper">
                <label className="input-label">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={motDePasse}
                    onChange={e => { setMotDePasse(e.target.value); setErreur('') }}
                    placeholder="••••••••••"
                    required
                    className="input-field pr-20"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-blue-400 transition-colors">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {erreur && (
                <div className="error-message">⚠ {erreur}</div>
              )}

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Connexion...</> : 'Se connecter →'}
              </button>

              <div className="text-center pt-2">
                <button type="button" onClick={() => { setVue('reinit'); setEmailReinit(email) }} className="text-white/40 hover:text-white text-sm transition-colors">
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ══ REINIT ══ */}
        {vue === 'reinit' && (
          <div className="form-card">
            <button onClick={() => setVue('login')} className="text-white/40 hover:text-white text-sm mb-4 transition-colors">
              ← Retour
            </button>
            
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">Réinitialiser</h2>
              <p className="text-white/40 text-xs mt-1">Entrez votre email professionnel</p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="key-icon">
                <Zap size={24} className="text-blue-400" />
              </div>
            </div>

            <p className="text-white/40 text-xs text-center mb-4">Votre mot de passe sera remis à <span className="font-mono text-blue-400">Optima@JJMMAAAA</span></p>

            <form onSubmit={handleReinit} className="space-y-5">
              <div className="input-wrapper">
                <label className="input-label">Votre email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={emailReinit}
                    onChange={e => setEmailReinit(e.target.value)}
                    placeholder="prenom.nom@optima.dz"
                    required
                    className="input-field pr-20"
                  />
                  {emailReinit && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {isOptimaEmail(emailReinit) ? (
                        <span className="valid-badge">
                          <span>✓</span> Optima
                        </span>
                      ) : isValidEmail(emailReinit) ? (
                        <span className="invalid-badge">
                          <span>!</span> Non-Optima
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {erreurReinit && <div className="error-message">⚠ {erreurReinit}</div>}

              <button type="submit" disabled={loadingReinit} className="amber-btn">
                {loadingReinit ? <Loader2 size={16} className="animate-spin" /> : 'Réinitialiser'}
              </button>
            </form>
          </div>
        )}

        {/* ══ SUCCES ══ */}
        {vue === 'succes' && (
          <div className="form-card text-center">
            <div className="success-icon mx-auto mb-5">
              <span className="text-2xl text-emerald-400">✓</span>
            </div>
            
            <h2 className="text-xl font-semibold text-white mb-2">Mot de passe réinitialisé !</h2>
            <p className="text-white/40 text-xs mb-6">Votre mot de passe a été remis à sa valeur initiale</p>

            <div className="mdp-box mb-6">
              <p className="text-[10px] text-blue-400/60 uppercase tracking-wider mb-1">Nouveau mot de passe</p>
              <p className="font-mono text-xl font-bold text-blue-400">{mdpRetrouve}</p>
            </div>

            <button onClick={() => setVue('login')} className="submit-btn">
              Retour à la connexion →
            </button>
          </div>
        )}

        <p className="text-center text-white/20 text-[11px] mt-8">© 2026 Cevital Group · Optima v1.0</p>
      </div>

      <style>{`
        /* ── Orbes ── */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: float-orb 20s ease-in-out infinite;
        }
        .orb1 {
          width: 500px; height: 500px;
          background: #1a6fd4;
          top: -200px; left: -150px;
          animation-delay: 0s;
        }
        .orb2 {
          width: 400px; height: 400px;
          background: #0d3a7a;
          bottom: -150px; right: -100px;
          animation-delay: -7s;
        }
        .orb3 {
          width: 300px; height: 300px;
          background: #2563eb;
          top: 40%; left: 60%;
          animation-delay: -14s;
        }
        @keyframes float-orb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, 40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }

        /* ── Boules ── */
        .ball {
          position: absolute;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.3);
          animation: float-ball 15s ease-in-out infinite;
        }
        .ball-1 { width: 8px; height: 8px; top: 10%; left: 15%; animation-delay: 0s; }
        .ball-2 { width: 6px; height: 6px; top: 20%; right: 25%; animation-delay: -2s; }
        .ball-3 { width: 10px; height: 10px; top: 60%; left: 10%; animation-delay: -4s; }
        .ball-4 { width: 5px; height: 5px; top: 70%; right: 15%; animation-delay: -6s; }
        .ball-5 { width: 7px; height: 7px; top: 40%; left: 20%; animation-delay: -8s; }
        .ball-6 { width: 9px; height: 9px; top: 80%; left: 30%; animation-delay: -10s; }
        .ball-7 { width: 6px; height: 6px; top: 30%; right: 40%; animation-delay: -12s; }
        .ball-8 { width: 8px; height: 8px; top: 50%; right: 10%; animation-delay: -3s; }
        .ball-9 { width: 5px; height: 5px; bottom: 20%; left: 25%; animation-delay: -5s; }
        .ball-10 { width: 7px; height: 7px; bottom: 30%; right: 35%; animation-delay: -7s; }
        .ball-11 { width: 6px; height: 6px; top: 15%; left: 50%; animation-delay: -9s; }
        .ball-12 { width: 9px; height: 9px; bottom: 15%; right: 20%; animation-delay: -11s; }

        @keyframes float-ball {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.6; }
          25% { transform: translateY(-30px) translateX(15px); opacity: 1; }
          50% { transform: translateY(-15px) translateX(-10px); opacity: 0.4; }
          75% { transform: translateY(-40px) translateX(20px); opacity: 0.8; }
        }

        /* ── Étoiles ── */
        .star {
          position: absolute;
          animation: twinkle 4s ease-in-out infinite;
        }
        .star-1 { top: 12%; left: 30%; animation-delay: 0s; }
        .star-2 { top: 25%; right: 20%; animation-delay: -1s; }
        .star-3 { top: 55%; left: 8%; animation-delay: -2s; }
        .star-4 { top: 65%; right: 30%; animation-delay: -3s; }
        .star-5 { top: 35%; left: 60%; animation-delay: -1.5s; }
        .star-6 { bottom: 25%; left: 15%; animation-delay: -2.5s; }
        .star-7 { bottom: 40%; right: 10%; animation-delay: -0.5s; }
        .star-8 { top: 8%; right: 45%; animation-delay: -3.5s; }

        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1) rotate(0deg); }
          50% { opacity: 0.8; transform: scale(1.2) rotate(10deg); }
        }

        /* ── Logo ── */
        .logo-container {
          width: 90px; height: 90px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(29,111,212,0.5), rgba(13,58,122,0.5));
          border: 1px solid rgba(59,130,246,0.4);
          box-shadow: 0 0 50px rgba(29,111,212,0.4);
        }

        /* ── Form Card ── */
        .form-card {
          background: rgba(10,22,40,0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
        }

        /* ── Inputs ── */
        .input-wrapper { display: flex; flex-direction: column; gap: 8px; }
        .input-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(147,197,253,0.7);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .input-field {
          width: 100%;
          padding: 16px 18px;
          background: rgba(30, 41, 59, 0.8) !important;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 14px;
          color: white !important;
          font-size: 15px;
          outline: none;
          transition: all 0.3s;
          caret-color: #60a5fa;
        }
        .input-field::placeholder { color: rgba(255,255,255,0.4); }
        .input-field:focus {
          background: rgba(30, 41, 59, 0.95) !important;
          border-color: rgba(96,165,250,0.6);
          box-shadow: 0 0 0 4px rgba(59,130,246,0.2);
        }
        /* Override browser autofill */
        .input-field:-webkit-autofill,
        .input-field:-webkit-autofill:hover,
        .input-field:-webkit-autofill:focus {
          -webkit-text-fill-color: white !important;
          -webkit-box-shadow: 0 0 0px 1000px rgba(30, 41, 59, 0.8) inset !important;
        }

        /* ── Buttons ── */
        .submit-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #1d6fd4, #1251a3);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s;
          box-shadow: 0 4px 20px rgba(29,111,212,0.4);
        }
        .submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #2478e0, #1a5fbe);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(29,111,212,0.5);
        }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .amber-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        /* ── Divers ── */
        .error-message {
          padding: 12px;
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
        }

        .key-icon {
          width: 60px; height: 60px;
          border-radius: 16px;
          background: rgba(217,119,6,0.15);
          border: 1px solid rgba(217,119,6,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .success-icon {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: rgba(16,185,129,0.15);
          border: 1px solid rgba(16,185,129,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mdp-box {
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 12px;
          padding: 1rem;
        }

        /* ── Email Validation Badges ── */
        .valid-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(16,185,129,0.15);
          border: 1px solid rgba(16,185,129,0.3);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 600;
          color: #34d399;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        
        .invalid-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 6px;
          font-size: 10px;
          font-weight: 600;
          color: #f87171;
        }
      `}</style>
    </div>
  )
}