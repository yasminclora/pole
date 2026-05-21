'use client'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'
import api from '@/services/axiosInstance'
import { polesService } from '@/services/polesService'
import {
  Activity, ClipboardList, AlertTriangle, RefreshCw,
  CheckCircle2, MapPin, ChevronRight, Building2,
  Wrench, Clock, X, User, Calendar, Tag,
  BarChart3, Sparkles, FileText, Cpu, Zap,
  LayoutDashboard,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'

// ═══════════════════════════════════════════════════════════════
// PALETTE — identique Dashboard Maintenance
// ═══════════════════════════════════════════════════════════════
const PAGE_BG    = '#FFFFFF'
const CARD_BG    = '#F4F6F9'
const CARD_WHITE = '#FFFFFF'
const BORDER     = '#E4E8EF'
const BLUE       = '#1E40AF'
const BLUE_DARK  = '#001a3d'
const BLUE_MID   = '#3B82F6'
const BLUE_LIGHT = '#DBEAFE'
const TEXT_1     = '#0F172A'
const TEXT_2     = '#475569'
const TEXT_3     = '#94A3B8'
const CORR_COLOR = '#1E40AF'
const PRED_COLOR = '#93C5FD'

const STATUT_OT: Record<string,string> = {
  CREE:'Créé',ASSIGNE:'Assigné',EN_COURS:'En cours',TERMINE:'Terminé',
  VALIDE_CE:'Validé CE',VALIDE_HSE:'Validé HSE',ARCHIVE:'Archivé',
  REJETE:'Rejeté',REWORK:'À reprendre',
}
const STATUT_DI: Record<string,string> = {
  EN_ATTENTE:'En attente',VERIFIE:'Vérifié',VALIDEE:'Validée',
  REJETEE:'Rejetée',EN_COURS:'En cours',
}
const STATUT_STYLE: Record<string,{bg:string;color:string}> = {
  ARCHIVE:    {bg:'#F1F5F9',color:'#475569'},
  VALIDE_CE:  {bg:'#EEF2FF',color:'#4338CA'},
  VALIDE_HSE: {bg:'#EEF2FF',color:'#4338CA'},
  EN_COURS:   {bg:'#FFF7ED',color:'#C2410C'},
  VALIDEE:    {bg:'#F0FDF4',color:'#15803D'},
  VERIFIE:    {bg:'#F0FDF4',color:'#15803D'},
  EN_ATTENTE: {bg:'#FFFBEB',color:'#B45309'},
  REJETEE:    {bg:'#FEF2F2',color:'#B91C1C'},
  REJETE:     {bg:'#FEF2F2',color:'#B91C1C'},
  CREE:       {bg:'#EFF6FF',color:'#1D4ED8'},
}

interface Pole      { id_pole:number; nom_pole:string }
interface StatusRow { statut:string;  count:number }
interface ZoneRow   { zone:string;    count:number }
interface EvolPoint { mois:string;    ot:number;  di:number }
interface RecentRow {
  ref:string; type:'OT'|'DI'; sous_type:string|null; statut:string|null
  date:string|null; id:number; equipement_code?:string|null; equipement_desc?:string|null
}

async function apiGet<T>(url:string, params?:Record<string,any>):Promise<T|null> {
  try { return (await api.get(url,{params})).data as T }
  catch { return null }
}
const fmtMonth=(m:string)=>{
  const [,mo]=m.split('-')
  return ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][parseInt(mo)-1]??mo
}

function useCountUp(target:number, ms=1000){
  const [v,setV]=useState(0)
  const prev=useRef(0)
  useEffect(()=>{
    let raf=0; const t0=performance.now(); const from=prev.current
    const tick=(t:number)=>{
      const p=Math.min((t-t0)/ms,1); const e=1-Math.pow(1-p,3)
      setV(Math.round(from+(target-from)*e))
      if(p<1) raf=requestAnimationFrame(tick); else prev.current=target
    }
    raf=requestAnimationFrame(tick); return ()=>cancelAnimationFrame(raf)
  },[target])
  return v
}

