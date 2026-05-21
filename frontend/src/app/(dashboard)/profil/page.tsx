'use client'
import { useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '@/store/store'
import { usersService } from '@/services/usersService'
import { updateUser } from '@/store/slices/authSlice'
import {
  Pencil, KeyRound, Eye, EyeOff, Check, Loader2, X, Camera, Trash2,
  User as UserIcon, Mail, Phone, Cake, Building2, Users as UsersIcon,
  Briefcase, Calendar, Shield, ChevronRight, Upload,
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════════
// PALETTE — harmonisée avec sidebar/topbar (navy + blanc + slate)
// ════════════════════════════════════════════════════════════════════
const NAVY            = '#0d2848'     // = sidebar
const NAVY_LIGHT      = '#1e3a5f'
const PAGE_BG         = '#F1F5F9'     // slate-100 fond page
const CARD_BG         = '#FFFFFF'
const CARD_BORDER     = '#E2E8F0'     // slate-200
const INPUT_BG        = '#F8FAFC'     // slate-50 (background champs)
const TEXT_PRIMARY    = '#0F172A'     // slate-900
const TEXT_SECONDARY  = '#475569'     // slate-600
const TEXT_MUTED      = '#94A3B8'     // slate-400
const ACCENT          = '#0052CC'     // bleu accent
const ACCENT_LIGHT    = '#DBEAFE'

const ROLE_LABELS: Record<string, string> = {
  ADMIN       : 'Administrateur',
  METHODISTE  : 'Méthodiste',
  CHEF_POLE   : 'Chef de Pôle',
  CHEF_EQUIPE : "Chef d'Équipe",
  MECANICIEN  : 'Mécanicien',
  TECHNICIEN  : 'Technicien',
  HSE         : 'HSE',
  GESTIONNAIRE_STOCK: 'Gestionnaire stock',
}

// ════════════════════════════════════════════════════════════════════
// Sections navigation
// ════════════════════════════════════════════════════════════════════
type Section = 'apercu' | 'infos' | 'securite'
const SECTIONS: { key: Section; label: string; icon: any; description: string }[] = [
  { key: 'apercu',   label: 'Aperçu du profil',     icon: UserIcon,  description: 'Vue d\'ensemble de vos informations' },
  { key: 'infos',    label: 'Informations personnelles',  icon: Pencil,    description: 'Modifier téléphone et date de naissance' },
  { key: 'securite', label: 'Sécurité & mot de passe', icon: Shield, description: 'Changer le mot de passe' },
]

// ════════════════════════════════════════════════════════════════════
// Composant Input réutilisable
// ════════════════════════════════════════════════════════════════════
function FormInput({ label, hint, error, ...rest }: any) {
  return (
    <div>
      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: TEXT_PRIMARY }}>
        {label}
        {hint && <span className="ml-2 text-[11px] font-normal" style={{ color: TEXT_MUTED }}>{hint}</span>}
      </label>
      <input
        {...rest}
        className="w-full px-3.5 py-2.5 rounded-lg text-sm transition-all
                   focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:border-blue-400"
        style={{
          background: INPUT_BG,
          border: `1px solid ${error ? '#FCA5A5' : CARD_BORDER}`,
          color: TEXT_PRIMARY,
        }}
      />
      {error && <p className="text-red-500 text-[11px] mt-1.5">⚠ {error}</p>}
    </div>
  )
}

