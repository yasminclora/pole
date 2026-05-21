'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, List, Plus, Trash2, ArrowLeft, AlertCircle, Info, LayoutGrid } from 'lucide-react'
import { polesService } from '@/services/polesService'
import { zonesService } from '@/services/zonesService'

const labelClass = `block text-[11px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2`
const inputClass = `w-full px-4 py-3.5 rounded-xl border border-gray-100 bg-white
  text-gray-900 text-sm font-semibold transition-all duration-300
  focus:outline-none focus:border-[#0052CC] focus:ring-4 focus:ring-[#0052CC]/5 shadow-sm`

const emptyZone = () => ({ code_zone: '', nom_zone: '' })

export default function AjoutPolePage() {
  const router = useRouter()

  const [form,    setForm]    = useState({ nom_pole: '', code_pole: '', description: '' })
  const [zones,   setZones]   = useState([emptyZone()])
  const [loading, setLoading] = useState(false)
  const [erreur,  setErreur]  = useState('')
  const [succes,  setSucces]  = useState(false)
  const [nomCree, setNomCree] = useState('')

  const setField = (k: string, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  const setZone = (i: number, k: string, v: string) =>
    setZones(z => z.map((z, idx) => idx === i ? { ...z, [k]: v } : z))

  const ajouterZone    = () => setZones(z => [...z, emptyZone()])
  const supprimerZone  = (i: number) => setZones(z => z.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom_pole.trim()) return
    setLoading(true); setErreur('')
    try {
      // 1. Créer le pôle
      const pole = await polesService.creer({
        nom_pole    : form.nom_pole.trim(),
        code_pole   : form.code_pole.trim().toUpperCase() || undefined,
        description : form.description.trim() || undefined,
      })

      // 2. Créer les zones valides
      const zonesValides = zones.filter(z => z.code_zone.trim() && z.nom_zone.trim())
      for (const z of zonesValides) {
        await zonesService.creer({
          code_zone : z.code_zone.trim().toUpperCase(),
          nom_zone  : z.nom_zone.trim(),
          id_pole   : pole.id_pole,
        })
      }

      setNomCree(form.nom_pole.trim())
      setSucces(true)
    } catch (err: any) {
      setErreur(err.response?.data?.detail ?? 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setForm({ nom_pole: '', code_pole: '', description: '' })
    setZones([emptyZone()])
    setSucces(false); setNomCree('')
  }

  // ── Écran de Succès Pleine Largeur ──
  if (succes) return (
    <div className="flex-grow p-12 bg-[#F8FAFC] flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-3xl p-10 shadow-2xl border border-gray-50 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-[#001F3F] mb-2">Pôle Créé avec Succès</h2>
        <p className="text-gray-500 mb-8 font-medium">
          Le pôle opérationnel <span className="text-[#0052CC] font-bold">« {nomCree} »</span> ainsi que ses zones associées ont été injectés.
        </p>
        <div className="flex gap-4">
          <button onClick={reset} className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
            <Building2 size={16}/> Ajouter un autre
          </button>
          <button onClick={() => router.push('/poles/liste')} className="flex-1 py-4 bg-[#0052CC] text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
            <List size={16}/> Voir la liste
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-grow flex flex-col bg-[#F8FAFC] w-full">

      {/* HEADER HERO PREMIUM (Même style exact que la page machine) */}
      <div className="bg-[#001F3F] p-8 pb-20 relative overflow-hidden w-full">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => router.back()} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Configuration Nouveau Pôle</h1>
              <p className="text-blue-300/80 font-bold text-xs uppercase tracking-[0.2em] mt-1">Génération d'Arborescence Usine & Secteurs</p>
            </div>
          </div>

        
        </div>
      </div>

      {/* CONTENU FORMULAIRE PLEINE LARGEUR MAX-W-[1600px] */}
      <form onSubmit={handleSubmit} className="max-w-[1600px] w-full mx-auto px-8 -mt-10 mb-12 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* COLONNE 1 : INFOS DU PÔLE */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/5 space-y-6 border border-gray-50 lg:col-span-1">
            <div className="flex items-center gap-3 pb-2 border-b border-gray-50">
              <Building2 className="text-[#0052CC] w-5 h-5" />
              <h2 className="font-black text-[#001F3F] uppercase text-xs tracking-widest">Informations du pôle</h2>
            </div>

            <div>
              <label className={labelClass}>Nom du pôle *</label>
              <input value={form.nom_pole}
                onChange={e => setField('nom_pole', e.target.value)}
                placeholder="ex : Corps Gras, Sucre, Lait..."
                required maxLength={100}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Code pôle (ex: BCH, LLK, BLS)</label>
              <input value={form.code_pole}
                onChange={e => setField('code_pole', e.target.value.toUpperCase())}
                placeholder="ex: BCH"
                maxLength={20}
                className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Description générale</label>
              <textarea value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Décrivez les activités de ce pôle opérationnel..."
                rows={3}
                className={`${inputClass} resize-none`} />
            </div>
          </div>

          {/* COLONNE 2 & 3 : ZONES DE PRODUCTION POUR OCCUPER TOUT LE RESTE DE L'ÉCRAN */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/5 space-y-6 border border-gray-50 lg:col-span-2 flex flex-col min-h-full">
            <div className="flex items-center justify-between pb-2 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <LayoutGrid className="text-[#0052CC] w-5 h-5" />
                <div>
                  <h2 className="font-black text-[#001F3F] uppercase text-xs tracking-widest">Zones associées</h2>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">Ajoutez les ateliers constituant ce pôle</p>
                </div>
              </div>
              
              <button type="button" onClick={ajouterZone}
                className="flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-blue-50 text-[#0052CC] text-xs font-bold uppercase tracking-wider
                           border border-blue-100 hover:bg-blue-100 transition-all">
                <Plus size={14}/> Ajouter une zone
              </button>
            </div>

            {/* LISTE DYNAMIQUE DES ZONES */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {zones.map((z, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end p-4 rounded-2xl bg-gray-50/70 border border-gray-100 animate-in slide-in-from-top-1 duration-200">
                  
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Code Zone</label>
                    <input value={z.code_zone}
                      onChange={e => setZone(i, 'code_zone', e.target.value.toUpperCase())}
                      placeholder="ex: BCH01"
                      className={inputClass} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nom Complet de la Zone</label>
                    <input value={z.nom_zone}
                      onChange={e => setZone(i, 'nom_zone', e.target.value)}
                      placeholder="ex: Conditionnement Huile"
                      className={inputClass} />
                  </div>

                  <div className="flex justify-end sm:col-span-1">
                    {zones.length > 1 && (
                      <button type="button" onClick={() => supprimerZone(i)}
                        className="w-12 h-12 rounded-xl flex items-center justify-center
                                   text-gray-400 hover:text-red-500 hover:bg-red-50
                                   border border-gray-100 bg-white shadow-sm transition-all">
                        <Trash2 size={16}/>
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>

            {/* APERÇU DES COMPOSANTS VALIDES */}
            {zones.some(z => z.code_zone && z.nom_zone) && (
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Info size={14} /> Détection de {zones.filter(z => z.code_zone && z.nom_zone).length} zone(s) prête(s) à l'intégration :
                </p>
                <div className="flex flex-wrap gap-2">
                  {zones.filter(z => z.code_zone && z.nom_zone).map((z, i) => (
                    <span key={i} className="text-xs px-3 py-1 rounded-xl bg-white text-[#001F3F] border border-blue-100 font-bold shadow-sm font-mono">
                      {z.code_zone}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION BUTTONS & ALERTES EN BAS DE CARTE */}
            <div className="mt-auto pt-6 border-t border-gray-100 space-y-4">
              {erreur && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" /> {erreur}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => router.push('/poles/liste')}
                  className="px-6 py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:text-gray-600 transition-all">
                  Annuler
                </button>
                <button type="submit" disabled={loading || !form.nom_pole.trim()}
                  className="px-8 py-4 bg-[#0052CC] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:shadow-blue-300 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      <span>Génération en cours...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16}/>
                      <span>Créer le pôle</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>
      </form>
    </div>
  )
}