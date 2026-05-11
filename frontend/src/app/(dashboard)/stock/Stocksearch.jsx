"use client";

import { useState, useCallback } from "react";

// ─── API ─────────────────────────────────────────────────────────────
async function searchPiece(query) {
  const url = new URL("http://localhost:8001/stock/search", window.location.origin);
  url.searchParams.set("q", query.trim());
  try {
    const r = await fetch(url.toString());
    return await r.json();
  } catch {
    return [];
  }
}

async function searchByEquipmentCode(code) {
  const url = new URL("http://localhost:8001/stock/by-composante", window.location.origin);
  url.searchParams.set("equipment_code", code.trim());
  try {
    const r = await fetch(url.toString());
    return await r.json(); // retourne 1 pièce ou null
  } catch {
    return null;
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────
function statutColor(quantite, seuil) {
  if (quantite === 0)          return { bg: "#FEE2E2", dot: "#EF4444", label: "RUPTURE",     text: "#991B1B" };
  if (quantite <= seuil)       return { bg: "#FEF3C7", dot: "#F59E0B", label: "STOCK BAS",   text: "#92400E" };
  return                              { bg: "#D1FAE5", dot: "#10B981", label: "DISPONIBLE",   text: "#065F46" };
}

function fmtQte(n, unite) {
  return `${n} ${unite || "pcs"}`;
}

// ─── COMPOSANT CARTE PIÈCE ────────────────────────────────────────────
function PieceCard({ piece }) {
  const st = statutColor(piece.quantite, piece.seuil_alerte);
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              color: "#F97316",
              background: "#FFF7ED",
              border: "1px solid #FED7AA",
              borderRadius: 5,
              padding: "2px 8px",
            }}>{piece.code_stock}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginTop: 6 }}>
            {piece.designation}
          </div>
          {piece.description && (
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{piece.description}</div>
          )}
        </div>
        {/* Statut */}
        <div style={{
          background: st.bg,
          borderRadius: 8,
          padding: "8px 14px",
          textAlign: "center",
          minWidth: 90,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: st.text }}>
            {piece.quantite}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: st.text, letterSpacing: "0.06em" }}>
            {piece.unite || "pcs"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", marginTop: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.dot, display: "inline-block" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: st.text }}>{st.label}</span>
          </div>
        </div>
      </div>

      {/* Infos */}
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6B7280", flexWrap: "wrap" }}>
        {piece.emplacement && (
          <span>📦 {piece.emplacement}</span>
        )}
        <span>⚠️ Seuil : {piece.seuil_alerte} {piece.unite || "pcs"}</span>
        {piece.nb_composantes != null && (
          <span>🔧 Utilisée sur {piece.nb_composantes} composante{piece.nb_composantes > 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Composantes liées */}
      {piece.composantes_liees?.length > 0 && (
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Composantes associées ({piece.composantes_liees.length})
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {piece.composantes_liees.slice(0, 8).map((c, i) => (
              <span key={i} style={{
                fontFamily: "monospace",
                fontSize: 11,
                background: "#F3F4F6",
                color: "#374151",
                borderRadius: 4,
                padding: "2px 7px",
              }}>{c.equipment_code}</span>
            ))}
            {piece.composantes_liees.length > 8 && (
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                +{piece.composantes_liees.length - 8} autres…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMPOSANT "AUCUN RÉSULTAT" ───────────────────────────────────────
function EmptyState({ query }) {
  return (
    <div style={{
      background: "#FFF5F5",
      border: "1px solid #FCA5A5",
      borderRadius: 12,
      padding: "28px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>❌</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#991B1B" }}>
        Pièce introuvable
      </div>
      <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
        Aucune pièce ne correspond à <strong>"{query}"</strong> dans le stock.
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>
        Vérifiez le code composante (ex : B4313R2003-01) ou la désignation.
      </div>
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────
export default function StockSearch() {
  const [query, setQuery]     = useState("");
  const [mode, setMode]       = useState("text"); // "text" | "code"
  const [results, setResults] = useState(null);   // null = pas encore cherché
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResults(null);

    if (mode === "code") {
      // Recherche par code composante → 1 pièce ou null
      const piece = await searchByEquipmentCode(q);
      setResults(piece ? [piece] : []);
    } else {
      // Recherche par code_stock ou désignation → liste
      const pieces = await searchPiece(q);
      setResults(pieces || []);
    }
    setLoading(false);
  }, [query, mode]);

  const handleKey = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClear = () => {
    setQuery("");
    setResults(null);
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px", fontFamily: "inherit" }}>

      {/* Titre */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>🔍 Recherche pièce en stock</div>
        <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
          Saisissez un code composante SAP ou une désignation
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          ["text", "Par désignation / code STK"],
          ["code", "Par code composante SAP"],
        ].map(([val, label]) => (
          <button key={val} onClick={() => { setMode(val); setResults(null); }} style={{
            padding: "5px 14px", borderRadius: 7, fontSize: 12, cursor: "pointer",
            background: mode === val ? "#FFF7ED" : "#fff",
            color: mode === val ? "#F97316" : "#6B7280",
            border: `1px solid ${mode === val ? "#F97316" : "#E5E7EB"}`,
            fontWeight: mode === val ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {/* Barre de recherche */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              mode === "code"
                ? "Ex : B4313R2003-01"
                : "Ex : MOTEUR ELECTRIQUE ou STK-0001"
            }
            style={{
              width: "100%",
              padding: "11px 40px 11px 14px",
              fontSize: 14,
              border: "1.5px solid #E5E7EB",
              borderRadius: 9,
              outline: "none",
              fontFamily: mode === "code" ? "monospace" : "inherit",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = "#F97316"}
            onBlur={e => e.target.style.borderColor = "#E5E7EB"}
          />
          {query && (
            <button onClick={handleClear} style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 16,
            }}>✕</button>
          )}
        </div>
        <button onClick={handleSearch} disabled={!query.trim() || loading} style={{
          padding: "11px 22px",
          background: query.trim() && !loading ? "#F97316" : "#E5E7EB",
          color: query.trim() && !loading ? "#fff" : "#9CA3AF",
          border: "none",
          borderRadius: 9,
          fontSize: 14,
          fontWeight: 600,
          cursor: query.trim() && !loading ? "pointer" : "default",
          transition: "background 0.15s",
        }}>
          {loading ? "…" : "Rechercher"}
        </button>
      </div>

      {/* Résultats */}
      {loading && (
        <div style={{ textAlign: "center", padding: "32px", color: "#9CA3AF", fontSize: 13 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #E5E7EB", borderTopColor: "#F97316", animation: "spin .7s linear infinite", margin: "0 auto 8px" }} />
          Recherche en cours…
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {!loading && results !== null && results.length === 0 && (
        <EmptyState query={query} />
      )}

      {!loading && results?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>
            {results.length} résultat{results.length > 1 ? "s" : ""} trouvé{results.length > 1 ? "s" : ""}
          </div>
          {results.map((p, i) => <PieceCard key={i} piece={p} />)}
        </div>
      )}
    </div>
  );
}