const STYLES=`
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
  @keyframes floatA{0%,100%{transform:translateY(0)}33%{transform:translateY(-7px)}66%{transform:translateY(-3px)}}
  @keyframes floatB{0%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}70%{transform:translateY(-9px)}}
  @keyframes floatC{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes ringDraw{from{stroke-dashoffset:200}to{stroke-dashoffset:0}}
  @keyframes progressGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @keyframes slideRow{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}

  .float-a{animation:floatA 5s ease-in-out infinite}
  .float-b{animation:floatB 6.5s ease-in-out infinite}
  .float-c{animation:floatC 4s ease-in-out infinite}

  .card-lift{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}
  .card-lift:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(30,64,175,.12);border-color:#BFDBFE!important}

  .row-btn{transition:background .12s ease;cursor:pointer}
  .row-btn:hover{background:#EFF6FF!important}
`

// ── Recharts Tooltip ──────────────────────────────────────────
const ChartTip=({active,payload,label}:any)=>{
  if(!active||!payload?.length) return null
  return(
    <div style={{background:TEXT_1,borderRadius:10,padding:'8px 12px',boxShadow:'0 8px 24px rgba(0,0,0,.3)'}}>
      <p style={{fontSize:10,fontWeight:700,color:'#FFF',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{label}</p>
      {payload.map((p:any,i:number)=>(
        <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,fontSize:11,paddingTop:2}}>
          <span style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:7,height:7,borderRadius:'50%',background:p.fill,display:'inline-block'}}/>
            <span style={{color:'#94A3B8'}}>{p.name}</span>
          </span>
          <span style={{color:'#FFF',fontWeight:700}}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Ring Card ────────────────────────────────────────────────
function RingCard({label,total,breakdown,delay=0,animKey,floatClass='float-a'}:{
  label:string;total:number;breakdown:{label:string;count:number;color:string}[]
  delay?:number;animKey:number;floatClass?:string
}){
  const animated=useCountUp(total,1200)
  const r=38,cx=48,cy=48,circ=2*Math.PI*r
  const totalBk=breakdown.reduce((a,b)=>a+b.count,0)||1
  let offset=0
  return(
    <div className="card-lift" style={{background:CARD_BG,border:`1px solid ${BORDER}`,
      borderRadius:18,padding:'20px 22px',
      animation:`fadeUp .55s ease both`,animationDelay:`${delay}ms`,
      display:'flex',alignItems:'center',gap:18}}>
      <div className={floatClass} style={{flexShrink:0}}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={BORDER} strokeWidth="9"/>
          {breakdown.map((b,i)=>{
            const dash=totalBk>0?(b.count/totalBk)*circ:0
            const seg=(
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={b.color} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${Math.max(dash-2,0)} ${circ}`}
                strokeDashoffset={-offset+circ*0.25}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{animation:`ringDraw 1.2s ease-out ${delay+i*200}ms both`}}/>
            )
            offset+=dash; return seg
          })}
          <text x={cx} y={cy-4} textAnchor="middle"
            style={{fontSize:18,fontWeight:700,fill:TEXT_1,fontFamily:'inherit'}}>{animated}</text>
          <text x={cx} y={cy+13} textAnchor="middle"
            style={{fontSize:8,fontWeight:700,fill:TEXT_3,letterSpacing:'0.1em',fontFamily:'inherit'}}>total</text>
        </svg>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:11,fontWeight:700,color:TEXT_3,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>{label}</p>
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {breakdown.map((b,i)=>(
            <div key={i}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:TEXT_2,marginBottom:3}}>
                <span style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:b.color,display:'inline-block',flexShrink:0}}/>
                  {b.label}
                </span>
                <span style={{fontWeight:700,color:TEXT_1}}>{b.count}</span>
              </div>
              <div style={{height:4,background:BORDER,borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',background:b.color,borderRadius:2,
                  width:`${totalBk>0?(b.count/totalBk)*100:0}%`,transformOrigin:'left',
                  animation:`progressGrow 1s ease-out ${delay+400+i*100}ms both`}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Mini Stat Card ────────────────────────────────────────────
function MiniStatCard({label,current,total,delay=0}:{
  label:string;current:number;total:number;delay?:number
}){
  const pct=total>0?Math.round((current/total)*100):0
  return(
    <div className="card-lift float-c" style={{background:CARD_BG,border:`1px solid ${BORDER}`,
      borderRadius:14,padding:'16px 18px',
      animation:`fadeUp .55s ease both`,animationDelay:`${delay}ms`}}>
      <p style={{fontSize:10,fontWeight:700,color:TEXT_3,textTransform:'uppercase',
        letterSpacing:'0.1em',marginBottom:8}}>{label}</p>
      <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:10}}>
        <span style={{fontSize:22,fontWeight:700,color:BLUE}}>{current}</span>
        <span style={{fontSize:11,color:TEXT_3}}>/ {total}</span>
      </div>
      <div style={{height:5,background:BORDER,borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',background:BLUE,borderRadius:3,
          width:`${pct}%`,transformOrigin:'left',
          animation:`progressGrow 1s ease-out ${delay+300}ms both`}}/>
      </div>
      <p style={{fontSize:10,fontWeight:700,color:BLUE,marginTop:5}}>{pct}%</p>
    </div>
  )
}

// ── Detail Modal ─────────────────────────────────────────────
function DetailModal({data,type,loading,onClose}:{data:any;type:'OT'|'DI';loading:boolean;onClose:()=>void}){
  const isOT=type==='OT'
  const ac=isOT?BLUE:'#0369A1'
  return(
    <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',
      justifyContent:'center',padding:16,background:'rgba(15,23,42,.65)',
      backdropFilter:'blur(6px)',animation:'fadeIn .2s ease both'}}
      onClick={onClose}>
      <div style={{width:'100%',maxWidth:520,maxHeight:'88vh',overflow:'hidden',borderRadius:20,
        background:CARD_WHITE,boxShadow:'0 32px 72px rgba(0,0,0,.22)',
        animation:'modalIn .3s ease both',display:'flex',flexDirection:'column'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{background:ac,padding:'20px 22px',position:'relative',overflow:'hidden',flexShrink:0}}>
          <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,
            borderRadius:'50%',background:'rgba(255,255,255,.07)',pointerEvents:'none'}}/>
          <div style={{display:'flex',alignItems:'start',justifyContent:'space-between',gap:12,position:'relative'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
              <div style={{width:44,height:44,borderRadius:14,flexShrink:0,
                background:'rgba(255,255,255,.18)',border:'1px solid rgba(255,255,255,.3)',
                display:'flex',alignItems:'center',justifyContent:'center'}}>
                {isOT?<ClipboardList size={20} color="#FFF"/>:<AlertTriangle size={20} color="#FFF"/>}
              </div>
              <div style={{minWidth:0}}>
                <p style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,.65)',
                  textTransform:'uppercase',letterSpacing:'0.15em',marginBottom:4}}>
                  {isOT?'Ordre de travail':"Demande d'intervention"}
                </p>
                <h2 style={{fontSize:16,fontWeight:700,color:'#FFF',fontFamily:'monospace',
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {data?.numero_ot||data?.numero_di||'—'}
                </h2>
              </div>
            </div>
            <button onClick={onClose}
              style={{width:32,height:32,borderRadius:10,flexShrink:0,
                background:'rgba(255,255,255,.18)',border:'none',cursor:'pointer',color:'#FFF',
                display:'flex',alignItems:'center',justifyContent:'center',transition:'background .2s'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.28)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.18)'}>
              <X size={15}/>
            </button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',background:'#F8FAFC',padding:16}}>
          {loading?(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',
              justifyContent:'center',padding:'56px 0',gap:14}}>
              <div style={{width:36,height:36,borderRadius:'50%',
                border:`4px solid ${BLUE_LIGHT}`,borderTopColor:BLUE,
                animation:'spin 1s linear infinite'}}/>
              <p style={{fontSize:12,color:TEXT_3}}>Chargement…</p>
            </div>
          ):!data?(
            <div style={{textAlign:'center',padding:'56px 0',color:TEXT_3}}>
              <FileText size={28} style={{margin:'0 auto 8px',opacity:.4}}/>
              <p style={{fontSize:13}}>Détails indisponibles.</p>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {data.equipement&&(
                <DSection icon={Cpu} title="Équipement" color={ac}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <DField label="Code" value={data.equipement.equipment_code} mono/>
                    <DField label="Description" value={data.equipement.description}/>
                  </div>
                </DSection>
              )}
              {(data.description||data.description_panne)&&(
                <DSection icon={FileText} title="Description de la panne" color="#7C3AED">
                  <p style={{fontSize:13,color:TEXT_1,lineHeight:1.6}}>
                    {data.description||data.description_panne}
                  </p>
                </DSection>
              )}
              {(data.methodiste||data.assigne||data.declarant)&&(
                <DSection icon={User} title="Acteurs" color={ac}>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {isOT&&data.methodiste&&<DActorRow role="Créé par"
                      name={`${data.methodiste.prenom||''} ${data.methodiste.nom||''}`.trim()}
                      sub={data.methodiste.email} color={ac}/>}
                    {isOT&&data.assigne&&<DActorRow role="Assigné à"
                      name={`${data.assigne.prenom||''} ${data.assigne.nom||''}`.trim()}
                      sub={data.assigne.role} color="#0D9488"/>}
                    {!isOT&&data.declarant&&<DActorRow role="Déclarant"
                      name={`${data.declarant.prenom||''} ${data.declarant.nom||''}`.trim()}
                      sub={data.declarant.role} color="#D97706"/>}
                  </div>
                </DSection>
              )}
              <DSection icon={Calendar} title="Chronologie" color="#D97706">
                {data.created_at&&<DDateRow label="Création" date={data.created_at}/>}
                {data.date_prevue&&<DDateRow label="Prévu" date={data.date_prevue}/>}
                {data.date_debut_reelle&&<DDateRow label="Début réel" date={data.date_debut_reelle}/>}
                {data.date_fin_reelle&&<DDateRow label="Fin réelle" date={data.date_fin_reelle}/>}
              </DSection>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
function DSection({icon:Icon,title,color,children}:{icon:any;title:string;color:string;children:React.ReactNode}){
  return(
    <div style={{background:CARD_WHITE,border:`1px solid ${BORDER}`,borderRadius:12,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 14px',
        borderBottom:`1px solid ${BORDER}`,background:CARD_BG}}>
        <div style={{width:22,height:22,borderRadius:6,background:color+'18',
          display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon size={12} style={{color}}/>
        </div>
        <p style={{fontSize:10,fontWeight:700,color:TEXT_2,textTransform:'uppercase',letterSpacing:'0.08em'}}>{title}</p>
      </div>
      <div style={{padding:14}}>{children}</div>
    </div>
  )
}
function DField({label,value,mono=false}:{label:string;value:any;mono?:boolean}){
  return(
    <div style={{background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:8,padding:10}}>
      <p style={{fontSize:9,fontWeight:700,color:TEXT_3,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:3}}>{label}</p>
      <p style={{fontSize:12,fontWeight:600,color:TEXT_1,fontFamily:mono?'monospace':'inherit'}}>{value||'—'}</p>
    </div>
  )
}
function DActorRow({role,name,sub,color}:{role:string;name:string;sub?:string;color:string}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,background:CARD_BG,
      border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 12px'}}>
      <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:color+'18',
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        <User size={14} style={{color}}/>
      </div>
      <div style={{minWidth:0}}>
        <p style={{fontSize:9,fontWeight:700,color:TEXT_3,textTransform:'uppercase',letterSpacing:'0.07em'}}>{role}</p>
        <p style={{fontSize:13,fontWeight:700,color:TEXT_1}}>{name||'—'}</p>
        {sub&&<p style={{fontSize:10,color:TEXT_3}}>{sub}</p>}
      </div>
    </div>
  )
}
function DDateRow({label,date}:{label:string;date:string}){
  const d=new Date(date),valid=!isNaN(d.getTime())
  return(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding:'8px 0',borderBottom:`1px solid ${BORDER}`,fontSize:12}}>
      <span style={{color:TEXT_2,display:'flex',alignItems:'center',gap:5}}>
        <Calendar size={10}/>{label}
      </span>
      <span style={{fontFamily:'monospace',fontWeight:600,color:TEXT_1,fontSize:10}}>
        {valid?d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})
          +' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—'}
      </span>
    </div>
  )
}
function fmtDate(s:string){
  const d=new Date(s); if(isNaN(d.getTime())) return s
  return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})
    +' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
}
export default function DashboardPage(){
  const router     =useRouter()
  const authUser   =useSelector((s:RootState)=>s.auth.user)
  const isAdmin    =authUser?.role==='ADMIN'
  const userPoleId =authUser?.id_pole as number|undefined

  const [poles,setPoles]           =useState<Pole[]>([])
  const [filtrePole,setFiltrePole] =useState<number|''>('')
  const [loading,setLoading]       =useState(true)
  const [lastRefresh,setLastRefresh]=useState<Date|null>(null)
  const [animKey,setAnimKey]       =useState(0)

  const [kpi,setKpi]               =useState<any>(null)
  const [otStatus,setOtStatus]     =useState<StatusRow[]>([])
  const [diStatus,setDiStatus]     =useState<StatusRow[]>([])
  const [recent,setRecent]         =useState<RecentRow[]>([])
  const [evolution,setEvolution]   =useState<EvolPoint[]>([])

  type FeedFilter='tout'|'OT'|'DI'
  const [feedFilter,setFeedFilter] =useState<FeedFilter>('tout')

  const [detailModal,setDetailModal]=useState<{type:'OT'|'DI';id:number}|null>(null)
  const [detailData,setDetailData]  =useState<any>(null)
  const [detailLoading,setDetailLoading]=useState(false)

  const activePole=isAdmin?(filtrePole||undefined):userPoleId
  const params=activePole?{id_pole:activePole}:{}

  useEffect(()=>{ if(isAdmin) polesService.lister().then(setPoles) },[])

  const charger=async()=>{
    setLoading(true)
    const [k,ots,dis,rec,ev]=await Promise.all([
      apiGet<any>('/dashboard/live/kpi',params),
      apiGet<StatusRow[]>('/dashboard/live/ot-by-status',params),
      apiGet<StatusRow[]>('/dashboard/live/di-by-status',params),
      apiGet<RecentRow[]>('/dashboard/live/recent',{...params,limit:14}),
      apiGet<EvolPoint[]>('/dashboard/live/evolution-mois',{...params,mois:12}),
    ])
    setKpi(k);setOtStatus(ots||[]);setDiStatus(dis||[])
    setRecent(rec||[]);setEvolution(ev||[])
    setLastRefresh(new Date()); setLoading(false); setAnimKey(k=>k+1)
  }

  useEffect(()=>{charger()},[activePole])
  useEffect(()=>{const t=setInterval(charger,60_000);return()=>clearInterval(t)},[activePole])

  const openDetail=async(type:'OT'|'DI',id:number)=>{
    setDetailModal({type,id});setDetailLoading(true);setDetailData(null)
    try{setDetailData((await api.get(type==='OT'?`/ot/${id}`:`/di/${id}`)).data)}
    catch{setDetailData(null)}finally{setDetailLoading(false)}
  }

  const totalOt   =otStatus.reduce((a,b)=>a+b.count,0)
  const totalDi   =diStatus.reduce((a,b)=>a+b.count,0)
  const otValides =['VALIDE_CE','VALIDE_HSE','ARCHIVE'].reduce((a,k)=>a+(otStatus.find(s=>s.statut===k)?.count??0),0)
  const otTermines=otStatus.find(s=>s.statut==='TERMINE')?.count??0
  const diTraitees=diStatus.filter(s=>['VALIDEE','VERIFIE'].includes(s.statut)).reduce((a,b)=>a+b.count,0)

  const otBreakdown=useMemo(()=>[
    {label:'En cours', statuts:['EN_COURS','ASSIGNE'],             color:CORR_COLOR},
    {label:'Clôturés', statuts:['VALIDE_CE','VALIDE_HSE','ARCHIVE'],color:PRED_COLOR},
    {label:'Créés',    statuts:['CREE'],                           color:'#CBD5E1'},
  ].map(s=>({label:s.label,count:otStatus.filter(o=>s.statuts.includes(o.statut)).reduce((a,b)=>a+b.count,0),color:s.color}))
   .filter(s=>s.count>0),[otStatus])

  const diBreakdown=useMemo(()=>[
    {label:'Validées',   statuts:['VALIDEE','VERIFIE'],    color:CORR_COLOR},
    {label:'En attente', statuts:['EN_ATTENTE','EN_COURS'],color:PRED_COLOR},
    {label:'Rejetées',   statuts:['REJETEE'],              color:'#CBD5E1'},
  ].map(s=>({label:s.label,count:diStatus.filter(d=>s.statuts.includes(d.statut)).reduce((a,b)=>a+b.count,0),color:s.color}))
   .filter(s=>s.count>0),[diStatus])

  const evolData=useMemo(()=>evolution.map(e=>({label:fmtMonth(e.mois),OT:e.ot,DI:e.di})),[evolution])
  const corrPredData=useMemo(()=>evolution.slice(-6).map(e=>({label:fmtMonth(e.mois),Correctif:e.ot,Prédictif:e.di})),[evolution])

  const filteredRecent=useMemo(()=>
    feedFilter==='tout'?recent:recent.filter(r=>r.type===feedFilter)
  ,[recent,feedFilter])

  const poleLabel=poles.find(p=>p.id_pole===filtrePole)?.nom_pole
    ||(isAdmin&&!filtrePole?'Tous les pôles':authUser?.nom_pole||'—')

  const otCorr=otStatus.reduce((a,b)=>a+b.count,0)
  return(
    <>
      <style dangerouslySetInnerHTML={{__html:STYLES}}/>
      <div style={{minHeight:'calc(100vh - 64px)',margin:'-24px',padding:'0 0 40px',background:PAGE_BG}}>
        <div style={{maxWidth:1400,margin:'0 auto',display:'flex',flexDirection:'column',gap:20}}>
          <div style={{borderRadius:0,overflow:'hidden',
            boxShadow:'0 4px 24px rgba(0,59,122,.15)',
            animation:'fadeUp .4s ease both',marginBottom:4}}>
            <div style={{
              background:`linear-gradient(135deg,${BLUE_DARK} 0%,#003B7A 50%,#0066CC 100%)`,
              padding:'28px 32px',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,right:0,width:340,height:340,
                background:'rgba(255,255,255,.05)',borderRadius:'50%',
                transform:'translate(30%,-50%)',filter:'blur(50px)',pointerEvents:'none'}}/>
              <div style={{position:'absolute',bottom:0,left:0,width:210,height:210,
                background:'rgba(255,255,255,.04)',borderRadius:'50%',
                transform:'translate(-25%,50%)',filter:'blur(35px)',pointerEvents:'none'}}/>
              {/* Grille */}
              <div style={{position:'absolute',inset:0,pointerEvents:'none',
                backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 30px,rgba(255,255,255,.025) 30px,rgba(255,255,255,.025) 31px),
                                  repeating-linear-gradient(90deg,transparent,transparent 30px,rgba(255,255,255,.025) 30px,rgba(255,255,255,.025) 31px)`}}/>

              <div style={{position:'relative',display:'flex',alignItems:'center',
                justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:18}}>
                  <div style={{width:56,height:56,borderRadius:18,
                    background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    backdropFilter:'blur(10px)',boxShadow:'0 8px 24px rgba(0,0,0,.2)'}}>
                    <LayoutDashboard size={26} color="#FFF"/>
                  </div>
                  <div>
                    
                    <h1 style={{fontSize:28,fontWeight:800,color:'#FFF',letterSpacing:'-0.02em',lineHeight:1.1}}>
                      Tableau de Bord
                    </h1>

                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  {isAdmin&&(
                    <select value={filtrePole}
                      onChange={e=>setFiltrePole(e.target.value?Number(e.target.value):'')}
                      style={{padding:'8px 14px',borderRadius:12,fontSize:13,fontWeight:600,
                        border:'1px solid rgba(255,255,255,.25)',background:'rgba(255,255,255,.12)',
                        color:'#FFF',cursor:'pointer',backdropFilter:'blur(8px)',outline:'none'}}>
                      <option value="" style={{color:TEXT_1}}>Tous les pôles</option>
                      {poles.map(p=><option key={p.id_pole} value={p.id_pole} style={{color:TEXT_1}}>{p.nom_pole}</option>)}
                    </select>
                  )}
                  <button onClick={charger} disabled={loading}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
                      borderRadius:12,border:'1px solid rgba(255,255,255,.25)',
                      background:'rgba(255,255,255,.12)',color:'#FFF',cursor:'pointer',
                      fontSize:12,fontWeight:600,backdropFilter:'blur(8px)',transition:'all .2s'}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.22)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.12)'}>
                    <RefreshCw size={13} style={{animation:loading?'spin 1s linear infinite':'none'}}/>
                    Actualiser
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div style={{padding:'0 28px',display:'flex',flexDirection:'column',gap:20}}>
            <div key={`rings-${animKey}`} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <RingCard label="Ordres de travail" total={totalOt}
                breakdown={otBreakdown.length?otBreakdown:[
                  {label:'Correctifs',count:Math.round(totalOt*.69),color:CORR_COLOR},
                  {label:'Prédictifs',count:totalOt-Math.round(totalOt*.69),color:PRED_COLOR},
                ]}
                delay={60} animKey={animKey} floatClass="float-a"/>
              <RingCard label="Demandes d'intervention" total={totalDi}
                breakdown={diBreakdown.length?diBreakdown:[
                  {label:'Validées',  count:diTraitees,          color:CORR_COLOR},
                  {label:'En attente',count:totalDi-diTraitees,  color:PRED_COLOR},
                ]}
                delay={160} animKey={animKey} floatClass="float-b"/>
            </div>

          
            {/* ══ ROW 4 : Tableau activité récente ═══════════════ */}
            <div className="card-lift" style={{background:CARD_BG,border:`1px solid ${BORDER}`,
              borderRadius:18,overflow:'hidden',
              animation:'fadeUp .55s ease both',animationDelay:'480ms'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'14px 20px',borderBottom:`1px solid ${BORDER}`,background:CARD_WHITE}}>
                <div>
                  <h3 style={{fontSize:13,fontWeight:700,color:TEXT_1,
                    display:'flex',alignItems:'center',gap:8}}>
                    <Activity size={14} style={{color:BLUE}}/>
                    Activité récente
                  </h3>
                  <p style={{fontSize:10,color:TEXT_3,marginTop:2}}>
                    {filteredRecent.length} entrées · cliquer pour détail complet
                  </p>
                </div>
                <div style={{display:'flex',gap:3,background:CARD_BG,
                  borderRadius:10,padding:3,border:`1px solid ${BORDER}`}}>
                  {(['tout','OT','DI'] as const).map(f=>(
                    <button key={f} onClick={()=>setFeedFilter(f)}
                      style={{padding:'4px 12px',borderRadius:8,fontSize:11,fontWeight:700,
                        border:'none',cursor:'pointer',transition:'all .2s',
                        background:feedFilter===f?BLUE:'transparent',
                        color:feedFilter===f?'#FFF':TEXT_3}}>
                      {f==='tout'?'Tout':f}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'90px 1fr 160px 90px 100px',
                gap:8,padding:'8px 20px',background:CARD_BG,borderBottom:`1px solid ${BORDER}`}}>
                {['Type','Référence','Équipement','Statut','Date'].map(col=>(
                  <span key={col} style={{fontSize:10,fontWeight:700,color:TEXT_3,
                    textTransform:'uppercase',letterSpacing:'0.07em'}}>{col}</span>
                ))}
              </div>
              <div style={{background:CARD_WHITE}}>
                {filteredRecent.length===0?(
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',padding:'48px 0',gap:8,color:TEXT_3}}>
                    <Activity size={22} style={{opacity:.3}}/>
                    <p style={{fontSize:12}}>Aucune activité</p>
                  </div>
                ):filteredRecent.map((r,i)=>{
                  const isOT=r.type==='OT'
                  const typeColor=isOT?BLUE:'#0369A1'
                  const ss=STATUT_STYLE[r.statut||'']||{bg:'#F1F5F9',color:'#475569'}
                  const sl=isOT?(STATUT_OT[r.statut||'']||r.statut||'—'):(STATUT_DI[r.statut||'']||r.statut||'—')
                  const ds=r.date?new Date(r.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}):'—'
                  return(
                    <div key={`${r.type}-${r.id}-${i}`} className="row-btn"
                      onClick={()=>openDetail(r.type,r.id)}
                      style={{display:'grid',gridTemplateColumns:'90px 1fr 160px 90px 100px',
                        gap:8,padding:'11px 20px',
                        borderBottom:i<filteredRecent.length-1?`1px solid ${BORDER}`:'none',
                        alignItems:'center',background:CARD_WHITE,
                        animation:`slideRow .4s ease both`,animationDelay:`${480+i*45}ms`}}>
                      <div>
                        <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:5,
                          background:typeColor+'18',color:typeColor,display:'inline-block'}}>
                          {r.type}
                        </span>
                      </div>
                      <div style={{minWidth:0}}>
                        <p style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:TEXT_1,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.ref}</p>
                        {r.sous_type&&<p style={{fontSize:10,color:TEXT_3,marginTop:1}}>{r.sous_type}</p>}
                      </div>
                      <div style={{minWidth:0}}>
                        {(r.equipement_code||r.equipement_desc)?(
                          <>
                            {r.equipement_code&&<p style={{fontFamily:'monospace',fontSize:10,fontWeight:600,
                              color:TEXT_2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {r.equipement_code}</p>}
                            {r.equipement_desc&&<p style={{fontSize:10,color:TEXT_3,marginTop:1,
                              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {r.equipement_desc}</p>}
                          </>
                        ):<span style={{fontSize:10,color:TEXT_3}}>—</span>}
                      </div>
                      <div>
                        <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:5,
                          display:'inline-block',background:ss.bg,color:ss.color,whiteSpace:'nowrap'}}>
                          {sl}
                        </span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span style={{fontSize:11,color:TEXT_3,fontFamily:'monospace'}}>{ds}</span>
                        <ChevronRight size={13} style={{color:TEXT_3,opacity:.5}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{textAlign:'center',fontSize:11,color:TEXT_3,
              animation:'fadeUp .4s ease both',animationDelay:'600ms',
              display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <Sparkles size={11}/>
              Données actualisées automatiquement toutes les 60 secondes
            </div>
          </div>
        </div>
      </div>

      {detailModal&&(
        <DetailModal data={detailData} type={detailModal.type} loading={detailLoading}
          onClose={()=>{setDetailModal(null);setDetailData(null)}}/>
      )}
    </>
  )
}