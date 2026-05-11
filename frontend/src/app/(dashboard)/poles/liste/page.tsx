'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { polesService } from '@/services/polesService'
import { zonesService } from '@/services/zonesService'
import {
  Building2, MapPin, Plus, ChevronDown,
  ChevronRight, Loader2, Search, Trash2
} from 'lucide-react'

interface Zone {
  id_zone   : number
  code_zone : string
  nom_zone  : string
  id_pole   : number
}

interface Pole {
  id_pole     : number
  nom_pole    : string
  code_pole   : string | null
  description : string | null
  zones       ?: Zone[]
}

const inputClass = `w-full px-3 py-2.5 rounded-xl border
  border-gray-200 dark:border-gray-700
  bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`

export default function ListePolesPage() {
  const router = useRouter()

  const [poles,     setPoles]     = useState<Pole[]>([])
  const [allZones,  setAllZones]  = useState<Zone[]>([])
  const [loading,   setLoading]   = useState(true)
  const [recherche, setRecherche] = useState('')
  const [expanded,  setExpanded]  = useState<number[]>([])

  // Formulaire ajout zone rapide
  const [addingZone,    setAddingZone]    = useState<number | null>(null)
  const [newZoneCode,   setNewZoneCode]   = useState('')
  const [newZoneNom,    setNewZoneNom]    = useState('')
  const [savingZone,    setSavingZone]    = useState(false)
  const [errZone,       setErrZone]       = useState('')

  const charger = async () => {
    setLoading(true)
    try {
      const [ps, zs] = await Promise.all([
        polesService.lister(),
        zonesService.lister(),
      ])
      setPoles(ps)
      setAllZones(zs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  const toggleExpand = (id: number) =>
    setExpanded(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const zonesParPole = (id: number) =>
    allZones.filter(z => z.id_pole === id)

  const handleAjouterZone = async (id_pole: number) => {
    if (!newZoneCode.trim() || !newZoneNom.trim()) {
      setErrZone('Code et nom obligatoires')
      return
    }
    setSavingZone(true); setErrZone('')
    try {
      const z = await zonesService.creer({
        code_zone : newZoneCode.trim().toUpperCase(),
        nom_zone  : newZoneNom.trim(),
        id_pole,
      })
      setAllZones(prev => [...prev, z])
      setAddingZone(null)
      setNewZoneCode(''); setNewZoneNom('')
    } catch (err: any) {
      setErrZone(err.response?.data?.detail ?? 'Erreur')
    } finally {
      setSavingZone(false)
    }
  }

  const handleSupprimerZone = async (id_zone: number) => {
    if (!confirm('Supprimer cette zone ?')) return
    try {
      await zonesService.supprimer(id_zone)
      setAllZones(prev => prev.filter(z => z.id_zone !== id_zone))
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erreur')
    }
  }

  const polesFiltres = poles.filter(p =>
    !recherche ||
    p.nom_pole.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.code_pole ?? '').toLowerCase().includes(recherche.toLowerCase())
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="text-blue-500 animate-spin"/>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center
                      justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pôles & Zones
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {poles.length} pôle{poles.length > 1 ? 's' : ''} —{' '}
            {allZones.length} zone{allZones.length > 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => router.push('/poles/ajout')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl
                     bg-blue-600 hover:bg-blue-700 text-white text-sm
                     font-medium transition-all">
          <Plus size={15}/> Nouveau pôle
        </button>
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un pôle..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border
                     border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900
                     text-gray-900 dark:text-white text-sm
                     placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500"/>
      </div>

      {/* Liste pôles */}
      {polesFiltres.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-800 rounded-2xl">
          <Building2 size={40}
            className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-500 dark:text-gray-400">Aucun pôle trouvé</p>
          <button onClick={() => router.push('/poles/ajout')}
            className="mt-4 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium">
            Créer un pôle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {polesFiltres.map(pole => {
            const zones   = zonesParPole(pole.id_pole)
            const ouvert  = expanded.includes(pole.id_pole)
            const ajoutZone = addingZone === pole.id_pole

            return (
              <div key={pole.id_pole}
                className="bg-white dark:bg-gray-900 border border-gray-200
                           dark:border-gray-800 rounded-2xl overflow-hidden">

                {/* Header pôle */}
                <div
                  className="flex items-center justify-between p-5
                             cursor-pointer hover:bg-gray-50
                             dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => toggleExpand(pole.id_pole)}>

                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-600
                                    flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-white"/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {pole.nom_pole}
                        </p>
                        {pole.code_pole && (
                          <span className="px-2 py-0.5 rounded-lg text-xs
                                           font-mono font-medium
                                           bg-indigo-100 dark:bg-indigo-900/30
                                           text-indigo-700 dark:text-indigo-300">
                            {pole.code_pole}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {zones.length} zone{zones.length > 1 ? 's' : ''}
                        {pole.description && ` — ${pole.description}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setAddingZone(ajoutZone ? null : pole.id_pole)
                        setNewZoneCode(''); setNewZoneNom(''); setErrZone('')
                        if (!ouvert) toggleExpand(pole.id_pole)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                 bg-blue-50 dark:bg-blue-900/20
                                 text-blue-600 dark:text-blue-400 text-xs
                                 border border-blue-200 dark:border-blue-800
                                 hover:bg-blue-100 dark:hover:bg-blue-900/30
                                 transition-all">
                      <Plus size={12}/> Zone
                    </button>
                    {ouvert
                      ? <ChevronDown size={18} className="text-gray-400"/>
                      : <ChevronRight size={18} className="text-gray-400"/>
                    }
                  </div>
                </div>

                {/* Contenu zones */}
                {ouvert && (
                  <div className="border-t border-gray-100 dark:border-gray-800
                                  px-5 py-4">

                    {/* Formulaire ajout zone rapide */}
                    {ajoutZone && (
                      <div className="mb-4 p-4 rounded-xl bg-blue-50
                                      dark:bg-blue-900/20
                                      border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-blue-700
                                      dark:text-blue-300 mb-3">
                          Nouvelle zone pour {pole.nom_pole}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600
                                              dark:text-gray-400 mb-1">
                              Code zone
                            </label>
                            <input value={newZoneCode}
                              onChange={e => setNewZoneCode(e.target.value.toUpperCase())}
                              placeholder="ex: BCH01"
                              className={inputClass}/>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600
                                              dark:text-gray-400 mb-1">
                              Nom zone
                            </label>
                            <input value={newZoneNom}
                              onChange={e => setNewZoneNom(e.target.value)}
                              placeholder="ex: Conditionnement"
                              className={inputClass}/>
                          </div>
                        </div>
                        {errZone && (
                          <p className="text-red-500 text-xs mt-2">⚠ {errZone}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => {
                              setAddingZone(null)
                              setNewZoneCode(''); setNewZoneNom('')
                            }}
                            className="px-3 py-1.5 rounded-lg border
                                       border-gray-200 dark:border-gray-700
                                       text-gray-500 text-xs
                                       hover:bg-gray-50 dark:hover:bg-gray-800">
                            Annuler
                          </button>
                          <button
                            onClick={() => handleAjouterZone(pole.id_pole)}
                            disabled={savingZone}
                            className="flex items-center gap-1.5 px-4 py-1.5
                                       rounded-lg bg-blue-600 hover:bg-blue-700
                                       text-white text-xs font-medium
                                       disabled:opacity-40">
                            {savingZone
                              ? <Loader2 size={12} className="animate-spin"/>
                              : <Check size={12}/>
                            }
                            Ajouter
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Liste zones */}
                    {zones.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-4">
                        Aucune zone — cliquez sur "+ Zone" pour en ajouter
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2
                                      lg:grid-cols-3 gap-2">
                        {zones.map(z => (
                          <div key={z.id_zone}
                            className="flex items-center justify-between
                                       p-3 rounded-xl
                                       bg-gray-50 dark:bg-gray-800
                                       border border-gray-200 dark:border-gray-700
                                       group">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg
                                              bg-indigo-100 dark:bg-indigo-900/30
                                              flex items-center justify-center
                                              flex-shrink-0">
                                <MapPin size={12}
                                  className="text-indigo-600 dark:text-indigo-400"/>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-mono font-semibold
                                             text-gray-900 dark:text-white">
                                  {z.code_zone}
                                </p>
                                <p className="text-xs text-gray-500
                                             dark:text-gray-400 truncate">
                                  {z.nom_zone}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleSupprimerZone(z.id_zone)}
                              className="opacity-0 group-hover:opacity-100
                                         w-6 h-6 rounded-lg flex items-center
                                         justify-center text-gray-400
                                         hover:text-red-500
                                         hover:bg-red-50 dark:hover:bg-red-900/20
                                         transition-all flex-shrink-0">
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}