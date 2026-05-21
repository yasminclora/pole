'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { polesService } from '@/services/polesService'
import { zonesService } from '@/services/zonesService'
import {
  Building2, MapPin, Plus, Loader2, Search, Trash2, 
  ArrowLeft, Layers, Factory, Info, Check, X, Eye
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

const inputClass = `w-full px-4 py-3 rounded-xl border border-gray-200 bg-white
  text-gray-900 text-sm font-semibold transition-all duration-300
  focus:outline-none focus:border-[#0052CC] focus:ring-4 focus:ring-[#0052CC]/5 shadow-sm`

export default function ListePolesPage() {
  const router = useRouter()

  const [poles,      setPoles]     = useState<Pole[]>([])
  const [allZones,   setAllZones]  = useState<Zone[]>([])
  const [loading,    setLoading]   = useState(true)
  const [recherche,  setRecherche] = useState('')
  
  // État pour la modale active
  const [activePoleModal, setActivePoleModal] = useState<Pole | null>(null)

  // Formulaire ajout zone
  const [showAddForm,   setShowAddForm]   = useState(false)
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
      setNewZoneCode(''); setNewZoneNom('')
      setShowAddForm(false)
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
    <div className="flex-grow flex items-center justify-center h-96 bg-[#F8FAFC]">
      <div className="text-center space-y-3">
        <Loader2 size={40} className="text-[#0052CC] animate-spin mx-auto"/>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Indexation des structures...</p>
      </div>
    </div>
  )

  return (
    <div className="flex-grow flex flex-col bg-[#F8FAFC] w-full min-h-screen relative">

      {/* HEADER HERO PREMIUM BANNER */}
      <div className="bg-[#001F3F] p-8 pb-20 relative overflow-hidden w-full">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => router.back()} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Architecture des Pôles</h1>
              <p className="text-blue-300/80 font-bold text-xs uppercase tracking-[0.2em] mt-1">
                {poles.length} pôle{poles.length > 1 ? 's' : ''} opérationnel{poles.length > 1 ? 's' : ''} — {allZones.length} zone{allZones.length > 1 ? 's' : ''} détectée{allZones.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative min-w-[280px] sm:min-w-[350px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300/60"/>
              <input value={recherche}
                onChange={e => setRecherche(e.target.value)}
                placeholder="Filtrer par pôle ou trigramme..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 
                          text-white text-sm font-semibold placeholder:text-blue-200/40
                          focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all shadow-inner"/>
            </div>

            <button onClick={() => router.push('/poles/ajout')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl
                         bg-[#0052CC] hover:bg-[#0041a3] text-white text-xs uppercase tracking-widest
                         font-black shadow-xl shadow-blue-900/20 hover:scale-[1.02] transition-all whitespace-nowrap">
              <Plus size={16}/> Nouveau pôle
            </button>
          </div>
        </div>
      </div>

      {/* CONTENU GRILLE PRINCIPALE */}
      <div className="max-w-[1600px] w-full mx-auto px-8 -mt-10 mb-12 relative z-20 flex-grow">
        
        {polesFiltres.length === 0 ? (
          <div className="text-center py-24 bg-white border border-gray-100 shadow-xl shadow-blue-900/5 rounded-3xl">
            <Factory size={48} className="text-gray-300 mx-auto mb-4"/>
            <h3 className="text-lg font-black text-[#001F3F]">Aucune structure trouvée</h3>
            <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto font-medium">Aucun pôle ne correspond à votre recherche.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {polesFiltres.map(pole => {
              const zones = zonesParPole(pole.id_pole)

              return (
                <div key={pole.id_pole}
                  onClick={() => {
                    setActivePoleModal(pole)
                    setShowAddForm(false)
                  }}
                  className="bg-white border border-gray-100/70 rounded-3xl shadow-xl shadow-blue-900/[0.02] hover:shadow-xl hover:shadow-blue-900/[0.05] hover:border-blue-200 hover:scale-[1.005] transition-all duration-300 p-6 flex flex-col justify-between gap-6 cursor-pointer group">
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center border border-gray-100 shrink-0 shadow-sm text-[#001F3F] transition-colors">
                        <Building2 size={24} className="text-[#0052CC]"/>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="font-black text-lg text-[#001F3F] truncate">{pole.nom_pole}</h2>
                          {pole.code_pole && (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase bg-blue-50 text-[#0052CC] border border-blue-100/50">
                              {pole.code_pole}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-400 mt-1 line-clamp-2 max-w-xl">
                          {pole.description ? pole.description : "Aucune description fournie pour ce secteur d'activité."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <span className="px-3 py-1.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-700 text-xs font-bold tracking-wide">
                      {zones.length} Zone{zones.length > 1 ? 's' : ''} rattachée{zones.length > 1 ? 's' : ''}
                    </span>
                    
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#0052CC] tracking-wider opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                      Gérer les zones <Eye size={14}/>
                    </span>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ==================== FENÊTRE MODALE PREMIUM DES ZONES ==================== */}
      {activePoleModal && (() => {
        const zones = zonesParPole(activePoleModal.id_pole)
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#001F3F]/40 backdrop-blur-md animate-in fade-in duration-200">
            
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
              
              {/* Header Modale */}
              <div className="p-6 bg-[#001F3F] text-white flex items-start justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-blue-300">
                    <Building2 size={22}/>
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xl font-black tracking-tight">{activePoleModal.nom_pole}</h3>
                      {activePoleModal.code_pole && (
                        <span className="px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold bg-white/10 text-blue-300 border border-white/5">
                          {activePoleModal.code_pole}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-200/60 font-medium mt-0.5">Cartographie et gestion des sous-entités de production</p>
                  </div>
                </div>

                <button 
                  onClick={() => setActivePoleModal(null)}
                  className="p-2 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-all relative z-10">
                  <X size={20}/>
                </button>
              </div>

              {/* Corps de la Modale */}
              <div className="p-6 flex-grow overflow-y-auto space-y-6 bg-[#F8FAFC]">
                
                {/* Entête d'action */}
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-[#001F3F] uppercase tracking-wider flex items-center gap-2">
                    <Layers size={14} className="text-[#0052CC]"/> Périmètre Sectoriel ({zones.length})
                  </h4>
                  
                  {!showAddForm && (
                    <button
                      onClick={() => {
                        setShowAddForm(true)
                        setNewZoneCode('')
                        setNewZoneNom('')
                        setErrZone('')
                      }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0052CC] text-white text-xs font-bold hover:bg-[#0041a3] transition-all shadow-md shadow-blue-500/10">
                      <Plus size={14}/> Déployer une zone
                    </button>
                  )}
                </div>

                {/* Formulaire Intégré */}
                {showAddForm && (
                  <div className="p-5 rounded-2xl bg-white border border-blue-100 shadow-xl shadow-blue-900/[0.03] animate-in slide-in-from-top-3 duration-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <p className="text-[11px] font-black text-[#001F3F] uppercase tracking-wider flex items-center gap-1.5">
                        <Plus size={12} className="text-[#0052CC]"/> Configuration du nouveau secteur
                      </p>
                      <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={14}/>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Code Unique (Trigramme)</label>
                        <input value={newZoneCode}
                          onChange={e => setNewZoneCode(e.target.value.toUpperCase())}
                          placeholder="ex: BCH01"
                          className={inputClass}/>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Libellé complet</label>
                        <input value={newZoneNom}
                          onChange={e => setNewZoneNom(e.target.value)}
                          placeholder="ex: Ligne Emballage & Palettisation"
                          className={inputClass}/>
                      </div>
                    </div>

                    {errZone && (
                      <p className="text-red-500 text-xs font-semibold flex items-center gap-1">⚠ {errZone}</p>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-all">
                        Annuler
                      </button>
                      <button 
                        onClick={() => handleAjouterZone(activePoleModal.id_pole)} 
                        disabled={savingZone}
                        className="px-5 py-2 rounded-xl bg-[#0052CC] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-40 shadow-md flex items-center gap-2 hover:bg-[#0041a3] transition-colors">
                        {savingZone ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                )}

                {/* Grille des zones (Avec l'amélioration du fond gris demandée) */}
                {zones.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                    <MapPin size={36} className="text-gray-300 mx-auto mb-3"/>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Aucun sous-secteur configuré</p>
                    <p className="text-gray-400 text-xs mt-1">Cliquez sur le bouton en haut à droite pour ajouter votre première zone.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {zones.map(z => (
                      <div key={z.id_zone}
                        className="flex items-center justify-between p-4 rounded-2xl bg-[#F1F5F9] border border-gray-200/60 shadow-sm hover:bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-900/[0.02] transition-all duration-200 group/item">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 text-[#0052CC] shadow-sm group-hover/item:bg-blue-50 group-hover/item:border-blue-100 transition-colors">
                            <MapPin size={16}/>
                          </div>
                          <div className="min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-200 text-gray-700 group-hover/item:bg-blue-50 group-hover/item:text-[#0052CC] transition-colors">
                              {z.code_zone}
                            </span>
                            <p className="text-sm font-bold text-[#001F3F] truncate max-w-[200px] sm:max-w-[240px] mt-1">{z.nom_zone}</p>
                          </div>
                        </div>
                        
                        {/* Supprimer visible seulement au survol (clean UI) */}
                        <button onClick={() => handleSupprimerZone(z.id_zone)}
                          className="opacity-0 group-hover/item:opacity-100 w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all shrink-0">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Footer Modale */}
              <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <span className="flex items-center gap-1"><Info size={12} className="text-gray-400"/> Status réseau : Opérationnel — {zones.length} paires détectées</span>
                <button 
                  onClick={() => setActivePoleModal(null)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all text-[11px] uppercase tracking-wider">
                  Fermer
                </button>
              </div>

            </div>
          </div>
        )
      })()}

    </div>
  )
}