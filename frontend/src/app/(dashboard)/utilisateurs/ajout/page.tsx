'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { polesService }   from '@/services/polesService'
import { equipesService } from '@/services/equipesService'
import { usersService }   from '@/services/usersService'
import { UserPlus, Check, Loader2 } from 'lucide-react'

interface Pole   { id_pole: number; nom_pole: string }
interface Equipe {
  id_equipe   : number
  nom_equipe  : string
  id_pole     : number
  a_chef      : boolean   // ← nouveau
}

const ROLES = [
  { value: 'ADMIN',             label: 'Administrateur'       },
  { value: 'METHODISTE',        label: 'Méthodiste'           },
  { value: 'CHEF_EQUIPE',       label: "Chef d'Équipe"       },
  { value: 'MECANICIEN',        label: 'Mécanicien'           },
  { value: 'TECHNICIEN',        label: 'Technicien'           },
  { value: 'HSE',               label: 'HSE'                  },
  { value: 'GESTIONNAIRE_STOCK', label: 'Gestionnaire Stock'   },
]

const ROLES_SANS_POLE = ['ADMIN', 'GESTIONNAIRE_STOCK']
const ROLES_AVEC_EQUIPE = ['MECANICIEN', 'TECHNICIEN', 'CHEF_EQUIPE']

const inputClass = `w-full px-3 py-2.5 rounded-xl border
  border-gray-200 dark:border-gray-700
  bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500
  focus:border-transparent transition-all
  placeholder:text-gray-400 dark:placeholder:text-gray-500`

