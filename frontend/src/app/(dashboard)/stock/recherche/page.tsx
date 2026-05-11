'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { disponibiliteService } from '@/services/disponibiliteService'
import { equipementService } from '@/services/historiqueService'
import { Loader2, Search, Package, ArrowLeft } from 'lucide-react'

export default function RechercheStockPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    const t = setTimeout(async () => {
      try {
        const data = await equipementService.search(query)
        setSuggestions(data ?? [])
        setShowSuggestions((data ?? []).length > 0)
      } catch { setSuggestions([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const handleSearch = async (code?: string) => {
    const searchCode = code || query.trim()
    if (!searchCode) return
    setLoading(true)
    setError('')
    setResult(null)
    setShowSuggestions(false)
    try {
      const data = await disponibiliteService.checkStock(searchCode)
      if (data?.has_stock) {
        setResult(data.piece)
      } else {
        setError('Aucune piece de stock liee a cet equipement')
      }
    } catch {
      setError('Erreur lors de la recherche')
    } finally {
      setLoading(false)
    }
  }

  const STATUS_CFG: Record<string, { label: string; color: string }> = {
    ok: { label: 'En stock', color: 'text-green-600 bg-green-50 border-green-200' },
    warning: { label: 'Stock bas', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    critical: { label: 'Rupture', color: 'text-red-600 bg-red-50 border-red-200' },
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recherche piece par equipement</h1>
          <p className="text-sm text-gray-500">Tapez le code ou le nom de la composante</p>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Code equipement ou description..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {showSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((s: any) => (
                  <button
                    key={s.id_equipement}
                    onClick={() => { setQuery(s.equipment_code); setShowSuggestions(false); handleSearch(s.equipment_code) }}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                  >
                    <span className="font-mono text-xs font-bold text-blue-600 mr-2">{s.equipment_code}</span>
                    <span className="text-gray-600">{s.description}</span>
                    <span className="ml-2 text-xs text-gray-400">L{s.level}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Chercher
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 flex items-start gap-2">
          <Package size={18} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Code stock</p>
              <p className="text-lg font-bold font-mono text-blue-700">{result.code_stock}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_CFG[result.status]?.color || ''}`}>
              {STATUS_CFG[result.status]?.label || result.status}
            </span>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Designation</p>
            <p className="font-medium text-gray-800">{result.designation}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Quantite</p>
              <p className={`text-lg font-bold ${result.quantite <= 0 ? 'text-red-600' : result.quantite <= result.seuil_alerte ? 'text-orange-600' : 'text-green-600'}`}>
                {result.quantite}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Seuil alerte</p>
              <p className="font-semibold text-gray-700">{result.seuil_alerte}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Unite</p>
              <p className="font-semibold text-gray-700">{result.unite || 'pcs'}</p>
            </div>
          </div>

          {result.emplacement && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Emplacement</p>
              <p className="font-mono text-sm text-gray-700">{result.emplacement}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
