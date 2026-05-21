'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import { equipementsService } from '@/services/equipementsService'
import { zonesService } from '@/services/zonesService'
import {
  Loader2, Plus, Search, ChevronRight, ChevronLeft,
  Factory, Settings, Calendar, Layers,
  LayoutGrid, List, Filter, Activity, MapPin, Cpu,
} from 'lucide-react'

interface Machine {
  id_equipement: number; equipment_code: string; description: string
  hierarchy_level: number; nom_pole?: string; nom_zone?: string
  install_date?: string; status: string; nb_enfants: number
}
interface Zone { id_zone: number; code_zone: string; nom_zone: string }
interface PaginationData {
  data: Machine[]; total: number; page: number; limit: number; total_pages: number
}

const STYLES = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

  .mc {
    animation: fadeUp .45s ease both;
    transition: transform .28s cubic-bezier(.34,1.56,.64,1),
                box-shadow .28s ease, border-color .28s ease;
  }
  .mc:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: 0 12px 32px rgba(37,99,235,.13), 0 2px 8px rgba(0,0,0,.06);
    border-color: #93c5fd !important;
  }
  .mc:hover .mc-icon { transform: scale(1.1) rotate(-5deg); }
  .mc:hover .mc-arrow { opacity: 1 !important; transform: translateX(0) !important; }

  .mr {
    transition: background .15s ease, transform .15s ease, border-left-color .2s ease, box-shadow .2s ease;
    animation: fadeUp .4s ease both;
  }
  .mr:hover {
    background: #eff6ff !important;
    transform: translateX(4px);
    border-left-color: #3b82f6 !important;
    box-shadow: 0 4px 16px rgba(37,99,235,.08);
  }

  .skel {
    background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 8px;
  }

  .fi:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
  .pg-btn { transition: all .2s ease; }
  .pg-btn:hover:not(:disabled) { border-color: #93c5fd !important; background: #eff6ff !important; }
`

function SkeletonCard() {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden', height: 220 }}>
      <div style={{ height: 3, background: '#e2e8f0' }} />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skel" style={{ width: 40, height: 40, borderRadius: 12 }} />
        <div className="skel" style={{ width: 80, height: 10 }} />
        <div className="skel" style={{ width: '90%', height: 14 }} />
        <div className="skel" style={{ width: '65%', height: 10 }} />
        <div className="skel" style={{ width: '50%', height: 10 }} />
      </div>
    </div>
  )
}

function MachineCard({ machine, onClick, delay = 0 }: { machine: Machine; onClick: () => void; delay?: number }) {
  return (
    <div className="mc" onClick={onClick}
      style={{
        background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #e2e8f0', borderRadius: 18,
        overflow: 'hidden', cursor: 'pointer', position: 'relative',
        animationDelay: `${delay}ms`,
      }}>
      {/* Barre top bleue */}
      <div style={{ height: 3, background: 'linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa)' }} />

      {/* Reflet angle haut droit */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90,
        borderRadius: '50%', background: 'radial-gradient(circle,rgba(59,130,246,.07) 0%,transparent 70%)',
        pointerEvents: 'none' }} />

      <div style={{ padding: 20, position: 'relative' }}>
        {/* Icône */}
        <div className="mc-icon"
          style={{ width: 42, height: 42, borderRadius: 13, marginBottom: 14,
            background: 'linear-gradient(135deg,#dbeafe,#eff6ff)',
            border: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)' }}>
          <Factory size={18} style={{ color: '#2563eb' }} />
        </div>

        {/* Code */}
        <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
          color: '#2563eb', marginBottom: 5, letterSpacing: '0.04em' }}>
          {machine.equipment_code}
        </p>

        {/* Description */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 16,
          lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {machine.description}
        </p>

        {/* Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {machine.nom_pole && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
              <Settings size={10} style={{ color: '#3b82f6', flexShrink: 0 }} />{machine.nom_pole}
            </div>
          )}
          {machine.nom_zone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
              <MapPin size={10} style={{ color: '#3b82f6', flexShrink: 0 }} />{machine.nom_zone}
            </div>
          )}
          {machine.install_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
              <Calendar size={10} style={{ color: '#3b82f6', flexShrink: 0 }} />
              {new Date(machine.install_date).toLocaleDateString('fr-FR')}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <Layers size={10} style={{ color: '#3b82f6', flexShrink: 0 }} />
            {machine.nb_enfants} sous-système{machine.nb_enfants !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#cbd5e1',
            textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Niv. {machine.hierarchy_level}
          </span>
          <div className="mc-arrow"
            style={{ display: 'flex', alignItems: 'center', gap: 3,
              opacity: 0, transform: 'translateX(-4px)', transition: 'opacity .2s, transform .2s' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>Voir</span>
            <ChevronRight size={13} style={{ color: '#3b82f6' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MachineRow({ machine, onClick, delay = 0 }: { machine: Machine; onClick: () => void; delay?: number }) {
  return (
    <div className="mr" onClick={onClick}
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderLeft: '3px solid #93c5fd',
        borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14,
        animationDelay: `${delay}ms`,
      }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(135deg,#dbeafe,#eff6ff)',
        border: '1px solid #bfdbfe',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Factory size={16} style={{ color: '#2563eb' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#2563eb', marginBottom: 3 }}>
          {machine.equipment_code}
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {machine.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          {machine.nom_pole && <span style={{ fontSize: 10, color: '#64748b' }}>{machine.nom_pole}</span>}
          {machine.nom_zone && <span style={{ fontSize: 10, color: '#64748b' }}>{machine.nom_zone}</span>}
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {machine.nb_enfants} ss-sys.
          </span>
        </div>
      </div>
      <ChevronRight size={14} style={{ color: '#cbd5e1', flexShrink: 0 }} />
    </div>
  )
}

export default function EquipementsPage() {
  const router   = useRouter()
  const authUser = useSelector((s: RootState) => s.auth.user)
  const idPole   = Number(authUser?.id_pole)
  const isAdmin  = authUser?.role === 'ADMIN'

  const [pagination, setPagination] = useState<PaginationData>({
    data: [], total: 0, page: 1, limit: 12, total_pages: 0,
  })
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [view, setView]               = useState<'grid' | 'list'>('grid')
  const [zones, setZones]             = useState<Zone[]>([])
  const [selectedZone, setSelectedZone] = useState<number | ''>('')

  const charger = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const data = await equipementsService.listeMachines({
        id_pole: isAdmin ? undefined : idPole,
        id_zone: selectedZone || undefined,
        search: search || undefined,
        page, limit: 12,
      })
      setPagination({
        data: data.data || [], total: data.total || 0,
        page: data.page || 1, limit: data.limit || 12,
        total_pages: data.total_pages || 0,
      })
    } finally { setLoading(false) }
  }, [isAdmin, idPole, selectedZone, search])

  useEffect(() => {
    if (isAdmin) zonesService.lister().then(setZones).catch(() => setZones([]))
    charger(1)
  }, [])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); charger(1) }
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.total_pages) charger(page)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ── Fond page : BLANC ── */}
      <div style={{ minHeight: 'calc(100vh - 64px)', margin: '-24px', padding: '24px', background: '#ffffff' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ══ HERO BANNER — même style Dashboard Maintenance ══ */}
          <div style={{ borderRadius: 24, overflow: 'hidden',
            boxShadow: '0 10px 32px rgba(0,59,122,.2)',
            animation: 'fadeUp .45s ease both' }}>
            <div style={{
              background: 'linear-gradient(135deg,#001a3d 0%,#003B7A 50%,#0066CC 100%)',
              padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>

              {/* Déco blurs */}
              <div style={{ position: 'absolute', top: 0, right: 0, width: 320, height: 320,
                background: 'rgba(255,255,255,.05)', borderRadius: '50%',
                transform: 'translate(30%,-50%)', filter: 'blur(45px)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: 200, height: 200,
                background: 'rgba(255,255,255,.04)', borderRadius: '50%',
                transform: 'translate(-25%,50%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
              {/* Grille */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 30px,rgba(255,255,255,.025) 30px,rgba(255,255,255,.025) 31px),
                                   repeating-linear-gradient(90deg,transparent,transparent 30px,rgba(255,255,255,.025) 30px,rgba(255,255,255,.025) 31px)` }} />

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                {/* Titre */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 18,
                    background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}>
                    <Cpu size={26} color="#FFF" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,.65)',
                        background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
                        padding: '2px 10px', borderRadius: 99 }}>
                        GMAO · Équipements
                      </span>
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFF',
                      letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      Parc Machines
                    </h1>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 5,
                      display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Activity size={12} />
                      <span style={{ fontWeight: 600 }}>
                        {pagination.total} machine{pagination.total !== 1 ? 's' : ''} enregistrées
                      </span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Toggle vue */}
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,.1)',
                    border: '1px solid rgba(255,255,255,.18)', borderRadius: 12, padding: 4, gap: 3 }}>
                    {([['grid', LayoutGrid], ['list', List]] as const).map(([v, Icon]) => (
                      <button key={v} onClick={() => setView(v)}
                        style={{ padding: '6px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                          transition: 'all .2s',
                          background: view === v ? 'rgba(255,255,255,.22)' : 'transparent',
                          color: view === v ? '#FFF' : 'rgba(255,255,255,.5)' }}>
                        <Icon size={14} />
                      </button>
                    ))}
                  </div>

                  {isAdmin && (
                    <button onClick={() => router.push('/equipements/ajouter')}
                      style={{ display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 18px', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,.25)',
                        background: 'rgba(255,255,255,.15)', color: '#FFF', cursor: 'pointer',
                        fontSize: 13, fontWeight: 700, backdropFilter: 'blur(8px)',
                        transition: 'all .2s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.25)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.15)'}>
                      <Plus size={15} /> Nouvelle machine
                    </button>
                  )}
                </div>
              </div>

              {/* Stats band */}
              <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap', position: 'relative' }}>
                {[
                  { label: 'Total machines', value: pagination.total.toLocaleString('fr-FR') },
                  { label: 'Page',           value: `${pagination.page} / ${pagination.total_pages || 1}` },
                  { label: 'Par page',       value: `${pagination.limit}` },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.14)', borderRadius: 10,
                    padding: '8px 16px', backdropFilter: 'blur(8px)',
                    animation: `fadeUp .5s ease both`, animationDelay: `${i * 60 + 100}ms` }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.5)',
                      textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>{s.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#FFF', lineHeight: 1 }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══ FILTRES ══ */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap',
            animation: 'fadeUp .5s ease both', animationDelay: '100ms' }}>
            <form onSubmit={handleSearch} style={{ flex: 1, minWidth: 240 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 14, top: '50%',
                  transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                <input className="fi" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par code ou description…"
                  style={{ width: '100%', paddingLeft: 42, paddingRight: 16,
                    paddingTop: 11, paddingBottom: 11, borderRadius: 12,
                    border: '1px solid #e2e8f0', background: '#f8fafc',
                    color: '#0f172a', fontSize: 13, transition: 'border-color .2s, box-shadow .2s',
                    boxSizing: 'border-box' }} />
              </div>
            </form>

            {isAdmin && zones.length > 0 && (
              <select value={selectedZone}
                onChange={e => {
                  setSelectedZone(e.target.value === '' ? '' : Number(e.target.value))
                  setTimeout(() => charger(1), 100)
                }}
                style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0',
                  background: '#f8fafc', color: '#0f172a', fontSize: 13,
                  cursor: 'pointer', outline: 'none' }}>
                <option value="">Toutes les zones</option>
                {zones.map(z => <option key={z.id_zone} value={z.id_zone}>{z.nom_zone}</option>)}
              </select>
            )}
          </div>

          {/* ══ CONTENU ══ */}
          {loading ? (
            view === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 16 }}>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skel" style={{ height: 76, borderRadius: 14 }} />
                ))}
              </div>
            )
          ) : pagination.data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px',
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20,
              animation: 'fadeIn .5s ease both' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
                background: '#dbeafe', border: '1px solid #bfdbfe',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Factory size={28} style={{ color: '#93c5fd' }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                Aucune machine trouvée
              </p>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
                Essayez de modifier vos filtres.
              </p>
              {isAdmin && (
                <button onClick={() => router.push('/equipements/ajouter')}
                  style={{ padding: '10px 24px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg,#003B7A,#3b82f6)',
                    color: '#FFF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={14} /> Ajouter une machine
                </button>
              )}
            </div>
          ) : (
            <>
              {view === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 16 }}>
                  {pagination.data.map((m, i) => (
                    <MachineCard key={m.id_equipement} machine={m} delay={i * 45}
                      onClick={() => router.push(`/equipements/${m.id_equipement}`)} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pagination.data.map((m, i) => (
                    <MachineRow key={m.id_equipement} machine={m} delay={i * 40}
                      onClick={() => router.push(`/equipements/${m.id_equipement}`)} />
                  ))}
                </div>
              )}

              {/* ── Pagination ── */}
              {pagination.total_pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, paddingTop: 8, animation: 'fadeIn .5s ease both' }}>

                  <button className="pg-btn" onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    style={{ padding: 8, borderRadius: 10, border: '1px solid #e2e8f0',
                      background: '#f8fafc', color: '#0f172a', cursor: 'pointer',
                      opacity: pagination.page <= 1 ? .3 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={15} />
                  </button>

                  {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    let p: number
                    if (pagination.total_pages <= 5)                     p = i + 1
                    else if (pagination.page <= 3)                       p = i + 1
                    else if (pagination.page >= pagination.total_pages - 2) p = pagination.total_pages - 4 + i
                    else                                                  p = pagination.page - 2 + i
                    const active = pagination.page === p
                    return (
                      <button key={p} className="pg-btn" onClick={() => goToPage(p)}
                        style={{ width: 36, height: 36, borderRadius: 10,
                          border: `1px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                          background: active ? 'linear-gradient(135deg,#003B7A,#2563eb)' : '#f8fafc',
                          color: active ? '#FFF' : '#475569', fontSize: 13, fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: active ? '0 4px 12px rgba(37,99,235,.3)' : 'none' }}>
                        {p}
                      </button>
                    )
                  })}

                  <button className="pg-btn" onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                    style={{ padding: 8, borderRadius: 10, border: '1px solid #e2e8f0',
                      background: '#f8fafc', color: '#0f172a', cursor: 'pointer',
                      opacity: pagination.page >= pagination.total_pages ? .3 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={15} />
                  </button>

                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
                    Page {pagination.page} / {pagination.total_pages}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}