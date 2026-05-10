"""
Services d'export pour OT - Format CEVITAL
"""

import io
import csv
from datetime import datetime
from typing import List, Dict, Any


def generate_ot_csv(ots: List[Dict[str, Any]]) -> str:
    """
    Génère un fichier CSV pour les OT
    """
    output = io.StringIO()
    
    headers = [
        "Numero OT", "Type", "Classe", "Priorité", "Statut",
        "Equipement", "Description", "Méthodiste", "Assigné",
        "Date Prévue", "Durée Estimée", "Date Création"
    ]
    
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    
    for ot in ots:
        writer.writerow({
            "Numero OT": ot.get("numero_ot", ""),
            "Type": ot.get("type_ot", ""),
            "Classe": ot.get("classe", ""),
            "Priorité": ot.get("priorite", ""),
            "Statut": ot.get("statut", ""),
            "Equipement": ot.get("equipement", {}).get("equipment_code", "") if ot.get("equipement") else "",
            "Description": ot.get("description", ""),
            "Méthodiste": ot.get("methodiste", {}).get("nom", "") if ot.get("methodiste") else "",
            "Assigné": ot.get("assigne", {}).get("nom", "") if ot.get("assigne") else "",
            "Date Prévue": ot.get("date_prevue", ""),
            "Durée Estimée": ot.get("duree_estimee", ""),
            "Date Création": ot.get("created_at", ""),
        })
    
    return output.getvalue()


