'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { equipementsService } from '@/services/equipementsService'
import { polesService } from '@/services/polesService'
import { zonesService } from '@/services/zonesService'
import {
  ArrowLeft, Plus, Loader2, Check, AlertCircle, Cpu, MapPin, Calendar, Info, BarChart3
} from 'lucide-react'

// Styles constants pour l'uniformité
const labelClass = `block text-[11px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2`
const inputClass = `w-full px-4 py-3.5 rounded-xl border border-gray-100 bg-white
  text-gray-900 text-sm font-semibold transition-all duration-300
  focus:outline-none focus:border-[#0052CC] focus:ring-4 focus:ring-[#0052CC]/5 shadow-sm`

export default function AjouterMachinePage() {
  const router   = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const isAdmin  = authUser?.role === 'ADMIN'

  const [poles,   setPoles]   = useState([])
  const [zones,   setZones]   = useState([])
  const [saving,  setSaving]  = useState(false)
  const [succes,  setSucces]  = useState(null)
  const [erreur,  setErreur]  = useState('')

  const [form, setForm] = useState({
    equipment_code : '',
    description    : '',
    id_pole        : '',
    id_zone        : '',
    install_date   : '',
    categorie      : '',
    status         : 'NORMAL',
  })

  // 1. Gestion stable du chargement initial des pôles selon le rôle de l'utilisateur
  useEffect(() => {
    if (!authUser) return

    polesService.lister().then(data => {
      if (authUser.role === 'ADMIN') {
        setPoles(data)
      } else {
        const userPole = Number(authUser.id_pole)
        const monPole = data.filter((p: any) => p.id_pole === userPole)
        setPoles(monPole)
        // Pré-remplir le pôle pour le méthodiste de manière sécurisée
        setForm(f => ({ ...f, id_pole: String(userPole) }))
      }
    }).catch(err => console.error("Erreur chargement pôles :", err))
  }, [authUser])

  // 2. Chargement stable des zones lors du changement de pôle
  useEffect(() => {
    if (form.id_pole) {
      zonesService.parPole(Number(form.id_pole))
        .then(setZones)
        .catch(err => console.error("Erreur chargement zones :", err))
      
      setForm(f => ({ ...f, id_zone: '' }))
    } else {
      setZones([])
    }
  }, [form.id_pole])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.equipment_code.trim() || !form.description.trim() || !form.id_pole) {
      return setErreur('Veuillez remplir tous les champs obligatoires (*)')
    }
    setSaving(true); setErreur('')
    try {
      const res = await equipementsService.creer({
        ...form,
        equipment_code: form.equipment_code.trim().toUpperCase(),
        id_pole: Number(form.id_pole),
        id_zone: form.id_zone ? Number(form.id_zone) : undefined,
      })
      setSucces(res)
    } catch (err: any) {
      setErreur(err.response?.data?.detail ?? 'Erreur lors de la création')
    } finally { setSaving(false) }
  }

  if (succes) return (
    <div className="flex-grow p-12 bg-[#F8FAFC] flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-3xl p-10 shadow-2xl border border-gray-50 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-[#001F3F] mb-2">Équipement Enregistré</h2>
        <p className="text-gray-500 mb-8 font-medium">La machine <strong>{succes.equipment_code}</strong> est maintenant active dans le parc.</p>
        <div className="flex gap-4">
          <button type="button" onClick={() => setSucces(null)} className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all">Nouveau</button>
          <button type="button" onClick={() => router.push('/equipements')} className="flex-1 py-4 bg-[#0052CC] text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:scale-[1.02] transition-all">Retour au parc</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-grow flex flex-col bg-[#F8FAFC]">
      
      {/* HEADER HERO (Style bannières SCADA de vos maquettes) */}
      <div className="bg-[#001F3F] p-8 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => router.back()} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Ajouter un équipement</h1>
              <p className="text-blue-300/80 font-bold text-xs uppercase tracking-[0.2em] mt-1">Configuration du Parc Machines • Niveau 1</p>
            </div>
          </div>

          <div className="flex gap-4">
           
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl min-w-[160px]">
              <p className="text-[10px] font-black text-blue-300 uppercase mb-1">Type Entrée</p>
              <p className="text-white font-bold text-sm">Équipement Racine</p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENU DU FORMULAIRE ASYMÉTRIQUE PLEINE LARGEUR */}
      <form onSubmit={handleSubmit} className="max-w-[1600px] w-full mx-auto px-8 -mt-10 mb-12 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLONNE 1 : IDENTITÉ TECHNIQUE */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/5 space-y-6 border border-gray-50">
            <div className="flex items-center gap-3 mb-2">
              <Cpu className="text-[#0052CC] w-5 h-5" />
              <h2 className="font-black text-[#001F3F] uppercase text-xs tracking-widest">Identification Technique</h2>
            </div>
            
            <div>
              <label className={labelClass}>Code Unique de l'Équipement *</label>
              <input type="text" value={form.equipment_code} onChange={e => set('equipment_code', e.target.value)} placeholder="Ex: B7214T0007" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Désignation Complète *</label>
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: SOUFFLEUSE SBO 20 SIDEL" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Catégorie / Groupe</label>
              <input type="text" value={form.categorie} onChange={e => set('categorie', e.target.value)} placeholder="Ex: EMBALLAGE" className={inputClass} />
            </div>
          </div>

          {/* COLONNE 2 : LOCALISATION USINE AVEC SELECTEUR PRO */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/5 space-y-6 border border-gray-50">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="text-[#0052CC] w-5 h-5" />
              <h2 className="font-black text-[#001F3F] uppercase text-xs tracking-widest">Localisation Usine</h2>
            </div>

            <div>
              <label className={labelClass}>Pôle de rattachement *</label>
              <select value={form.id_pole} onChange={e => set('id_pole', e.target.value)} disabled={!isAdmin} className={`${inputClass} appearance-none cursor-pointer ${!isAdmin && 'bg-gray-50 opacity-70 text-gray-500'}`}>
                <option value="">-- Sélectionner un pôle --</option>
                {poles.map(p => (
                  <option key={p.id_pole} value={String(p.id_pole)}>{p.nom_pole}</option>
                ))}
              </select>
            </div>

            {form.id_pole && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className={labelClass}>Zone Opérationnelle</label>
                <select value={form.id_zone} onChange={e => set('id_zone', e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
                  <option value="">-- Équipement Zone / Général --</option>
                  {zones.map(z => (
                    <option key={z.id_zone} value={String(z.id_zone)}>{z.nom_zone}</option>
                  ))}
                </select>
              </div>
            )}

          
          </div>

          {/* COLONNE 3 : SPÉCIFICATIONS TECHNIQUE & CONFIRMATION */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/5 space-y-6 border border-gray-50 flex flex-col">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="text-[#0052CC] w-5 h-5" />
              <h2 className="font-black text-[#001F3F] uppercase text-xs tracking-widest">État de Mise en Service</h2>
            </div>

            <div>
              <label className={labelClass}>Date d'Installation</label>
              <div className="relative">
                <Calendar className="absolute right-4 top-3.5 w-5 h-5 text-gray-300 pointer-events-none" />
                <input type="date" value={form.install_date} onChange={e => set('install_date', e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Statut de Départ</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputClass}>
                <option value="NORMAL">🟢 OPÉRATIONNEL</option>
                <option value="EN PANNE">🔴 EN PANNE CRITIQUE</option>
                <option value="ARRETE">🟡 ARRÊTÉ / HORS SERVICE</option>
              </select>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-50 space-y-4">
              {erreur && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" /> {erreur}
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => router.back()} className="flex-1 py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600 transition-all">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="flex-[2] py-4 bg-[#0052CC] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:shadow-blue-300 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer la Machine
                </button>
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}