export default function AjoutUtilisateurPage() {
  const router = useRouter()

  const [poles,    setPoles]   = useState<Pole[]>([])
  const [equipes,  setEquipes] = useState<Equipe[]>([])
  const [loading,  setLoading] = useState(false)
  const [succes,   setSucces]  = useState(false)
  const [erreur,   setErreur]  = useState('')

  const [form, setForm] = useState({
    nom            : '',
    prenom         : '',
    genre          : '',
    date_naissance : '',
    date_embauche  : '',
    telephone      : '',
    role           : '',
    id_pole        : '',
    id_equipe      : '',
  })

  // Erreurs de validation en temps réel
  const [errTel, setErrTel] = useState('')

  useEffect(() => {
    polesService.lister().then(setPoles)
    equipesService.listerAvecChef().then(setEquipes)
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Validation téléphone algérien
  const validerTelephone = (val: string) => {
    set('telephone', val)
    if (!val) { setErrTel(''); return }
    const regex = /^(05|06|07)[0-9]{8}$/
    if (!regex.test(val)) {
      setErrTel('Format invalide — ex: 0655123456 (05/06/07 + 8 chiffres)')
    } else {
      setErrTel('')
    }
  }

  // Email auto-généré
  const email = form.prenom && form.nom
    ? `${form.prenom.toLowerCase().trim().replace(/ /g,'')}` +
      `.${form.nom.toLowerCase().trim().replace(/ /g,'')}@optima.dz`
    : ''

  // Mot de passe auto-généré
  const motDePasse = form.date_embauche ? (() => {
    const d    = new Date(form.date_embauche)
    const jj   = String(d.getDate()).padStart(2, '0')
    const mm   = String(d.getMonth() + 1).padStart(2, '0')
    const aaaa = d.getFullYear()
    return `Optima@${jj}${mm}${aaaa}`
  })() : ''

  // Équipes filtrées par pôle
  const equipesFiltrees = equipes.filter(
    e => e.id_pole === Number(form.id_pole)
  )

  // Pour CHEF_EQUIPE → uniquement équipes sans chef
  const equipesDisponibles = form.role === 'CHEF_EQUIPE'
    ? equipesFiltrees.filter(e => !e.a_chef)
    : equipesFiltrees

  const besoinEquipe = ROLES_AVEC_EQUIPE.includes(form.role)

  // Validation globale
  const erreurs: string[] = []
  if (!form.nom)            erreurs.push('Nom requis')
  if (!form.prenom)         erreurs.push('Prénom requis')
  if (!form.genre)          erreurs.push('Genre requis')
  if (!form.role)           erreurs.push('Rôle requis')
  if (!form.id_pole && !ROLES_SANS_POLE.includes(form.role))
                           erreurs.push('Pôle requis')
  if (!form.date_naissance) erreurs.push('Date de naissance requise')
  if (!form.date_embauche)  erreurs.push("Date d'embauche requise")
  if (form.date_naissance && new Date(form.date_naissance).getFullYear() > 2006)
    erreurs.push('Doit avoir au moins 20 ans')
  if (form.date_embauche && new Date(form.date_embauche) >= new Date())
    erreurs.push("Date d'embauche doit être dans le passé")
  if (form.telephone && errTel)
    erreurs.push('Téléphone invalide')

  const formulaireValide = erreurs.length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formulaireValide) return
    setLoading(true)
    setErreur('')
    try {
      await usersService.creer({
        nom            : form.nom,
        prenom         : form.prenom,
        genre          : form.genre,
        date_naissance : form.date_naissance,
        date_embauche  : form.date_embauche,
        telephone      : form.telephone || null,
        role           : form.role,
        id_pole        : ROLES_SANS_POLE.includes(form.role) ? null : (form.id_pole ? Number(form.id_pole) : null),
        id_equipe      : (besoinEquipe && form.id_equipe)
                           ? Number(form.id_equipe)
                           : null,
      })
      setSucces(true)
    } catch (err: any) {
      // Gérer les erreurs Pydantic qui sont des objets
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        setErreur(detail.map((d: any) => d.msg).join(', '))
      } else {
        setErreur(typeof detail === 'string' ? detail : 'Erreur lors de la création')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Écran succès ──────────────────────────────────────
  if (succes) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30
                        flex items-center justify-center mx-auto mb-5">
          <Check size={36} className="text-green-500"/>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Compte créé !
        </h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 mb-6
                        text-left space-y-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Identifiants à communiquer à l'employé
          </p>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Email</span>
            <span className="font-mono text-blue-600 dark:text-blue-400
                             bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
              {email}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Mot de passe</span>
            <span className="font-mono text-amber-600 dark:text-amber-400
                             bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
              {motDePasse}
            </span>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => {
            setSucces(false)
            setForm({ nom:'',prenom:'',genre:'',date_naissance:'',
                      date_embauche:'',telephone:'',role:'',id_pole:'',id_equipe:'' })
          }}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium transition-all">
            Ajouter un autre
          </button>
          <button onClick={() => router.push('/utilisateurs/liste')}
            className="px-5 py-2.5 rounded-xl border border-gray-200
                       dark:border-gray-700 text-gray-700 dark:text-gray-300
                       text-sm hover:bg-gray-50 dark:hover:bg-gray-800
                       font-medium transition-all">
            Voir la liste
          </button>
        </div>
      </div>
    )
  }

  // ── Formulaire ────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">

      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
          <UserPlus size={22} className="text-white"/>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Nouvel utilisateur
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Remplissez les informations du nouvel employé
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Section 1 : Identité ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider mb-4">Identité</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Nom <span className="text-red-500">*</span>
              </label>
              <input value={form.nom}
                onChange={e => set('nom', e.target.value)}
                placeholder="ex : Benali"
                className={inputClass}/>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input value={form.prenom}
                onChange={e => set('prenom', e.target.value)}
                placeholder="ex : Ahmed"
                className={inputClass}/>
            </div>

            {/* Genre */}
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Genre <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
{[{ v: 'HOMME', l: 'Homme' }, { v: 'FEMME', l: 'Femme' }].map(g => (                  <button key={g.v} type="button"
                    onClick={() => set('genre', g.v)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm
                                font-medium transition-all ${
                      form.genre === g.v
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300'
                    }`}>
                    {g.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Téléphone avec validation */}
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Téléphone
                <span className="text-gray-400 font-normal ml-1 text-xs">
                  (05/06/07 + 8 chiffres)
                </span>
              </label>
              <input
                value={form.telephone}
                onChange={e => validerTelephone(e.target.value)}
                placeholder="ex : 0655123456"
                maxLength={10}
                className={`${inputClass} ${
                  errTel
                    ? 'border-red-400 focus:ring-red-400'
                    : form.telephone && !errTel
                      ? 'border-green-400 focus:ring-green-400'
                      : ''
                }`}/>
              {errTel && (
                <p className="text-red-500 text-xs mt-1">⚠ {errTel}</p>
              )}
              {form.telephone && !errTel && form.telephone.length === 10 && (
                <p className="text-green-500 text-xs mt-1">✓ Format valide</p>
              )}
            </div>

            {/* Date naissance */}
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Date de naissance <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1 text-xs">(≤ 2006)</span>
              </label>
              <input type="date" value={form.date_naissance}
                max="2006-12-31"
                onChange={e => set('date_naissance', e.target.value)}
                className={inputClass}/>
              {form.date_naissance &&
               new Date(form.date_naissance).getFullYear() > 2006 && (
                <p className="text-red-500 text-xs mt-1">
                  ⚠ Doit avoir au moins 20 ans
                </p>
              )}
            </div>

            {/* Date embauche */}
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Date d'embauche <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1 text-xs">(passée)</span>
              </label>
              <input type="date" value={form.date_embauche}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => set('date_embauche', e.target.value)}
                className={inputClass}/>
              {form.date_embauche &&
               new Date(form.date_embauche) >= new Date() && (
                <p className="text-red-500 text-xs mt-1">
                  ⚠ Doit être antérieure à aujourd'hui
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2 : Rôle & Affectation ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider mb-4">Rôle & Affectation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Rôle */}
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Rôle <span className="text-red-500">*</span>
              </label>
              <select value={form.role}
                onChange={e => { set('role', e.target.value); set('id_equipe', '') }}
                className={inputClass}>
                <option value="">-- Sélectionner un rôle --</option>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Pôle */}
            {!ROLES_SANS_POLE.includes(form.role) ? (
              <div>
                <label className="block text-sm font-medium text-gray-700
                                  dark:text-gray-300 mb-1.5">
                  Pôle <span className="text-red-500">*</span>
                </label>
                <select value={form.id_pole}
                  onChange={e => { set('id_pole', e.target.value); set('id_equipe', '') }}
                  className={inputClass}>
                  <option value="">-- Sélectionner un pôle --</option>
                  {poles.map(p => (
                    <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700
                                  dark:text-gray-300 mb-1.5">
                  Pôle
                </label>
                <div className="px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800
                            text-gray-500 text-sm border border-gray-200 dark:border-gray-700">
                  Aucun pôle (Rôle unique)
                </div>
              </div>
            )}

            {/* Équipe */}
            {besoinEquipe && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700
                                  dark:text-gray-300 mb-1.5">
                  Équipe <span className="text-red-500">*</span>
                  {form.role === 'CHEF_EQUIPE' && (
                    <span className="text-amber-500 font-normal ml-2 text-xs">
                      (uniquement les équipes sans chef)
                    </span>
                  )}
                </label>
                <select value={form.id_equipe}
                  onChange={e => set('id_equipe', e.target.value)}
                  disabled={!form.id_pole}
                  className={inputClass}>
                  <option value="">-- Sélectionner une équipe --</option>
                  {equipesDisponibles.map(eq => (
                    <option key={eq.id_equipe} value={eq.id_equipe}>
                      {eq.nom_equipe}
                    </option>
                  ))}
                </select>

                {/* Messages d'aide */}
                {form.id_pole && equipesFiltrees.length === 0 && (
                  <p className="text-amber-500 text-xs mt-1">
                    ⚠ Aucune équipe dans ce pôle
                  </p>
                )}
                {form.role === 'CHEF_EQUIPE' &&
                 form.id_pole &&
                 equipesFiltrees.length > 0 &&
                 equipesDisponibles.length === 0 && (
                  <p className="text-red-500 text-xs mt-1">
                    ⚠ Toutes les équipes de ce pôle ont déjà un chef
                  </p>
                )}
                {form.role === 'CHEF_EQUIPE' && form.id_pole &&
                 equipesFiltrees.length !== equipesDisponibles.length && (
                  <p className="text-gray-400 text-xs mt-1">
                    {equipesFiltrees.length - equipesDisponibles.length} équipe(s) masquée(s) — chef déjà assigné
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 3 : Identifiants générés ── */}
        {(email || motDePasse) && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-dashed
                          border-gray-300 dark:border-gray-700 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase
                           tracking-wider mb-3">
              Identifiants générés automatiquement
            </h2>
            <div className="space-y-3">
              {email && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
                  <span className="font-mono text-sm text-blue-600 dark:text-blue-400
                                   bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
                    {email}
                  </span>
                </div>
              )}
              {motDePasse && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Mot de passe initial
                  </span>
                  <span className="font-mono text-sm text-amber-600 dark:text-amber-400
                                   bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-lg">
                    {motDePasse}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Erreur API */}
        {erreur && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20
                          border border-red-200 dark:border-red-800
                          text-red-600 dark:text-red-400 text-sm">
            ⚠ {erreur}
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 justify-end pb-6">
          <button type="button"
            onClick={() => router.push('/utilisateurs/liste')}
            className="px-6 py-2.5 rounded-xl border border-gray-200
                       dark:border-gray-700 text-gray-600 dark:text-gray-400
                       text-sm font-medium hover:bg-gray-50
                       dark:hover:bg-gray-800 transition-all">
            Annuler
          </button>
          <button type="submit"
            disabled={loading || !formulaireValide}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl
                       bg-blue-600 hover:bg-blue-700 text-white text-sm
                       font-medium disabled:opacity-40
                       disabled:cursor-not-allowed transition-all">
            {loading
              ? <><Loader2 size={16} className="animate-spin"/> Création...</>
              : <><UserPlus size={16}/> Créer l'utilisateur</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}