"use client";

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart,
  Area, ReferenceLine,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

function getToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

async function apiFetch(path: string, params: Record<string, any> = {}) {
  try {
    const token = getToken();
    const url = new URL(`${API}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    });
    const r = await fetch(url.toString(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.error("API error:", e);
    return null;
  }
}

async function apiPost(path: string, body: Record<string, any> = {}) {
  const token = getToken();
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`);
  return data;
}

const fmtDA = (n: number | null | undefined) => {
  if (!n) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " M DA";
  if (n >= 1_000) return Math.round(n / 1_000) + " K DA";
  return Math.round(n) + " DA";
};

// ─────────────────────────────────────────────────────────────────────
// CRITICITÉ CONFIG
// ─────────────────────────────────────────────────────────────────────
type Criticite = "CRITIQUE" | "URGENT" | "SURVEILLANCE" | "OK";

const CC: Record<Criticite, {
  rowBg: string; rowBorder: string; textColor: string;
  badgeBg: string; badgeText: string; badgeBorder: string;
  dotColor: string; barColor: string;
}> = {
  CRITIQUE:    { rowBg:"bg-red-50",    rowBorder:"border-l-2 border-l-red-500",    textColor:"text-red-600",    badgeBg:"bg-red-100",    badgeText:"text-red-700",    badgeBorder:"border-red-200",    dotColor:"bg-red-500",    barColor:"#ef4444" },
  URGENT:      { rowBg:"bg-orange-50", rowBorder:"border-l-2 border-l-orange-500", textColor:"text-orange-600", badgeBg:"bg-orange-100", badgeText:"text-orange-700", badgeBorder:"border-orange-200", dotColor:"bg-orange-500", barColor:"#f97316" },
  SURVEILLANCE:{ rowBg:"bg-amber-50",  rowBorder:"border-l-2 border-l-amber-400",  textColor:"text-amber-600",  badgeBg:"bg-amber-100",  badgeText:"text-amber-700",  badgeBorder:"border-amber-200",  dotColor:"bg-amber-400",  barColor:"#f59e0b" },
  OK:          { rowBg:"bg-white",     rowBorder:"",                                textColor:"text-emerald-600",badgeBg:"bg-emerald-50", badgeText:"text-emerald-700",badgeBorder:"border-emerald-200",dotColor:"bg-emerald-500",barColor:"#10b981" },
};

// ─────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────
function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-7 h-7 border-2" : "w-4 h-4 border-2";
  return <div className={`${cls} border-gray-200 border-t-indigo-500 rounded-full animate-spin`} />;
}

function RulBar({ rul, mtbf }: { rul: number; mtbf: number }) {
  const pct   = Math.min(100, Math.round((rul / Math.max(mtbf, 1)) * 100));
  const color = rul <= 3 ? "#ef4444" : rul <= 10 ? "#f97316" : rul <= 25 ? "#f59e0b" : "#10b981";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:color }} />
      </div>
      <span className="font-mono text-xs font-semibold" style={{ color }}>{rul}j</span>
    </div>
  );
}

