"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── TYPES ────────────────────────────────────────────────────────────
interface KpiData {
  total_interventions: number;
  correctif: number;
  preventif: number;
  ratio_corr_pct: number;
  ratio_prev_pct: number;
  cout_total_da: number;
  cout_moyen_da: number;
}

interface MonthlyData {
  periode: string;
  prev: number;
  corr: number;
}

interface CostData {
  periode: string;
  prev: number;
  corr: number;
}

interface EquipmentData {
  system_equipment: string;
  equipment_code?: string;
  nb_pannes: number;
  mtbf_jours: number | null;
  description?: string;
  job_class?: string;
  cout_total?: number;
}

interface ZoneData {
  zone: string;
  nb_pannes: number;
  mtbf_moyen_jours: number;
  cout_total: number;
  criticite: string;
}

interface InterventionData {
  equipment_code?: string;
  system_equipment?: string;
  description?: string;
  type_travail: string;
  job_class?: string;
  date_declaration?: string;
  duree_jours?: number;
  cout_total?: number;
}

interface PoleData {
  pole: string;
  prev: number;
  corr: number;
}

// Machine mère (parent) levels
interface MachineMere {
  niveau_1?: string;
  niveau_2?: string;
  code_niveau_1?: string;
  code_niveau_2?: string;
}

interface ComposanteCritique extends EquipmentData, MachineMere {}

// ─── CONFIG ───────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000/dashboard";

async function apiFetch(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(API_BASE + endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  });
  try {
    const r = await fetch(url.toString());
    return await r.json();
  } catch {
    return null;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined): string => {
  if (n == null) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + " K";
  return Math.round(n).toLocaleString("fr");
};

const fmtDA = (n: number | null | undefined): string => {
  if (!n) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " M DA";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + " K DA";
  return Math.round(n).toLocaleString("fr") + " DA";
};

const fmtMTBF = (val: number | null | undefined): string =>
  val == null || val <= 0 || !isFinite(val) ? "N/A" : `${Math.round(val)} j`;

const mtbfColor = (val: number | null | undefined): string =>
  !val || val <= 0 ? "#9CA3AF"
  : val < 20 ? "#EF4444"
  : val < 40 ? "#F59E0B"
  : "#10B981";

// ─── COMPOSANTS DE BASE ──────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 8, color: "#6B7280", fontSize: 13 }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #E5E7EB", borderTopColor: "#F97316", animation: "dash-spin .7s linear infinite" }} />
      Chargement…
      <style>{`@keyframes dash-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function KpiCard({ label, value, sub, color = "#F97316" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderTop: `3px solid ${color}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Tag({ type, children }: { type: string; children: React.ReactNode }) {
  const styles: Record<string, { background: string; color: string }> = {
    CORR:   { background: "#FEE2E2", color: "#991B1B" },
    PREV:   { background: "#D1FAE5", color: "#065F46" },
    PREVEN: { background: "#D1FAE5", color: "#065F46" },
    MECA:   { background: "#DBEAFE", color: "#1E40AF" },
    ELEC:   { background: "#EDE9FE", color: "#5B21B6" },
  };
  const s = styles[type] || { background: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ ...s, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>{children}</span>
  );
}

function Tip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ color: "#6B7280", marginBottom: 4 }}>{label || payload[0]?.name}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontWeight: 600, color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("fr") : p.value}
        </div>
      ))}
    </div>
  );
}

