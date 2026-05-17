'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/services/axiosInstance'
import {
  ArrowLeft, Package, Save, Loader2, Plus, X, Search,
  CheckCircle2, AlertTriangle, Hash, MapPin, Tag, Cog,
} from 'lucide-react'

interface EquipementSuggest {
  id_equipement: number
  equipment_code: string
  description:    string
  hierarchy_level: number
}

export default function NouvellePiecePage() {
  const router = useRouter()

  // Champs pièce
  const [codeStock,    setCodeStock]    = useState('')
  const [designation,  setDesignation]  = useState('')
  const [description,  setDescription]  = useState('')
  const [quantite,     setQuantite]     = useState<number>(0)
  const [seuilAlerte,  setSeuilAlerte]  = useState<number>(2)
  const [emplacement,  setEmplacement]  = useState('')
  const [unite,        setUnite]        = useState('pcs')
  const [quantiteType, setQuantiteType] = useState<number>(1)

  // Équipements liés
  const [equipementsLies, setEquipementsLies] = useState<EquipementSuggest[]>([])
  const [searchEquip,     setSearchEquip]     = useState('')
  const [suggestions,     setSuggestions]     = useState<EquipementSuggest[]>([])
  const [searching,       setSearching]       = useState(false)

  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Recherche équipements via API
  useEffect(() => {
    if (!searchEquip.trim()) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get('/equipements/search', {
          params: { q: searchEquip, limit: 8 },
        })
        const list = (res.data?.data || res.data || []) as EquipementSuggest[]
        setSuggestions(list.filter(e =>
          !equipementsLies.find(x => x.equipment_code === e.equipment_code)
        ))
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchEquip, equipementsLies])

  const addEquip = (eq: EquipementSuggest) => {
    setEquipementsLies(prev => [...prev, eq])
    setSearchEquip('')
    setSuggestions([])
  }
  const removeEquip = (code: string) => {
    setEquipementsLies(prev => prev.filter(e => e.equipment_code !== code))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (!designation.trim()) { setError('La désignation est obligatoire.'); return }
    if (designation.trim().length < 2) { setError('La désignation doit faire ≥ 2 caractères.'); return }

    setSaving(true)
    try {
      const res = await api.post('/stock/pieces/nouvelle', {
        code_stock:      codeStock.trim() || null,
        designation:     designation.trim(),
        description:     description.trim() || null,
        quantite,
        seuil_alerte:    seuilAlerte,
        emplacement:     emplacement.trim() || null,
        unite:           unite.trim() || 'pcs',
        quantite_type:   quantiteType,
        equipment_codes: equipementsLies.map(e => e.equipment_code),
      })
      const createdCode = res.data?.code_stock
      const introuvables = res.data?.equipment_codes_introuvables ?? []
      setSuccess(
        `Pièce ${createdCode} créée avec succès.` +
        (introuvables.length > 0 ? ` (${introuvables.length} équipement(s) non trouvé(s) : ${introuvables.join(', ')})` : '')
      )
      // Redirection après 1.5s
      setTimeout(() => router.push('/stock/pieces'), 1500)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      <button onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
        <ArrowLeft size={14} /> Retour au stock
      </button>

      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow">
          <Package className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle pièce de rechange</h1>
          <p className="text-sm text-gray-500">Crée une pièce et lie-la aux équipements concernés</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Bloc identification */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Tag size={14} className="text-blue-600" /> Identification
          </h2>

          <Field label="Code stock" hint="Laisser vide pour générer STK-NNNN automatiquement">
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={codeStock}
                     onChange={e => setCodeStock(e.target.value)}
                     placeholder="STK-0042 (optionnel)"
                     className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </Field>

          <Field label="Désignation" required>
            <input type="text" value={designation}
                   onChange={e => setDesignation(e.target.value)}
                   placeholder="MOTEUR ÉLECTRIQUE 1500W"
                   className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                   required />
          </Field>

          <Field label="Description" hint="Détails, références constructeur, etc.">
            <textarea value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Notes techniques, références fournisseur…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>

        {/* Bloc stock */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Package size={14} className="text-blue-600" /> Stock et alerte
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Quantité initiale">
              <input type="number" min={0} value={quantite}
                     onChange={e => setQuantite(Math.max(0, parseInt(e.target.value || '0', 10)))}
                     className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
            <Field label="Unité">
              <select value={unite} onChange={e => setUnite(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="pcs">pcs (pièces)</option>
                <option value="m">m (mètres)</option>
                <option value="L">L (litres)</option>
                <option value="kg">kg (kilogrammes)</option>
                <option value="boite">boîte</option>
                <option value="rouleau">rouleau</option>
              </select>
            </Field>
            <Field label="Seuil alerte" hint="🔔 ≤ ce seuil = FAIBLE">
              <input type="number" min={0} value={seuilAlerte}
                     onChange={e => setSeuilAlerte(Math.max(0, parseInt(e.target.value || '0', 10)))}
                     className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </Field>
          </div>

          <Field label="Emplacement physique" hint="Ex : Rayon A - Étagère 3 - Bac 12">
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={emplacement}
                     onChange={e => setEmplacement(e.target.value)}
                     placeholder="Rayon - Étagère - Bac"
                     className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </Field>

          <Field label="Qté nécessaire par remplacement" hint="Combien de cette pièce faut-il pour un remplacement standard ?">
            <input type="number" min={1} value={quantiteType}
                   onChange={e => setQuantiteType(Math.max(1, parseInt(e.target.value || '1', 10)))}
                   className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>

        {/* Bloc équipements liés */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Cog size={14} className="text-blue-600" /> Équipements liés
            <span className="text-xs font-normal text-gray-500">— Composantes qui utilisent cette pièce</span>
          </h2>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchEquip}
                   onChange={e => setSearchEquip(e.target.value)}
                   placeholder="Rechercher par code (ex: B4313R2003-01)…"
                   className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-gray-400" />}
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map(s => (
                  <button type="button" key={s.equipment_code}
                          onClick={() => addEquip(s)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition border-b border-gray-100 last:border-0">
                    <div className="font-mono text-xs font-semibold text-gray-900">{s.equipment_code}</div>
                    <div className="text-xs text-gray-500 truncate">{s.description}</div>
                    <div className="text-[10px] text-gray-400">Niveau {s.hierarchy_level}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {equipementsLies.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
              Aucun équipement lié pour le moment.
            </p>
          ) : (
            <div className="space-y-2">
              {equipementsLies.map(eq => (
                <div key={eq.equipment_code}
                     className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-gray-900">{eq.equipment_code}</div>
                    <div className="text-xs text-gray-600 truncate">{eq.description}</div>
                  </div>
                  <button type="button" onClick={() => removeEquip(eq.equipment_code)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => router.back()}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
            Annuler
          </button>
          <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold shadow disabled:opacity-50">
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</>
              : <><Save className="w-4 h-4" /> Créer la pièce</>}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-gray-400 mt-0.5 block">{hint}</span>}
    </label>
  )
}
