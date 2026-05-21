'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useRouter } from 'next/navigation'
import { RootState } from '@/store/store'
import { updateUser } from '@/store/slices/authSlice'
import { usersService } from '@/services/usersService'
import { polesService } from '@/services/polesService'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  Search, Download, Pencil, Trash2, Loader2, Plus,
  Users, ChevronUp, ChevronDown, Building2,
  UsersRound, KeyRound, Printer, Filter, RefreshCw,
  Mail, Phone, Calendar, Shield, CheckCircle2,
} from 'lucide-react'

/* ───────────── Types ───────────── */
interface User {
  id_user: number; nom: string; prenom: string; email: string
  identifiant: string; role: string; genre: string
  date_naissance: string; date_embauche: string
  telephone: string | null
  id_pole: number | null; id_equipe: number | null
  nom_pole: string | null; nom_equipe: string | null
}
interface Pole { id_pole: number; nom_pole: string }

/* ───────────── Constantes ───────────── */
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur', METHODISTE: 'Méthodiste',
  CHEF_POLE: 'Chef de Pôle', CHEF_EQUIPE: "Chef d'Équipe",
  MECANICIEN: 'Mécanicien', TECHNICIEN: 'Technicien', HSE: 'HSE',
}

/* Palette « entreprise » — accents froids sur fond clair, sobriété GMAO */
const ROLE_STYLES: Record<string, string> = {
  ADMIN:       'bg-violet-50 text-violet-700 ring-violet-200',
  METHODISTE:  'bg-sky-50 text-sky-700 ring-sky-200',
  CHEF_POLE:   'bg-indigo-50 text-indigo-700 ring-indigo-200',
  CHEF_EQUIPE: 'bg-amber-50 text-amber-700 ring-amber-200',
  MECANICIEN:  'bg-emerald-50 text-emerald-700 ring-emerald-200',
  TECHNICIEN:  'bg-teal-50 text-teal-700 ring-teal-200',
  HSE:         'bg-rose-50 text-rose-700 ring-rose-200',
}

const AVATAR_GRADIENTS = [
  'from-sky-500 to-indigo-600',
  'from-violet-500 to-fuchsia-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-indigo-500 to-purple-600',
]

/* Logo Cevital — hébergé publiquement.
   Si l'image est bloquée par CORS chez vous, copiez-la dans /public/cevital.png. */
const CEVITAL_LOGO =
  'https://upload.wikimedia.org/wikipedia/fr/thumb/9/9d/Cevital_logo.svg/2560px-Cevital_logo.svg.png'

