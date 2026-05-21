'use client'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { usersService } from '@/services/usersService'
import { polesService } from '@/services/polesService'
import {
  Users, UserCheck, Building2, BarChart3, PieChart,
  TrendingUp, Activity, Shield, RefreshCw, Award, Sparkles,
} from 'lucide-react'

/* ───────────── Types ───────────── */
interface User {
  id_user: number; nom: string; prenom: string; role: string
  genre: string; date_embauche: string; id_pole: number | null
}
interface Pole { id_pole: number; nom_pole: string }

/* ───────────── Constantes ───────────── */
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', METHODISTE: 'Méthodiste', CHEF_POLE: 'Chef Pôle',
  CHEF_EQUIPE: "Chef Équipe", MECANICIEN: 'Mécanicien',
  TECHNICIEN: 'Technicien', HSE: 'HSE',
}

/* Dégradés cohérents avec la palette navy Cevital */
const ROLE_GRADIENTS: Record<string, string> = {
  ADMIN:       'from-violet-500 to-purple-600',
  METHODISTE:  'from-sky-500 to-blue-600',
  CHEF_POLE:   'from-indigo-500 to-blue-700',
  CHEF_EQUIPE: 'from-amber-500 to-orange-600',
  MECANICIEN:  'from-emerald-500 to-teal-600',
  TECHNICIEN:  'from-teal-500 to-cyan-600',
  HSE:         'from-rose-500 to-red-600',
}

const POLE_GRADIENTS = [
  'from-sky-500 to-indigo-600',
  'from-violet-500 to-fuchsia-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
]

const GENRE_COLORS = { HOMME: '#0ea5e9', FEMME: '#ec4899' }

