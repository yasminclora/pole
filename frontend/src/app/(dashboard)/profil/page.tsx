'use client'
import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '@/store/store'
import { usersService } from '@/services/usersService'
import { updateUser } from '@/store/slices/authSlice'
import { Pencil, KeyRound, Eye, EyeOff, Check, Loader2, X } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur', METHODISTE: 'Méthodiste',
  CHEF_POLE: 'Chef de Pôle', CHEF_EQUIPE: "Chef d'Équipe",
  MECANICIEN: 'Mécanicien', TECHNICIEN: 'Technicien', HSE: 'HSE',
}

const avatarColors = [
  'bg-blue-500','bg-purple-500','bg-green-500',
  'bg-orange-500','bg-teal-500','bg-red-500','bg-indigo-500'
]

const inputClass = `w-full px-3 py-2.5 rounded-lg border
  border-gray-200 dark:border-gray-700
  bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500
  transition-all`

// ← SORTI du composant principal pour éviter la perte de focus
interface ChampMdpProps {
  label: string; value: string; onChange: (v: string) => void
  show: boolean; toggleShow: () => void
}
function ChampMdp({ label, value, onChange, show, toggleShow }: ChampMdpProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700
                        dark:text-gray-300 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          required
          className={`${inputClass} pr-10`}
        />
        <button type="button" onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2
                     text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          {show ? <EyeOff size={15}/> : <Eye size={15}/>}
        </button>
      </div>
    </div>
  )
}

// ← SORTI aussi
interface LigneProps { label: string; value: string }
function Ligne({ label, value }: LigneProps) {
  return (
    <div className="flex items-center justify-between py-3
                    border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400 w-44 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 dark:text-white text-right">
        {value || '—'}
      </span>
    </div>
  )
}

