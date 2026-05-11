'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useRouter } from 'next/navigation'
import { RootState } from '@/store/store'
import { updateUser } from '@/store/slices/authSlice'
import { usersService } from '@/services/usersService'
import { polesService  } from '@/services/polesService'
import { useWebSocket  } from '@/hooks/useWebSocket'
import {
  Search, Download, Pencil, Trash2, Loader2,
  Users, ChevronUp, ChevronDown, Building2,
  UsersRound, KeyRound
} from 'lucide-react'

interface User {
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
  id_pole        : number | null
  id_equipe      : number | null
  nom_pole       : string | null
  nom_equipe     : string | null
}

interface Pole { id_pole: number; nom_pole: string }

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
  ELECTRICIEN  : 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  HSE         : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const avatarColors = [
  'bg-blue-500','bg-purple-500','bg-green-500',
  'bg-orange-500','bg-teal-500','bg-red-500','bg-indigo-500'
]

export default function ListeUtilisateursPage() {
  const router    = useRouter()
  const dispatch  = useDispatch()
  const authUser  = useSelector((s: RootState) => s.auth.user)
  const isAdmin   = authUser?.role === 'ADMIN'

  const [users,      setUsers]      = useState<User[]>([])
  const [poles,      setPoles]      = useState<Pole[]>([])
  const [loading,    setLoading]    = useState(true)
  const [suppId,     setSuppId]     = useState<number | null>(null)
  const [flashId,    setFlashId]    = useState<number | null>(null)
  const [reinitInfo, setReinitInfo] = useState<{
    nom: string; prenom: string; mdp: string
  } | null>(null)

  const [recherche,   setRecherche]   = useState('')
  const [filtreRole,  setFiltreRole]  = useState('')
  const [filtrePole,  setFiltrePole]  = useState('')
  const [filtreAnnee, setFiltreAnnee] = useState('')
  const [triCol,      setTriCol]      = useState('nom')
  const [triAsc,      setTriAsc]      = useState(true)

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const data = await usersService.lister()
      // Exclure les admins
      let filtered = data.filter((u: User) => u.role !== 'ADMIN')

      // Chef de pôle → uniquement son pôle
      // Number() forcé pour éviter comparaison string/number
      if (!isAdmin && authUser?.id_pole) {
        const idPole = Number(authUser.id_pole)
        filtered = filtered.filter((u: User) => Number(u.id_pole) === idPole)
      }

      setUsers(filtered)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, authUser?.id_pole])

  useEffect(() => {
    charger()
    if (isAdmin) polesService.lister().then(setPoles)
  }, [])

  // WebSocket — écoute tous les événements
  useWebSocket((msg) => {
    if (msg.type === 'NOUVEL_UTILISATEUR') {
      charger().then(() => {
        if (msg.payload?.id_user) {
          setFlashId(msg.payload.id_user)
          setTimeout(() => setFlashId(null), 3000)
        }
      })
    }

    if (msg.type === 'UTILISATEUR_MODIFIE') {
      // Mettre à jour la ligne dans le tableau directement
      setUsers(prev => prev.map(u => {
        if (u.id_user === msg.payload?.id_user) {
          return {
            ...u,
            nom            : msg.payload.nom        ?? u.nom,
            prenom         : msg.payload.prenom     ?? u.prenom,
            telephone      : msg.payload.telephone   ?? u.telephone,
            date_naissance : msg.payload.date_naissance ?? u.date_naissance,
            nom_pole       : msg.payload.nom_pole    ?? u.nom_pole,
            nom_equipe     : msg.payload.nom_equipe  ?? u.nom_equipe,
          }
        }
        return u
      }))

      // Si c'est l'user connecté → mettre à jour Redux aussi
      if (Number(msg.payload?.id_user) === Number(authUser?.id_user)) {
        dispatch(updateUser({
          nom            : msg.payload.nom,
          prenom         : msg.payload.prenom,
          telephone      : msg.payload.telephone,
          date_naissance : msg.payload.date_naissance,
          nom_pole       : msg.payload.nom_pole,
          nom_equipe     : msg.payload.nom_equipe,
        }))
      }
    }

    if (msg.type === 'UTILISATEUR_SUPPRIME') {
      setUsers(prev => prev.filter(u => u.id_user !== msg.payload?.id_user))
    }
  })

  const supprimer = async (id: number) => {
    if (!confirm('Supprimer cet utilisateur ?')) return
    setSuppId(id)
    try {
      await usersService.supprimer(id)
      setUsers(prev => prev.filter(u => u.id_user !== id))
    } catch {
      alert('Erreur lors de la suppression')
    } finally {
      setSuppId(null)
    }
  }

  const handleReinitMdp = async (id: number, prenom: string, nom: string) => {
    if (!confirm(`Réinitialiser le mot de passe de ${prenom} ${nom} ?`)) return
    try {
      const res = await usersService.reinitMdp(id)
      setReinitInfo({ nom, prenom, mdp: res.mdp_initial })
    } catch {
      alert('Erreur lors de la réinitialisation')
    }
  }

  const usersFiltres = users
    .filter(u => {
      const txt = recherche.toLowerCase()
      const matchRecherche = !recherche ||
        u.nom.toLowerCase().includes(txt)                 ||
        u.prenom.toLowerCase().includes(txt)              ||
        u.email.toLowerCase().includes(txt)               ||
        (u.nom_pole   ?? '').toLowerCase().includes(txt)  ||
        (u.nom_equipe ?? '').toLowerCase().includes(txt)
      const matchRole  = !filtreRole  || u.role === filtreRole
      const matchPole  = !filtrePole  || String(u.id_pole) === filtrePole
      const matchAnnee = !filtreAnnee ||
        new Date(u.date_embauche).getFullYear() === Number(filtreAnnee)
      return matchRecherche && matchRole && matchPole && matchAnnee
    })
    .sort((a, b) => {
      let va = (a as any)[triCol] ?? ''
      let vb = (b as any)[triCol] ?? ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      return triAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })

  const toggleTri = (col: string) => {
    if (triCol === col) setTriAsc(a => !a)
    else { setTriCol(col); setTriAsc(true) }
  }

  const exportCSV = () => {
    const headers = ['Nom','Prénom','Email','Rôle','Genre','Pôle','Équipe','Date embauche','Téléphone']
    const rows    = usersFiltres.map(u => [
      u.nom, u.prenom, u.email,
      ROLE_LABELS[u.role] ?? u.role, u.genre,
      u.nom_pole ?? '', u.nom_equipe ?? '',
      new Date(u.date_embauche).toLocaleDateString('fr-FR'),
      u.telephone ?? '',
    ])
    const csv  = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'utilisateurs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const initiales   = (u: User) => `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase()
  const avatarColor = (id: number) => avatarColors[id % avatarColors.length]
  const annees      = [...new Set(users.map(u =>
    new Date(u.date_embauche).getFullYear()
  ))].sort((a, b) => b - a)

  const ColTri = ({ col, label }: { col: string; label: string }) => (
    <th onClick={() => toggleTri(col)}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500
                 dark:text-gray-400 uppercase tracking-wider cursor-pointer
                 hover:text-gray-900 dark:hover:text-white select-none whitespace-nowrap">
      <div className="flex items-center gap-1">
        {label}
        {triCol === col
          ? triAsc ? <ChevronUp size={12} className="text-blue-500"/>
                   : <ChevronDown size={12} className="text-blue-500"/>
          : <ChevronUp size={12} className="opacity-20"/>
        }
      </div>
    </th>
  )

  return (
    <div className="space-y-5">

      {/* Modal Réinit MDP */}
      {reinitInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center
                        justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6
                          max-w-sm w-full border border-gray-200
                          dark:border-gray-700 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30
                            flex items-center justify-center mx-auto mb-4">
              <KeyRound size={22} className="text-amber-500"/>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white
                           text-center mb-1">Mot de passe réinitialisé</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-4">
              {reinitInfo.prenom} {reinitInfo.nom}
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 border
                            border-amber-200 dark:border-amber-800
                            rounded-xl p-4 text-center mb-5">
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                Nouveau mot de passe à communiquer
              </p>
              <p className="font-mono text-lg font-bold text-amber-700 dark:text-amber-300">
                {reinitInfo.mdp}
              </p>
            </div>
            <button onClick={() => setReinitInfo(null)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                         text-white text-sm font-medium transition-all">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Utilisateurs
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {usersFiltres.length} résultat{usersFiltres.length > 1 ? 's' : ''}
            {!isAdmin && ' — votre pôle uniquement'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border
                       border-gray-200 dark:border-gray-700
                       text-gray-600 dark:text-gray-400 text-sm font-medium
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            <Download size={15}/>
            Export CSV
          </button>
          {isAdmin && (
            <button onClick={() => router.push('/utilisateurs/ajout')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl
                         bg-blue-600 hover:bg-blue-700 text-white text-sm
                         font-medium transition-all">
              <Users size={15}/>
              Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Nom, prénom, email, pôle, équipe..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border
                       border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       text-sm placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"/>
        </div>

        <select value={filtreRole} onChange={e => setFiltreRole(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS)
            .filter(([v]) => v !== 'ADMIN')
            .map(([v, l]) => <option key={v} value={v}>{l}</option>)
          }
        </select>

        {isAdmin ? (
          <select value={filtrePole} onChange={e => setFiltrePole(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tous les pôles</option>
            {poles.map(p => (
              <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>
            ))}
          </select>
        ) : (
          <select value={filtreAnnee} onChange={e => setFiltreAnnee(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes les années</option>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}

        {isAdmin && (
          <select value={filtreAnnee} onChange={e => setFiltreAnnee(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       sm:col-span-2 lg:col-span-1">
            <option value="">Toutes les années</option>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="text-blue-500 animate-spin"/>
        </div>
      ) : usersFiltres.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-800 rounded-2xl">
          <Users size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-500 dark:text-gray-400">Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b
                                border-gray-200 dark:border-gray-800">
                <tr>
                  <ColTri col="nom"           label="Utilisateur"/>
                  <ColTri col="role"          label="Rôle"/>
                  <ColTri col="nom_pole"      label="Pôle"/>
                  <ColTri col="nom_equipe"    label="Équipe"/>
                  <ColTri col="date_embauche" label="Embauche"/>
                  <th className="px-4 py-3 text-left text-xs font-semibold
                                 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-semibold
                                   text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {usersFiltres.map(user => (
                  <tr key={user.id_user}
                    className={`transition-all duration-500 ${
                      flashId === user.id_user
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center
                                        justify-center text-white text-xs font-bold
                                        flex-shrink-0 ${avatarColor(user.id_user)}`}>
                          {initiales(user)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {user.prenom} {user.nom}
                            {flashId === user.id_user && (
                              <span className="ml-2 text-xs text-green-500 font-normal">
                                ● nouveau
                              </span>
                            )}
                          </p>
                          <p className="text-gray-400 text-xs">{user.identifiant}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg
                                       text-xs font-medium ${ROLE_COLORS[user.role] ?? ''}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {user.nom_pole ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-gray-400"/>
                          <span className="text-gray-700 dark:text-gray-300 text-sm">
                            {user.nom_pole}
                          </span>
                        </div>
                      ) : <span className="text-gray-400 text-sm">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      {user.nom_equipe ? (
                        <div className="flex items-center gap-1.5">
                          <UsersRound size={13} className="text-gray-400"/>
                          <span className="text-gray-700 dark:text-gray-300 text-sm">
                            {user.nom_equipe}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Sans équipe</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-gray-700 dark:text-gray-300 text-sm">
                        {new Date(user.date_embauche).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-gray-400 text-xs">
{user.genre === 'HOMME' ? 'Homme' : 'Femme'}                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300 text-sm
                                   truncate max-w-[160px]">
                        {user.email}
                      </p>
                      <p className="text-gray-400 text-xs">{user.telephone ?? '—'}</p>
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => router.push(`/utilisateurs/modifier/${user.id_user}`)}
                            title="Modifier"
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                       text-gray-400 hover:text-blue-600
                                       hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                            <Pencil size={14}/>
                          </button>
                          <button
                            onClick={() => handleReinitMdp(user.id_user, user.prenom, user.nom)}
                            title="Réinitialiser MDP"
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                       text-gray-400 hover:text-amber-500
                                       hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
                            <KeyRound size={14}/>
                          </button>
                          <button
                            onClick={() => supprimer(user.id_user)}
                            disabled={suppId === user.id_user}
                            title="Supprimer"
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                       text-gray-400 hover:text-red-500
                                       hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                            {suppId === user.id_user
                              ? <Loader2 size={14} className="animate-spin"/>
                              : <Trash2  size={14}/>
                            }
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800
                          bg-gray-50 dark:bg-gray-800/30 text-xs text-gray-400
                          flex items-center justify-between">
            <span>
              {usersFiltres.length} utilisateur{usersFiltres.length > 1 ? 's' : ''} affiché{usersFiltres.length > 1 ? 's' : ''}
              {users.length !== usersFiltres.length && ` sur ${users.length} au total`}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              Temps réel actif
            </span>
          </div>
        </div>
      )}
    </div>
  )
}