'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { equipementsService } from '@/services/equipementsService'
import { polesService } from '@/services/polesService'
import { zonesService } from '@/services/zonesService'
import {
  ArrowLeft, Plus, Loader2, Check, AlertCircle, Factory
} from 'lucide-react'

const inputClass = `w-full px-3 py-2.5 rounded-xl border
  border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`

export default function AjouterMachinePage() {
  const router   = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const isAdmin  = authUser?.role === 'ADMIN'
  const userPole = Number(authUser?.id_pole)

  const [poles,   setPoles]   = useState<any[]>([])
  const [zones,   setZones]   = useState<any[]>([])
  const [saving,  setSaving]  = useState(false)
  const [succes,  setSucces]  = useState<any>(null)
  const [erreur,  setErreur]  = useState('')

  const [form, setForm] = useState({
    equipment_code : '',
    description    : '',
    id_pole        : isAdmin ? '' : String(userPole),
    id_zone        : '',
    install_date   : '',
    categorie      : '',
    status         : 'NORMAL',
  })

  // Charger les pôles
  useEffect(() => {
    if (isAdmin) {
      polesService.lister().then(setPoles)
    } else {
      // Si pas admin → on charge juste son pôle
      polesService.lister().then(data => {
        const monPole = data.filter((p: any) => p.id_pole === userPole)
        setPoles(monPole)
      })
    }
  }, [])

  // Charger les zones quand le pôle change
  useEffect(() => {
    if (form.id_pole) {
      zonesService.parPole(Number(form.id_pole)).then(setZones)
      setForm(f => ({ ...f, id_zone: '' }))
    } else {
      setZones([])
    }
  }, [form.id_pole])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.equipment_code.trim()) {
      setErreur('Le code est obligatoire'); return
    }
    if (!form.description.trim()) {
      setErreur('La description est obligatoire'); return
    }
    if (!form.id_pole) {
      setErreur('Selectionnez un pole'); return
    }
    setSaving(true); setErreur('')
    try {
      const res = await equipementsService.creer({
        equipment_code : form.equipment_code.trim().toUpperCase(),
        description    : form.description.trim(),
        id_pole        : Number(form.id_pole),
        id_zone        : form.id_zone ? Number(form.id_zone) : undefined,
        install_date   : form.install_date || undefined,
        categorie      : form.categorie.trim() || undefined,
        status         : form.status,
      })
      setSucces(res)
    } catch (err: any) {
      setErreur(err.response?.data?.detail ?? 'Erreur')
    } finally { setSaving(false) }
  }

  const resetForm = () => {
    setSucces(null)
    setForm({
      equipment_code: '',
      description   : '',
      id_pole       : isAdmin ? '' : String(userPole),
      id_zone       : '',
      install_date  : '',
      categorie     : '',
      status        : 'NORMAL',
    })
  }

  if (succes) return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30
                      flex items-center justify-center mx-auto mb-5">
        <Check size={36} className="text-green-500"/>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Machine creee !
      </h2>
      <p className="font-mono font-bold text-blue-600 text-lg mb-1">
        {succes.equipment_code}
      </p>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
        {succes.description}
      </p>
      {succes.nom_pole && (
        <p className="text-gray-400 text-sm mb-6">
          Pole : {succes.nom_pole}
        </p>
      )}
      <div className="flex gap-3 justify-center">
        <button onClick={resetForm}
          className="px-5 py-2.5 rounded-xl border border-gray-200
                     dark:border-gray-700 text-gray-600 text-sm
                     hover:bg-gray-50 dark:hover:bg-gray-800">
          Nouvelle machine
        </button>
        <button
          onClick={() => router.push(`/equipements/${succes.id_equipement}`)}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                     text-white text-sm font-medium">
          Voir l'arbre
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()}
          className="w-10 h-10 rounded-xl border border-gray-200
                     dark:border-gray-700 flex items-center justify-center
                     text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft size={18}/>
        </button>
        <div className="w-12 h-12 rounded-2xl bg-blue-600
                        flex items-center justify-center">
          <Factory size={22} className="text-white"/>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Nouvelle machine
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Equipement racine (Level 1)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Identification */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider">
            Identification
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700
                              dark:text-gray-300 mb-1.5">
              Code equipement *
            </label>
            <input
              value={form.equipment_code}
              onChange={e => set('equipment_code', e.target.value)}
              placeholder="ex: B7214T0007"
              className={inputClass}/>
            <p className="text-xs text-gray-400 mt-1">
              Code unique — sera converti en majuscules automatiquement
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700
                              dark:text-gray-300 mb-1.5">
              Description *
            </label>
            <input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="ex: SOUFFLEUSE SBO 20 SIDEL"
              className={inputClass}/>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700
                              dark:text-gray-300 mb-1.5">
              Categorie
            </label>
            <input
              value={form.categorie}
              onChange={e => set('categorie', e.target.value)}
              placeholder="ex: B7214"
              className={inputClass}/>
          </div>
        </div>

        {/* Localisation */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider">
            Localisation
          </h2>

          {/* Pôle */}
          <div>
            <label className="block text-sm font-medium text-gray-700
                              dark:text-gray-300 mb-1.5">
              Pole *
            </label>
            {poles.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 size={14} className="animate-spin"/>
                Chargement...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {poles.map(p => (
                  <button key={p.id_pole} type="button"
                    onClick={() => set('id_pole', String(p.id_pole))}
                    className={`flex flex-col items-start p-3 rounded-xl border
                               text-left transition-all ${
                      form.id_pole === String(p.id_pole)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                    <span className="font-mono text-xs font-bold text-blue-600
                                     dark:text-blue-400">
                      {p.code_pole}
                    </span>
                    <span className={`text-xs mt-0.5 ${
                      form.id_pole === String(p.id_pole)
                        ? 'text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {p.nom_pole}
                    </span>
                    {form.id_pole === String(p.id_pole) && (
                      <Check size={11} className="text-blue-500 mt-1"/>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zone — apparaît seulement si pôle sélectionné */}
          {form.id_pole && (
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Zone
                <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
              </label>
              {zones.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Aucune zone dans ce pole
                </p>
              ) : (
                <select
                  value={form.id_zone}
                  onChange={e => set('id_zone', e.target.value)}
                  className={inputClass}>
                  <option value="">-- Aucune --</option>
                  {zones.map(z => (
                    <option key={z.id_zone} value={z.id_zone}>
                     {z.code_zone} — {z.nom_zone}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Informations complémentaires */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200
                        dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider">
            Informations complementaires
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Date installation
              </label>
              <input
                type="date"
                value={form.install_date}
                onChange={e => set('install_date', e.target.value)}
                className={inputClass}/>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700
                                dark:text-gray-300 mb-1.5">
                Statut
              </label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className={inputClass}>
                <option value="NORMAL">NORMAL</option>
                <option value="EN_PANNE">EN PANNE</option>
                <option value="ARRETE">ARRETE</option>
              </select>
            </div>
          </div>
        </div>

        {erreur && (
          <div className="flex items-center gap-2 p-4 rounded-xl
                          bg-red-50 dark:bg-red-900/20
                          border border-red-200 dark:border-red-800
                          text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={15}/> {erreur}
          </div>
        )}

        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 rounded-xl border border-gray-200
                       dark:border-gray-700 text-gray-600 dark:text-gray-400
                       text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            Annuler
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl
                       bg-blue-600 hover:bg-blue-700 text-white text-sm
                       font-medium disabled:opacity-40 transition-all">
            {saving
              ? <><Loader2 size={16} className="animate-spin"/> Creation...</>
              : <><Plus size={16}/> Creer la machine</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}