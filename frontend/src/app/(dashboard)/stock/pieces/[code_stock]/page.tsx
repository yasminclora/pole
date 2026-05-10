'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { stockService } from '@/services/stockService'
import {
  Loader2, ArrowLeft, Package, AlertTriangle, CheckCircle,
  MapPin, Hash, Layers, FileText, Plus
} from 'lucide-react'

interface Piece {
  id_piece: number
  code_stock: string
  designation: string
  description: string
  quantite: number
  seuil_alerte: number
  emplacement: string
  unite: string
  nb_composantes: number
  composantes_liees: Array<{
    equipment_code: string
    description: string
    level: number
  }>
}

export default function StockPieceDetailPage() {
  const { code_stock } = useParams<{ code_stock: string }>()
  const router = useRouter()

  const [piece, setPiece] = useState<Piece | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (code_stock) {
      loadPiece()
    }
  }, [code_stock])

  const loadPiece = async () => {
    setLoading(true)
    try {
      const data = await stockService.getByCode(code_stock)
      setPiece(data)
    } catch (error) {
      console.error('Erreur chargement pièce:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStockStatus = (piece: Piece) => {
    if (piece.quantite <= 0) return { color: 'red', label: 'Rupture de stock', icon: AlertTriangle, bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
    if (piece.quantite <= piece.seuil_alerte) return { color: 'orange', label: 'Stock faible', icon: AlertTriangle, bg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' }
    return { color: 'green', label: 'Stock suffisant', icon: CheckCircle, bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-orange-500 animate-spin"/>
      </div>
    )
  }

  if (!piece) {
    return (
      <div className="text-center py-20">
        <Package size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
        <p className="text-gray-500 dark:text-gray-400 font-medium">Pièce introuvable</p>
        <button onClick={() => router.push('/stock/pieces')}
          className="mt-4 text-orange-600 hover:text-orange-700 text-sm">
          Retour à la liste
        </button>
      </div>
    )
  }

  const status = getStockStatus(piece)
  const StatusIcon = status.icon

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Bouton retour */}
      <button onClick={() => router.push('/stock/pieces')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
        <ArrowLeft size={16}/>
        Retour à la liste
      </button>

      {/* Carte principale */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-orange-600 flex items-center justify-center">
              <Package size={24} className="text-white"/>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-orange-600 dark:text-orange-400">
                {piece.code_stock}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {piece.designation}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {piece.quantite > 0 && (
              <button
                onClick={() => router.push(`/stock/reservation?piece=${piece.code_stock}`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm">
                <Plus size={16}/>
                Réserver
              </button>
            )}
            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${status.bg}`}>
              <StatusIcon size={16}/>
              {status.label}
            </span>
          </div>
        </div>

        {/* Description */}
        {piece.description && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-gray-400"/>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{piece.description}</p>
          </div>
        )}

        {/* Infos stock */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Hash size={16} className="text-gray-400"/>
              <span className="text-xs text-gray-500">Quantité en stock</span>
            </div>
            <p className={`text-2xl font-bold ${piece.quantite <= piece.seuil_alerte ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
              {piece.quantite} {piece.unite}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-gray-400"/>
              <span className="text-xs text-gray-500">Seuil d'alerte</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {piece.seuil_alerte} {piece.unite}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={16} className="text-gray-400"/>
              <span className="text-xs text-gray-500">Emplacement</span>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {piece.emplacement || 'Non défini'}
            </p>
          </div>
        </div>

        {/* Composantes liées */}
        {piece.composantes_liees && piece.composantes_liees.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Layers size={18} className="text-gray-400"/>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Composantes liées ({piece.nb_composantes})
              </h2>
            </div>
            <div className="space-y-2">
              {piece.composantes_liees.map((comp, idx) => (
                <div key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg
                             hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => router.push(`/equipements/${comp.equipment_code}`)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Package size={14} className="text-blue-600 dark:text-blue-400"/>
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {comp.equipment_code}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{comp.description}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    Niveau {comp.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
