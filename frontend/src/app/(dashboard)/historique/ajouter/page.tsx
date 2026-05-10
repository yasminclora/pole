'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { historiqueService, equipementService, EquipementNode } from '@/services/historiqueService'
import { Loader2, Upload, FileText, Check, ChevronRight, Search, X } from 'lucide-react'

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
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {chain.map((node, i) => (
        <span key={node.id_equipement} className="flex items-center gap-1">
          <span className={`
            px-2 py-0.5 rounded text-xs font-medium
            ${i === chain.length - 1
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
          `}>
            <span className="text-gray-400 dark:text-gray-500 mr-1">L{node.level}</span>
            {node.equipment_code}
          </span>
          {i < chain.length - 1 && (
            <ChevronRight size={12} className="text-gray-300 dark:text-gray-600" />
          )}
        </span>
      ))}
    </div>
  )
}

// ── Composant : selecteur d'enfants (navigation top-down) ───────────
function ChildrenSelector({
  parentId,
  level,
  onSelect,
  selectedCode,
}: {
  parentId: number
  level: number
  onSelect: (node: EquipementNode) => void
  selectedCode?: string
}) {
  const [children, setChildren] = useState<EquipementNode[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    equipementService.getChildren(parentId).then(data => {
      setChildren(data)
      setLoading(false)
    })
  }, [parentId])

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
      <Loader2 size={14} className="animate-spin" /> Chargement niveau {level}...
    </div>
  )

  if (children.length === 0) return (
    <p className="text-xs text-gray-400 italic py-1">Aucun sous-composant disponible</p>
  )

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        Niveau {level}
      </label>
      <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1">
        {children.map(child => (
          <button
            key={child.id_equipement}
            type="button"
            onClick={() => onSelect(child)}
            className={`
              text-left px-3 py-2 rounded-lg text-sm transition-all border
              ${selectedCode === child.equipment_code
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-400'}
            `}
          >
            <span className="font-mono text-xs font-bold mr-2">{child.equipment_code}</span>
            <span className="text-xs opacity-80">{child.description}</span>
            {child.has_children && (
              <span className="ml-2 text-xs opacity-50">&rsaquo;</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────
export default function AjouterHistoriquePage() {
  const router  = useRouter()
  const [mode, setMode] = useState<'manuel' | 'csv'>('manuel')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Mode de saisie equipement
  const [searchMode, setSearchMode] = useState<'code' | 'tree'>('code')

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

  // Navigation top-down (mode arbre)
  const [treeStack, setTreeStack]   = useState<{ node: EquipementNode; selectedChild?: EquipementNode }[]>([])
  const [roots, setRoots]           = useState<EquipementNode[]>([])
  const [rootsLoading, setRootsLoading] = useState(false)

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

  // Charger les racines quand on passe en mode arbre
  useEffect(() => {
    if (searchMode === 'tree' && roots.length === 0) {
      setRootsLoading(true)
      equipementService.getRoots().then(data => {
        setRoots(data)
        setRootsLoading(false)
      })
    }
  }, [searchMode])

  // ── Autocomplete code ─────────────────────────────────────────────
  const handleCodeInput = useCallback(async (val: string) => {
    setCodeInput(val)
    setCodeError('')
    setChain([])
    setSelectedLeaf(null)
    if (val.length < 2) { setSuggestions([]); setShowSugg(false); return }
    const results = await equipementService.search(val)
    setSuggestions(results)
    setShowSugg(results.length > 0)
  }, [])

  const resolveCode = useCallback(async (code: string) => {
    setCodeLoading(true)
    setCodeError('')
    setShowSugg(false)
    const result = await equipementService.getByCode(code)
    setCodeLoading(false)
    if (!result) {
      setCodeError('Code introuvable dans la base equipements')
      setChain([])
      setSelectedLeaf(null)
      return
    }
    setChain(result.chain)
    setSelectedLeaf(result.equipement)
    setCodeInput(code.toUpperCase())
  }, [])

  // ── Navigation arbre top-down ─────────────────────────────────────
  const handleRootSelect = (root: EquipementNode) => {
    setTreeStack([{ node: root }])
    setChain([root])
    setSelectedLeaf(root)
  }

  const handleChildSelect = (child: EquipementNode, stackIndex: number) => {
    // Tronquer le stack au niveau actuel + ajouter le nouvel enfant
    const newStack = treeStack.slice(0, stackIndex + 1).map((s, i) =>
      i === stackIndex ? { ...s, selectedChild: child } : s
    )
    if (child.has_children) {
      newStack.push({ node: child })
    }
    setTreeStack(newStack)
    // Mettre a jour la chaine
    const newChain = [treeStack[0].node, ...newStack.slice(1).map(s => s.node), child]
      .filter((v, i, a) => a.findIndex(x => x.id_equipement === v.id_equipement) === i)
    setChain(newChain)
    setSelectedLeaf(child)
  }

  // ── Equipement selectionne (feuille) ──────────────────────────────
  const rootNode    = chain[0] || null
  const parentNode  = chain[chain.length - 2] || null

  // ── Soumission ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLeaf || !rootNode) {
      setMessage({ type: 'error', text: 'Veuillez selectionner un equipement' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
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
      setMessage({ type: 'success', text: 'Intervention ajoutee avec succes' })
      // Reset equipement
      setChain([])
      setSelectedLeaf(null)
      setCodeInput('')
      setTreeStack([])
      setForm(f => ({ ...f, cout_total: '', date_declaration: '', date_fin: '' }))
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Erreur' })
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
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Erreur import' })
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center">
          <FileText size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Nouvelle Intervention Historique
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Ajouter manuellement ou importer un fichier CSV
          </p>
        </div>
      </div>

      {/* Tabs mode */}
      <div className="flex gap-2 mb-6">
        {(['manuel', 'csv'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === m
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {m === 'manuel' ? 'Formulaire manuel' : 'Import CSV'}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl mb-6 flex items-start gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {message.type === 'success' ? <Check size={16} className="mt-0.5 shrink-0" /> : <span>⚠️</span>}
          {message.text}
        </div>
      )}

      {/* ── Mode manuel ─────────────────────────────────────────────── */}
      {mode === 'manuel' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Section 1 : Selection equipement */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              1. Selection de l'equipement
            </h2>

            {/* Toggle mode saisie */}
            <div className="flex gap-2 mb-5">
              {([
                ['code', 'Par code SAP'],
                ['tree', 'Navigation arbre'],
              ] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => {
                  setSearchMode(val)
                  setChain([])
                  setSelectedLeaf(null)
                  setCodeInput('')
                  setTreeStack([])
                }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    searchMode === val
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-purple-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Mode code */}
            {searchMode === 'code' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Code composante (SAP)
                </label>
                <div className="relative" ref={suggRef}>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={codeInput}
                      onChange={e => handleCodeInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); resolveCode(codeInput) } }}
                      placeholder="ex: B7716R0021-102  puis Entree"
                      className="w-full pl-9 pr-24 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                                 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono
                                 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      {codeInput && (
                        <button type="button" onClick={() => { setCodeInput(''); setChain([]); setSelectedLeaf(null); setSuggestions([]); }}
                          className="p-1 text-gray-400 hover:text-gray-600">
                          <X size={14} />
                        </button>
                      )}
                      <button type="button" onClick={() => resolveCode(codeInput)} disabled={codeLoading || !codeInput}
                        className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium disabled:opacity-40">
                        {codeLoading ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
                      </button>
                    </div>
                  </div>

                  {/* Suggestions autocomplete */}
                  {showSugg && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map(s => (
                        <button key={s.id_equipement} type="button"
                          onClick={() => { setCodeInput(s.equipment_code); resolveCode(s.equipment_code); setShowSugg(false); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <span className="font-mono text-xs font-bold text-purple-600 mr-2">{s.equipment_code}</span>
                          <span className="text-xs text-gray-500">{s.description}</span>
                          <span className="ml-2 text-xs text-gray-300">L{s.level}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {codeError && (
                  <p className="text-xs text-red-500 mt-1">{codeError}</p>
                )}
              </div>
            )}

            {/* Mode arbre top-down */}
            {searchMode === 'tree' && (
              <div className="space-y-4">
                {/* Racines */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Machine racine (Niveau 1)
                  </label>
                  {rootsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 size={14} className="animate-spin" /> Chargement...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1">
                      {roots.map(root => (
                        <button key={root.id_equipement} type="button"
                          onClick={() => handleRootSelect(root)}
                          className={`text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                            treeStack[0]?.node.id_equipement === root.id_equipement
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-400'
                          }`}>
                          <span className="font-mono text-xs font-bold mr-2">{root.equipment_code}</span>
                          <span className="text-xs opacity-80">{root.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selecteurs enfants en cascade */}
                {treeStack.map((frame, idx) => (
                  idx < treeStack.length - 1 ? null : (
                    <ChildrenSelector
                      key={frame.node.id_equipement}
                      parentId={frame.node.id_equipement}
                      level={frame.node.level + 1}
                      selectedCode={frame.selectedChild?.equipment_code}
                      onSelect={child => handleChildSelect(child, idx)}
                    />
                  )
                ))}
              </div>
            )}

            {/* Chaine resolue */}
            {chain.length > 0 && (
              <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
                  Equipement selectionne
                </p>
                <HierarchyChain chain={chain} />
                {selectedLeaf && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {selectedLeaf.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 2 : Intervention */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              2. Details de l'intervention
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Type travail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Type de travail *
                </label>
                <select
                  value={form.type_travail}
                  onChange={e => setForm(f => ({ ...f, type_travail: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="CORR">CORR — Correctif</option>
                  <option value="PREV">PREV — Preventif</option>
                </select>
              </div>

              {/* Entite */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Entite executante
                </label>
                <input
                  value={currentUser?.nom_pole || ''}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 text-sm cursor-not-allowed"
                />
              </div>

              {/* Date declaration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Date declaration *
                </label>
                <input type="date" required
                  value={form.date_declaration}
                  onChange={e => setForm(f => ({ ...f, date_declaration: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Date fin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Date fin <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input type="date"
                  value={form.date_fin}
                  min={form.date_declaration}
                  onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Date creation -- grisee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Date creation
                  <span className="ml-2 text-xs text-gray-400 font-normal">(aujourd'hui, non modifiable)</span>
                </label>
                <input type="date" disabled value={today}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-100 dark:bg-gray-800 text-gray-400 text-sm cursor-not-allowed"
                />
              </div>

              {/* Cout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Cout total (DA)
                </label>
                <input type="number" step="0.01" min="0"
                  value={form.cout_total}
                  onChange={e => setForm(f => ({ ...f, cout_total: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Source */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Source
                </label>
                <input
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="ex: 2025_CORRECTIF"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => router.push('/dashboard')}
              className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                         text-gray-600 dark:text-gray-400 text-sm font-medium
                         hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              Annuler
            </button>
            <button type="submit" disabled={loading || !selectedLeaf}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-purple-600
                         hover:bg-purple-700 text-white text-sm font-medium
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Ajouter
            </button>
          </div>
        </form>
      )}

      {/* ── Mode CSV ─────────────────────────────────────────────────── */}
      {mode === 'csv' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Import fichier CSV
          </h2>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8
                          text-center hover:border-purple-400 transition-colors">
            <Upload size={40} className="text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Glissez votre fichier CSV ici ou
            </p>
            <label className="inline-block px-4 py-2 bg-purple-600 text-white rounded-xl text-sm
                              cursor-pointer hover:bg-purple-700 transition-colors">
              Parcourir
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </label>
            {csvFile && <p className="mt-2 text-sm text-purple-600">{csvFile.name}</p>}
          </div>

          {csvPreview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Apercu (5 premieres lignes)
              </h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs text-left">
                  <tbody>
                    {csvPreview.map((row, idx) => (
                      <tr key={idx} className={idx === 0 ? 'font-bold bg-gray-50 dark:bg-gray-800' : 'border-t border-gray-100 dark:border-gray-800'}>
                        {row.map((cell, cidx) => (
                          <td key={cidx} className="px-3 py-2 text-gray-700 dark:text-gray-300">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setCsvFile(null); setCsvPreview([]) }}
              className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                         text-gray-600 dark:text-gray-400 text-sm font-medium
                         hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              Annuler
            </button>
            <button onClick={handleImportCSV} disabled={!csvFile || loading}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-purple-600
                         hover:bg-purple-700 text-white text-sm font-medium
                         disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Importer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}