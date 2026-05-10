'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { usersService }   from '@/services/usersService'
import { equipesService } from '@/services/equipesService'
import { ArrowLeft, Check, Loader2, Pencil } from 'lucide-react'

interface Equipe {
  id_equipe  : number
  nom_equipe : string
  id_pole    : number
  a_chef     : boolean
}

const ROLES = [
  { value: 'METHODISTE',  label: 'Méthodiste'    },
  { value: 'CHEF_POLE',   label: 'Chef de Pôle'  },
  { value: 'CHEF_EQUIPE', label: "Chef d'Équipe" },
  { value: 'MECANICIEN',  label: 'Mécanicien'    },
  { value: 'TECHNICIEN',  label: 'Technicien'    },
  { value: 'HSE',         label: 'HSE'           },
]

const ROLES_AVEC_EQUIPE = ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE']

const ROLE_LABELS: Record<string, string> = {
  METHODISTE: 'Méthodiste', CHEF_POLE: 'Chef de Pôle',
  CHEF_EQUIPE: "Chef d'Équipe", MECANICIEN: 'Mécanicien',
  TECHNICIEN: 'Technicien', HSE: 'HSE',
}

const inputClass = `w-full px-3 py-2.5 rounded-xl border
  border-gray-200 dark:border-gray-700
  bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500
  focus:border-transparent transition-all`

export default function ModifierUtilisateurPage() {
  const router = useRouter()
  const params = useParams()
  const id     = Number(params.id)

  const [equipes,  setEquipes]  = useState<Equipe[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [succes,   setSucces]   = useState(false)
  const [erreur,   setErreur]   = useState('')

  // Infos affichées (lecture seule)
  const [userInfo, setUserInfo] = useState({
    nom            : '',
    prenom         : '',
    email          : '',
    identifiant    : '',
    genre          : '',
    date_naissance : '',
    date_embauche  : '',
    telephone      : '',
    nom_pole       : '',
    id_pole        : 0,
  })

  // Champs modifiables
  const [role,     setRole]     = useState('')
  const [idEquipe, setIdEquipe] = useState('')

  useEffect(() => {
    const charger = async () => {
      try {
        const [userData, equipesData] = await Promise.all([
          usersService.getById(id),
          equipesService.listerAvecChef(),
        ])
        setEquipes(equipesData)
        setUserInfo({
          nom            : userData.nom            ?? '',
          prenom         : userData.prenom         ?? '',
          email          : userData.email          ?? '',
          identifiant    : userData.identifiant    ?? '',
          genre          : userData.genre          ?? '',
          date_naissance : userData.date_naissance ?? '',
          date_embauche  : userData.date_embauche  ?? '',
          telephone      : userData.telephone      ?? '',
          nom_pole       : userData.nom_pole       ?? '',
          id_pole        : userData.id_pole        ?? 0,
        })
        setRole(userData.role ?? '')
        setIdEquipe(userData.id_equipe ? String(userData.id_equipe) : '')
      } finally {
        setLoading(false)
      }
    }
    charger()
  }, [id])

  const equipesFiltrees    = equipes.filter(e => e.id_pole === userInfo.id_pole)
  const equipesDisponibles = role === 'CHEF_EQUIPE'
    ? equipes.filter(e =>
        e.id_pole === userInfo.id_pole &&
        (!e.a_chef || e.id_equipe === Number(idEquipe))
      )
    : equipesFiltrees

  const besoinEquipe = ROLES_AVEC_EQUIPE.includes(role)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErreur('')
    try {
      await usersService.modifierAffectation(id, {
        role      : role,
        id_equipe : besoinEquipe && idEquipe ? Number(idEquipe) : null,
      })
      setSucces(true)
    } catch (err: any) {
      setErreur(err.response?.data?.detail ?? 'Erreur lors de la modification')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="text-blue-500 animate-spin"/>
    </div>
  )

  if (succes) return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30
                      flex items-center justify-center mx-auto mb-5">
        <Check size={36} className="text-green-500"/>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Modifications enregistrées !
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        Le compte de <span className="font-semibold">{userInfo.prenom} {userInfo.nom}</span> a été mis à jour.
      </p>
      <button onClick={() => router.push('/utilisateurs/liste')}
        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                   text-white text-sm font-medium transition-all">
        Retour à la liste
      </button>
    </div>
  )

  const Ligne = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between py-2.5
                    border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 dark:text-white text-right">
        {value || '—'}
      </span>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()}
          className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700
                     flex items-center justify-center text-gray-500
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
          <ArrowLeft size={18}/>
        </button>
        <div className="w-12 h-12 rounded-2xl bg-orange-500
                        flex items-center justify-center">
          <Pencil size={20} className="text-white"/>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Modifier l'utilisateur
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {userInfo.prenom} {userInfo.nom}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Infos en lecture seule */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider mb-3">
            Informations (lecture seule)
          </h2>
          <Ligne label="Email"           value={userInfo.email}          />
          <Ligne label="Identifiant"     value={userInfo.identifiant}    />
          <Ligne label="Genre"
            value={userInfo.genre === 'HOMME' ? '👨 Homme' : '👩 Femme'}/>
          <Ligne label="Pôle"            value={userInfo.nom_pole}       />
          <Ligne label="Date naissance"
            value={userInfo.date_naissance
              ? new Date(userInfo.date_naissance).toLocaleDateString('fr-FR') : '—'}/>
          <Ligne label="Date embauche"
            value={userInfo.date_embauche
              ? new Date(userInfo.date_embauche).toLocaleDateString('fr-FR') : '—'}/>
          <Ligne label="Téléphone"       value={userInfo.telephone}      />
        </div>

        {/* Champs modifiables */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider mb-4">
            Rôle & Affectation (modifiable)
          </h2>
          <div className="space-y-4">

            {/* Rôle */}
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">Rôle</label>
              <select value={role}
                onChange={e => { setRole(e.target.value); setIdEquipe('') }}
                className={inputClass}>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Équipe */}
            {besoinEquipe && (
              <div>
                <label className="block text-sm font-medium text-gray-700
                                  dark:text-gray-300 mb-1.5">
                  Équipe
                  {role === 'CHEF_EQUIPE' && (
                    <span className="text-amber-500 font-normal ml-2 text-xs">
                      (équipes disponibles uniquement)
                    </span>
                  )}
                </label>
                <select value={idEquipe}
                  onChange={e => setIdEquipe(e.target.value)}
                  className={inputClass}>
                  <option value="">-- Sélectionner une équipe --</option>
                  {equipesDisponibles.map(eq => (
                    <option key={eq.id_equipe} value={eq.id_equipe}>
                      {eq.nom_equipe}
                    </option>
                  ))}
                </select>
                {equipesFiltrees.length === 0 && (
                  <p className="text-amber-500 text-xs mt-1">
                    ⚠ Aucune équipe dans ce pôle
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {erreur && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20
                          border border-red-200 dark:border-red-800
                          text-red-600 dark:text-red-400 text-sm">
            ⚠ {erreur}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 rounded-xl border border-gray-200
                       dark:border-gray-700 text-gray-600 dark:text-gray-400
                       text-sm font-medium hover:bg-gray-50
                       dark:hover:bg-gray-800 transition-all">
            Annuler
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl
                       bg-orange-500 hover:bg-orange-600 text-white text-sm
                       font-medium disabled:opacity-40 transition-all">
            {saving
              ? <><Loader2 size={16} className="animate-spin"/> Enregistrement...</>
              : <><Check size={16}/> Enregistrer</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}