'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { equipementsService } from '@/services/equipementsService'
import {
  ArrowLeft, Loader2, Plus, ChevronDown,
  ChevronRight, Factory, Trash2,
  AlertTriangle, Layers
} from 'lucide-react'

const LEVEL_CONFIG: Record<number, {
  label: string; color: string; bg: string
}> = {
  1: { label: 'Machine',         color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'     },
  2: { label: 'Sous-systeme',    color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  3: { label: 'Composante',      color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'   },
  4: { label: 'Sous-composante', color: 'text-orange-700 dark:text-orange-300',bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
}

const inputClass = `w-full px-3 py-2.5 rounded-xl border
  border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800
  text-gray-900 dark:text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`

// ── Composant nœud récursif ───────────────────────────────────────────

function NoeudEquipement({
  noeud, isAdmin, onAjouter, onSupprimer, depth = 0
}: {
  noeud      : any
  isAdmin    : boolean
  onAjouter  : (parent: any) => void
  onSupprimer: (equip: any) => void
  depth?     : number
}) {
  const [ouvert, setOuvert] = useState(depth < 2)
  const conf      = LEVEL_CONFIG[noeud.hierarchy_level] ?? LEVEL_CONFIG[4]
  const hasEnfants = noeud.enfants?.length > 0

  return (
    <div className={depth > 0
      ? 'ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4 mt-2'
      : 'mt-2'
    }>
      <div className={`flex items-center justify-between p-3 rounded-xl
                      border transition-all ${conf.bg}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">

          {/* Toggle expand */}
          <button
            type="button"
            onClick={() => setOuvert(o => !o)}
            className="w-5 h-5 flex items-center justify-center
                       text-gray-400 flex-shrink-0">
            {hasEnfants
              ? ouvert
                ? <ChevronDown size={14}/>
                : <ChevronRight size={14}/>
              : <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"/>
            }
          </button>

          {/* Infos */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold
                               text-blue-600 dark:text-blue-400">
                {noeud.equipment_code}
              </span>
              <span className={`text-xs font-medium ${conf.color}`}>
                {conf.label}
              </span>
              {noeud.status && noeud.status !== 'NORMAL' && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium
                                 bg-red-100 text-red-600 dark:bg-red-900/30
                                 dark:text-red-400">
                  {noeud.status}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300
                          truncate mt-0.5">
              {noeud.description}
            </p>
            {/* Infos secondaires */}
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {noeud.categorie && (
                <span className="text-xs text-gray-400">
                  Cat: {noeud.categorie}
                </span>
              )}
              {noeud.install_date && (
                <span className="text-xs text-gray-400">
                  Installé: {new Date(noeud.install_date)
                    .toLocaleDateString('fr-FR')}
                </span>
              )}
              {hasEnfants && (
                <span className="text-xs text-gray-400">
                  {noeud.enfants.length} enfant{noeud.enfants.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {isAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {noeud.hierarchy_level < 4 && (
              <button
                type="button"
                onClick={() => onAjouter(noeud)}
                title="Ajouter un sous-element"
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30
                           transition-all">
                <Plus size={14}/>
              </button>
            )}
            {!hasEnfants && (
              <button
                type="button"
                onClick={() => onSupprimer(noeud)}
                title="Supprimer"
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30
                           transition-all">
                <Trash2 size={13}/>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Enfants */}
      {ouvert && hasEnfants && (
        <div>
          {noeud.enfants.map((enfant: any) => (
            <NoeudEquipement
              key={enfant.id_equipement}
              noeud={enfant}
              isAdmin={isAdmin}
              onAjouter={onAjouter}
              onSupprimer={onSupprimer}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────

export default function DetailEquipementPage() {
  const router   = useRouter()
  const params   = useParams()
  const rawId    = Array.isArray(params?.id) ? params.id[0] : params?.id
  const id       = rawId ? parseInt(rawId, 10) : NaN
  const authUser = useSelector((s: RootState) => s.auth.user)
  const isAdmin  = authUser?.role === 'ADMIN'

  const [arbre,   setArbre]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Modal ajouter enfant
  const [parentSelect, setParentSelect] = useState<any>(null)
  const [formAjout,    setFormAjout]    = useState({
    code        : '',
    description : '',
    categorie   : '',
    install_date: '',
    status      : 'NORMAL',
  })
  const [saving,   setSaving]   = useState(false)
  const [errModal, setErrModal] = useState('')

  // Modal supprimer
  const [equipSuppr,  setEquipSuppr]  = useState<any>(null)
  const [suppressing, setSuppressing] = useState(false)

  const charger = async () => {
    if (!id || isNaN(id)) return
    setLoading(true)
    try {
      const data = await equipementsService.getArbre(id)
      setArbre(data)
    } finally { setLoading(false) }
  }

  useEffect(() => { charger() }, [id])

  const confParent = parentSelect
    ? LEVEL_CONFIG[parentSelect.hierarchy_level + 1] ?? LEVEL_CONFIG[4]
    : null

  const handleAjouter = async () => {
    if (!formAjout.code.trim() || !formAjout.description.trim()) {
      setErrModal('Code et description obligatoires'); return
    }
    setSaving(true); setErrModal('')
    try {
      await equipementsService.creer({
        equipment_code : formAjout.code.trim().toUpperCase(),
        description    : formAjout.description.trim(),
        id_parent      : parentSelect.id_equipement,
        categorie      : formAjout.categorie.trim() || undefined,
        install_date   : formAjout.install_date     || undefined,
        status         : formAjout.status,
      })
      setParentSelect(null)
      setFormAjout({
        code: '', description: '',
        categorie: '', install_date: '', status: 'NORMAL'
      })
      await charger()
    } catch (err: any) {
      setErrModal(err.response?.data?.detail ?? 'Erreur')
    } finally { setSaving(false) }
  }

  const handleSupprimer = async () => {
    if (!equipSuppr) return
    setSuppressing(true)
    try {
      await equipementsService.supprimer(equipSuppr.id_equipement)
      setEquipSuppr(null)
      await charger()
    } catch (err: any) {
      alert(err.response?.data?.detail ?? 'Erreur')
    } finally { setSuppressing(false) }
  }

  if (!id || isNaN(id)) return (
    <div className="text-center py-20 text-gray-500">
      Identifiant invalide
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="text-blue-500 animate-spin"/>
    </div>
  )

  if (!arbre) return (
    <div className="text-center py-20 text-gray-500">
      Equipement introuvable
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── Modal ajouter enfant ── */}
      {parentSelect && (
        <div className="fixed inset-0 bg-black/50 flex items-center
                        justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full
                          border border-gray-200 dark:border-gray-700 shadow-2xl
                          max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100
                            dark:border-gray-800 bg-blue-50 dark:bg-blue-900/20
                            rounded-t-2xl flex-shrink-0">
              <h3 className="text-base font-bold text-blue-800 dark:text-blue-200">
                Ajouter un {confParent?.label.toLowerCase()}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Parent : {parentSelect.equipment_code} — {parentSelect.description}
              </p>
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700
                                  dark:text-gray-300 mb-1.5">
                  Code *
                </label>
                <input
                  value={formAjout.code}
                  onChange={e => setFormAjout(f => ({
                    ...f, code: e.target.value
                  }))}
                  placeholder={`ex: ${parentSelect.equipment_code}-SS1`}
                  className={inputClass}/>
                <p className="text-xs text-gray-400 mt-1">
                  Sera converti en majuscules automatiquement
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700
                                  dark:text-gray-300 mb-1.5">
                  Description *
                </label>
                <input
                  value={formAjout.description}
                  onChange={e => setFormAjout(f => ({
                    ...f, description: e.target.value
                  }))}
                  placeholder="ex: MOTEUR PRINCIPAL"
                  className={inputClass}/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700
                                  dark:text-gray-300 mb-1.5">
                  Categorie
                  <span className="text-gray-400 font-normal ml-1">
                    (optionnel)
                  </span>
                </label>
                <input
                  value={formAjout.categorie}
                  onChange={e => setFormAjout(f => ({
                    ...f, categorie: e.target.value
                  }))}
                  placeholder="ex: B7214"
                  className={inputClass}/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700
                                    dark:text-gray-300 mb-1.5">
                    Date installation
                    <span className="text-gray-400 font-normal ml-1 text-xs">
                      (optionnel)
                    </span>
                  </label>
                  <input
                    type="date"
                    value={formAjout.install_date}
                    onChange={e => setFormAjout(f => ({
                      ...f, install_date: e.target.value
                    }))}
                    className={inputClass}/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700
                                    dark:text-gray-300 mb-1.5">
                    Statut
                  </label>
                  <select
                    value={formAjout.status}
                    onChange={e => setFormAjout(f => ({
                      ...f, status: e.target.value
                    }))}
                    className={inputClass}>
                    <option value="NORMAL">NORMAL</option>
                    <option value="EN_PANNE">EN PANNE</option>
                    <option value="ARRETE">ARRETE</option>
                  </select>
                </div>
              </div>

              {errModal && (
                <div className="flex items-center gap-2 p-3 rounded-xl
                                bg-red-50 dark:bg-red-900/20
                                border border-red-200 dark:border-red-800
                                text-red-600 dark:text-red-400 text-xs">
                  <AlertTriangle size={12}/> {errModal}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100
                            dark:border-gray-800 flex-shrink-0">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setParentSelect(null)
                    setFormAjout({
                      code: '', description: '',
                      categorie: '', install_date: '', status: 'NORMAL'
                    })
                    setErrModal('')
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200
                             dark:border-gray-700 text-gray-600 dark:text-gray-400
                             text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAjouter}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2
                             py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700
                             text-white text-sm font-medium
                             disabled:opacity-40 transition-all">
                  {saving
                    ? <Loader2 size={14} className="animate-spin"/>
                    : <><Plus size={14}/> Ajouter</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal supprimer ── */}
      {equipSuppr && (
        <div className="fixed inset-0 bg-black/50 flex items-center
                        justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full
                          border border-gray-200 dark:border-gray-700
                          shadow-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30
                            flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500"/>
            </div>
            <h3 className="text-base font-bold text-center text-gray-900
                           dark:text-white mb-1">
              Supprimer cet equipement ?
            </h3>
            <p className="text-sm text-center text-gray-500 dark:text-gray-400
                          mb-1">
              {equipSuppr.equipment_code}
            </p>
            <p className="text-xs text-center text-gray-400 mb-5">
              {equipSuppr.description}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEquipSuppr(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200
                           dark:border-gray-700 text-gray-600 dark:text-gray-400
                           text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSupprimer}
                disabled={suppressing}
                className="flex-1 flex items-center justify-center gap-2
                           py-2.5 rounded-xl bg-red-500 hover:bg-red-600
                           text-white text-sm font-medium
                           disabled:opacity-40 transition-all">
                {suppressing
                  ? <Loader2 size={14} className="animate-spin"/>
                  : <><Trash2 size={14}/> Supprimer</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── En-tête ── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl border border-gray-200
                     dark:border-gray-700 flex items-center justify-center
                     text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft size={18}/>
        </button>
        <div className="w-12 h-12 rounded-2xl bg-blue-600
                        flex items-center justify-center flex-shrink-0">
          <Factory size={22} className="text-white"/>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white
                         font-mono truncate">
            {arbre.equipment_code}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
            {arbre.description}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setParentSelect(arbre)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
                       bg-blue-600 hover:bg-blue-700 text-white text-sm
                       font-medium transition-all flex-shrink-0">
            <Plus size={15}/> Ajouter
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pole',        value: arbre.nom_pole ?? '—'  },
          { label: 'Zone',        value: arbre.code_zone ?? '—'  },
          { label: 'Statut',      value: arbre.status   ?? '—'  },
          { label: 'Installation',value: arbre.install_date
              ? new Date(arbre.install_date).toLocaleDateString('fr-FR')
              : '—'
          },
        ].map(s => (
          <div key={s.label}
            className="bg-white dark:bg-gray-900 border border-gray-200
                       dark:border-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Arbre hiérarchique ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200
                      dark:border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={14} className="text-gray-400"/>
          <h2 className="text-xs font-semibold text-gray-400 uppercase
                         tracking-wider">
            Arbre hierarchique
          </h2>
          <span className="ml-auto text-xs text-gray-400">
            {arbre.enfants?.length ?? 0} sous-systeme{arbre.enfants?.length > 1 ? 's' : ''}
            {' '}directs
          </span>
        </div>

        <NoeudEquipement
          noeud={arbre}
          isAdmin={isAdmin}
          onAjouter={setParentSelect}
          onSupprimer={setEquipSuppr}
          depth={0}
        />
      </div>
    </div>
  )
}