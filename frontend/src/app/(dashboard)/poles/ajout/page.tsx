'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, List, Plus, Trash2, ArrowRight } from 'lucide-react'
import { polesService } from '@/services/polesService'
import { zonesService } from '@/services/zonesService'

const inputClass = `w-full px-4 py-2.5 rounded-xl border
  border-gray-200 dark:border-gray-700
  bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  placeholder:text-gray-400
  focus:outline-none focus:ring-2 focus:ring-blue-500
  transition-all`

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

  // ── Succès ──
  if (succes) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30
                      flex items-center justify-center mx-auto mb-5">
        <Check size={36} className="text-green-500"/>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Pôle créé !
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Le pôle <span className="font-semibold text-blue-600">«{nomCree}»</span> et ses zones ont été ajoutés.
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={reset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          <Building2 size={15}/> Ajouter un autre
        </button>
        <button onClick={() => router.push('/poles/liste')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border
                     border-gray-200 dark:border-gray-700
                     text-gray-700 dark:text-gray-300 text-sm font-medium
                     hover:bg-gray-50 dark:hover:bg-gray-800">
          <List size={15}/> Voir la liste
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-600
                        flex items-center justify-center">
          <Building2 size={22} className="text-white"/>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Nouveau pôle
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Créez un pôle et ajoutez ses zones directement
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Infos pôle ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider mb-4">
            Informations du pôle
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Nom du pôle <span className="text-red-500">*</span>
              </label>
              <input value={form.nom_pole}
                onChange={e => setField('nom_pole', e.target.value)}
                placeholder="ex : Corps Gras, Sucre, Lait..."
                required maxLength={100}
                className={inputClass}/>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Code pôle
                <span className="text-gray-400 font-normal ml-1 text-xs">
                  (ex: BCH, LLK, BLS)
                </span>
              </label>
              <input value={form.code_pole}
                onChange={e => setField('code_pole', e.target.value.toUpperCase())}
                placeholder="ex: BCH"
                maxLength={20}
                className={inputClass}/>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Description
                <span className="text-gray-400 font-normal ml-1 text-xs">
                  (optionnel)
                </span>
              </label>
              <textarea value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Décrivez les activités de ce pôle..."
                rows={2}
                className={`${inputClass} resize-none`}/>
            </div>
          </div>
        </div>

        {/* ── Zones ── */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase
                             tracking-wider">
                Zones du pôle
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Ajoutez les zones qui composent ce pôle
              </p>
            </div>
            <button type="button" onClick={ajouterZone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                         bg-blue-50 dark:bg-blue-900/20
                         text-blue-600 dark:text-blue-400 text-sm
                         border border-blue-200 dark:border-blue-800
                         hover:bg-blue-100 dark:hover:bg-blue-900/30
                         transition-all">
              <Plus size={13}/> Ajouter zone
            </button>
          </div>

          <div className="space-y-3">
            {zones.map((z, i) => (
              <div key={i}
                className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-start
                           p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50
                           border border-gray-200 dark:border-gray-700">

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500
                                    dark:text-gray-400 mb-1">
                    Code zone
                  </label>
                  <input value={z.code_zone}
                    onChange={e => setZone(i, 'code_zone', e.target.value.toUpperCase())}
                    placeholder="ex: BCH01"
                    className={inputClass}/>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500
                                    dark:text-gray-400 mb-1">
                    Nom zone
                  </label>
                  <input value={z.nom_zone}
                    onChange={e => setZone(i, 'nom_zone', e.target.value)}
                    placeholder="ex: Conditionnement Huile"
                    className={inputClass}/>
                </div>

                <div className="flex items-end justify-end pb-0.5">
                  {zones.length > 1 && (
                    <button type="button"
                      onClick={() => supprimerZone(i)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center
                                 text-gray-400 hover:text-red-500
                                 hover:bg-red-50 dark:hover:bg-red-900/20
                                 border border-gray-200 dark:border-gray-700
                                 transition-all">
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Aperçu zones valides */}
          {zones.some(z => z.code_zone && z.nom_zone) && (
            <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20
                            border border-blue-100 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                {zones.filter(z => z.code_zone && z.nom_zone).length} zone{zones.filter(z => z.code_zone && z.nom_zone).length > 1 ? 's' : ''} à créer :
              </p>
              <div className="flex flex-wrap gap-2">
                {zones.filter(z => z.code_zone && z.nom_zone).map((z, i) => (
                  <span key={i}
                    className="text-xs px-2.5 py-1 rounded-lg
                               bg-blue-100 dark:bg-blue-900/40
                               text-blue-700 dark:text-blue-300">
                    {z.code_zone}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Erreur */}
        {erreur && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20
                          border border-red-200 dark:border-red-800
                          text-red-600 dark:text-red-400 text-sm">
            ⚠ {erreur}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => router.push('/poles/liste')}
            className="px-5 py-2.5 rounded-xl border border-gray-200
                       dark:border-gray-700 text-gray-600 dark:text-gray-400
                       text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            Annuler
          </button>
          <button type="submit" disabled={loading || !form.nom_pole.trim()}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl
                       bg-blue-600 hover:bg-blue-700 text-white text-sm
                       font-medium disabled:opacity-40 transition-all">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30
                                   border-t-white rounded-full animate-spin"/>
                  Création...</>
              : <><Check size={15}/> Créer le pôle</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}