/* ═══════════════════════════════════════════════════════════════ */
export default function AnalytiquePage() {
  const authUser = useSelector((s: RootState) => s.auth.user)
  const isAdmin  = authUser?.role === 'ADMIN'

  const [users, setUsers]           = useState<User[]>([])
  const [poles, setPoles]           = useState<Pole[]>([])
  const [filtrePole, setFiltrePole] = useState('')
  const [loading, setLoading]       = useState(true)

  const charger = () => {
    setLoading(true)
    usersService.lister().then(data => {
      const filtered = (!isAdmin && authUser?.id_pole)
        ? data.filter((u: User) => u.id_pole === authUser.id_pole)
        : data
      setUsers(filtered)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    charger()
    if (isAdmin) polesService.lister().then(setPoles)
  }, []) // eslint-disable-line

  /* ──────── Calculs ──────── */
  const usersFiltres = filtrePole
    ? users.filter(u => String(u.id_pole) === filtrePole)
    : users

  const hommes = usersFiltres.filter(u => u.genre === 'HOMME').length
  const femmes = usersFiltres.filter(u => u.genre === 'FEMME').length
  const total  = usersFiltres.length

  const parRole = Object.keys(ROLE_LABELS).map(role => ({
    role, label: ROLE_LABELS[role],
    count: usersFiltres.filter(u => u.role === role).length,
  })).filter(r => r.count > 0).sort((a, b) => b.count - a.count)

  const parPole = poles.map(p => ({
    nom: p.nom_pole, id: p.id_pole,
    count: users.filter(u => u.id_pole === p.id_pole).length,
  })).filter(p => p.count > 0).sort((a, b) => b.count - a.count)

  const maxRole = Math.max(...parRole.map(r => r.count), 1)
  const maxPole = Math.max(...parPole.map(p => p.count), 1)

  /* Ancienneté moyenne (en années) */
  const anciennete = usersFiltres.length
    ? (usersFiltres.reduce((acc, u) =>
        acc + (Date.now() - new Date(u.date_embauche).getTime()) / 31557600000, 0) / usersFiltres.length)
    : 0

  /* ──────── Donut Genre ──────── */
  const DonutChart = () => {
    const r = 72, cx = 100, cy = 100
    const C = 2 * Math.PI * r
    if (total === 0) return (
      <div className="flex items-center justify-center w-[200px] h-[200px]
                      rounded-full border-2 border-dashed border-slate-200 text-slate-400 text-sm">
        Aucune donnée
      </div>
    )
    const dashH = (hommes / total) * C
    const dashF = (femmes / total) * C

    return (
      <div className="relative">
        <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
          <defs>
            <linearGradient id="gradH" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#1e4976" />
            </linearGradient>
            <linearGradient id="gradF" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="22" />
          {femmes > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gradF)" strokeWidth="22"
              strokeDasharray={`${dashF} ${C}`} strokeLinecap="round" />
          )}
          {hommes > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gradH)" strokeWidth="22"
              strokeDasharray={`${dashH} ${C}`} strokeDashoffset={-dashF} strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-4xl font-bold font-serif text-slate-900">{total}</p>
          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mt-1">utilisateurs</p>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════ RENDER ═══════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 space-y-6">

      {/* HERO BANNER — identique à la page Utilisateurs */}
      <div className="relative overflow-hidden rounded-2xl
                      bg-gradient-to-br from-[#0c2340] via-[#13315a] to-[#1e4976]
                      shadow-xl shadow-slate-900/10">
        <div className="absolute inset-0 opacity-[0.07]"
             style={{ backgroundImage: 'radial-gradient(circle at 20% 50%,white 1px,transparent 1px)',
                      backgroundSize: '24px 24px' }} />
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-20 w-72 h-72 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative px-8 py-8 flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20
                            flex items-center justify-center shadow-lg">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              
              <h1 className="text-3xl font-serif font-bold text-white tracking-tight">
                Analytique RH
              </h1>
             
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <select value={filtrePole} onChange={e => setFiltrePole(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur
                           text-white text-sm font-medium
                           focus:outline-none focus:ring-2 focus:ring-sky-400
                           [&>option]:text-slate-900">
                <option value="">Tous les pôles</option>
                {poles.map(p => <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>)}
              </select>
            )}
            <button onClick={charger}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20
                         flex items-center justify-center text-white transition-all"
              title="Actualiser">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: 'Effectif total', v: total, i: Users, c: 'sky',
            sub: `${total} actifs`, accent: 'from-sky-400 to-blue-600' },
          { l: 'Hommes', v: hommes, i: UserCheck, c: 'indigo',
            sub: total ? `${Math.round(hommes/total*100)}% des effectifs` : '—',
            accent: 'from-indigo-400 to-blue-700' },
          { l: 'Femmes', v: femmes, i: UserCheck, c: 'rose',
            sub: total ? `${Math.round(femmes/total*100)}% des effectifs` : '—',
            accent: 'from-pink-400 to-rose-600' },
          { l: 'Ancienneté moy.', v: anciennete.toFixed(1) + ' ans', i: Award, c: 'amber',
            sub: 'depuis embauche', accent: 'from-amber-400 to-orange-600' },
        ].map((k, i) => (
          <div key={i} className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200
                                  p-5 hover:shadow-lg hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{k.l}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 font-serif">{k.v}</p>
                <p className="mt-1 text-xs text-slate-400">{k.sub}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-${k.c}-50 ring-1 ring-${k.c}-100
                              flex items-center justify-center`}>
                <k.i className={`w-5 h-5 text-${k.c}-600`} />
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.accent}
                            scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500`} />
          </div>
        ))}
      </div>

      {/* Ligne 2 : Donut Genre + Barres Rôles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Donut Genre */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-serif">Répartition par genre</h2>
              <p className="text-xs text-slate-500 mt-0.5">Hommes / Femmes</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-sky-50 ring-1 ring-sky-100 flex items-center justify-center">
              <PieChart className="w-4 h-4 text-sky-600" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-6">
            <DonutChart />
            <div className="w-full space-y-3">
              {[
                { label: 'Hommes', count: hommes, color: GENRE_COLORS.HOMME, grad: 'from-sky-500 to-blue-700' },
                { label: 'Femmes', count: femmes, color: GENRE_COLORS.FEMME, grad: 'from-pink-500 to-rose-600' },
              ].map(g => {
                const pct = total > 0 ? (g.count / total) * 100 : 0
                return (
                  <div key={g.label}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                        <span className="font-medium text-slate-700">{g.label}</span>
                      </div>
                      <span className="text-slate-900 font-semibold">
                        {g.count}
                        <span className="text-slate-400 font-normal ml-1.5">({Math.round(pct)}%)</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${g.grad} rounded-full transition-all duration-700`}
                           style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Barres Rôles */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-serif">Effectifs par rôle</h2>
              <p className="text-xs text-slate-500 mt-0.5">Distribution des fonctions</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-indigo-600" />
            </div>
          </div>

          {parRole.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Aucune donnée</div>
          ) : (
            <div className="space-y-4">
              {parRole.map(r => {
                const pct = (r.count / maxRole) * 100
                const grad = ROLE_GRADIENTS[r.role] ?? 'from-slate-500 to-slate-700'
                return (
                  <div key={r.role}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${grad}`} />
                        <span className="text-sm font-medium text-slate-700">{r.label}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-bold text-slate-900">{r.count}</span>
                        <span className="ml-1.5 text-xs text-slate-400">
                          ({total > 0 ? Math.round(r.count / total * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-700`}
                           style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Barres par Pôle (Admin) */}
      {isAdmin && parPole.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-serif">Effectifs par pôle</h2>
              <p className="text-xs text-slate-500 mt-0.5">Comparaison des unités opérationnelles</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>

          <div className="flex items-end gap-3 h-64 px-2 border-b border-slate-200">
            {parPole.map((p, i) => {
              const h = Math.max((p.count / maxPole) * 100, 6)
              const grad = POLE_GRADIENTS[i % POLE_GRADIENTS.length]
              return (
                <div key={p.id} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-xs font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition">
                    {p.count}
                  </span>
                  <div className="w-full flex items-end flex-1">
                    <div className={`w-full rounded-t-lg bg-gradient-to-t ${grad}
                                     shadow-md hover:shadow-xl transition-all duration-300
                                     hover:-translate-y-1 cursor-default relative`}
                         style={{ height: `${h}%` }}>
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-900
                                       opacity-100 group-hover:opacity-0 transition">{p.count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 px-2 mt-2">
            {parPole.map(p => (
              <div key={p.id} className="flex-1 text-center text-[11px] font-medium text-slate-600 truncate">
                {p.nom}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tableau récap */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-serif">Détail par rôle</h2>
            <p className="text-xs text-slate-500 mt-0.5">Synthèse tabulaire</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-violet-50 ring-1 ring-violet-100 flex items-center justify-center">
            <Activity className="w-4 h-4 text-violet-600" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Rôle', 'Effectif', 'Part', 'Répartition'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-bold text-slate-500
                                         uppercase tracking-[0.08em] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parRole.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400">Aucune donnée</td></tr>
              ) : parRole.map(r => {
                const pct = total > 0 ? (r.count / total) * 100 : 0
                const grad = ROLE_GRADIENTS[r.role] ?? 'from-slate-500 to-slate-700'
                return (
                  <tr key={r.role} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad}
                                          flex items-center justify-center shadow-md ring-2 ring-white`}>
                          <Shield className="w-4 h-4 text-white" />
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{r.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900 font-serif">{r.count}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100
                                       text-slate-700 text-xs font-semibold">
                        {Math.round(pct)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 w-[40%]">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-700`}
                             style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-3 bg-slate-50/60 border-t border-slate-200 text-xs">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{parRole.length}</span> rôle{parRole.length > 1 ? 's' : ''} actif{parRole.length > 1 ? 's' : ''}
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-semibold text-slate-900">{total}</span> utilisateur{total > 1 ? 's' : ''} analysé{total > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1.5 text-emerald-700">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-semibold">Données à jour</span>
          </div>
        </div>
      </div>
    </div>
  )
}
