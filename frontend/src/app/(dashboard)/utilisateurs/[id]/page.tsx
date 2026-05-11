'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { usersService } from '@/services/usersService'
import {
  ArrowLeft, Pencil, KeyRound, Mail, Phone,
  Building2, UsersRound, Calendar, User,
  Loader2, Shield
} from 'lucide-react'

import { updateUser } from '@/store/slices/authSlice'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur', METHODISTE: 'Méthodiste',
  CHEF_POLE: 'Chef de Pôle', CHEF_EQUIPE: "Chef d'Équipe",
  MECANICIEN: 'Mécanicien', TECHNICIEN: 'Technicien', HSE: 'HSE',
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN       : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  METHODISTE  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  CHEF_POLE   : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  CHEF_EQUIPE : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  MECANICIEN  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  TECHNICIEN  : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  HSE         : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const avatarColors = [
  'bg-blue-500','bg-purple-500','bg-green-500',
  'bg-orange-500','bg-teal-500','bg-red-500','bg-indigo-500'
]

interface UserDetail {
  id_user        : number
  nom            : string
  prenom         : string
  email          : string
  identifiant    : string
  role           : string
  genre          : string
  date_naissance : string
  date_embauche  : string
  telephone      : string | null
  nom_pole       : string | null
  nom_equipe     : string | null
  id_pole        : number | null
}

export default function FicheUtilisateurPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = Number(params.id)
  const authUser = useSelector((s: RootState) => s.auth.user)
  const isAdmin  = authUser?.role === 'ADMIN'

  const [user,      setUser]      = useState<UserDetail | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [reinitMdp, setReinitMdp] = useState<string | null>(null)
  const [reiniting, setReiniting] = useState(false)

  useEffect(() => {
    usersService.getById(id)
      .then(setUser)
      .finally(() => setLoading(false))
  }, [id])

  const handleReinit = async () => {
    if (!confirm('Réinitialiser le mot de passe ?')) return
    setReiniting(true)
    try {
      const res = await usersService.reinitMdp(id)
      setReinitMdp(res.mdp_initial)
    } catch {
      alert('Erreur')
    } finally {
      setReiniting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="text-blue-500 animate-spin"/>
    </div>
  )

  if (!user) return (
    <div className="text-center py-20 text-gray-500">Utilisateur introuvable</div>
  )

  const initiales   = `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
  const couleur     = avatarColors[user.id_user % avatarColors.length]
  const anciennete  = Math.floor(
    (new Date().getTime() - new Date(user.date_embauche).getTime())
    / (1000 * 60 * 60 * 24 * 365)
  )

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── En-tête ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700
                     flex items-center justify-center text-gray-500
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
          <ArrowLeft size={18}/>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Fiche utilisateur
        </h1>
      </div>

      {/* ── Card principale ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200
                      dark:border-gray-800 rounded-2xl overflow-hidden">

        {/* Bannière */}
        <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600"/>

        {/* Avatar + infos */}
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end
                          justify-between gap-4 -mt-12 mb-5">
            <div className="flex items-end gap-4">
              <div className={`w-20 h-20 rounded-2xl border-4 border-white
                              dark:border-gray-900 flex items-center justify-center
                              text-white text-2xl font-bold shadow-lg ${couleur}`}>
                {initiales}
              </div>
              <div className="mb-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {user.prenom} {user.nom}
                </h2>
                <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs
                                 font-medium ${ROLE_COLORS[user.role] ?? ''}`}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>
            </div>

            {/* Boutons actions */}
            {isAdmin && (
              <div className="flex gap-2">
                <button onClick={handleReinit} disabled={reiniting}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl
                             border border-amber-200 dark:border-amber-800
                             text-amber-600 dark:text-amber-400 text-sm
                             hover:bg-amber-50 dark:hover:bg-amber-900/20
                             disabled:opacity-50 transition-all">
                  {reiniting
                    ? <Loader2 size={14} className="animate-spin"/>
                    : <KeyRound size={14}/>
                  }
                  Réinit MDP
                </button>
                <button
                  onClick={() => router.push(`/utilisateurs/modifier/${user.id_user}`)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl
                             bg-blue-600 hover:bg-blue-700 text-white text-sm
                             transition-all">
                  <Pencil size={14}/>
                  Modifier
                </button>
              </div>
            )}
          </div>

          {/* MDP réinitialisé */}
          {reinitMdp && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20
                            border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                Nouveau mot de passe — à communiquer à l'employé
              </p>
              <p className="font-mono text-lg font-bold text-amber-700 dark:text-amber-300">
                {reinitMdp}
              </p>
            </div>
          )}

          {/* Infos en grille */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {[
              { icon: Mail,      label: 'Email',          value: user.email },
              { icon: Phone,     label: 'Téléphone',      value: user.telephone ?? '—' },
              { icon: User,      label: 'Identifiant',    value: user.identifiant },
              { icon: Shield,    label: 'Genre',          value: user.genre === 'HOMME' ? '👨 Homme' : '👩 Femme' },
              { icon: Building2, label: 'Pôle',           value: user.nom_pole ?? '—' },
              { icon: UsersRound,label: 'Équipe',         value: user.nom_equipe ?? 'Sans équipe' },
              { icon: Calendar,  label: 'Date naissance', value: new Date(user.date_naissance).toLocaleDateString('fr-FR') },
              { icon: Calendar,  label: 'Date embauche',  value: new Date(user.date_embauche).toLocaleDateString('fr-FR') },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.label}
                  className="flex items-center gap-3 p-3 rounded-xl
                             bg-gray-50 dark:bg-gray-800">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700
                                  flex items-center justify-center flex-shrink-0
                                  border border-gray-200 dark:border-gray-600">
                    <Icon size={14} className="text-gray-500 dark:text-gray-400"/>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.value}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Ancienneté ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200
                      dark:border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Ancienneté
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3">
            <div className="h-3 rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(anciennete * 5, 100)}%` }}/>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white
                           whitespace-nowrap">
            {anciennete} an{anciennete > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}