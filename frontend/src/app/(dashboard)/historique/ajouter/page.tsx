'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { historiqueService, equipementService, EquipementNode } from '@/services/historiqueService'
import { Loader2, Upload, FileText, Check, ChevronRight, Search, X, PlusCircle, Filter } from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────
interface User {
  id_user: number
  nom: string
  prenom: string
  role: string
  nom_pole?: string
  [key: string]: any
}

interface ChainNode {
  id_equipement: number
  equipment_code: string
  description: string
  level: number
}

// ── Composant : breadcrumb de la hierarchie selectionnee ────────────
function HierarchyChain({ chain }: { chain: ChainNode[] }) {
  if (chain.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {chain.map((node, i) => (
        <span key={node.id_equipement} className="flex items-center gap-1.5">
          <span className={`
            px-2.5 py-1 rounded-lg text-xs font-bold transition-all
            ${i === chain.length - 1
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 ring-1 ring-slate-300'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}
          `}>
            <span className="text-slate-400 dark:text-slate-500 mr-1.5 text-[10px] uppercase font-extrabold">L{node.level}</span>
            {node.equipment_code}
          </span>
          {i < chain.length - 1 && (
            <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
          )}
        </span>
      ))}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────
export default function AjouterHistoriquePage() {
  const router  = useRouter()
  const [mode, setMode] = useState<'manuel' | 'csv'>('manuel')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Champ de recherche par code
  const [codeInput, setCodeInput]   = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeError, setCodeError]   = useState('')
  const [suggestions, setSuggestions] = useState<EquipementNode[]>([])
  const [showSugg, setShowSugg]     = useState(false)
  const suggRef = useRef<HTMLDivElement>(null)

  // Hierarchie resolue
  const [chain, setChain]           = useState<ChainNode[]>([])
  const [selectedLeaf, setSelectedLeaf] = useState<EquipementNode | null>(null)

  // Formulaire
  const [form, setForm] = useState({
    type_travail:    'CORR',
    cout_total:      '',
    date_declaration:'',
    date_fin:        '',
    source:          'MANUAL',
  })
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // CSV
  const [csvFile, setCsvFile]       = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<string[][]>([])

  const today = new Date().toISOString().split('T')[0]

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) setCurrentUser(JSON.parse(userStr))
  }, [])

  // Fermer les suggestions au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggRef.current && !suggRef.current.contains(event.target as Node)) {
        setShowSugg(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Autocomplete avec Debounce (Evite le harcèlement de l'API) ─────
  useEffect(() => {
    const trimmed = codeInput.trim()
    
    // Si vide, trop court, ou correspond déjà à l'équipement validé, on ne fait rien
    if (!trimmed || trimmed.length < 3 || (selectedLeaf && trimmed === selectedLeaf.equipment_code)) {
      setSuggestions([])
      setShowSugg(false)
      return
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const results = await equipementService.search(trimmed)
        if (results && Array.isArray(results)) {
          setSuggestions(results)
          setShowSugg(results.length > 0)
        } else {
          setSuggestions([])
          setShowSugg(false)
        }
      } catch (err) {
        // Bloque toute propagation d'erreur vers les composants globaux
        setSuggestions([])
        setShowSugg(false)
      }
    }, 300) // Attend 300ms après la fin de la saisie avant d'interroger le serveur

    return () => clearTimeout(delayDebounce)
  }, [codeInput, selectedLeaf])

  const resolveCode = useCallback(async (code: string) => {
    const targetCode = code.trim()
    if (!targetCode || targetCode.length < 2) return
    
    setCodeLoading(true)
    setCodeError('')
    setShowSugg(false)
    try {
      const result = await equipementService.getByCode(targetCode)
      setCodeLoading(false)
      if (!result) {
        setCodeError('Code introuvable dans la base équipements')
        setChain([])
        setSelectedLeaf(null)
        return
      }
      setChain(result.chain)
      setSelectedLeaf(result.equipement)
      setCodeInput(targetCode.toUpperCase())
    } catch (err) {
      setCodeLoading(false)
      setCodeError('Code introuvable ou erreur de structure.')
      setChain([])
      setSelectedLeaf(null)
    }
  }, [])

  // ── Soumission ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeaf || !chain[0]) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un équipement avant de valider.' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const rootNode = chain[0]
      const parentNode = chain[chain.length - 2] || null
      
      await historiqueService.ajouter({
        system_equipment:      rootNode.equipment_code,
        equipment_description: selectedLeaf.description,
        equipment_code:        selectedLeaf.equipment_code,
        equipment_level:       selectedLeaf.level,
        parent_code:           parentNode?.equipment_code,
        parent_level:          parentNode?.level,
        type_travail:          form.type_travail,
        action_entity:         currentUser?.nom_pole,
        cout_total:            form.cout_total ? parseFloat(form.cout_total) : undefined,
        date_declaration:      form.date_declaration,
        date_fin:              form.date_fin || undefined,
        date_creation:         today,
        source:                form.source,
      })
      setMessage({ type: 'success', text: 'Intervention ajoutée avec succès au registre historique.' })
      setChain([])
      setSelectedLeaf(null)
      setCodeInput('')
      setForm(f => ({ ...f, cout_total: '', date_declaration: '', date_fin: '' }))
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Erreur lors de la création de l\'intervention' })
    } finally {
      setLoading(false)
    }
  }

  // ── CSV ───────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsvPreview(text.split('\n').slice(0, 6).map(l => l.split(',')))
    }
    reader.readAsText(file)
  }

  const handleImportCSV = async () => {
    if (!csvFile) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await historiqueService.importCSV(csvFile)
      setMessage({ type: 'success', text: res.message })
      setCsvFile(null)
      setCsvPreview([])
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Erreur lors de l\'importation du fichier' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── BANNIÈRE EN-TÊTE BLEU CORPORATE ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003B7A] via-[#004a8f] to-[#003B7A] p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>
        <div className="relative flex items-center justify-between flex-wrap gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <FileText size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl text-white">Nouvelle Intervention</h1>
              <p className="text-blue-100 text-base mt-2 font-medium">
                Enregistrement manuel ou import groupé d'interventions dans l'historique général
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS SÉLECTION DE MODE ── */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl max-w-sm border border-slate-200">
        {(['manuel', 'csv'] as const).map(m => (
          <button 
            key={m} 
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 text-center rounded-lg text-xs font-black tracking-wide uppercase transition-all ${
              mode === m
                ? 'bg-white text-slate-800 shadow-md border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {m === 'manuel' ? 'Saisie Manuelle' : 'Import CSV'}
          </button>
        ))}
      </div>

      {/* ── NOTIFICATION ── */}
      {message && (
        <div className={`p-4 rounded-xl font-bold text-sm flex items-start gap-3 border shadow-sm transition-all duration-200 ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {message.type === 'success' ? <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <span className="text-rose-600 font-black">⚠️</span>}
          <div>{message.text}</div>
        </div>
      )}

      {/* ── Saisie Manuelle ─────────────────────────────────────────────── */}
      {mode === 'manuel' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* SECTION 1 : SÉLECTION ÉQUIPEMENT */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Filter size={16} className="text-slate-500" /> 1. Identification de l'Équipement Cible
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Recherche par Code SAP */}
              <div className="space-y-2 max-w-xl">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                  Code Composante SAP
                </label>
                <div className="relative" ref={suggRef}>
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={codeInput}
                      onChange={e => setCodeInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); resolveCode(codeInput) } }}
                      placeholder="Ex: B7716R0021-102 (puis appuyez sur Entrée)"
                      className="w-full pl-12 pr-24 py-3.5 border-2 border-slate-200 rounded-xl bg-white
                        text-slate-900 placeholder-slate-400 font-bold font-mono text-sm shadow-sm
                        focus:outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {codeInput && (
                        <button type="button" onClick={() => { setCodeInput(''); setChain([]); setSelectedLeaf(null); setSuggestions([]); }}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                          <X size={15} />
                        </button>
                      )}
                      <button 
                        type="button" 
                        onClick={() => resolveCode(codeInput)} 
                        disabled={codeLoading || !codeInput}
                        className="px-4 py-2 bg-[#003B7A] hover:bg-[#002a5a] text-white rounded-lg text-xs font-black uppercase tracking-wide transition-all shadow-sm disabled:opacity-40"
                      >
                        {codeLoading ? <Loader2 size={14} className="animate-spin" /> : 'OK'}
                      </button>
                    </div>
                  </div>

                  {/* Suggestions Autocomplete */}
                  {showSugg && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-50">
                      {suggestions.map(s => (
                        <button 
                          key={s.id_equipement} 
                          type="button"
                          onClick={() => { setCodeInput(s.equipment_code); resolveCode(s.equipment_code); setShowSugg(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between"
                        >
                          <div className="truncate">
                            <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mr-2">{s.equipment_code}</span>
                            <span className="text-xs text-slate-600 font-bold">{s.description}</span>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">Niveau {s.level}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {codeError && <p className="text-xs text-red-500 font-bold mt-1 pl-1">⚠️ {codeError}</p>}
              </div>

              {/* Résumé de sélection de la chaîne */}
              {chain.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner space-y-2">
                  <p className="text-xs font-black text-slate-600 uppercase tracking-wider">
                    Structure Technique Validée
                  </p>
                  <HierarchyChain chain={chain} />
                  {selectedLeaf && (
                    <p className="text-xs text-slate-500 font-bold bg-white p-2.5 rounded-xl border border-slate-100 inline-block mt-2 shadow-sm">
                      Désignation complète : <span className="text-slate-800 font-extrabold">{selectedLeaf.description}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2 : DÉTAILS INTERVENTION */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <PlusCircle size={16} className="text-slate-500" /> 2. Métadonnées et Spécifications du Travail
              </h2>
            </div>
            
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Type travail */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                  Type de Travail *
                </label>
                <select
                  value={form.type_travail}
                  onChange={e => setForm(f => ({ ...f, type_travail: e.target.value }))}
                  className="w-full appearance-none px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold cursor-pointer text-slate-800 focus:border-slate-500 focus:outline-none transition-all shadow-sm"
                >
                  <option value="CORR">CORR — Correctif historique</option>
                  <option value="PREV">PREV — Préventif périodique</option>
                </select>
              </div>

              {/* Entité */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">
                  Entité Exécutante (Pôle)
                </label>
                <input
                  value={currentUser?.nom_pole || 'LLK - Lalla Khedidja Eau Minerale'}
                  disabled
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-500 text-sm font-bold cursor-not-allowed shadow-inner"
                />
              </div>

              {/* Date déclaration */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                  Date de Déclaration / Déclenchement *
                </label>
                <input 
                  type="date" 
                  required
                  value={form.date_declaration}
                  onChange={e => setForm(f => ({ ...f, date_declaration: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900 font-bold text-sm shadow-sm focus:outline-none focus:border-slate-500 transition-all"
                />
              </div>

              {/* Date fin */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                  Date de Clôture / Fin <span className="text-slate-400 font-medium lowercase">(optionnel)</span>
                </label>
                <input 
                  type="date"
                  value={form.date_fin}
                  min={form.date_declaration}
                  onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900 font-bold text-sm shadow-sm focus:outline-none focus:border-slate-500 transition-all"
                />
              </div>

              {/* Date création */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400">
                  Date d'Enregistrement Système
                </label>
                <input 
                  type="date" 
                  disabled 
                  value={today}
                  className="w-full px-4 py-3 border-2 border-slate-100 bg-slate-50 text-slate-400 text-sm font-bold cursor-not-allowed shadow-inner"
                />
              </div>

              {/* Coût */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                  Coût Total Estimé (DA)
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={form.cout_total}
                  onChange={e => setForm(f => ({ ...f, cout_total: e.target.value }))}
                  placeholder="0.00 DA"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900 font-bold text-sm shadow-sm focus:outline-none focus:border-slate-500 transition-all"
                />
              </div>

              {/* Source */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                  Référence Source / Tag d'Origine
                </label>
                <input
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="Ex: ARCHIVE_EXCEL_2026_CORRECTIF"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white text-slate-900 font-bold text-sm shadow-sm focus:outline-none focus:border-slate-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* ACTIONS FORMULAIRE */}
          <div className="flex gap-3 justify-end items-center pt-2">
            <button 
              type="button" 
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wide bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={loading || !selectedLeaf}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#003B7A] hover:bg-[#002a5a] text-white text-xs font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Inscrire au Registre
            </button>
          </div>
        </form>
      )}

      {/* ── Mode CSV ─────────────────────────────────────────────────── */}
      {mode === 'csv' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Upload size={16} className="text-slate-500" /> Importation de Fichiers d'Interventions Groupés
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="border-4 border-dashed border-slate-200 rounded-2xl p-10 text-center bg-slate-50/50 hover:border-slate-400 hover:bg-slate-100/50 transition-all cursor-pointer group">
              <Upload size={48} className="text-slate-400 group-hover:text-slate-600 mx-auto mb-4 transition-colors" />
              <p className="text-sm text-slate-600 font-bold mb-3">
                Glissez-déposez votre fichier de données .csv ici, ou utilisez le sélecteur
              </p>
              <label className="inline-block px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-md">
                Parcourir les disques
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              </label>
              {csvFile && (
                <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-black font-mono">
                  <FileText size={14}/> {csvFile.name}
                </div>
              )}
            </div>

            {/* Aperçu CSV */}
            {csvPreview.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  Aperçu Technique Structurel <span className="text-[10px] text-slate-400 font-bold font-mono">(5 premières lignes)</span>
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className={`
                            ${idx === 0 
                              ? 'bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-xs' 
                              : 'border-b border-slate-100 text-[11px] font-medium text-slate-600 hover:bg-slate-50/60'}
                          `}
                        >
                          {row.map((cell, cidx) => (
                            <td key={cidx} className="px-4 py-3 max-w-[200px] truncate font-mono">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions CSV */}
            <div className="flex gap-3 justify-end items-center pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => { setCsvFile(null); setCsvPreview([]) }}
                className="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wide bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                Vider la sélection
              </button>
              <button 
                onClick={handleImportCSV} 
                disabled={!csvFile || loading}
                className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Lancer l'injection CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}