def generate_ot_pdf_html(ot: Dict[str, Any]) -> str:
    """
    Génère un HTML formaté pour impression PDF
    Format CEVITAL - Professional OT Certificate
    """
    
    # Déterminer le statut et sa couleur
    statut = ot.get("statut", "")
    statut_colors = {
        "CREE": "#6b7280",
        "ASSIGNE": "#3b82f6",
        "EN_COURS": "#8b5cf6",
        "TERMINE": "#f59e0b",
        "VALIDE_CE": "#10b981",
        "VALIDE_HSE": "#059669",
    }
    statut_color = statut_colors.get(statut, "#6b7280")
    
    equip = ot.get("equipement", {})
    methodiste = ot.get("methodiste", {})
    assigne = ot.get("assigne", {})
    pole = ot.get("pole", {})
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Arial', sans-serif; color: #1f2937; }}
        
        .container {{ max-width: 800px; margin: 0 auto; padding: 20px; }}
        
        /* Header */
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1e40af;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }}
        
        .logo {{
            font-size: 24px;
            font-weight: bold;
            color: #1e40af;
        }}
        
        .logo span {{ color: #f59e0b; }}
        
        .doc-title {{
            font-size: 18px;
            font-weight: bold;
            text-align: right;
        }}
        
        .doc-info {{ font-size: 12px; color: #6b7280; }}
        
        /* OT Number */
        .ot-number {{
            background: #1e40af;
            color: white;
            padding: 10px 20px;
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 20px;
        }}
        
        /* Info Grid */
        .info-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
        }}
        
        .info-box {{
            border: 1px solid #e5e7eb;
            padding: 12px;
            border-radius: 4px;
        }}
        
        .info-label {{
            font-size: 11px;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 4px;
        }}
        
        .info-value {{
            font-size: 14px;
            font-weight: 600;
        }}
        
        .info-value.status {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            color: white;
            font-size: 12px;
        }}
        
        /* Description */
        .description-section {{
            border: 1px solid #e5e7eb;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
        }}
        
        .section-title {{
            font-size: 12px;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 8px;
            font-weight: bold;
        }}
        
        .description-text {{
            font-size: 13px;
            line-height: 1.5;
        }}
        
        /* Equipment Details */
        .equipment-box {{
            background: #f3f4f6;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }}
        
        .equipment-row {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }}
        
        .equipment-label {{
            font-size: 12px;
            color: #6b7280;
        }}
        
        .equipment-value {{
            font-size: 13px;
            font-weight: 500;
        }}
        
        /* Signatures */
        .signatures {{
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }}
        
        .signature-box {{
            text-align: center;
        }}
        
        .signature-line {{
            border-bottom: 1px solid #374151;
            height: 40px;
            margin-bottom: 8px;
        }}
        
        .signature-label {{
            font-size: 11px;
            color: #6b7280;
        }}
        
        /* Footer */
        .footer {{
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 10px;
        }}
        
        @media print {{
            body {{ -webkit-print-color-adjust: exact; }}
            .container {{ padding: 0; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="logo">CEVITAL<span> - Optima</span></div>
            <div>
                <div class="doc-title">ORDRE DE TRAVAIL</div>
                <div class="doc-info">Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}</div>
            </div>
        </div>
        
        <!-- OT Number -->
        <div class="ot-number">{ot.get('numero_ot', '')}</div>
        
        <!-- Info Grid -->
        <div class="info-grid">
            <div class="info-box">
                <div class="info-label">Type</div>
                <div class="info-value">{ot.get('type_ot', '')}</div>
            </div>
            <div class="info-box">
                <div class="info-label">Classe</div>
                <div class="info-value">{ot.get('classe', '')}</div>
            </div>
            <div class="info-box">
                <div class="info-label">Priorité</div>
                <div class="info-value">{ot.get('priorite', '')}</div>
            </div>
            <div class="info-box">
                <div class="info-label">Statut</div>
                <div class="info-value status" style="background: {statut_color}">{statut}</div>
            </div>
            <div class="info-box">
                <div class="info-label">Pôle</div>
                <div class="info-value">{pole.get('nom_pole', '') if pole else ''}</div>
            </div>
            <div class="info-box">
                <div class="info-label">Date Prévue</div>
                <div class="info-value">{ot.get('date_prevue', 'Non définie')}</div>
            </div>
            <div class="info-box">
                <div class="info-label">Méthodiste</div>
                <div class="info-value">{methodiste.get('nom', '') if methodiste else ''}</div>
            </div>
            <div class="info-box">
                <div class="info-label">Assigné à</div>
                <div class="info-value">{assigne.get('nom', '') if assigne else 'Non assigné'}</div>
            </div>
        </div>
        
        <!-- Description -->
        <div class="description-section">
            <div class="section-title">Description de l'intervention</div>
            <div class="description-text">{ot.get('description', '')}</div>
        </div>
        
        <!-- Equipment -->
        <div class="equipment-box">
            <div class="section-title">Équipement</div>
            <div class="equipment-row">
                <span class="equipment-label">Code:</span>
                <span class="equipment-value">{equip.get('equipment_code', '')}</span>
            </div>
            <div class="equipment-row">
                <span class="equipment-label">Description:</span>
                <span class="equipment-value">{equip.get('description', '')}</span>
            </div>
            <div class="equipment-row">
                <span class="equipment-label">Machine parente:</span>
                <span class="equipment-value">{equip.get('machine_code', '') if equip.get('machine_code') else 'N/A'}</span>
            </div>
        </div>
        
        <!-- Signatures -->
        <div class="signatures">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Méthodiste</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Chef Equipe</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">Intervenant</div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            Document généré par Optima Maintenance - CEVITAL | Page 1/1
        </div>
    </div>
</body>
</html>
    """
    
    return html


def generate_ot_list_pdf_html(ots: List[Dict[str, Any]]) -> str:
    """
    Génère un PDF pour une liste d'OTs
    """
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Arial', sans-serif; font-size: 11px; }}
        
        .header {{
            text-align: center;
            border-bottom: 2px solid #1e40af;
            padding: 15px;
            margin-bottom: 20px;
        }}
        
        .logo {{ font-size: 20px; font-weight: bold; color: #1e40af; }}
        .logo span {{ color: #f59e0b; }}
        
        table {{ width: 100%; border-collapse: collapse; }}
        
        th {{
            background: #1e40af;
            color: white;
            padding: 8px;
            text-align: left;
            font-weight: bold;
        }}
        
        td {{ padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }}
        
        tr:nth-child(even) {{ background: #f3f4f6; }}
        
        .statut {{
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
        }}
        
        .CREE {{ background: #e5e7eb; color: #374151; }}
        .ASSIGNE {{ background: #dbeafe; color: #1e40af; }}
        .EN_COURS {{ background: #ede9fe; color: #7c3aed; }}
        .TERMINE {{ background: #fef3c7; color: #d97706; }}
        .VALIDE_CE {{ background: #d1fae5; color: #059669; }}
        
        .footer {{
            margin-top: 20px;
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">CEVITAL<span> - Optima</span></div>
        <div>Liste des Ordres de Travail</div>
        <div>Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}</div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>N° OT</th>
                <th>Type</th>
                <th>Classe</th>
                <th>Priorité</th>
                <th>Statut</th>
                <th>Équipement</th>
                <th>Assigné</th>
                <th>Date Prévue</th>
            </tr>
        </thead>
        <tbody>
"""
    
    for ot in ots:
        equip = ot.get("equipement", {})
        assigne = ot.get("assigne", {})
        statut = ot.get("statut", "")
        
        html += f"""
            <tr>
                <td>{ot.get('numero_ot', '')}</td>
                <td>{ot.get('type_ot', '')}</td>
                <td>{ot.get('classe', '')}</td>
                <td>{ot.get('priorite', '')}</td>
                <td><span class="statut {statut}">{statut}</span></td>
                <td>{equip.get('equipment_code', '') if equip else ''}</td>
                <td>{assigne.get('nom', '') if assigne else '-'}</td>
                <td>{ot.get('date_prevue', '-')}</td>
            </tr>
"""
    
    html += f"""
        </tbody>
    </table>
    
    <div class="footer">
        Total: {len(ots)} OT(s) | Optima Maintenance - CEVITAL
    </div>
</body>
</html>
    """
    
    return html