export default function ProfilPage() {
  const dispatch = useDispatch()
  const user     = useSelector((s: RootState) => s.auth.user)

  const [showInfos, setShowInfos] = useState(false)
  const [showMdp,   setShowMdp]   = useState(false)

  const [telephone,     setTelephone]     = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [errTel,        setErrTel]        = useState('')
  const [errDate,       setErrDate]       = useState('')
  const [savingInfos,   setSavingInfos]   = useState(false)
  const [succesInfos,   setSuccesInfos]   = useState(false)

  const [ancienMdp,   setAncienMdp]   = useState('')
  const [nouveauMdp,  setNouveauMdp]  = useState('')
  const [confirmMdp,  setConfirmMdp]  = useState('')
  const [showAncien,  setShowAncien]  = useState(false)
  const [showNouveau, setShowNouveau] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingMdp,   setSavingMdp]   = useState(false)
  const [succesMdp,   setSuccesMdp]   = useState(false)
  const [errMdp,      setErrMdp]      = useState('')

  if (!user) return null

  const initiales = `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase()
  const couleur   = avatarColors[user.id_user % avatarColors.length]

  const ouvrirInfos = () => {
    setTelephone(user.telephone      ?? '')
    setDateNaissance(user.date_naissance ?? '')
    setErrTel(''); setErrDate(''); setSuccesInfos(false)
    setShowInfos(true); setShowMdp(false)
  }

  const ouvrirMdp = () => {
    setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('')
    setErrMdp(''); setSuccesMdp(false)
    setShowMdp(true); setShowInfos(false)
  }

  const validerTel = (val: string) => {
    setTelephone(val)
    if (!val) { setErrTel(''); return }
    setErrTel(/^(05|06|07)[0-9]{8}$/.test(val) ? '' : 'Format invalide (05/06/07 + 8 chiffres)')
  }

  const validerDate = (val: string) => {
    setDateNaissance(val)
    if (!val) { setErrDate(''); return }
    setErrDate(new Date(val).getFullYear() > 2006 ? 'Doit avoir au moins 20 ans' : '')
  }

  const handleSaveInfos = async () => {
    if (errTel || errDate) return
    setSavingInfos(true)
    try {
      await usersService.modifierInfosPerso(user.id_user, {
        telephone      : telephone     || null,
        date_naissance : dateNaissance || null,
      })
      dispatch(updateUser({
        telephone      : telephone     || null,
        date_naissance : dateNaissance || null,
      }))
      setSuccesInfos(true)
      setTimeout(() => { setSuccesInfos(false); setShowInfos(false) }, 1500)
    } catch {
      alert('Erreur lors de la mise à jour')
    } finally {
      setSavingInfos(false)
    }
  }

  const handleChangeMdp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrMdp('')
    if (nouveauMdp !== confirmMdp) {
      setErrMdp('Les mots de passe ne correspondent pas'); return
    }
    if (nouveauMdp.length < 6) {
      setErrMdp('Minimum 6 caractères'); return
    }
    setSavingMdp(true)
    try {
      await usersService.changerMdp(user.id_user, ancienMdp, nouveauMdp)
      setSuccesMdp(true)
      setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('')
      setTimeout(() => { setSuccesMdp(false); setShowMdp(false) }, 1500)
    } catch (err: any) {
      setErrMdp(err.response?.data?.detail ?? 'Ancien mot de passe incorrect')
    } finally {
      setSavingMdp(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon profil</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
          Vos informations personnelles
        </p>
      </div>

      {/* Card infos — lit Redux directement */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200
                      dark:border-gray-800 rounded-2xl overflow-hidden">

        <div className="flex items-center gap-4 p-6 border-b
                        border-gray-100 dark:border-gray-800">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center
                          text-white text-xl font-bold flex-shrink-0 ${couleur}`}>
            {initiales}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {user.prenom} {user.nom}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>
        </div>

        <div className="px-6 py-2">
          <Ligne label="Email"            value={user.email       ?? ''} />
          <Ligne label="Identifiant"      value={user.identifiant ?? ''} />
          <Ligne label="Genre"
            value={user.genre === 'HOMME' ? '👨 Homme' : '👩 Femme'}   />
          <Ligne label="Pôle"             value={user.nom_pole    ?? '—'} />
          <Ligne label="Équipe"           value={user.nom_equipe  ?? '—'} />
          <Ligne label="Date d'embauche"
            value={user.date_embauche
              ? new Date(user.date_embauche).toLocaleDateString('fr-FR') : '—'}/>
          <Ligne label="Date de naissance"
            value={user.date_naissance
              ? new Date(user.date_naissance).toLocaleDateString('fr-FR') : '—'}/>
          <Ligne label="Téléphone"        value={user.telephone   ?? '—'} />
        </div>

        <div className="flex flex-wrap gap-3 p-6 border-t
                        border-gray-100 dark:border-gray-800">
          <button onClick={ouvrirInfos}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
                       border border-gray-200 dark:border-gray-700
                       text-gray-700 dark:text-gray-300 text-sm font-medium
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
            <Pencil size={15}/>
            Modifier mes informations
          </button>
          <button onClick={ouvrirMdp}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
                       border border-amber-200 dark:border-amber-800
                       text-amber-600 dark:text-amber-400 text-sm font-medium
                       hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
            <KeyRound size={15}/>
            Modifier le mot de passe
          </button>
        </div>
      </div>

      {/* Formulaire infos */}
      {showInfos && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Modifier mes informations
            </h3>
            <button onClick={() => setShowInfos(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center
                         text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={16}/>
            </button>
          </div>
          <div className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Téléphone
                <span className="text-gray-400 font-normal ml-1 text-xs">
                  (05/06/07 + 8 chiffres)
                </span>
              </label>
              <input
                value={telephone}
                onChange={e => validerTel(e.target.value)}
                placeholder="0655123456"
                maxLength={10}
                className={`${inputClass} ${errTel ? 'border-red-400' : ''}`}
              />
              {errTel && <p className="text-red-500 text-xs mt-1">⚠ {errTel}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">Date de naissance</label>
              <input
                type="date"
                value={dateNaissance}
                max="2006-12-31"
                onChange={e => validerDate(e.target.value)}
                className={`${inputClass} ${errDate ? 'border-red-400' : ''}`}
              />
              {errDate && <p className="text-red-500 text-xs mt-1">⚠ {errDate}</p>}
            </div>

            {succesInfos && (
              <div className="flex items-center gap-2 p-3 rounded-lg
                              bg-green-50 dark:bg-green-900/20
                              border border-green-200 dark:border-green-800
                              text-green-600 dark:text-green-400 text-sm">
                <Check size={15}/> Informations mises à jour !
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowInfos(false)}
                className="px-4 py-2 rounded-lg border border-gray-200
                           dark:border-gray-700 text-gray-600 dark:text-gray-400
                           text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Annuler
              </button>
              <button onClick={handleSaveInfos}
                disabled={savingInfos || !!errTel || !!errDate}
                className="flex items-center gap-2 px-5 py-2 rounded-lg
                           bg-blue-600 hover:bg-blue-700 text-white text-sm
                           font-medium disabled:opacity-40 transition-all">
                {savingInfos
                  ? <><Loader2 size={14} className="animate-spin"/> Enregistrement...</>
                  : <><Check size={14}/> Enregistrer</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire MDP */}
      {showMdp && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Modifier le mot de passe
            </h3>
            <button onClick={() => setShowMdp(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center
                         text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={16}/>
            </button>
          </div>

          <form onSubmit={handleChangeMdp} className="space-y-4">

            <ChampMdp
              label="Mot de passe actuel"
              value={ancienMdp}
              onChange={setAncienMdp}
              show={showAncien}
              toggleShow={() => setShowAncien(v => !v)}
            />

            <ChampMdp
              label="Nouveau mot de passe"
              value={nouveauMdp}
              onChange={setNouveauMdp}
              show={showNouveau}
              toggleShow={() => setShowNouveau(v => !v)}
            />

            <ChampMdp
              label="Confirmer le nouveau mot de passe"
              value={confirmMdp}
              onChange={setConfirmMdp}
              show={showConfirm}
              toggleShow={() => setShowConfirm(v => !v)}
            />

            {confirmMdp && confirmMdp !== nouveauMdp && (
              <p className="text-red-500 text-xs">
                ⚠ Les mots de passe ne correspondent pas
              </p>
            )}

            {errMdp && (
              <p className="text-red-500 text-sm">⚠ {errMdp}</p>
            )}

            {succesMdp && (
              <div className="flex items-center gap-2 p-3 rounded-lg
                              bg-green-50 dark:bg-green-900/20
                              border border-green-200 dark:border-green-800
                              text-green-600 dark:text-green-400 text-sm">
                <Check size={15}/> Mot de passe modifié !
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowMdp(false)}
                className="px-4 py-2 rounded-lg border border-gray-200
                           dark:border-gray-700 text-gray-600 dark:text-gray-400
                           text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Annuler
              </button>
              <button
                type="submit"
                disabled={
                  savingMdp     ||
                  !ancienMdp    ||
                  !nouveauMdp   ||
                  nouveauMdp !== confirmMdp ||
                  nouveauMdp.length < 6
                }
                className="flex items-center gap-2 px-5 py-2 rounded-lg
                           bg-amber-500 hover:bg-amber-600 text-white text-sm
                           font-medium disabled:opacity-40 transition-all">
                {savingMdp
                  ? <><Loader2 size={14} className="animate-spin"/> Modification...</>
                  : <><KeyRound size={14}/> Changer</>
                }
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}