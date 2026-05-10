'use client'
import { useCallback, useEffect, useState } from 'react'
import api from '@/services/axiosInstance'
import { Loader2, Package, Search, AlertTriangle, CheckCircle } from 'lucide-react'

interface Piece {
  id_piece: number
  code_stock: string
  designation: string
  description?: string
  quantite: number
  seuil_alerte: number
  emplacement?: string
  unite: string
}

export default function PiecesPage() {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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

  return (
    <div className="max-w-6xl mx-auto pb-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="text-[#003B7A]" /> Stock Pièces
        </h1>
        <p className="text-gray-500 text-sm mt-1">{total} pièces en stock</p>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher par code ou désignation..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>
        <button onClick={fetchPieces} className="px-4 py-2 bg-[#003B7A] text-white rounded-lg text-sm">
          Rechercher
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#003B7A] w-8 h-8"/></div>
      ) : pieces.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Aucune pièce trouvée</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Code Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Désignation</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Quantité</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Seuil</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Emplacement</th>
              </tr>
            </thead>
            <tbody>
              {pieces.map((p) => (
                <tr key={p.id_piece} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-[#003B7A]">{p.code_stock}</td>
                  <td className="px-4 py-3">{p.designation}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                      p.quantite === 0 ? 'bg-red-100 text-red-600' :
                      p.quantite <= p.seuil_alerte ? 'bg-orange-100 text-orange-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {p.quantite} {p.unite}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{p.seuil_alerte}</td>
                  <td className="px-4 py-3 text-gray-500">{p.emplacement || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50">
            Précédent
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50">
            Suivant
          </button>
        </div>
      )}
    </div>
  )
}