function CritBadge({ statut }: { statut: Criticite }) {
  const c = CC[statut];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${c.badgeBg} ${c.badgeText} ${c.badgeBorder}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dotColor} ${statut==="CRITIQUE"?"animate-pulse":""}`} />
      {statut}
    </span>
  );
}

function StockPill({ ok, qte }: { ok: boolean; qte?: number }) {
  if (ok) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {qte ?? "—"} unité{(qte ?? 0) > 1 ? "s" : ""}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      Rupture
    </span>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-gray-500 mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-semibold" style={{ color: p.color || p.fill }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MODAL PLANIFIER OT
// ─────────────────────────────────────────────────────────────────────
function PlanifierOTModal({ composante, onClose, onSuccess }: {
  composante: any;
  onClose: () => void;
  onSuccess: (ot: any) => void;
}) {
  const [form, setForm] = useState({
    classe:        "MECANIQUE",
    priorite:      "NORMALE",
    date_prevue:   "",
    duree_estimee: 120,
    description:   "",
    observations:  "",
    id_assigne:    "" as number | "",
  });
  const [techniciens,   setTechniciens]   = useState<any[]>([]);
  const [loadingUsers,  setLoadingUsers]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // Pré-remplir depuis la prédiction
  useEffect(() => {
    if (!composante) return;
    const priorite =
      composante.statut === "CRITIQUE"    ? "CRITIQUE" :
      composante.statut === "URGENT"      ? "HAUTE"    :
      composante.statut === "SURVEILLANCE"? "NORMALE"  : "FAIBLE";

    setForm(prev => ({
      ...prev,
      priorite,
      date_prevue: composante.date_panne_prevue?.split("T")[0] || "",
      description: `OT prédictif — ${composante.equipment_code} (${composante.description}). RUL estimé : ${composante.rul_jours} jours. Machine : ${composante.system_equipment}.`,
    }));
  }, [composante]);

  // Charger les intervenants selon la classe
  useEffect(() => {
    if (!composante) return;
    setLoadingUsers(true);
    setForm(prev => ({ ...prev, id_assigne: "" }));
    const role = form.classe === "ELECTRIQUE" ? "TECHNICIEN" : "MECANICIEN";
    apiFetch("/users", { role, pole: composante.pole }).then(data => {
      setTechniciens(Array.isArray(data) ? data : []);
      setLoadingUsers(false);
    });
  }, [form.classe, composante?.pole]);

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.id_assigne) { setError("Veuillez sélectionner un intervenant."); return; }
    if (!form.date_prevue) { setError("Veuillez saisir une date prévue."); return; }
    if (!form.description.trim()) { setError("La description est obligatoire."); return; }

    setLoading(true);
    try {
      const rawUser = localStorage.getItem("user");
      const user    = rawUser ? JSON.parse(rawUser) : null;
      if (!user?.id_user) throw new Error("Utilisateur non connecté. Rechargez la page.");

      const ot = await apiPost("/predictions/ot", {
        equipment_code: composante.equipment_code,
        id_methodiste:  user.id_user,
        id_assigne:     Number(form.id_assigne),
        classe:         form.classe,
        priorite:       form.priorite,
        date_prevue:    form.date_prevue,
        duree_estimee:  Number(form.duree_estimee),
        description:    form.description.trim(),
        observations:   form.observations.trim() || null,
        rul_jours:      composante.rul_jours,
      });

      onSuccess(ot);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la création de l'OT.");
    } finally {
      setLoading(false);
    }
  };

  if (!composante) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Planifier un Ordre de Travail</h2>
            <p className="text-xs text-gray-400 mt-0.5">Depuis la prédiction RUL · OT de type PRÉDICTIF</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5">×</button>
        </div>

        {/* Résumé composante */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-gray-800">{composante.equipment_code}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded border bg-red-50 text-red-600 border-red-200">RUL {composante.rul_jours}j</span>
                <CritBadge statut={composante.statut} />
              </div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">{composante.description} · {composante.system_equipment}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-400">Pôle</div>
              <div className="text-sm font-semibold text-gray-700">{composante.pole}</div>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Classe <span className="text-red-500">*</span></label>
              <select value={form.classe} onChange={set("classe")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
                <option value="MECANIQUE">⚙️ Mécanique → Mécanicien</option>
                <option value="ELECTRIQUE">⚡ Électrique → Technicien</option>
                <option value="GLOBALE">🔧 Globale → Les deux</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Priorité <span className="text-red-500">*</span></label>
              <select value={form.priorite} onChange={set("priorite")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
                <option value="CRITIQUE">🔴 Critique</option>
                <option value="HAUTE">🟠 Haute</option>
                <option value="NORMALE">🔵 Normale</option>
                <option value="FAIBLE">⚪ Faible</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date prévue <span className="text-red-500">*</span></label>
              <input type="date" value={form.date_prevue} onChange={set("date_prevue")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
              <p className="text-xs text-gray-400 mt-1">Suggérée d'après RUL ({composante.rul_jours}j restants)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Durée estimée (min)</label>
              <input type="number" min={15} max={2880} step={15} value={form.duree_estimee} onChange={set("duree_estimee")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Assigner à <span className="text-red-500">*</span>
              <span className="font-normal text-gray-400 ml-1">
                ({form.classe === "ELECTRIQUE" ? "Technicien" : "Mécanicien"} · pôle {composante.pole})
              </span>
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 py-2 text-xs text-gray-400"><Spinner /> Chargement…</div>
            ) : techniciens.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Aucun intervenant disponible pour ce pôle et cette classe.
              </div>
            ) : (
              <select value={form.id_assigne} onChange={set("id_assigne")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
                <option value="">— Sélectionner un intervenant —</option>
                {techniciens.map((u: any) => (
                  <option key={u.id_user} value={u.id_user}>{u.prenom} {u.nom}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description <span className="text-red-500">*</span></label>
            <textarea value={form.description} onChange={set("description")} rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Observations (optionnel)</label>
            <textarea value={form.observations} onChange={set("observations")} rows={2}
              placeholder="Notes pour le mécanicien…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-lg transition-all active:scale-95 shadow-sm">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création…</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>Créer l'OT</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SECTION VUE GLOBALE
// ─────────────────────────────────────────────────────────────────────
function SectionVueGlobale({ stats, machines, composantes }: any) {
  const critiques = composantes.filter((c: any) => c.statut === "CRITIQUE").length;
  const urgents   = composantes.filter((c: any) => c.statut === "URGENT").length;

  const distData = [
    { label:"0–3j",   count:composantes.filter((c:any)=>c.rul_jours<=3).length,                          fill:"#ef4444" },
    { label:"4–10j",  count:composantes.filter((c:any)=>c.rul_jours>3&&c.rul_jours<=10).length,          fill:"#f97316" },
    { label:"11–25j", count:composantes.filter((c:any)=>c.rul_jours>10&&c.rul_jours<=25).length,         fill:"#f59e0b" },
    { label:">25j",   count:composantes.filter((c:any)=>c.rul_jours>25).length,                          fill:"#10b981" },
  ];

  const poleMap: Record<string, { crit:number; ok:number }> = {};
  composantes.forEach((c: any) => {
    if (!poleMap[c.pole]) poleMap[c.pole] = { crit:0, ok:0 };
    if (c.statut==="CRITIQUE"||c.statut==="URGENT") poleMap[c.pole].crit++;
    else poleMap[c.pole].ok++;
  });
  const poleData = Object.entries(poleMap)
    .map(([pole, v]) => ({ pole:pole.replace("ELKS_",""), krit:v.crit, ok:v.ok, pct:Math.round((v.crit/Math.max(v.crit+v.ok,1))*100) }))
    .sort((a,b)=>b.krit-a.krit);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label:"Composantes analysées", value:composantes.length, sub:"Niveaux 3, 4 & 5", color:"border-l-gray-400",   val:"text-gray-800"    },
          { label:"Critiques",             value:critiques,          sub:"RUL ≤ 3 jours",    color:"border-l-red-500",    val:"text-red-600"     },
          { label:"Urgents",               value:urgents,            sub:"RUL 4–10 jours",   color:"border-l-orange-500", val:"text-orange-600"  },
          { label:"Coût moyen / panne",    value:fmtDA(stats?.cout_moyen), sub:"Historique CORR", color:"border-l-indigo-500", val:"text-indigo-600"  },
        ].map(k => (
          <div key={k.label} className={`bg-white border border-gray-200 border-l-4 ${k.color} rounded-xl p-4`}>
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-2xl font-bold font-mono ${k.val}`}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {machines.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Machines les plus sollicitées</h3>
          <div className="grid grid-cols-3 gap-3">
            {machines.slice(0,6).map((m: any, i: number) => (
              <div key={m.system_equipment} className={`p-4 rounded-xl border ${i===0?"border-red-200 bg-red-50":i===1?"border-orange-200 bg-orange-50":"border-gray-100 bg-gray-50"}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-gray-800 truncate">{m.system_equipment}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ml-2 shrink-0 ${i===0?"bg-red-100 text-red-600":i===1?"bg-orange-100 text-orange-600":"bg-gray-200 text-gray-500"}`}>#{i+1}</span>
                </div>
                <div className="text-xs text-gray-500 truncate mb-2">{m.description}</div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span><span className="font-semibold text-gray-700">{m.nb_composantes}</span> composantes</span>
                  <span><span className="font-semibold text-gray-700">{m.nb_pannes}</span> pannes</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{m.pole}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Répartition par fenêtre RUL</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distData} margin={{top:4,right:8,bottom:4,left:-16}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{fontSize:11,fill:"#9ca3af"}} />
              <YAxis tick={{fontSize:10,fill:"#9ca3af"}} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Composantes" radius={[4,4,0,0]}>
                {distData.map((d,i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Criticité par pôle</h3>
          <div className="grid grid-cols-3 gap-3">
            {poleData.slice(0,6).map(z => (
              <div key={z.pole} className="flex flex-col items-center">
                <div className="relative">
                  <PieChart width={66} height={66}>
                    <Pie data={[{v:z.krit},{v:z.ok}]} cx={29} cy={29} innerRadius={20} outerRadius={30} dataKey="v" startAngle={90} endAngle={-270}>
                      <Cell fill={z.pct>60?"#ef4444":z.pct>30?"#f97316":"#10b981"} />
                      <Cell fill="#f3f4f6" />
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-[11px] font-bold text-gray-700">{z.pct}%</span>
                  </div>
                </div>
                <div className="text-[10px] font-medium text-gray-500 mt-1 text-center">{z.pole}</div>
                <div className="text-[9px] text-gray-400">{z.krit}/{z.krit+z.ok}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SECTION PRÉDICTIONS
// ─────────────────────────────────────────────────────────────────────
function SectionPredictions({ composantes, onSelectComposante, onCreateOt, selected }: any) {
  const [search,     setSearch]     = useState("");
  const [rulFilter,  setRulFilter]  = useState("toutes");
  const [critFilter, setCritFilter] = useState("tous");

  const filtered = composantes.filter((c: any) => {
    const q         = search.toLowerCase();
    const matchS    = !search || c.equipment_code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    const matchR    = rulFilter==="toutes"?true:rulFilter==="0-3"?c.rul_jours<=3:rulFilter==="4-10"?c.rul_jours>3&&c.rul_jours<=10:c.rul_jours>10;
    const matchC    = critFilter==="tous"?true:c.statut===critFilter;
    return matchS && matchR && matchC;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input type="text" placeholder="Code ou description…" value={search} onChange={e=>setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[{key:"toutes",label:"Tous"},{key:"0-3",label:"0–3j"},{key:"4-10",label:"4–10j"},{key:"+10",label:"+10j"}].map(f => (
            <button key={f.key} onClick={()=>setRulFilter(f.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${rulFilter===f.key?"bg-white text-gray-800 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={critFilter} onChange={e=>setCritFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
          <option value="tous">Toutes criticités</option>
          <option value="CRITIQUE">Critique</option>
          <option value="URGENT">Urgent</option>
          <option value="SURVEILLANCE">Surveillance</option>
          <option value="OK">OK</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} composante{filtered.length!==1?"s":""}</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[560px]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr>
                {["Composante","Machine","Pôle","Niv.","RUL","MTBF","Pannes","Coût","Statut",""].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length===0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-gray-400 text-sm">Aucune composante pour ces filtres</td></tr>
              ) : filtered.map((c: any) => {
                const cc    = CC[c.statut as Criticite];
                const isSel = selected?.equipment_code === c.equipment_code;
                return (
                  <tr key={c.equipment_code} onClick={()=>onSelectComposante(c)}
                    className={`cursor-pointer transition-colors hover:bg-gray-50 ${cc.rowBg} ${cc.rowBorder} ${isSel?"ring-1 ring-inset ring-indigo-400":""}`}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-gray-800">{c.equipment_code}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[180px] mt-0.5">{c.description}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{c.system_equipment}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.pole}</td>
                    <td className="px-4 py-3 text-center"><span className="text-xs font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">L{c.equipment_level}</span></td>
                    <td className="px-4 py-3"><RulBar rul={c.rul_jours} mtbf={c.mtbf_jours} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.mtbf_jours}j</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.nb_pannes}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDA(c.cout_total)}</td>
                    <td className="px-4 py-3"><CritBadge statut={c.statut} /></td>
                    <td className="px-4 py-3">
                      <button onClick={e=>{e.stopPropagation();onCreateOt(c);}}
                        className="text-xs font-semibold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
                        Créer OT
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SECTION VISUALISATION
// ─────────────────────────────────────────────────────────────────────
function SectionVisualisation({ composantes, selected, trend, loadingTrend }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Top 10 composantes — pannes historiques</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={composantes.slice(0,10).map((c:any)=>({code:c.equipment_code.split("-").pop(),pannes:c.nb_pannes}))} layout="vertical" margin={{top:0,right:16,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis type="number" tick={{fontSize:10,fill:"#9ca3af"}} />
              <YAxis type="category" dataKey="code" tick={{fontSize:9,fill:"#9ca3af"}} width={56} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="pannes" name="Pannes" radius={[0,4,4,0]}>
                {composantes.slice(0,10).map((c:any,i:number)=><Cell key={i} fill={CC[c.statut as Criticite].barColor} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Évolution RUL — composante sélectionnée</h3>
          {selected ? (
            <>
              <div className="text-sm font-semibold text-gray-700 mb-3 font-mono truncate">{selected.equipment_code}</div>
              {loadingTrend ? (
                <div className="flex items-center justify-center h-48 gap-3"><Spinner /><span className="text-sm text-gray-400">Chargement…</span></div>
              ) : trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trend} margin={{top:5,right:5,bottom:5,left:-16}}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{fontSize:9,fill:"#9ca3af"}} interval="preserveStartEnd" />
                    <YAxis tick={{fontSize:9,fill:"#9ca3af"}} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                    <Area type="monotone" dataKey="rul" name="RUL estimé" stroke="#6366f1" fill="url(#areaGrad)" strokeWidth={2} dot={{fill:"#6366f1",r:3}} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-gray-400">Données insuffisantes</div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-56 text-gray-400 gap-2">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
              </svg>
              <span className="text-sm">Cliquez sur une ligne dans le tableau</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SECTION PLANIFICATION
// ─────────────────────────────────────────────────────────────────────
function SectionPlanification({ composantes, onCreateOt }: any) {
  const prioritaires = composantes.filter((c: any) => c.statut==="CRITIQUE"||c.statut==="URGENT");

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Interventions à planifier en priorité</h3>
          {prioritaires.length > 0 && (
            <span className="text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg">
              {prioritaires.length} intervention{prioritaires.length>1?"s":""} requise{prioritaires.length>1?"s":""}
            </span>
          )}
        </div>
        {prioritaires.length===0 ? (
          <div className="flex items-center justify-center gap-3 py-16 text-emerald-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">Aucune composante critique — situation nominale</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {prioritaires.map((c: any, i: number) => {
              const cc      = CC[c.statut as Criticite];
              const stockOk = i%3!==1;
              const stockQte= Math.floor(Math.abs(Math.sin(i*7))*8)+1;
              return (
                <div key={c.equipment_code} className={`flex items-center gap-4 px-5 py-4 ${cc.rowBg} ${cc.rowBorder}`}>
                  <span className="text-sm font-bold text-gray-400 w-6 shrink-0">#{i+1}</span>
                  <CritBadge statut={c.statut} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-semibold text-gray-800 truncate">{c.equipment_code}</div>
                    <div className="text-xs text-gray-500 truncate">{c.description}</div>
                    <div className="text-xs text-gray-400 font-mono">{c.system_equipment} · {c.pole}</div>
                  </div>
                  <div className="text-center w-14 shrink-0">
                    <div className={`font-mono text-2xl font-bold ${cc.textColor}`}>{c.rul_jours}</div>
                    <div className="text-xs text-gray-400">jours</div>
                  </div>
                  <div className="text-center w-14 shrink-0">
                    <div className="font-mono text-base font-semibold text-gray-600">{c.mtbf_jours}j</div>
                    <div className="text-xs text-gray-400">MTBF</div>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="text-xs font-medium text-gray-400 mb-1">Stock</div>
                    <StockPill ok={stockOk} qte={stockQte} />
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="text-xs font-medium text-gray-400 mb-1.5">Confiance</div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full" style={{width:`${c.confiance_pct}%`}} />
                      </div>
                      <span className="font-mono text-xs text-gray-500">{c.confiance_pct}%</span>
                    </div>
                  </div>
                  <button onClick={()=>onCreateOt(c)}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Créer OT
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id:"global",        label:"Vue d'ensemble",  icon:"📊" },
  { id:"predictions",   label:"Prédictions RUL", icon:"🔮" },
  { id:"visualisation", label:"Visualisation",   icon:"📈" },
  { id:"planification", label:"Planification",   icon:"📋" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

export default function PredictionsPage() {
  const [section,       setSection]       = useState<SectionId>("global");
  const [poles,         setPoles]         = useState<string[]>([]);
  const [poleFilter,    setPoleFilter]    = useState<string>("");
  const [composantes,   setComposantes]   = useState<any[]>([]);
  const [machines,      setMachines]      = useState<any[]>([]);
  const [stats,         setStats]         = useState<any>(null);
  const [selected,      setSelected]      = useState<any>(null);
  const [trend,         setTrend]         = useState<any[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [loadingTrend,  setLoadingTrend]  = useState(false);
  const [modalComp,     setModalComp]     = useState<any>(null);
  const [planningMsg,   setPlanningMsg]   = useState<{type:"success"|"error";text:string}|null>(null);

  const authUser = useSelector((s: any) => s.auth.user);
  const isAdmin  = authUser?.role === 'ADMIN' || authUser?.role === 'METHODISTE';

  // Charger les pôles
  useEffect(() => {
    apiFetch("/predictions/poles").then(data => {
      if (Array.isArray(data)) setPoles(data);
    });
  }, []);

  // Charger les données quand le pôle change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setComposantes([]);
    setMachines([]);

    Promise.all([
      apiFetch("/predictions/composantes",        { pole: poleFilter||undefined }),
      apiFetch("/predictions/machines-critiques", { pole: poleFilter||undefined, limit:6 }),
      apiFetch("/predictions/stats",              { pole: poleFilter||undefined }),
    ]).then(([comp, mach, st]) => {
      if (cancelled) return;
      setComposantes(Array.isArray(comp)?comp:[]);
      setMachines(Array.isArray(mach)?mach:[]);
      setStats(st);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [poleFilter]);

  // Charger la tendance quand on sélectionne une composante
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingTrend(true);
    apiFetch(`/predictions/rul-trend/${encodeURIComponent(selected.equipment_code)}`).then(data => {
      if (cancelled) return;
      setTrend(Array.isArray(data)?data:[]);
      setLoadingTrend(false);
    });
    return () => { cancelled = true; };
  }, [selected]);

  const critiques = composantes.filter(c => c.statut==="CRITIQUE").length;
  const urgents   = composantes.filter(c => c.statut==="URGENT").length;

  const handleCreateOt = (c: any) => setModalComp(c);

  const handleSelectComposante = (c: any) => {
    setSelected(c);
    setSection("visualisation");
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Maintenance Prédictive</h1>
              <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">SIMULATION MTBF</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Prédiction du RUL — composantes niveaux 3, 4 & 5</p>
          </div>
          {!loading && composantes.length>0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-sm font-bold text-red-600">{critiques}</span>
                <span className="text-xs text-gray-500 font-medium">critiques</span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="font-mono text-sm font-bold text-orange-600">{urgents}</span>
                <span className="text-xs text-gray-500 font-medium">urgents</span>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5">
                <span className="font-mono text-sm font-bold text-gray-700">{composantes.length}</span>
                <span className="text-xs text-gray-500 font-medium">composantes</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={()=>setSection(s.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${section===s.id?"bg-indigo-50 text-indigo-700 border border-indigo-200":"text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                <span className="text-base leading-none">{s.icon}</span>
                {s.label}
                {s.id==="planification" && critiques+urgents>0 && (
                  <span className="ml-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {Math.min(critiques+urgents,99)}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Pôle</label>
            {isAdmin ? (
              <select value={poleFilter} onChange={e=>setPoleFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 min-w-36">
                <option value="">Tous les pôles</option>
                {poles.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg">{poleFilter||"—"}</span>
            )}
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <div className="p-6">
        {planningMsg && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium flex items-center justify-between ${planningMsg.type==="success"?"bg-emerald-50 border-emerald-200 text-emerald-700":"bg-red-50 border-red-200 text-red-700"}`}>
            <span>{planningMsg.text}</span>
            <button onClick={()=>setPlanningMsg(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">×</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-gray-400">Calcul RUL depuis l'historique…</p>
          </div>
        ) : (
          <>
            {section==="global"        && <SectionVueGlobale    stats={stats} machines={machines} composantes={composantes} />}
            {section==="predictions"   && <SectionPredictions   composantes={composantes} onSelectComposante={handleSelectComposante} onCreateOt={handleCreateOt} selected={selected} />}
            {section==="visualisation" && <SectionVisualisation composantes={composantes} selected={selected} trend={trend} loadingTrend={loadingTrend} />}
            {section==="planification" && <SectionPlanification composantes={composantes} onCreateOt={handleCreateOt} />}
          </>
        )}
      </div>

      {/* MODAL OT */}
      <PlanifierOTModal
        composante={modalComp}
        onClose={()=>setModalComp(null)}
        onSuccess={ot=>{
          setModalComp(null);
          setPlanningMsg({ type:"success", text:`✓ ${ot.numero_ot} créé et assigné avec succès` });
          setSection("planification");
        }}
      />
    </div>
  );
}