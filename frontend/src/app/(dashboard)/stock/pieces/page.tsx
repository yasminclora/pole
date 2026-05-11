'use client'
import { useCallback, useEffect, useState } from 'react'
import api from '@/services/axiosInstance'
import { Loader2, Package, Search } from 'lucide-react'

interface Piece {
  id_piece: number
  code_stock: string
  designation: string
  description?: string
  quantite: number
  seuil_alerte: number
  emplacement?: string
  unite: string
  composantes_liees?: { equipment_code: string; description: string; level: number }[]
}

export default function PiecesPage() {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchPieces = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/stock/liste', {
        params: { page, limit: 20, search }
      })
      setPieces(res.data.data || [])
      setTotalPages(res.data.total_pages || 1)
      setTotal(res.data.total || 0)
    } catch (err) {
      console.error('Erreur:', err)
      setPieces([])
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchPieces() }, [fetchPieces])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Package size={20} className="text-gray-600"/>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Recherche de Pieces</h1>
                <p className="text-gray-500 text-sm">{total} pieces disponibles</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Tapez designation ou code equipement..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>
            <button 
              onClick={handleSearch}
              className="px-5 py-2.5 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition text-sm"
            >
              Rechercher
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-gray-400 w-8 h-8"/>
          </div>
        ) : pieces.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <Package size={48} className="text-gray-300 mx-auto mb-4"/>
            <p className="text-gray-500">Aucune piece trouvee</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pieces.map((p) => (
              <div key={p.id_piece} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono font-semibold text-gray-800">{p.code_stock}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        p.quantite === 0 ? 'bg-red-50 text-red-600' :
                        p.quantite <= p.seuil_alerte ? 'bg-amber-50 text-amber-600' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {p.quantite} {p.unite}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{p.designation}</p>
                    {p.emplacement && (
                      <p className="text-xs text-gray-400 mt-1">Emplacement: {p.emplacement}</p>
                    )}
                  </div>
                  {p.composantes_liees && p.composantes_liees.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-1">Equipt:</p>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {p.composantes_liees.slice(0, 3).map((c, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                            {c.equipment_code}
                          </span>
                        ))}
                        {p.composantes_liees.length > 3 && (
                          <span className="text-xs text-gray-400">+{p.composantes_liees.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">
              Precedent
            </button>
            <span className="px-4 py-2 text-gray-500 text-sm">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  )
}