function FormPassword({ label, value, onChange, show, toggleShow }: any) {
  return (
    <div>
      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: TEXT_PRIMARY }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full pl-3.5 pr-10 py-2.5 rounded-lg text-sm transition-all
                     focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:border-blue-400"
          style={{
            background: INPUT_BG,
            border: `1px solid ${CARD_BORDER}`,
            color: TEXT_PRIMARY,
          }}
        />
        <button type="button" onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition"
          style={{ color: TEXT_MUTED }}>
          {show ? <EyeOff size={15}/> : <Eye size={15}/>}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Info Card (clé-valeur) pour l'aperçu
// ════════════════════════════════════════════════════════════════════
function InfoRow({ icon: Icon, label, value, big }: { icon: any; label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3.5 transition-all hover:bg-slate-50 -mx-3 px-3 rounded-lg">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: ACCENT_LIGHT }}>
        <Icon size={15} style={{ color: ACCENT }}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: TEXT_MUTED }}>
          {label}
        </p>
        <p className={`${big ? 'text-base' : 'text-sm'} font-semibold mt-0.5 truncate`}
           style={{ color: value && value !== '—' ? TEXT_PRIMARY : TEXT_MUTED }}>
          {value || '—'}
        </p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Page profil
// ════════════════════════════════════════════════════════════════════
export default function ProfilPage() {
  const dispatch = useDispatch()
  const user     = useSelector((s: RootState) => s.auth.user)

  const [section, setSection] = useState<Section>('apercu')

  // Photo upload
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form infos
  const [telephone,     setTelephone]     = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [errTel,        setErrTel]        = useState('')
  const [errDate,       setErrDate]       = useState('')
  const [savingInfos,   setSavingInfos]   = useState(false)
  const [succesInfos,   setSuccesInfos]   = useState(false)

  // Form MDP
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
  const apiBase   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001'
  const photoSrc  = user.photo_url
    ? (user.photo_url.startsWith('http') ? user.photo_url : `${apiBase}${user.photo_url}`)
    : null

  // ── Init du form infos quand on entre dedans
  const goInfos = () => {
    setTelephone(user.telephone ?? '')
    setDateNaissance(user.date_naissance ?? '')
    setErrTel(''); setErrDate(''); setSuccesInfos(false)
    setSection('infos')
  }

  const goSecurite = () => {
    setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('')
    setErrMdp(''); setSuccesMdp(false)
    setSection('securite')
  }

  // ── Upload photo
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError(null)

    // Validation
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setPhotoError('Format non supporté (JPG/PNG/WEBP/GIF uniquement)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Fichier trop volumineux (5 MB max)')
      return
    }

    setUploading(true)
    try {
      const res = await usersService.uploadPhoto(user.id_user, file)
      dispatch(updateUser({ photo_url: res.photo_url }))
    } catch (err: any) {
      setPhotoError(err.response?.data?.detail || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeletePhoto = async () => {
    if (!user.photo_url) return
    if (!confirm('Supprimer la photo de profil ?')) return
    setUploading(true)
    try {
      await usersService.supprimerPhoto(user.id_user)
      dispatch(updateUser({ photo_url: null }))
    } catch {
      setPhotoError('Erreur lors de la suppression')
    } finally {
      setUploading(false)
    }
  }

  // ── Validation form infos
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
      setTimeout(() => setSuccesInfos(false), 2500)
    } catch {
      alert('Erreur lors de la mise à jour')
    } finally {
      setSavingInfos(false)
    }
  }

  const handleChangeMdp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrMdp('')
    if (nouveauMdp !== confirmMdp) { setErrMdp('Les mots de passe ne correspondent pas'); return }
    if (nouveauMdp.length < 6) { setErrMdp('Minimum 6 caractères'); return }
    setSavingMdp(true)
    try {
      await usersService.changerMdp(user.id_user, ancienMdp, nouveauMdp)
      setSuccesMdp(true)
      setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('')
      setTimeout(() => setSuccesMdp(false), 2500)
    } catch (err: any) {
      setErrMdp(err.response?.data?.detail ?? 'Ancien mot de passe incorrect')
    } finally {
      setSavingMdp(false)
    }
  }

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="-m-6 p-6 min-h-[calc(100vh-64px)]" style={{ background: PAGE_BG }}>

      {/* ── HEADER page ── */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: TEXT_PRIMARY }}>Mon profil</h1>
        <p className="text-sm mt-1" style={{ color: TEXT_SECONDARY }}>
          Gérez vos informations personnelles et la sécurité de votre compte
        </p>
      </div>

      {/* ── LAYOUT 2 colonnes : Sidebar nav (12rem) + Contenu ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">

        {/* ════════════ SIDEBAR LATÉRALE PROFIL ════════════ */}
        <aside className="space-y-4">

          {/* Carte avatar + nom (navy gradient comme sidebar app) */}
          <div className="rounded-2xl overflow-hidden shadow-lg"
               style={{ background: `linear-gradient(155deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)` }}>
            <div className="p-5 text-center">
              {/* Avatar grande taille avec ring + bouton caméra */}
              <div className="relative inline-block mb-3">
                <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 overflow-hidden mx-auto shadow-2xl">
                  {photoSrc ? (
                    <img src={photoSrc} alt={user.prenom} className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                      {initiales}
                    </div>
                  )}
                </div>

                {/* Bouton caméra */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center
                             shadow-lg ring-2 ring-white/40 transition hover:scale-110 disabled:opacity-50"
                  style={{ background: ACCENT }}
                  title="Modifier la photo"
                >
                  {uploading
                    ? <Loader2 size={15} className="text-white animate-spin"/>
                    : <Camera size={15} className="text-white"/>
                  }
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              <p className="text-white text-base font-bold leading-tight">
                {user.prenom} {user.nom}
              </p>
              <p className="text-blue-200 text-[11px] mt-1 uppercase tracking-widest font-semibold">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>

              {/* Actions photo */}
              <div className="mt-3 flex gap-2 justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-[10px] font-semibold uppercase tracking-widest text-blue-200 hover:text-white transition flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10"
                >
                  <Upload size={10}/> {photoSrc ? 'Changer' : 'Ajouter'}
                </button>
                {photoSrc && (
                  <button
                    onClick={handleDeletePhoto}
                    disabled={uploading}
                    className="text-[10px] font-semibold uppercase tracking-widest text-red-300 hover:text-red-100 transition flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10"
                  >
                    <Trash2 size={10}/> Retirer
                  </button>
                )}
              </div>
            </div>

            {/* Bandeau infos courtes (email + pôle) */}
            <div className="px-5 py-3 bg-black/15 border-t border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-blue-200">
                <Mail size={11} className="flex-shrink-0"/>
                <span className="truncate">{user.email}</span>
              </div>
              {user.nom_pole && (
                <div className="flex items-center gap-2 text-[11px] text-blue-200">
                  <Building2 size={11} className="flex-shrink-0"/>
                  <span className="truncate">{user.nom_pole}</span>
                </div>
              )}
            </div>
          </div>

          {photoError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700">
              ⚠ {photoError}
            </div>
          )}

          {/* Navigation sections */}
          <nav className="rounded-2xl border shadow-sm overflow-hidden"
               style={{ background: CARD_BG, borderColor: CARD_BORDER }}>
            {SECTIONS.map((s, idx) => {
              const Icon = s.icon
              const active = section === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => {
                    if (s.key === 'infos') goInfos()
                    else if (s.key === 'securite') goSecurite()
                    else setSection(s.key)
                  }}
                  className="w-full text-left flex items-center gap-3 px-4 py-3.5 transition-all border-b last:border-b-0 group"
                  style={{
                    background: active ? ACCENT_LIGHT : 'transparent',
                    borderColor: CARD_BORDER,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: active ? ACCENT : '#F1F5F9' }}
                  >
                    <Icon size={15} style={{ color: active ? '#FFFFFF' : TEXT_SECONDARY }}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate"
                       style={{ color: active ? ACCENT : TEXT_PRIMARY }}>
                      {s.label}
                    </p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: TEXT_MUTED }}>
                      {s.description}
                    </p>
                  </div>
                  <ChevronRight size={14}
                                className={`transition ${active ? 'translate-x-0.5' : 'opacity-40'}`}
                                style={{ color: active ? ACCENT : TEXT_MUTED }}/>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ════════════ ZONE DE CONTENU ════════════ */}
        <main className="rounded-2xl border shadow-sm p-6"
              style={{ background: CARD_BG, borderColor: CARD_BORDER }}>

          {/* ─── APERÇU ─── */}
          {section === 'apercu' && (
            <div>
              <div className="flex items-center justify-between mb-5 pb-4 border-b"
                   style={{ borderColor: CARD_BORDER }}>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: TEXT_PRIMARY }}>
                    Aperçu du profil
                  </h2>
                  <p className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>
                    Vos informations professionnelles et personnelles
                  </p>
                </div>
                <button
                  onClick={goInfos}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:shadow-md"
                  style={{ background: ACCENT, color: '#FFFFFF' }}
                >
                  <Pencil size={13}/> Modifier
                </button>
              </div>

              {/* Sections : Identité + Affectation + Coordonnées */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                {/* Colonne 1 : Identité */}
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1"
                      style={{ color: TEXT_MUTED }}>
                    Identité
                  </h3>
                  <InfoRow icon={UserIcon} label="Nom complet" value={`${user.prenom} ${user.nom}`} big/>
                  <InfoRow icon={Shield}   label="Identifiant" value={user.identifiant}/>
                  <InfoRow icon={UserIcon} label="Genre" value={user.genre === 'HOMME' ? '👨 Homme' : '👩 Femme'}/>
                  <InfoRow icon={Cake}     label="Date de naissance"
                           value={user.date_naissance ? new Date(user.date_naissance).toLocaleDateString('fr-FR') : '—'}/>
                </div>

                {/* Colonne 2 : Affectation */}
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1"
                      style={{ color: TEXT_MUTED }}>
                    Affectation professionnelle
                  </h3>
                  <InfoRow icon={Briefcase} label="Rôle"   value={ROLE_LABELS[user.role] ?? user.role} big/>
                  <InfoRow icon={Building2} label="Pôle"   value={user.nom_pole ?? '—'}/>
                  <InfoRow icon={UsersIcon} label="Équipe" value={user.nom_equipe ?? '—'}/>
                  <InfoRow icon={Calendar}  label="Date d'embauche"
                           value={user.date_embauche ? new Date(user.date_embauche).toLocaleDateString('fr-FR') : '—'}/>
                </div>

                {/* Colonne pleine largeur : Coordonnées */}
                <div className="md:col-span-2 mt-4 pt-4 border-t" style={{ borderColor: CARD_BORDER }}>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: TEXT_MUTED }}>
                    Coordonnées
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <InfoRow icon={Mail}  label="Email"     value={user.email}/>
                    <InfoRow icon={Phone} label="Téléphone" value={user.telephone ?? '—'}/>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── INFOS PERSO ─── */}
          {section === 'infos' && (
            <div>
              <div className="flex items-center justify-between mb-5 pb-4 border-b"
                   style={{ borderColor: CARD_BORDER }}>
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
                    <Pencil size={17} style={{ color: ACCENT }}/>
                    Informations personnelles
                  </h2>
                  <p className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>
                    Vous pouvez modifier votre téléphone et votre date de naissance
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormInput
                  label="Téléphone"
                  hint="(05/06/07 + 8 chiffres)"
                  value={telephone}
                  onChange={(e: any) => validerTel(e.target.value)}
                  placeholder="0655123456"
                  maxLength={10}
                  error={errTel}
                />
                <FormInput
                  label="Date de naissance"
                  type="date"
                  value={dateNaissance}
                  max="2006-12-31"
                  onChange={(e: any) => validerDate(e.target.value)}
                  error={errDate}
                />

                {/* Champs en lecture seule */}
                <div className="md:col-span-2 mt-2 pt-4 border-t" style={{ borderColor: CARD_BORDER }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: TEXT_MUTED }}>
                    Informations verrouillées (modifiables uniquement par un administrateur)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: TEXT_PRIMARY }}>
                        Email
                      </label>
                      <input value={user.email} disabled
                        className="w-full px-3.5 py-2.5 rounded-lg text-sm cursor-not-allowed"
                        style={{ background: '#F1F5F9', border: `1px solid ${CARD_BORDER}`, color: TEXT_MUTED }}/>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold mb-1.5" style={{ color: TEXT_PRIMARY }}>
                        Identifiant
                      </label>
                      <input value={user.identifiant} disabled
                        className="w-full px-3.5 py-2.5 rounded-lg text-sm cursor-not-allowed"
                        style={{ background: '#F1F5F9', border: `1px solid ${CARD_BORDER}`, color: TEXT_MUTED }}/>
                    </div>
                  </div>
                </div>
              </div>

              {succesInfos && (
                <div className="mt-5 flex items-center gap-2 p-3 rounded-lg text-sm font-semibold"
                     style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                  <Check size={15}/> Informations mises à jour avec succès !
                </div>
              )}

              <div className="flex gap-2 justify-end mt-6 pt-4 border-t" style={{ borderColor: CARD_BORDER }}>
                <button
                  onClick={() => setSection('apercu')}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold transition hover:shadow-md"
                  style={{ background: '#F1F5F9', color: TEXT_SECONDARY, border: `1px solid ${CARD_BORDER}` }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveInfos}
                  disabled={savingInfos || !!errTel || !!errDate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition hover:shadow-md disabled:opacity-40"
                  style={{ background: ACCENT, color: '#FFFFFF' }}
                >
                  {savingInfos
                    ? <><Loader2 size={14} className="animate-spin"/>Enregistrement…</>
                    : <><Check size={14}/>Enregistrer les modifications</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ─── SÉCURITÉ ─── */}
          {section === 'securite' && (
            <form onSubmit={handleChangeMdp}>
              <div className="flex items-center justify-between mb-5 pb-4 border-b"
                   style={{ borderColor: CARD_BORDER }}>
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
                    <Shield size={17} style={{ color: ACCENT }}/>
                    Sécurité du compte
                  </h2>
                  <p className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>
                    Changez votre mot de passe régulièrement pour sécuriser votre compte
                  </p>
                </div>
              </div>

              <div className="max-w-md space-y-4">
                <FormPassword
                  label="Mot de passe actuel"
                  value={ancienMdp}
                  onChange={setAncienMdp}
                  show={showAncien}
                  toggleShow={() => setShowAncien(v => !v)}
                />
                <FormPassword
                  label="Nouveau mot de passe"
                  value={nouveauMdp}
                  onChange={setNouveauMdp}
                  show={showNouveau}
                  toggleShow={() => setShowNouveau(v => !v)}
                />
                <FormPassword
                  label="Confirmer le nouveau mot de passe"
                  value={confirmMdp}
                  onChange={setConfirmMdp}
                  show={showConfirm}
                  toggleShow={() => setShowConfirm(v => !v)}
                />

                {/* Indicateur force/règles */}
                <div className="bg-slate-50 rounded-lg p-3 border" style={{ borderColor: CARD_BORDER }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: TEXT_MUTED }}>
                    Règles
                  </p>
                  <ul className="space-y-1 text-xs">
                    <li className="flex items-center gap-2" style={{ color: nouveauMdp.length >= 6 ? '#059669' : TEXT_MUTED }}>
                      {nouveauMdp.length >= 6 ? <Check size={12}/> : <span className="w-3 h-3 rounded-full border" style={{ borderColor: TEXT_MUTED }}/>}
                      Au moins 6 caractères
                    </li>
                    <li className="flex items-center gap-2" style={{ color: nouveauMdp && nouveauMdp === confirmMdp ? '#059669' : TEXT_MUTED }}>
                      {nouveauMdp && nouveauMdp === confirmMdp ? <Check size={12}/> : <span className="w-3 h-3 rounded-full border" style={{ borderColor: TEXT_MUTED }}/>}
                      Les deux nouveaux mots de passe correspondent
                    </li>
                  </ul>
                </div>

                {errMdp && (
                  <p className="text-red-500 text-sm">⚠ {errMdp}</p>
                )}

                {succesMdp && (
                  <div className="flex items-center gap-2 p-3 rounded-lg text-sm font-semibold"
                       style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                    <Check size={15}/> Mot de passe modifié avec succès !
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end mt-6 pt-4 border-t" style={{ borderColor: CARD_BORDER }}>
                <button
                  type="button"
                  onClick={() => setSection('apercu')}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold transition hover:shadow-md"
                  style={{ background: '#F1F5F9', color: TEXT_SECONDARY, border: `1px solid ${CARD_BORDER}` }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={
                    savingMdp ||
                    !ancienMdp ||
                    !nouveauMdp ||
                    nouveauMdp !== confirmMdp ||
                    nouveauMdp.length < 6
                  }
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition hover:shadow-md disabled:opacity-40"
                  style={{ background: ACCENT, color: '#FFFFFF' }}
                >
                  {savingMdp
                    ? <><Loader2 size={14} className="animate-spin"/>Modification…</>
                    : <><KeyRound size={14}/>Changer le mot de passe</>
                  }
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}
