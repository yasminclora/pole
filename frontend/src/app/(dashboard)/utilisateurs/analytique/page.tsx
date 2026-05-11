'use client'
import { useEffect, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { usersService } from '@/services/usersService'
import { polesService } from '@/services/polesService'
import { Users, TrendingUp, UserCheck, Building2 } from 'lucide-react'

interface User {
  id_user       : number
  nom           : string
  prenom        : string
  role          : string
  genre         : string
  date_embauche : string
  id_pole       : number | null
}
interface Pole { id_pole: number; nom_pole: string }

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', METHODISTE: 'Méthodiste', CHEF_POLE: 'Chef Pôle',
  CHEF_EQUIPE: "Chef Équipe", MECANICIEN: 'Mécanicien',
  TECHNICIEN: 'Technicien', HSE: 'HSE',
}

const ROLE_COLORS = [
  '#6366f1','#3b82f6','#8b5cf6','#f59e0b',
  '#10b981','#14b8a6','#ef4444'
]

const GENRE_COLORS = { HOMME: '#3b82f6', FEMME: '#ec4899' }

export default function AnalytiquePage() {
  const authUser = useSelector((s: RootState) => s.auth.user)
  const isAdmin  = authUser?.role === 'ADMIN'

  const [users,      setUsers]      = useState<User[]>([])
  const [poles,      setPoles]      = useState<Pole[]>([])
  const [filtrePole, setFiltrePole] = useState('')

  useEffect(() => {
    usersService.lister().then(data => {
      if (!isAdmin && authUser?.id_pole) {
        setUsers(data.filter((u: User) => u.id_pole === authUser.id_pole))
      } else {
        setUsers(data)
      }
    })
    if (isAdmin) polesService.lister().then(setPoles)
  }, [])

  // Filtrage par pôle
  const usersFiltres = filtrePole
    ? users.filter(u => String(u.id_pole) === filtrePole)
    : users

  // Stats genre
  const hommes = usersFiltres.filter(u => u.genre === 'HOMME').length
  const femmes = usersFiltres.filter(u => u.genre === 'FEMME').length
  const total  = usersFiltres.length

  // Stats par rôle
  const parRole = Object.keys(ROLE_LABELS).map(role => ({
    role,
    label : ROLE_LABELS[role],
    count : usersFiltres.filter(u => u.role === role).length,
  })).filter(r => r.count > 0).sort((a, b) => b.count - a.count)

  // Stats par pôle (admin)
  const parPole = poles.map(p => ({
    nom   : p.nom_pole,
    count : users.filter(u => u.id_pole === p.id_pole).length,
  })).filter(p => p.count > 0)

  const maxRole = Math.max(...parRole.map(r => r.count), 1)
  const maxPole = Math.max(...parPole.map(p => p.count), 1)

  // Donut chart SVG
  const DonutChart = () => {
    const r = 70; const cx = 90; const cy = 90
    const circumference = 2 * Math.PI * r
    if (total === 0) return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Aucune donnée
      </div>
    )
    const pctH = hommes / total
    const pctF = femmes / total
    const dashH = pctH * circumference
    const dashF = pctF * circumference
    return (
      <div className="relative flex items-center justify-center">
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Fond */}
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke="#e5e7eb" strokeWidth="22"/>
          {/* Femmes */}
          {femmes > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={GENRE_COLORS.FEMME} strokeWidth="22"
              strokeDasharray={`${dashF} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}/>
          )}
          {/* Hommes */}
          {hommes > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={GENRE_COLORS.HOMME} strokeWidth="22"
              strokeDasharray={`${dashH} ${circumference}`}
              strokeDashoffset={-dashF}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}/>
          )}
          {/* Centre */}
          <text x={cx} y={cy - 8} textAnchor="middle"
            className="fill-gray-900 dark:fill-white"
            style={{fontSize:26, fontWeight:700, fill:'currentColor'}}>
            {total}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle"
            style={{fontSize:11, fill:'#9ca3af'}}>
            utilisateurs
          </text>
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytique RH
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Vue d'ensemble des effectifs
            {!isAdmin && ' — votre pôle'}
          </p>
        </div>
        {isAdmin && (
          <select value={filtrePole}
            onChange={e => setFiltrePole(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200
                       dark:border-gray-700 bg-white dark:bg-gray-900
                       text-gray-900 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tous les pôles</option>
            {poles.map(p => (
              <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: total,  icon: Users,      color: 'blue'   },
          { label: 'Hommes',    value: hommes, icon: UserCheck,  color: 'indigo' },
          { label: 'Femmes',    value: femmes, icon: UserCheck,  color: 'pink'   },
          { label: 'Pôles',     value: isAdmin ? poles.length : 1, icon: Building2, color: 'purple' },
        ].map(kpi => {
          const Icon = kpi.icon
          const bg: Record<string, string> = {
            blue  : 'bg-blue-500',
            indigo: 'bg-indigo-500',
            pink  : 'bg-pink-500',
            purple: 'bg-purple-500',
          }
          const soft: Record<string, string> = {
            blue  : 'bg-blue-50 dark:bg-blue-900/20',
            indigo: 'bg-indigo-50 dark:bg-indigo-900/20',
            pink  : 'bg-pink-50 dark:bg-pink-900/20',
            purple: 'bg-purple-50 dark:bg-purple-900/20',
          }
          return (
            <div key={kpi.label}
              className="bg-white dark:bg-gray-900 border border-gray-200
                         dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {kpi.label}
                </span>
                <div className={`w-9 h-9 rounded-xl ${soft[kpi.color]}
                                 flex items-center justify-center`}>
                  <Icon size={16} className={`text-${kpi.color}-600 dark:text-${kpi.color}-400`}/>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {kpi.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* ── Ligne 2 : Donut + Barres rôles ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Donut Genre */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Répartition par genre
          </h3>
          <div className="flex items-center gap-8">
            <DonutChart/>
            <div className="space-y-3 flex-1">
              {[
                { label: 'Hommes', count: hommes, color: GENRE_COLORS.HOMME },
                { label: 'Femmes', count: femmes, color: GENRE_COLORS.FEMME },
              ].map(g => (
                <div key={g.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: g.color }}/>
                      <span className="text-gray-600 dark:text-gray-400">{g.label}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {g.count}
                      <span className="text-gray-400 font-normal ml-1 text-xs">
                        ({total > 0 ? Math.round(g.count / total * 100) : 0}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-700"
                      style={{
                        width     : `${total > 0 ? (g.count / total) * 100 : 0}%`,
                        background: g.color,
                      }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Barres Rôles */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Effectifs par rôle
          </h3>
          {parRole.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {parRole.map((r, i) => (
                <div key={r.role}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }}/>
                      <span className="text-gray-600 dark:text-gray-400">{r.label}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {r.count}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full transition-all duration-700"
                      style={{
                        width     : `${(r.count / maxRole) * 100}%`,
                        background: ROLE_COLORS[i % ROLE_COLORS.length],
                      }}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Barres par Pôle (Admin seulement) ── */}
      {isAdmin && parPole.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-6">
            Effectifs par pôle
          </h3>
          <div className="flex items-end gap-4 h-40">
            {parPole.map((p, i) => {
              const hauteur = Math.max((p.count / maxPole) * 100, 8)
              return (
                <div key={p.nom} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {p.count}
                  </span>
                  <div className="w-full rounded-t-lg transition-all duration-700"
                    style={{
                      height    : `${hauteur}%`,
                      background: ROLE_COLORS[i % ROLE_COLORS.length],
                      minHeight : '8px',
                    }}/>
                  <span className="text-xs text-gray-500 dark:text-gray-400
                                   text-center leading-tight">
                    {p.nom}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tableau récap ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200
                      dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Détail par rôle
          </h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              {['Rôle','Effectif','Part','Jauge'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold
                                       text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {parRole.map((r, i) => (
              <tr key={r.role}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full"
                      style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }}/>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {r.label}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm font-semibold
                               text-gray-900 dark:text-white">
                  {r.count}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {total > 0 ? Math.round(r.count / total * 100) : 0}%
                </td>
                <td className="px-5 py-3 w-40">
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 rounded-full"
                      style={{
                        width     : `${(r.count / maxRole) * 100}%`,
                        background: ROLE_COLORS[i % ROLE_COLORS.length],
                      }}/>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}