"""
Templates HTML d'impression — branding CEVITAL Optima.

Le template `CEVITAL_TEMPLATE` accepte ces placeholders :
  - {title}           → balise <title>
  - {document_title}  → grand titre central (ex : "Liste du Personnel")
  - {sous_titre}      → petite ligne sous le titre
  - {meta}            → HTML des badges méta (date, effectif, etc.)
  - {content}         → HTML principal (sections, tableaux…)
  - {signatures}      → HTML des cases signatures (3 colonnes par défaut)
"""

CEVITAL_TEMPLATE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<style>
  @page {{ size: A4; margin: 16mm 12mm 18mm 12mm; }}

  * {{ box-sizing: border-box; }}
  body {{
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    color: #1f2937; margin: 0; background: #fff;
    font-size: 10.5pt;
  }}

  /* En-tête CEVITAL */
  .doc-header {{
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #003B7A;
    padding-bottom: 14px; margin-bottom: 18px;
  }}
  .logo-block {{ display: flex; align-items: center; gap: 14px; }}
  .logo {{
    width: 64px; height: 64px;
    background: linear-gradient(135deg, #003B7A, #002a5a);
    color: white; font-weight: 800; font-size: 28pt;
    display: flex; align-items: center; justify-content: center;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0,59,122,0.3);
  }}
  .company {{ line-height: 1.3; }}
  .company h1 {{
    margin: 0; font-size: 22pt; color: #003B7A; font-weight: 800;
    letter-spacing: 0.5px;
  }}
  .company .tagline {{
    font-size: 9pt; color: #6b7280; margin-top: 2px;
    text-transform: uppercase; letter-spacing: 1px;
  }}
  .address {{
    text-align: right; font-size: 9pt; color: #4b5563; line-height: 1.5;
  }}
  .address strong {{ color: #1f2937; }}

  /* Titre document */
  .doc-title {{ text-align: center; margin: 22px 0 18px 0; }}
  .doc-title h2 {{
    margin: 0; font-size: 18pt; color: #1f2937; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px;
  }}
  .doc-title .sous-titre {{
    margin-top: 4px; font-size: 10pt; color: #6b7280;
  }}
  .doc-title .meta {{
    margin-top: 10px; display: inline-flex; gap: 22px; align-items: center;
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 6px; padding: 8px 18px; font-size: 9pt; flex-wrap: wrap;
    justify-content: center;
  }}
  .doc-title .meta b {{ color: #1f2937; }}

  /* Sections (par rôle, par zone, etc.) */
  .role-section {{ margin-bottom: 24px; page-break-inside: avoid; }}
  .role-header {{
    display: flex; justify-content: space-between; align-items: center;
    background: linear-gradient(90deg, #003B7A 0%, #002a5a 100%);
    color: white; padding: 8px 14px; border-radius: 4px 4px 0 0;
  }}
  .role-header h2 {{
    margin: 0; font-size: 12pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px;
  }}
  .role-header .badge {{
    background: rgba(255,255,255,0.25);
    padding: 3px 10px; border-radius: 12px; font-size: 9pt; font-weight: 600;
  }}

  /* Tableaux */
  table.users-table {{
    width: 100%; border-collapse: collapse;
    border: 1px solid #d1d5db; font-size: 8.5pt;
  }}
  table.users-table th {{
    background: #f3f4f6; color: #1f2937;
    padding: 7px 6px; text-align: left;
    border-bottom: 2px solid #003B7A;
    font-weight: 700; font-size: 8pt;
    text-transform: uppercase;
  }}
  table.users-table td {{
    padding: 5px 6px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }}
  table.users-table tr:nth-child(even) td {{ background: #fafafa; }}
  table.users-table .num {{ text-align: center; color: #9ca3af; width: 28px; font-weight: 600; }}
  table.users-table .nom {{ font-weight: 600; color: #111827; }}
  table.users-table .mono {{ font-family: 'Courier New', monospace; font-size: 8pt; }}

  /* Badges de statut dans les tableaux */
  .statut {{
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
  }}
  .statut.CREE        {{ background: #e5e7eb; color: #374151; }}
  .statut.ASSIGNE     {{ background: #dbeafe; color: #1e40af; }}
  .statut.EN_COURS    {{ background: #ede9fe; color: #7c3aed; }}
  .statut.TERMINE     {{ background: #fef3c7; color: #d97706; }}
  .statut.VALIDE_CE   {{ background: #d1fae5; color: #059669; }}
  .statut.VALIDE_HSE  {{ background: #a7f3d0; color: #047857; }}
  .statut.ARCHIVE     {{ background: #f3f4f6; color: #6b7280; }}
  .statut.REJETE      {{ background: #fee2e2; color: #b91c1c; }}

  .priorite {{
    display: inline-block; padding: 1px 7px; border-radius: 3px;
    font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
  }}
  .priorite.CRITIQUE  {{ background: #fee2e2; color: #b91c1c; }}
  .priorite.HAUTE     {{ background: #ffedd5; color: #c2410c; }}
  .priorite.NORMALE   {{ background: #fef3c7; color: #92400e; }}
  .priorite.FAIBLE    {{ background: #ecfccb; color: #4d7c0f; }}

  /* Signatures */
  .signatures {{
    margin-top: 40px;
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px;
    page-break-inside: avoid;
  }}
  .signature-box {{
    text-align: center;
    border-top: 1px solid #1f2937;
    padding-top: 8px;
  }}
  .signature-box .label {{ font-size: 9pt; color: #4b5563; font-weight: 600; }}
  .signature-box .sub {{ font-size: 8pt; color: #9ca3af; margin-top: 2px; }}

  /* Footer */
  .doc-footer {{
    margin-top: 30px; padding-top: 10px;
    border-top: 1px solid #e5e7eb;
    text-align: center; font-size: 8pt; color: #9ca3af;
  }}
  .doc-footer .conf {{
    background: #fef3c7; color: #92400e;
    display: inline-block; padding: 3px 10px;
    border-radius: 3px; font-weight: 600; margin-top: 4px;
  }}

  /* Boutons impression (cachés à l'impression) */
  .print-actions {{
    position: fixed; top: 16px; right: 16px;
    display: flex; gap: 8px; z-index: 100;
  }}
  .print-actions button {{
    background: #003B7A; color: white; border: 0;
    padding: 8px 16px; border-radius: 6px;
    font-size: 11pt; cursor: pointer; font-weight: 600;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
  }}
  .print-actions button:hover {{ background: #002a5a; }}
  .print-actions .secondary {{ background: #4b5563; }}
  .print-actions .secondary:hover {{ background: #1f2937; }}

  @media print {{
    .print-actions {{ display: none; }}
    body {{ font-size: 9.5pt; }}
  }}

  .empty {{ text-align: center; padding: 60px; color: #9ca3af; font-style: italic; }}
</style>
</head>
<body>

<div class="print-actions">
  <button onclick="window.print()">🖨️ Imprimer</button>
  <button class="secondary" onclick="window.close()">✕ Fermer</button>
</div>

<header class="doc-header">
  <div class="logo-block">
    <div class="logo">C</div>
    <div class="company">
      <h1>CEVITAL</h1>
      <div class="tagline">Industrie Agroalimentaire</div>
    </div>
  </div>
  <div class="address">
    <strong>CEVITAL SPA</strong><br>
    Nouveau Quai, Port de Béjaïa<br>
    06000 Béjaïa, Algérie<br>
    Tél : +213 (0)34 21 75 75<br>
    www.cevital.com
  </div>
</header>

<section class="doc-title">
  <h2>{document_title}</h2>
  <div class="sous-titre">{sous_titre}</div>
  <div class="meta">{meta}</div>
</section>

{content}

<section class="signatures">
{signatures}
</section>

<footer class="doc-footer">
  Document généré automatiquement par <strong>Optima GMAO</strong> · CEVITAL Béjaïa<br>
  <span class="conf">CONFIDENTIEL — Usage interne uniquement</span>
</footer>

</body>
</html>"""