/* ═══════════════════════════════════════════════════════════════ */
export default function ListeUtilisateursPage() {
  const router   = useRouter()
  const dispatch = useDispatch()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const isAdmin  = authUser?.role === 'ADMIN'

  const [users, setUsers]       = useState<User[]>([])
  const [poles, setPoles]       = useState<Pole[]>([])
  const [loading, setLoading]   = useState(true)
  const [suppId, setSuppId]     = useState<number | null>(null)
  const [flashId, setFlashId]   = useState<number | null>(null)
  const [reinitInfo, setReinitInfo] = useState<{ nom: string; prenom: string; mdp: string } | null>(null)

  const [recherche, setRecherche]   = useState('')
  const [filtreRole, setFiltreRole] = useState('')
  const [filtrePole, setFiltrePole] = useState('')
  const [filtreAnnee, setFiltreAnnee] = useState('')
  const [triCol, setTriCol] = useState('nom')
  const [triAsc, setTriAsc] = useState(true)

  /* ──────── Data ──────── */
  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const data = await usersService.lister()
      let filtered = data.filter((u: User) => u.role !== 'ADMIN')
      if (!isAdmin && authUser?.id_pole) {
        const idPole = Number(authUser.id_pole)
        filtered = filtered.filter((u: User) => Number(u.id_pole) === idPole)
      }
      setUsers(filtered)
    } finally { setLoading(false) }
  }, [isAdmin, authUser?.id_pole])

  useEffect(() => {
    charger()
    if (isAdmin) polesService.lister().then(setPoles)
  }, []) // eslint-disable-line

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
      setUsers(prev => prev.map(u => u.id_user === msg.payload?.id_user ? {
        ...u,
        nom: msg.payload.nom ?? u.nom,
        prenom: msg.payload.prenom ?? u.prenom,
        telephone: msg.payload.telephone ?? u.telephone,
        date_naissance: msg.payload.date_naissance ?? u.date_naissance,
        nom_pole: msg.payload.nom_pole ?? u.nom_pole,
        nom_equipe: msg.payload.nom_equipe ?? u.nom_equipe,
      } : u))
      if (Number(msg.payload?.id_user) === Number(authUser?.id_user)) {
        dispatch(updateUser({
          nom: msg.payload.nom, prenom: msg.payload.prenom,
          telephone: msg.payload.telephone,
          date_naissance: msg.payload.date_naissance,
          nom_pole: msg.payload.nom_pole, nom_equipe: msg.payload.nom_equipe,
        }))
      }
    }
    if (msg.type === 'UTILISATEUR_SUPPRIME') {
      setUsers(prev => prev.filter(u => u.id_user !== msg.payload?.id_user))
    }
  })

  /* ──────── Actions ──────── */
  const supprimer = async (id: number) => {
    if (!confirm('Supprimer cet utilisateur ?')) return
    setSuppId(id)
    try {
      await usersService.supprimer(id)
      setUsers(prev => prev.filter(u => u.id_user !== id))
    } catch (err: any) {
      if (err?.response?.status === 409) {
        const detail = err.response.data?.detail ?? 'Données associées.'
        if (confirm(`${detail}\n\nForcer la suppression ?`)) {
          try {
            await usersService.supprimer(id, true)
            setUsers(prev => prev.filter(u => u.id_user !== id))
          } catch (e: any) { alert(`Échec : ${e?.response?.data?.detail ?? e.message}`) }
        }
      } else alert(`Erreur : ${err?.response?.data?.detail ?? err.message}`)
    } finally { setSuppId(null) }
  }

  const handleReinitMdp = async (id: number, prenom: string, nom: string) => {
    if (!confirm(`Réinitialiser le mot de passe de ${prenom} ${nom} ?`)) return
    try {
      const res = await usersService.reinitMdp(id)
      setReinitInfo({ nom, prenom, mdp: res.mdp_initial })
    } catch { alert('Erreur lors de la réinitialisation') }
  }

  /* ──────── Impression — format dossier d'entreprise ──────── */
  const imprimer = () => {
    const today = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
    const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    const rows = usersFiltres.map((u, i) => `
      <tr>
        <td class="num">${String(i + 1).padStart(3, '0')}</td>
        <td><strong>${u.nom.toUpperCase()}</strong></td>
        <td>${u.prenom}</td>
        <td>${u.identifiant}</td>
        <td>${ROLE_LABELS[u.role] ?? u.role}</td>
        <td>${u.nom_pole ?? '—'}</td>
        <td>${u.nom_equipe ?? '—'}</td>
        <td>${u.email}</td>
        <td>${u.telephone ?? '—'}</td>
        <td>${new Date(u.date_embauche).toLocaleDateString('fr-FR')}</td>
      </tr>`).join('')

    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>CEVITAL — Liste des utilisateurs</title>
<style>
  @page { size: A4 landscape; margin: 14mm 12mm 18mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color:#0f172a; margin:0; font-size:10.5px; }
  /* En-tête institutionnel */
  .header { display:flex; align-items:center; justify-content:space-between;
            border-bottom:3px solid #0c2340; padding-bottom:10px; margin-bottom:14px; }
  .brand  { display:flex; align-items:center; gap:14px; }
  .brand img { height:46px; }
  .brand .meta { line-height:1.2; }
  .brand .meta .co { font-size:16px; font-weight:800; color:#0c2340; letter-spacing:.5px; }
  .brand .meta .sub { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:2px; }
  .doc-id { text-align:right; font-size:10px; color:#475569; line-height:1.5; }
  .doc-id .ref { font-family:'Courier New',monospace; color:#0c2340; font-weight:700; }

  /* Titre du document */
  .title-block { background:linear-gradient(90deg,#0c2340,#1e3a5f); color:white;
                 padding:14px 18px; border-radius:4px; margin-bottom:14px;
                 display:flex; justify-content:space-between; align-items:center; }
  .title-block h1 { margin:0; font-size:18px; font-weight:700; letter-spacing:.4px; }
  .title-block .scope { font-size:10px; opacity:.85; text-transform:uppercase; letter-spacing:1.5px; margin-top:3px; }
  .title-block .badge { background:rgba(255,255,255,.12); padding:6px 12px; border-radius:3px;
                        font-size:10px; letter-spacing:1px; text-transform:uppercase;
                        border:1px solid rgba(255,255,255,.25); }

  /* KPI strip */
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:14px; }
  .kpi  { border:1px solid #e2e8f0; border-left:3px solid #0c2340; padding:8px 12px; }
  .kpi .l { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:1.2px; }
  .kpi .v { font-size:16px; font-weight:700; color:#0c2340; margin-top:2px; }

  /* Tableau */
  table { width:100%; border-collapse:collapse; }
  thead th { background:#0c2340; color:white; text-align:left; padding:8px 9px;
             font-size:9.5px; text-transform:uppercase; letter-spacing:.8px; font-weight:600; }
  tbody td { padding:7px 9px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
  tbody tr:nth-child(even) td { background:#f8fafc; }
  tbody td.num { font-family:'Courier New',monospace; color:#64748b; font-weight:700; }

  /* Pied de page */
  .footer { position:fixed; bottom:6mm; left:12mm; right:12mm;
            border-top:1px solid #cbd5e1; padding-top:6px;
            display:flex; justify-content:space-between; font-size:9px; color:#64748b; }
  .footer .conf { font-weight:700; color:#0c2340; letter-spacing:1px; }
  .sign { margin-top:24px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:30px; }
  .sign div { border-top:1px solid #94a3b8; padding-top:6px; text-align:center;
              font-size:9.5px; color:#475569; text-transform:uppercase; letter-spacing:1px; }
  @media print { .no-print{display:none} }
</style></head><body>

<div class="header">
  <div class="brand">
    <img src="${CEVITAL_LOGO}" alt="Cevital" onerror="this.style.display='none'">
    <div class="meta">
      <div class="co">CEVITAL</div>
      <div class="sub">Optima · GMAO — Direction Maintenance</div>
    </div>
  </div>
  <div class="doc-id">
    <div>Réf. document : <span class="ref">OPT-RH-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}</span></div>
    <div>Édité le ${today} à ${heure}</div>
    <div>Édité par : <strong>${authUser?.prenom ?? ''} ${authUser?.nom ?? ''}</strong></div>
  </div>
</div>

<div class="title-block">
  <div>
    <h1>Liste officielle des utilisateurs</h1>
    <div class="scope">${isAdmin ? 'Tous pôles confondus' : `Pôle : ${authUser?.nom_pole ?? '—'}`} · ${usersFiltres.length} enregistrement(s)</div>
  </div>
  <div class="badge">Document interne</div>
</div>

<div class="kpis">
  <div class="kpi"><div class="l">Effectif total</div><div class="v">${usersFiltres.length}</div></div>
  <div class="kpi"><div class="l">Pôles</div><div class="v">${new Set(usersFiltres.map(u=>u.nom_pole).filter(Boolean)).size}</div></div>
  <div class="kpi"><div class="l">Équipes</div><div class="v">${new Set(usersFiltres.map(u=>u.nom_equipe).filter(Boolean)).size}</div></div>
  <div class="kpi"><div class="l">Rôles distincts</div><div class="v">${new Set(usersFiltres.map(u=>u.role)).size}</div></div>
</div>

<table>
  <thead><tr>
    <th>N°</th><th>Nom</th><th>Prénom</th><th>Identifiant</th><th>Rôle</th>
    <th>Pôle</th><th>Équipe</th><th>Email</th><th>Téléphone</th><th>Embauche</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="sign">
  <div>Visa Méthodiste</div>
  <div>Visa Chef de Pôle</div>
  <div>Visa Direction</div>
</div>

<div class="footer">
  <div>CEVITAL — Optima GMAO · Document généré automatiquement</div>
  <div class="conf">CONFIDENTIEL — USAGE INTERNE</div>
  <div>Page 1</div>
</div>

<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`

    const w = window.open('', '_blank', 'width=1200,height=800')
    if (!w) { alert("Activez les popups pour l'impression."); return }
    w.document.open(); w.document.write(html); w.document.close()
  }

  /* ──────── Filtrage & tri ──────── */
  const usersFiltres = users
    .filter(u => {
      const txt = recherche.toLowerCase()
      const matchR = !recherche ||
        u.nom.toLowerCase().includes(txt) || u.prenom.toLowerCase().includes(txt) ||
        u.email.toLowerCase().includes(txt) ||
        (u.nom_pole ?? '').toLowerCase().includes(txt) ||
        (u.nom_equipe ?? '').toLowerCase().includes(txt)
      const mRole  = !filtreRole  || u.role === filtreRole
      const mPole  = !filtrePole  || String(u.id_pole) === filtrePole
      const mAnnee = !filtreAnnee || new Date(u.date_embauche).getFullYear() === Number(filtreAnnee)
      return matchR && mRole && mPole && mAnnee
    })
    .sort((a, b) => {
      let va = (a as any)[triCol] ?? ''; let vb = (b as any)[triCol] ?? ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      return triAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })

  const toggleTri = (col: string) =>
    triCol === col ? setTriAsc(a => !a) : (setTriCol(col), setTriAsc(true))

  const exportCSV = () => {
    const headers = ['Nom','Prénom','Email','Rôle','Genre','Pôle','Équipe','Date embauche','Téléphone']
    const rows = usersFiltres.map(u => [
      u.nom, u.prenom, u.email, ROLE_LABELS[u.role] ?? u.role, u.genre,
      u.nom_pole ?? '', u.nom_equipe ?? '',
      new Date(u.date_embauche).toLocaleDateString('fr-FR'), u.telephone ?? '',
    ])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `cevital-utilisateurs-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const initiales = (u: User) => `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase()
  const gradient  = (id: number) => AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length]
  const annees = [...new Set(users.map(u => new Date(u.date_embauche).getFullYear()))].sort((a, b) => b - a)

  /* ──────── Composants internes ──────── */
  const ColTri = ({ col, label }: { col: string; label: string }) => (
    <th onClick={() => toggleTri(col)}
      className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500
                 uppercase tracking-[0.08em] cursor-pointer hover:text-slate-900
                 select-none whitespace-nowrap transition-colors">
      <span className="inline-flex items-center gap-1.5">
        {label}
        {triCol === col
          ? (triAsc ? <ChevronUp className="w-3.5 h-3.5 text-sky-600" />
                    : <ChevronDown className="w-3.5 h-3.5 text-sky-600" />)
          : <ChevronDown className="w-3.5 h-3.5 opacity-20" />}
      </span>
    </th>
  )

  /* ═══════════════════════════════ RENDER ═══════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6 space-y-6">

      {/* Modal Réinit MDP */}
      {reinitInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 border border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500
                            flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900">Mot de passe réinitialisé</h3>
            <p className="text-center text-sm text-slate-500 mt-1">{reinitInfo.prenom} {reinitInfo.nom}</p>
            <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Nouveau mot de passe à communiquer
              </p>
              <p className="mt-2 font-mono text-lg font-bold text-slate-900 break-all">{reinitInfo.mdp}</p>
            </div>
            <button onClick={() => setReinitInfo(null)}
              className="mt-5 w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800
                         text-white text-sm font-semibold transition-all">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* HERO BANNER — style Cevital Optima */}
      <div className="relative overflow-hidden rounded-2xl
                      bg-gradient-to-br from-[#0c2340] via-[#13315a] to-[#1e4976]
                      shadow-xl shadow-slate-900/10">
        {/* Motif décoratif */}
        <div className="absolute inset-0 opacity-[0.07]"
             style={{ backgroundImage: 'radial-gradient(circle at 20% 50%,white 1px,transparent 1px)',
                      backgroundSize: '24px 24px' }} />
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-20 w-72 h-72 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative px-8 py-8 flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20
                            flex items-center justify-center shadow-lg">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
             
              <h1 className="text-3xl font-serif font-bold text-white tracking-tight">
                Gestion des Utilisateurs
              </h1>
           
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => charger()}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20
                         flex items-center justify-center text-white transition-all"
              title="Actualiser">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: 'Effectif total', v: users.length, i: Users, c: 'sky' },
          { l: 'Pôles', v: new Set(users.map(u => u.nom_pole).filter(Boolean)).size, i: Building2, c: 'indigo' },
          { l: 'Équipes', v: new Set(users.map(u => u.nom_equipe).filter(Boolean)).size, i: UsersRound, c: 'emerald' },
          { l: 'Rôles', v: new Set(users.map(u => u.role)).size, i: Shield, c: 'amber' },
        ].map((k, i) => (
          <div key={i} className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200
                                  p-5 hover:shadow-lg hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{k.l}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 font-serif">{k.v}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-${k.c}-50 ring-1 ring-${k.c}-100
                              flex items-center justify-center`}>
                <k.i className={`w-5 h-5 text-${k.c}-600`} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#0c2340] to-sky-500
                            scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
          </div>
        ))}
      </div>

      {/* BARRE D'OUTILS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-700 font-semibold pr-3 border-r border-slate-200">
            <Filter className="w-4 h-4" />
            <span className="text-sm uppercase tracking-wider">Filtres</span>
          </div>

          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Nom, prénom, email, pôle, équipe…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200
                         text-slate-900 text-sm placeholder:text-slate-400
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all" />
          </div>

          <select value={filtreRole} onChange={e => setFiltreRole(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white">
            <option value="">Tous les rôles</option>
            {Object.entries(ROLE_LABELS).filter(([v]) => v !== 'ADMIN').map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          {isAdmin && (
            <select value={filtrePole} onChange={e => setFiltrePole(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white">
              <option value="">Tous les pôles</option>
              {poles.map(p => <option key={p.id_pole} value={p.id_pole}>{p.nom_pole}</option>)}
            </select>
          )}

          <select value={filtreAnnee} onChange={e => setFiltreAnnee(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white">
            <option value="">Toutes les années</option>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {(authUser?.role === 'ADMIN' || authUser?.role === 'METHODISTE') && (
              <button onClick={imprimer}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                           border border-slate-200 bg-white hover:bg-slate-50 text-slate-700
                           text-sm font-semibold transition-all">
                <Printer className="w-4 h-4" /> Imprimer
              </button>
            )}
            <button onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                         border border-slate-200 bg-white hover:bg-slate-50 text-slate-700
                         text-sm font-semibold transition-all">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {isAdmin && (
              <button onClick={() => router.push('/utilisateurs/ajout')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                           bg-gradient-to-r from-[#0c2340] to-[#1e4976] hover:from-[#0a1d36] hover:to-[#173d63]
                           text-white text-sm font-semibold shadow-lg shadow-slate-900/20 transition-all">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
            <p className="text-sm text-slate-500">Chargement…</p>
          </div>
        ) : usersFiltres.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Users className="w-12 h-12 opacity-30" />
            <p className="text-base font-medium">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <ColTri col="nom" label="Utilisateur" />
                  <ColTri col="role" label="Rôle" />
                  <ColTri col="nom_pole" label="Pôle" />
                  <ColTri col="nom_equipe" label="Équipe" />
                  <ColTri col="date_embauche" label="Embauche" />
                  <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Contact</th>
                  {isAdmin && <th className="px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersFiltres.map(user => (
                  <tr key={user.id_user}
                      className={`group hover:bg-slate-50/70 transition-colors
                                  ${flashId === user.id_user ? 'bg-sky-50/60' : ''}`}>
                    {/* Utilisateur */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient(user.id_user)}
                                         flex items-center justify-center text-white text-sm font-bold
                                         shadow-md ring-2 ring-white`}>
                          {initiales(user)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {user.prenom} {user.nom}
                            </p>
                            {flashId === user.id_user && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700
                                               text-[10px] font-bold uppercase tracking-wider">● nouveau</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-mono truncate">@{user.identifiant}</p>
                        </div>
                      </div>
                    </td>

                    {/* Rôle */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md ring-1
                                        text-xs font-semibold ${ROLE_STYLES[user.role] ?? 'bg-slate-50 text-slate-700 ring-slate-200'}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>

                    {/* Pôle */}
                    <td className="px-5 py-3.5">
                      {user.nom_pole ? (
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" /> {user.nom_pole}
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Équipe */}
                    <td className="px-5 py-3.5">
                      {user.nom_equipe ? (
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <UsersRound className="w-3.5 h-3.5 text-slate-400" /> {user.nom_equipe}
                        </div>
                      ) : <span className="text-xs italic text-slate-400">Sans équipe</span>}
                    </td>

                    {/* Embauche */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(user.date_embauche).toLocaleDateString('fr-FR')}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {user.genre === 'HOMME' ? 'Homme' : 'Femme'}
                      </p>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[180px]">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" /> {user.telephone ?? '—'}
                      </div>
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => router.push(`/utilisateurs/modifier/${user.id_user}`)}
                            title="Modifier"
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                       text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleReinitMdp(user.id_user, user.prenom, user.nom)}
                            title="Réinitialiser MDP"
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                       text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all">
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button onClick={() => supprimer(user.id_user)} disabled={suppId === user.id_user}
                            title="Supprimer"
                            className="w-8 h-8 rounded-lg flex items-center justify-center
                                       text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
                            {suppId === user.id_user
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pied du tableau */}
        {!loading && usersFiltres.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50/60 border-t border-slate-200 text-xs">
            <p className="text-slate-600">
              <span className="font-semibold text-slate-900">{usersFiltres.length}</span> utilisateur{usersFiltres.length > 1 ? 's' : ''} affiché{usersFiltres.length > 1 ? 's' : ''}
              {users.length !== usersFiltres.length && <> sur <span className="font-semibold text-slate-900">{users.length}</span> au total</>}
            </p>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-semibold">Temps réel actif</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
