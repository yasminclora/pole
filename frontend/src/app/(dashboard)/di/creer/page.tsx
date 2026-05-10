'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { diService } from '@/services/diService'
import { equipementsService } from '@/services/equipementsService'
import {
  ArrowLeft, AlertTriangle, Loader2,
  Check, Search, X, Factory, Package, MapPin
} from 'lucide-react'

const URGENCE_LABELS: Record<string, { label: string; color: string }> = {
  NIVEAU_1: { label: 'Niveau 1', color: 'text-green-600' },
  NIVEAU_2: { label: 'Niveau 2', color: 'text-orange-600' },
  NIVEAU_3: { label: 'Niveau 3', color: 'text-red-600' },
}

const getHierarchyLabel = (level: number, description: string) => {
  if (level === 1) return 'Machine racine'
  if (level === 2) return 'Machine système'
  if (level === 3) return `Composante niveau 3`
  if (level === 4) return `Composante niveau 4`
  return description
}

export default function CreerDIPage() {
  const router   = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idPole   = Number(authUser?.id_pole)
  const idUser   = Number(authUser?.id_user)

  const [machineQuery,  setMachineQuery]  = useState('')
  const [machines,      setMachines]      = useState<any[]>([])
  const [searchingMachine, setSearchingMachine] = useState(false)
  const [machineSel,    setMachineSel]    = useState<any>(null)

  const [composantes,   setComposantes]   = useState<any[]>([])
  const [composante,    setComposante]    = useState<any>(null)

  const [urgence,      setUrgence]      = useState('NIVEAU_1')
  const [description,  setDescription]  = useState('')
  const [saving,       setSaving]       = useState(false)
  const [succes,       setSucces]       = useState<any>(null)
  const [erreur,       setErreur]       = useState('')

  const rechercherMachine = async () => {
    if (!machineQuery.trim()) return
    setSearchingMachine(true)
    try {
      const res = await equipementsService.listeMachines({
        id_pole: idPole,
        search : machineQuery.trim(),
      })
      setMachines(res.data || res)
    } catch {
      setMachines([])
    } finally {
      setSearchingMachine(false)
    }
  }

  useEffect(() => {
    if (!machineQuery.trim()) {
      setMachines([])
      return
    }
    const timer = setTimeout(rechercherMachine, 400)
    return () => clearTimeout(timer)
  }, [machineQuery])

  useEffect(() => {
    if (!machineSel) {
      setComposantes([])
      setComposante(null)
      return
    }
    equipementsService.getArbre(machineSel.id_equipement)
      .then(arbre => {
        const extractComposantes = (node: any): any[] => {
          let result: any[] = []
          if (node.hierarchy_level >= 3 && node.hierarchy_level <= 4) {
            result.push(node)
          }
          if (node.enfants) {
            node.enfants.forEach((e: any) => {
              result = [...result, ...extractComposantes(e)]
            })
          }
          return result
        }
        const comps = extractComposantes(arbre)
        setComposantes(comps)
      })
      .catch(() => setComposantes([]))
  }, [machineSel])

  useEffect(() => {
    if (!composante) return
    const level = composante.hierarchy_level
    if (level === 1 || level === 2) setUrgence('NIVEAU_1')
    else if (level === 3) setUrgence('NIVEAU_2')
    else if (level === 4) setUrgence('NIVEAU_3')
  }, [composante])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!composante) {
      setErreur('Sélectionnez une composante'); return
    }
    if (!description.trim()) {
      setErreur('Décrivez la panne'); return
    }
    setSaving(true); setErreur('')
    
    const payload = {
      id_equipement: composante.id_equipement,
      id_pole: idPole,
      id_declarant: idUser,
      description_panne: description.trim(),
      gravite: urgence,
    }
    
    try {
      const res = await diService.creer(payload)
      setSucces(res)
    } catch (err: any) {
      setErreur(err.response?.data?.detail || err.message || 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  if (succes) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl shadow-lg p-6 text-center max-w-sm w-full border border-blue-100">
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
          <Check size={24} className="text-[#003B7A]"/>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">DI créée avec succès!</h2>
        <p className="font-mono text-base font-bold text-[#003B7A] mb-4">{succes.numero_di}</p>
        <p className="text-sm text-gray-500 mb-4">Transmise au méthodiste pour validation</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => router.push('/di/mes-di')}
            className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50">
            Mes DI
          </button>
          <button onClick={() => {
            setSucces(null); setComposante(null); setMachineSel(null)
            setDescription(''); setUrgence('NIVEAU_1')
          }}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{backgroundColor: '#003B7A'}}>
            Nouvelle
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()}
          className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-500 hover:bg-blue-50 hover:border-[#003B7A] hover:text-[#003B7A]">
          <ArrowLeft size={18}/>
        </button>
        <h1 className="text-lg font-bold text-[#003B7A]">Nouvelle Demande d'Intervention</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="bg-white rounded-lg border-2 border-[#003B7A] p-4">
          <label className="text-sm font-semibold text-[#003B7A] mb-3 block">Machine / Équipement</label>
          
          {machineSel ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-blue-50">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Factory size={18} className="text-[#003B7A] flex-shrink-0"/>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Code:</span>
                    <span className="font-mono text-sm font-bold text-[#003B7A]">{machineSel.equipment_code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Nom:</span>
                    <span className="text-sm text-gray-700 truncate">{machineSel.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Niveau:</span>
                    <span className="text-xs font-medium text-[#003B7A]">{getHierarchyLabel(machineSel.hierarchy_level, machineSel.description)}</span>
                  </div>
                  {machineSel.nom_zone && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Zone:</span>
                      <span className="text-xs font-medium text-[#003B7A]">{machineSel.nom_zone}</span>
                    </div>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => { setMachineSel(null); setComposantes([]); setComposante(null) }}
                className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-2">
                <X size={16}/>
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input
                value={machineQuery}
                onChange={e => setMachineQuery(e.target.value)}
                placeholder="Rechercher machine..."
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-[#003B7A] focus:ring-1 focus:ring-[#003B7A]"/>
              {searchingMachine && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#003B7A] animate-spin"/>}
            </div>
          )}

          {machines.length > 0 && !machineSel && (
            <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
              {machines.map(m => (
                <button key={m.id_equipement} type="button"
                  onClick={() => { setMachineSel(m); setMachineQuery('') }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0">
                  <Factory size={16} className="text-[#003B7A] flex-shrink-0"/>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Code:</span>
                      <span className="font-mono text-sm font-bold text-[#003B7A]">{m.equipment_code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Nom:</span>
                      <span className="text-xs text-gray-600 truncate">{m.description}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {machineSel && (
          <div className="bg-white rounded-lg border-2 border-[#003B7A] p-4">
            <label className="text-sm font-semibold text-[#003B7A] mb-3 block">Composante en panne</label>
            
            {composante ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-blue-50">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Package size={18} className="text-[#003B7A] flex-shrink-0"/>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Code:</span>
                      <span className="font-mono text-sm font-bold text-[#003B7A]">{composante.equipment_code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Nom:</span>
                      <span className="text-sm text-gray-700 truncate">{composante.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Niveau:</span>
                      <span className="text-xs font-medium text-[#003B7A]">{getHierarchyLabel(composante.hierarchy_level, composante.description)}</span>
                    </div>
                    {composante.nom_zone && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Zone:</span>
                        <span className="text-xs font-medium text-[#003B7A]">{composante.nom_zone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => setComposante(null)} className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-2">
                  <X size={16}/>
                </button>
              </div>
            ) : (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {composantes.length === 0 && (
                  <div className="p-4 text-center text-xs text-gray-400">
                    <Loader2 size={14} className="animate-spin inline mr-1"/>Chargement...
                  </div>
                )}
                {composantes.map((c, idx) => (
                  <button key={c.id_equipement || idx} type="button"
                    onClick={() => setComposante(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0">
                    <Package size={16} className="text-[#003B7A] flex-shrink-0"/>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Code:</span>
                        <span className="font-mono text-sm text-gray-700">{c.equipment_code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Nom:</span>
                        <span className="text-xs text-gray-500 truncate">{c.description}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {composante && (
          <>
            <div className="bg-white rounded-lg border-2 border-[#003B7A] p-4">
              <label className="text-sm font-semibold text-[#003B7A] mb-3 block">Zone</label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-gray-200">
                <MapPin size={16} className="text-[#003B7A]"/>
                <span className="text-sm font-medium text-gray-700">
                  {(composante?.nom_zone || machineSel?.nom_zone) || 'Non définie'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg border-2 border-[#003B7A] p-4">
              <label className="text-sm font-semibold text-[#003B7A] mb-3 block">Niveau d'urgence</label>
              <div className="flex gap-2">
                {Object.entries(URGENCE_LABELS).map(([key, { label, color }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setUrgence(key)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                      urgence === key 
                        ? 'border-[#003B7A] bg-blue-50 text-[#003B7A]' 
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border-2 border-[#003B7A] p-4">
              <label className="text-sm font-semibold text-[#003B7A] mb-3 block">Description de la panne</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Décrivez le problème observé..."
                rows={4}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:border-[#003B7A] focus:ring-1 focus:ring-[#003B7A] resize-none"/>
            </div>
          </>
        )}

        {erreur && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle size={14} className="text-red-500"/>
            <p className="text-sm text-red-600">{erreur}</p>
          </div>
        )}

        {composante && (
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={() => router.back()}
              className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving || !description.trim()}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-40"
              style={{backgroundColor: '#003B7A'}}>
              {saving ? <Loader2 size={14} className="animate-spin inline"/> : 'Soumettre'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}