// ─── VUE : Vue d'ensemble ────────────────────────────────────────────
function ViewOverview({ pole }: { pole: string | null }) {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [costs, setCosts] = useState<CostData[]>([]);
  const [annee, setAnnee] = useState<number | null>(null);

  const load = useCallback(async () => {
    const p: Record<string, any> = { annee, ...(pole ? { pole } : {}) };
    const [k, m, c] = await Promise.all([
      apiFetch("/kpis", p),
      apiFetch("/interventions-par-mois", p),
      apiFetch("/cout-par-mois", p),
    ]);
    setKpis(k);
    setMonthly(m || []);
    setCosts(c || []);
  }, [annee, pole]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filtre année */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["Tout", null], ["2023", 2023], ["2024", 2024], ["2025", 2025], ["2026", 2026]].map(([label, val]) => (
          <button key={label} onClick={() => setAnnee(val as number | null)} style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
            background: annee === val ? "#FFF7ED" : "#fff",
            color: annee === val ? "#F97316" : "#6B7280",
            border: `1px solid ${annee === val ? "#F97316" : "#E5E7EB"}`,
            fontWeight: annee === val ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {!kpis ? <Spinner /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <KpiCard label="Total interventions" value={fmt(kpis.total_interventions)} sub="Toutes années" color="#F97316" />
          <KpiCard label="Correctif (CORR)" value={fmt(kpis.correctif)} sub={`${kpis.ratio_corr_pct ?? 0}% du total`} color="#EF4444" />
          <KpiCard label="Préventif (PREV)" value={fmt(kpis.preventif)} sub={`${kpis.ratio_prev_pct ?? 0}% du total`} color="#10B981" />
          <KpiCard label="Coût total" value={fmtDA(kpis.cout_total_da)} sub={`Moy. ${fmtDA(kpis.cout_moyen_da)}/int.`} color="#F59E0B" />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Interventions par mois" sub="PREV vs CORR">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="periode" tick={{ fontSize: 9, fill: "#9CA3AF" }} interval={Math.floor(monthly.length / 6) || 0} />
              <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} width={36} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="prev" stackId="1" stroke="#10B981" fill="#10B98118" name="Préventif" />
              <Area type="monotone" dataKey="corr" stackId="1" stroke="#EF4444" fill="#EF444418" name="Correctif" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Coût mensuel" sub="PREV + CORR en DA">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={costs} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="periode" tick={{ fontSize: 9, fill: "#9CA3AF" }} interval={Math.floor(costs.length / 6) || 0} />
              <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} width={44} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="corr" fill="#EF444488" name="Correctif" radius={[3, 3, 0, 0]} />
              <Bar dataKey="prev" fill="#10B98188" name="Préventif" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ─── VUE : Équipements & Composantes Critiques ──────────────────────
function ViewEquipements({ pole }: { pole: string | null }) {
  const [top, setTop] = useState<EquipmentData[]>([]);
  const [mtbf, setMtbf] = useState<EquipmentData[]>([]);
  const [compo, setCompo] = useState<ComposanteCritique[]>([]);

  useEffect(() => {
    const p = pole ? { pole } : {};
    Promise.all([
      apiFetch("/top-equipements", { limit: 8, type_travail: "CORR", ...p }),
      apiFetch("/mtbf-equipements", { limit: 8, ...p }),
      apiFetch("/composantes-critiques", { limit: 10, ...p }),
    ]).then(([t, m, c]) => {
      setTop(t || []);
      setMtbf((m || []).map((x: any) => ({ ...x, mtbf_jours: x.mtbf_jours > 0 ? x.mtbf_jours : null })));
      setCompo(c || []);
    });
  }, [pole]);

  const validMtbf = mtbf.filter(x => x.mtbf_jours != null && x.mtbf_jours > 0);
  const mtbfMoy = validMtbf.length
    ? Math.round(validMtbf.reduce((a, b) => a + (b.mtbf_jours || 0), 0) / validMtbf.length)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <KpiCard label="MTBF moyen" value={fmtMTBF(mtbfMoy)} sub="Inter-pannes moyen" color="#F59E0B" />
        <KpiCard label="Équip. critiques" value={String(mtbf.filter(m => m.mtbf_jours != null && m.mtbf_jours < 20).length)} sub="MTBF < 20 jours" color="#EF4444" />
        <KpiCard label="Top défaillant" value={top[0]?.system_equipment || "—"} sub={`${top[0]?.nb_pannes || 0} pannes`} color="#F97316" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Top 8 équipements" sub="Nb de pannes correctives">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis type="number" tick={{ fontSize: 9, fill: "#9CA3AF" }} />
              <YAxis type="category" dataKey="system_equipment" tick={{ fontSize: 9, fill: "#9CA3AF" }} width={100} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="nb_pannes" name="Pannes" fill="#F97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="MTBF par équipement" sub="Jours inter-pannes">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mtbf} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis type="number" tick={{ fontSize: 9, fill: "#9CA3AF" }} unit=" j" />
              <YAxis type="category" dataKey="system_equipment" tick={{ fontSize: 9, fill: "#9CA3AF" }} width={100} />
              <Tooltip content={<Tip />} formatter={(v: any) => fmtMTBF(v)} />
              <Bar dataKey="mtbf_jours" name="MTBF" radius={[0, 4, 4, 0]}>
                {mtbf.map((d, i) => <Cell key={i} fill={mtbfColor(d.mtbf_jours)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#6B7280" }}>
            {[["#EF4444", "< 20 j"], ["#F59E0B", "20–40 j"], ["#10B981", "> 40 j"]].map(([c, l]) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Composantes critiques avec machines mères */}
      <Card title="Composantes critiques avec machines mères" sub="Top 10 par pannes, coût et MTBF">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                {["#", "Code", "Description", "Classe", "Machine Mère Niv.1", "Machine Mère Niv.2", "Pannes", "MTBF", "Coût", "Statut"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compo.map((r, i) => {
                const mtbfVal = (r.mtbf_jours != null && r.mtbf_jours > 0) ? r.mtbf_jours : null;
                const crit = mtbfVal != null && mtbfVal < 20 ? "CRITIQUE" : mtbfVal != null && mtbfVal < 40 ? "SURV." : "OK";
                const critColor = crit === "CRITIQUE" ? "#EF4444" : crit === "SURV." ? "#F59E0B" : "#10B981";
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "9px 10px", color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: "9px 10px", fontSize: 11, fontWeight: 600, color: "#111827" }}>{r.equipment_code || r.system_equipment || "—"}</td>
                    <td style={{ padding: "9px 10px", color: "#374151", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                    <td style={{ padding: "9px 10px" }}><Tag type={r.job_class || ""}>{r.job_class || "—"}</Tag></td>
                    <td style={{ padding: "9px 10px", fontSize: 11, color: "#6B7280" }}>{r.niveau_1 || "—"}</td>
                    <td style={{ padding: "9px 10px", fontSize: 11, color: "#6B7280" }}>{r.niveau_2 || "—"}</td>
                    <td style={{ padding: "9px 10px", fontWeight: 700, color: "#EF4444" }}>{r.nb_pannes}</td>
                    <td style={{ padding: "9px 10px", fontWeight: 600, color: mtbfColor(mtbfVal) }}>{fmtMTBF(mtbfVal)}</td>
                    <td style={{ padding: "9px 10px", fontSize: 11 }}>{fmtDA(r.cout_total)}</td>
                    <td style={{ padding: "9px 10px", fontSize: 10, fontWeight: 700, color: critColor }}>{crit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── VUE : Zones & Pôles ────────────────────────────────────────────
function ViewZones({ isAdmin, pole }: { isAdmin: boolean; pole: string | null }) {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [poles, setPoles] = useState<PoleData[]>([]);

  useEffect(() => {
    const p = !isAdmin && pole ? { pole } : {};
    Promise.all([
      apiFetch("/zones-critiques", p),
      apiFetch("/interventions-par-pole", p),
    ]).then(([z, po]) => { setZones(z || []); setPoles(po || []); });
  }, [isAdmin, pole]);

  const maxPannes = zones.length ? Math.max(...zones.map(z => z.nb_pannes || 0), 1) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {zones.slice(0, isAdmin ? 9 : zones.length).map((z, i) => {
          const isCrit = z.criticite === "CRITIQUE";
          const pct = Math.round(((z.nb_pannes || 0) / maxPannes) * 100);
          const barColor = isCrit ? "#EF4444" : z.criticite === "ELEVE" ? "#F59E0B" : "#10B981";
          return (
            <div key={i} style={{ background: isCrit ? "#FFF5F5" : "#fff", border: `1px solid ${isCrit ? "#FCA5A5" : "#E5E7EB"}`, borderRadius: 10, padding: "12px 14px" }}>
              {isCrit && (
                <div style={{ fontSize: 9, fontWeight: 800, color: "#EF4444", background: "#FEE2E2", padding: "2px 6px", borderRadius: 4, display: "inline-block", marginBottom: 6, letterSpacing: "0.06em" }}>CRITIQUE</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{z.zone}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: z.nb_pannes > 500 ? "#EF4444" : "#111827" }}>{z.nb_pannes || 0}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>Pannes</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: mtbfColor(z.mtbf_moyen_jours) }}>{fmtMTBF(z.mtbf_moyen_jours)}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>MTBF</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmt(z.cout_total)}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>Coût</div>
                </div>
              </div>
              <div style={{ height: 3, background: "#F3F4F6", borderRadius: 99, marginTop: 10 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 99 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Graph pôles : uniquement admin */}
      {isAdmin && (
        <Card title="Interventions par pôle" sub="PREV vs CORR">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={poles.slice(0, 10)} margin={{ top: 5, right: 5, bottom: 30, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="pole" tick={{ fontSize: 8, fill: "#9CA3AF" }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} width={36} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="prev" fill="#10B98188" name="Préventif" radius={[3, 3, 0, 0]} />
              <Bar dataKey="corr" fill="#EF444488" name="Correctif" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ─── VUE : Interventions ─────────────────────────────────────────────
function ViewInterventions({ pole }: { pole: string | null }) {
  const [journal, setJournal] = useState<InterventionData[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    const p = pole ? { pole } : {};
    Promise.all([
      apiFetch("/journal", { limit: 100, ...p }),
      apiFetch("/tendance-annuelle", p),
    ]).then(([j, t]) => { setJournal(j || []); setTrend(t || []); });
  }, [pole]);

  const filtered = typeFilter ? journal.filter(r => r.type_travail === typeFilter) : journal;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Tendance PREV vs CORR" sub="Par trimestre 2023–2026">
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={trend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="periode" tick={{ fontSize: 9, fill: "#9CA3AF" }} />
            <YAxis tick={{ fontSize: 9, fill: "#9CA3AF" }} width={36} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="prev" fill="#10B98130" stroke="#10B981" name="Préventif" />
            <Line type="monotone" dataKey="corr" stroke="#EF4444" strokeWidth={2} dot={false} name="Correctif" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Journal des interventions" sub={`${filtered.length} entrées`}>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {[["Tous", null], ["PREV", "PREV"], ["CORR", "CORR"]].map(([l, v]) => (
            <button key={l} onClick={() => setTypeFilter(v as string | null)} style={{
              padding: "3px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer",
              background: typeFilter === v ? "#FFF7ED" : "#fff",
              color: typeFilter === v ? "#F97316" : "#6B7280",
              border: `1px solid ${typeFilter === v ? "#F97316" : "#E5E7EB"}`,
              fontWeight: typeFilter === v ? 600 : 400,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ overflowY: "auto", maxHeight: 300 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                {["Code", "Description", "Type", "Classe", "Date", "Durée", "Coût"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 80).map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, color: "#111827" }}>{r.equipment_code || r.system_equipment || "—"}</td>
                  <td style={{ padding: "8px 10px", color: "#374151", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                  <td style={{ padding: "8px 10px" }}><Tag type={r.type_travail}>{r.type_travail}</Tag></td>
                  <td style={{ padding: "8px 10px" }}><Tag type={r.job_class || ""}>{r.job_class || "—"}</Tag></td>
                  <td style={{ padding: "8px 10px", fontSize: 11, color: "#6B7280" }}>{r.date_declaration || "—"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11, color: "#6B7280" }}>{r.duree_jours != null ? `${Math.round(r.duree_jours)} j` : "—"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11 }}>{fmtDA(r.cout_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "overview",      label: "Vue d'ensemble" },
  { id: "equipment",     label: "Équipements & Composantes" },
  { id: "zones",         label: "Zones & Pôles" },
  { id: "interventions", label: "Interventions" },
];

export default function DashboardPage() {
  const authUser = useSelector((s: RootState) => s.auth.user);
  const isAdmin = authUser?.role === 'ADMIN';
  const userPole = authUser?.nom_pole || null;
  
  const [activeTab, setActiveTab] = useState("overview");

  // Si non-admin → passe le nom du pôle à l'API
  const pole = isAdmin ? null : userPole;

  const renderView = () => {
    switch (activeTab) {
      case "overview":      return <ViewOverview      pole={pole} />;
      case "equipment":     return <ViewEquipements   pole={pole} />;
      case "zones":         return <ViewZones         isAdmin={isAdmin} pole={pole} />;
      case "interventions": return <ViewInterventions pole={pole} />;
      default:              return null;
    }
  };

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100%", fontFamily: "inherit" }}>

      {/* Barre de navigation */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 24px", display: "flex", alignItems: "center", gap: 2 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "12px 16px", fontSize: 13, cursor: "pointer",
            fontWeight: activeTab === tab.id ? 600 : 400,
            color: activeTab === tab.id ? "#F97316" : "#6B7280",
            background: "transparent", border: "none",
            borderBottom: `2px solid ${activeTab === tab.id ? "#F97316" : "transparent"}`,
          }}>{tab.label}</button>
        ))}

        {/* Badge pôle pour les non-admins */}
        {!isAdmin && userPole && (
          <div style={{ marginLeft: "auto", background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1D4ED8", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
            Pôle : {userPole}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div style={{ padding: "20px 24px" }}>
        {renderView()}
      </div>
    </div>
  );
}
