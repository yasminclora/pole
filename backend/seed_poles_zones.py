# -*- coding: utf-8 -*-
"""
Script Seed - Tous les Poles et Zones (genere depuis equipment_clean.csv)
Lance : python seed_poles_zones_complet.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database      import SessionLocal
from models.pole   import Pole
from models.zone   import Zone
from models.equipe import Equipe

POLES_DATA = [
    {
        "code"        : "BBS",
        "nom"         : "BBS - Sucrerie Brute",
        "description" : "Sucrerie brute : cristallisation, turbinage, sechage et conditionnement",
        "zones": [
            ("BBS",         "Zone Generale BBS"),
            ("BBS-ACC1",    "Accumulateur 1"),
            ("BBS-ACC2",    "Accumulateur 2"),
            ("BBS-ACC3",    "Accumulateur 3"),
            ("BBS-AIR",     "Station Air Comprime"),
            ("BBS-APLEV",   "Appareils de Levage"),
            ("BBS-CARAME",  "Caramelisation"),
            ("BBS-CDE",     "Commande et Controle"),
            ("BBS-CONDST",  "Conditionnement Stockage"),
            ("BBS-CRIST",   "Cristallisation"),
            ("BBS-DE-TBE",  "Depart TBE"),
            ("BBS-DEPS2",   "Depot 2"),
            ("BBS-DEPS3",   "Depot 3"),
            ("BBS-DESI",    "Deshydratation"),
            ("BBS-DIVERS",  "Divers BBS"),
            ("BBS-ENERG",   "Energie"),
            ("BBS-ENS-EL",  "Ensachage Electrique"),
            ("BBS-ENSI",    "Ensachage"),
            ("BBS-FROID",   "Refroidissement"),
            ("BBS-LIQUEU",  "Liqueur"),
            ("BBS-MCC",     "Centre Controle Moteurs"),
            ("BBS-MTBT",    "Moyenne Tension Basse Tension"),
            ("BBS-RF",      "Raffinage Final"),
            ("BBS-S1",      "Section 1"),
            ("BBS-SECH",    "Sechoir"),
            ("BBS-STOCK",   "Stockage"),
            ("BBS-TURB",    "Turbinage"),
            ("BBS-VIDE",    "Systeme de Vide"),
            ("CEVITAL",     "Zone Generale Cevital"),
        ]
    },
    {
        "code"        : "BCH",
        "nom"         : "BCH - Conditionnement Huile",
        "description" : "Conditionnement et emballage des huiles alimentaires",
        "zones": [
            ("BCH-CHAUDR",  "Chaudronnerie"),
            ("BCH01",       "Ligne Conditionnement 01"),
            ("BCH02",       "Ligne Conditionnement 02"),
            ("BCH03",       "Ligne Conditionnement 03"),
            ("BCH04",       "Ligne Conditionnement 04"),
            ("BCH05",       "Ligne Conditionnement 05"),
            ("BCH06",       "Ligne Conditionnement 06"),
            ("BCH07",       "Ligne Conditionnement 07"),
            ("BCH08",       "Ligne Conditionnement 08"),
            ("BCH09",       "Ligne Conditionnement 09"),
            ("BCH10",       "Ligne Conditionnement 10"),
            ("BCH11",       "Ligne Conditionnement 11"),
            ("BCH12",       "Ligne Conditionnement 12"),
            ("BCH13",       "Ligne Conditionnement 13"),
            ("BCH14",       "Ligne Conditionnement 14"),
            ("REB-BCH",     "Rebuts BCH"),
            ("UAP1-BSCIP",  "Bloc Services Controle Industriel"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BEC",
        "nom"         : "BEC - Batiments et Edifices",
        "description" : "Gestion des batiments, edifices et infrastructure administrative",
        "zones": [
            ("BEC-ADM-EN",  "Administration Entree"),
            ("BEC-ALLEE",   "Allee"),
            ("BEC-ALLEES",  "Allees"),
            ("BEC-DEPOTS",  "Depots"),
            ("BEC-MAG",     "Magasin"),
            ("BEC_ADM",     "Administration"),
            ("BEC_ADM_DO",  "Administration Domaine"),
            ("BEC_ADM_EU",  "Administration EU"),
            ("BEC_ADM_MC",  "Administration MC"),
            ("BEC_ADM_R1",  "Administration R1"),
            ("BEC_ADM_R2",  "Administration R2"),
            ("BEC_ADM_R3",  "Administration R3"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BEU",
        "nom"         : "BEU - Utilites Energie Vapeur et Eau",
        "description" : "Services generaux : production energie, vapeur, eau industrielle et traitement des eaux",
        "zones": [
            ("BEN",         "Zone BEN"),
            ("BEU-AEROC",   "Aerorefrigerants"),
            ("BEU-AIRC",    "Air Comprime"),
            ("BEU-ARM",     "Armoires Electriques"),
            ("BEU-ARMA",    "Armoires Automatisme"),
            ("BEU-BABCH",   "Bac BCH"),
            ("BEU-BABCOM",  "Bac B Commun"),
            ("BEU-BAS",     "Bassins"),
            ("BEU-BAT",     "Batiments Utilites"),
            ("BEU-BOU",     "Boucle"),
            ("BEU-CDH",     "Centrale de Chauffage"),
            ("BEU-CGE",     "Centrale Gestion Energie"),
            ("BEU-CGES",    "Centrale Gestion Energie Secondaire"),
            ("BEU-CHAR",    "Chaufferie"),
            ("BEU-COG",     "Cogeneration"),
            ("BEU-COMF",    "Compression Froid"),
            ("BEU-COML12",  "Compresseur Lignes 1-2"),
            ("BEU-COMLO",   "Compresseur Local"),
            ("BEU-COMUP",   "Compresseur Upstream"),
            ("BEU-COMV",    "Compresseur Vapeur"),
            ("BEU-DAT",     "Donnees"),
            ("BEU-DEP",     "Depot"),
            ("BEU-DISJ",    "Disjoncteurs"),
            ("BEU-DIV",     "Divers Utilites"),
            ("BEU-DS1",     "Distribution Secondaire 1"),
            ("BEU-DS2-3",   "Distribution Secondaire 2-3"),
            ("BEU-EDI",     "Edifices"),
            ("BEU-EVAPC",   "Evaporateur Central"),
            ("BEU-EVPCOM",  "Evaporateur Commun"),
            ("BEU-F1",      "Four 1"),
            ("BEU-F2",      "Four 2"),
            ("BEU-F3",      "Four 3"),
            ("BEU-F4",      "Four 4"),
            ("BEU-GAZ",     "Station Gaz"),
            ("BEU-GES",     "Gestion Energie"),
            ("BEU-GTA1",    "Groupe Turbine Gaz 1"),
            ("BEU-GTA2",    "Groupe Turbine Gaz 2"),
            ("BEU-L1",      "Ligne Electrique 1"),
            ("BEU-L2",      "Ligne Electrique 2"),
            ("BEU-L3",      "Ligne Electrique 3"),
            ("BEU-L4",      "Ligne Electrique 4"),
            ("BEU-LACCP",   "Ligne Alimentation Compresseur"),
            ("BEU-LOOSCH",  "Loosch"),
            ("BEU-LOSCOM",  "LOS Commun"),
            ("BEU-LP",      "Ligne de Prelevement"),
            ("BEU-LRJ",     "Ligne Rejet"),
            ("BEU-MAG",     "Magasin Utilites"),
            ("BEU-MCC",     "Centre Controle Moteurs"),
            ("BEU-OSM",     "Osmose Inverse"),
            ("BEU-P30",     "Poste 30 kV"),
            ("BEU-P60",     "Poste 60 kV"),
            ("BEU-PR",      "Pompes et Reseaux"),
            ("BEU-PR1",     "Pompes Reseau 1"),
            ("BEU-PR2",     "Pompes Reseau 2"),
            ("BEU-PRF",     "Pompes Reseau Froid"),
            ("BEU-RAF",     "Rafraichissement"),
            ("BEU-S1",      "Section 1"),
            ("BEU-S2",      "Section 2"),
            ("BEU-SBAS",    "Station Basse"),
            ("BEU-SIL",     "Silencieux"),
            ("BEU-STCH",    "Station Chauffage"),
            ("BEU-STCOM",   "Station Commun"),
            ("BEU-SUPP",    "Support"),
            ("BEU-TGCG",    "Turbine Gaz Corps Gras"),
            ("BEU-TGOS",    "Turbine Gaz OS"),
            ("BEU-TRC",     "Transformateurs Courant"),
            ("BEU-TRF",     "Transformateurs Force"),
            ("BEU_APIHMI",  "API HMI BEU"),
            ("BLS-U500",    "BLS Unite 500"),
            ("ELKS_UT-CH",  "Utilites Chaufferie Elkser"),
            ("UFC-PV",      "UFC Prise Vapeur"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BGS_IP",
        "nom"         : "BGS IP - Gestion Systemes Informatiques",
        "description" : "Gestion des systemes informatiques et infrastructures IP",
        "zones": [
            ("ZZONE", "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BHS",
        "nom"         : "BHS - Hydraulique et Stockage",
        "description" : "Systemes hydrauliques et stockage industriel",
        "zones": [
            ("BHS_LOCP1",   "Local Pompes 1"),
            ("BHS_LOCP2",   "Local Pompes 2"),
            ("BHS_RAI",     "Reseau Alimentation Industrielle"),
        ]
    },
    {
        "code"        : "BLS",
        "nom"         : "BLS - Raffinage Huile",
        "description" : "Raffinage et traitement des huiles alimentaires",
        "zones": [
            ("BBS-DEPS3",   "Depot 3 BBS"),
            ("BLS",         "Zone Generale BLS"),
            ("BLS-AIR_ST",  "Station Air"),
            ("BLS-AUTRES",  "Autres"),
            ("BLS-BAT",     "Batiments"),
            ("BLS-CDE",     "Commande"),
            ("BLS-CTRNE",   "Citerne"),
            ("BLS-DIVERS",  "Divers BLS"),
            ("BLS-EAU_PR",  "Eau Process"),
            ("BLS-EXPED",   "Expedition"),
            ("BLS-FROID",   "Refroidissement"),
            ("BLS-LOGIST",  "Logistique"),
            ("BLS-PROD",    "Production"),
            ("BLS-QUAI",    "Quai"),
            ("BLS-STOCK",   "Stockage"),
            ("BLS-U100",    "Unite 100"),
            ("BLS-U1000",   "Unite 1000"),
            ("BLS-U200",    "Unite 200"),
            ("BLS-U300",    "Unite 300"),
            ("BLS-U400",    "Unite 400"),
            ("BLS-U500",    "Unite 500"),
            ("BLS-U600",    "Unite 600"),
            ("BLS-UTIL",    "Utilites BLS"),
            ("BLS_APIHMI",  "API HMI BLS"),
            ("BS2-CO2",     "CO2 BS2"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BMA",
        "nom"         : "BMA - Magasin et Appareillage",
        "description" : "Magasin central et gestion des appareillages",
        "zones": [
            ("BMA-18",      "Zone 18"),
            ("BMA-19",      "Zone 19"),
            ("BMA-21",      "Zone 21"),
            ("BMA-22",      "Zone 22"),
            ("BMA-A01",     "Allée A01"),
            ("BMA-A02",     "Allée A02"),
            ("BMA-A03",     "Allée A03"),
            ("BMA-A04",     "Allée A04"),
            ("BMA-A05",     "Allée A05"),
            ("BMA-A06",     "Allée A06"),
            ("BMA-A07",     "Allée A07"),
            ("BMA-A08",     "Allée A08"),
            ("BMA-A09",     "Allée A09"),
            ("BMA-A10",     "Allée A10"),
            ("BMA-A11",     "Allée A11"),
            ("BMA-A12",     "Allée A12"),
            ("BMA-A13",     "Allée A13"),
            ("BMA-A14",     "Allée A14"),
            ("BMA-A15",     "Allée A15"),
            ("BMA-A16",     "Allée A16"),
            ("BMA-A17",     "Allée A17"),
            ("BMA-A20",     "Allée A20"),
            ("BMA-A23",     "Allée A23"),
            ("BMA-PALET",   "Palettes"),
            ("REB-BMA",     "Rebuts BMA"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BMG_PL",
        "nom"         : "BMG PL - Poids Lourds",
        "description" : "Gestion et maintenance des poids lourds",
        "zones": [
            ("BMG-PL", "Poids Lourds"),
        ]
    },
    {
        "code"        : "BPFC",
        "nom"         : "BPFC - Portiques et Chariots",
        "description" : "Portiques, grues, nacelles et chariots de manutention",
        "zones": [
            ("BPFC-CHAR",   "Chariots"),
            ("BPFC-NACEL",  "Nacelles"),
            ("BPFC-NICHE",  "Niches"),
            ("BPFC-RTG1",   "RTG 1"),
            ("BPFC-STKR1",  "Stacker 1"),
            ("BPFC-STKR2",  "Stacker 2"),
        ]
    },
    {
        "code"        : "BRH",
        "nom"         : "BRH - Raffinerie Huile",
        "description" : "Raffinerie d'huile : neutralisation, decoloration, desodorisation",
        "zones": [
            ("BEU-LOOSCH",  "Loosch BEU"),
            ("BRH",         "Zone Generale BRH"),
            ("BRH-A20",     "Zone A20"),
            ("BRH-A26",     "Zone A26"),
            ("BRH-A27",     "Zone A27"),
            ("BRH-AZT",     "Azote"),
            ("BRH-B20",     "Zone B20"),
            ("BRH-B26",     "Zone B26"),
            ("BRH-B27",     "Zone B27"),
            ("BRH-CHAUDR",  "Chaudronnerie"),
            ("BRH-CHF",     "Chaufferie"),
            ("BRH-HB",      "Hydrogenation B"),
            ("BRH-HF",      "Hydrogenation F"),
            ("BRH-IEE",     "Instrumentation Electrique"),
            ("BRH-IPREP",   "Preparation"),
            ("BRH-IREACT",  "Reacteur"),
            ("BRH-ISTOCK",  "Stockage"),
            ("BRH-IUTILI",  "Utilites"),
            ("BRH-LA",      "Ligne A"),
            ("BRH-LB",      "Ligne B"),
            ("BRH-LC",      "Ligne C"),
            ("BRH-NRG",     "Energie"),
            ("BRH-NRJ",     "Energie NRJ"),
            ("BRH-R1000T",  "Reacteur 1000T"),
            ("BRH-R800T",   "Reacteur 800T"),
            ("BRH-S21",     "Section 21"),
            ("BRH-S24",     "Section 24"),
            ("BRH-S31",     "Section 31"),
            ("BRH-S500",    "Section 500"),
            ("BRH-S56",     "Section 56"),
            ("BRH-S57",     "Section 57"),
            ("BRH-S600",    "Section 600"),
            ("BRH-S800",    "Section 800"),
            ("BRH-S800EX",  "Section 800 Export"),
            ("BRH-STEP",    "Station Epuration"),
            ("BRH-UT1000",  "Utilites 1000"),
            ("BRH-UTILIT",  "Utilites BRH"),
            ("BSL-RQ",      "BSL Rack"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BRH_METH_MAINT",
        "nom"         : "BRH Methodes Maintenance",
        "description" : "Methodes et planification de la maintenance BRH",
        "zones": [
            ("BRH", "Zone Generale BRH"),
        ]
    },
    {
        "code"        : "BS1",
        "nom"         : "BS1 - Sucrerie 1 - Raffinage du Sucre",
        "description" : "Raffinage et production de sucre blanc - sucrerie 1",
        "zones": [
            ("BLS-FROID",   "Refroidissement BLS"),
            ("BS1",         "Zone Generale BS1"),
            ("BS1-ACC1",    "Accumulateur 1"),
            ("BS1-ACC10",   "Accumulateur 10"),
            ("BS1-ACC2",    "Accumulateur 2"),
            ("BS1-ACC3",    "Accumulateur 3"),
            ("BS1-ACC4",    "Accumulateur 4"),
            ("BS1-ACC5",    "Accumulateur 5"),
            ("BS1-ACC6",    "Accumulateur 6"),
            ("BS1-ACC7",    "Accumulateur 7"),
            ("BS1-ACC8",    "Accumulateur 8"),
            ("BS1-ACC9",    "Accumulateur 9"),
            ("BS1-AF-TBE",  "Affinage TBE"),
            ("BS1-AFF",     "Affinage"),
            ("BS1-AIR",     "Station Air Comprime"),
            ("BS1-APLEV",   "Appareils de Levage"),
            ("BS1-ATEL",    "Atelier Mecanique"),
            ("BS1-BAT",     "Batiments"),
            ("BS1-BF5",     "Bac Filtration 5"),
            ("BS1-BUR",     "Bureau"),
            ("BS1-CNDST",   "Conditionnement Stockage"),
            ("BS1-CO2",     "Station CO2"),
            ("BS1-CONC4",   "Concentration Effet 4"),
            ("BS1-CONC5",   "Concentration Effet 5"),
            ("BS1-CRB",     "Carbonatation"),
            ("BS1-CRST6",   "Cristallisation 6"),
            ("BS1-CRST8",   "Cristallisation 8"),
            ("BS1-DE-TBE",  "Depart TBE"),
            ("BS1-DECO",    "Decoloration"),
            ("BS1-DES",     "Deshydratation"),
            ("BS1-EN-TBE",  "Entree TBE"),
            ("BS1-ENS",     "Ensachage"),
            ("BS1-EVAP",    "Evaporation"),
            ("BS1-FB",      "Filtration Bagasse"),
            ("BS1-FRD",     "Refroidissement"),
            ("BS1-FS",      "Filtration Sirop"),
            ("BS1-LDC",     "Laboratoire de Controle"),
            ("BS1-NANO",    "Nano-Filtration"),
            ("BS1-REFD",    "Refroidissement Distribution"),
            ("BS1-RF",      "Raffinage Final"),
            ("BS1-S6",      "Section 6"),
            ("BS1-S7",      "Section 7"),
            ("BS1-SE-TBE",  "Sortie TBE"),
            ("BS1-SEC",     "Sechage"),
            ("BS1-SECH",    "Sechoir"),
            ("BS1-SEL",     "Salle Electrique"),
            ("BS1-SILOM",   "Silos Matieres"),
            ("BS1-TURB6",   "Turbinage 6"),
            ("BS1-TURB8",   "Turbinage 8"),
            ("BS1-UTIL",    "Utilites BS1"),
            ("BS1-VID",     "Vidange et Transfert"),
            ("BS1_APIHMI",  "API HMI BS1"),
            ("BS2-AFF",     "Affinage BS2"),
            ("BS2-CRIST8",  "Cristallisation 8 BS2"),
            ("BS2-TRENS",   "Transfert Ensachage BS2"),
            ("BSL-RQ",      "BSL Rack"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BS2",
        "nom"         : "BS2 - Sucrerie 2",
        "description" : "Sucrerie 2 : raffinage, cristallisation et conditionnement",
        "zones": [
            ("BEJAIA",      "Zone Bejaia"),
            ("BS2",         "Zone Generale BS2"),
            ("BS2-80KT",    "Capacite 80KT"),
            ("BS2-ACC1",    "Accumulateur 1"),
            ("BS2-ACC10",   "Accumulateur 10"),
            ("BS2-ACC2",    "Accumulateur 2"),
            ("BS2-ACC3",    "Accumulateur 3"),
            ("BS2-ACC4",    "Accumulateur 4"),
            ("BS2-ACC5",    "Accumulateur 5"),
            ("BS2-ACC6",    "Accumulateur 6"),
            ("BS2-ACC7",    "Accumulateur 7"),
            ("BS2-ACC8",    "Accumulateur 8"),
            ("BS2-ACC9",    "Accumulateur 9"),
            ("BS2-AF-TBE",  "Affinage TBE"),
            ("BS2-AFF",     "Affinage"),
            ("BS2-AIR",     "Station Air Comprime"),
            ("BS2-APLEL",   "Appareils Electriques"),
            ("BS2-ATEL",    "Atelier Mecanique"),
            ("BS2-BATI",    "Batiments"),
            ("BS2-BU",      "Bureau"),
            ("BS2-CNDST",   "Conditionnement Stockage"),
            ("BS2-CO2",     "Station CO2"),
            ("BS2-CONC4",   "Concentration Effet 4"),
            ("BS2-CONC5",   "Concentration Effet 5"),
            ("BS2-CRB",     "Carbonatation"),
            ("BS2-CRIST6",  "Cristallisation 6"),
            ("BS2-CRIST8",  "Cristallisation 8"),
            ("BS2-DECO",    "Decoloration"),
            ("BS2-EVAPCO",  "Evaporation Commun"),
            ("BS2-FB",      "Filtration Bagasse"),
            ("BS2-FRD",     "Refroidissement"),
            ("BS2-FS",      "Filtration Sirop"),
            ("BS2-LDC",     "Laboratoire de Controle"),
            ("BS2-LITF",    "Lit Fluidise"),
            ("BS2-MCC",     "Centre Controle Moteurs"),
            ("BS2-NANO",    "Nano-Filtration"),
            ("BS2-RF",      "Raffinage Final"),
            ("BS2-SECH",    "Sechoir"),
            ("BS2-SEL",     "Salle Electrique"),
            ("BS2-TD-TBE",  "TBE Transfert"),
            ("BS2-TGBT",    "Tableau General Basse Tension"),
            ("BS2-TRDES",   "Transfert Deshydratation"),
            ("BS2-TRENS",   "Transfert Ensachage"),
            ("BS2-TURB6",   "Turbinage 6"),
            ("BS2-TURB8",   "Turbinage 8"),
            ("BS2-UTIL",    "Utilites BS2"),
            ("BS2-VIDE5",   "Vide 5"),
            ("BS2-VIDE6",   "Vide 6"),
            ("BS2-VIDE8",   "Vide 8"),
            ("BS2_APIHMI",  "API HMI BS2"),
            ("UFC-HYD",     "UFC Hydraulique"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BSC",
        "nom"         : "BSC - Silos et Conditionnement",
        "description" : "Silos de stockage et conditionnement sucre et matieres",
        "zones": [
            ("BEJAIA",      "Zone Bejaia"),
            ("BS2-TRDES",   "Transfert Deshydratation BS2"),
            ("BSC",         "Zone Generale BSC"),
            ("BSC-50-BAT",  "Batiment 50"),
            ("BSC-A",       "Zone A"),
            ("BSC-APLA",    "Aspirateur Ligne A"),
            ("BSC-APLB",    "Aspirateur Ligne B"),
            ("BSC-APLC",    "Aspirateur Ligne C"),
            ("BSC-APLD",    "Aspirateur Ligne D"),
            ("BSC-APLE",    "Aspirateur Ligne E"),
            ("BSC-APLF",    "Aspirateur Ligne F"),
            ("BSC-AUCLA",   "Automatisme Ligne A"),
            ("BSC-AUCLIM",  "Automatisme Climatisation"),
            ("BSC-AUDAT",   "Automatisme Donnees"),
            ("BSC-BABB7",   "Bac B7"),
            ("BSC-BABB8",   "Bac B8"),
            ("BSC-BNBB3",   "Benne B3"),
            ("BSC-N",       "Zone N"),
            ("BSC-NPCP",    "Nouveau Process Commun"),
            ("BSC-NPCR",    "Nouveau Process Creation"),
            ("BSC-NPLA",    "Nouveau Process Ligne A"),
            ("BSC-NPLB",    "Nouveau Process Ligne B"),
            ("BSC-NPLC",    "Nouveau Process Ligne C"),
            ("BSC-NPLD",    "Nouveau Process Ligne D"),
            ("BSC-NPLE",    "Nouveau Process Ligne E"),
            ("BSC-NPLF",    "Nouveau Process Ligne F"),
            ("BSC-NPLG",    "Nouveau Process Ligne G"),
            ("BSC-NPLH",    "Nouveau Process Ligne H"),
            ("BSC-NUDAT",   "Nouveau Donnees"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "BSC-A",
        "nom"         : "BSC-A - Conditionnement Sucre Zone A",
        "description" : "Conditionnement sucre zone A : lignes et aspirateurs",
        "zones": [
            ("ATL-50",      "Atelier 50"),
            ("BEJAIA",      "Zone Bejaia"),
            ("BSC-A",       "Zone A"),
            ("BSC-APLA",    "Aspirateur Ligne A"),
            ("BSC-APLB",    "Aspirateur Ligne B"),
            ("BSC-APLC",    "Aspirateur Ligne C"),
            ("BSC-APLD",    "Aspirateur Ligne D"),
            ("BSC-APLE",    "Aspirateur Ligne E"),
            ("BSC-APLF",    "Aspirateur Ligne F"),
            ("BSC-APP",     "Aspirateur Principal"),
            ("BSC-APT1",    "Aspirateur T1"),
            ("BSC-APTREM",  "Aspirateur Tremie"),
            ("BSC-AU",      "Automatisme"),
            ("BSC-AUDAT",   "Automatisme Donnees"),
        ]
    },
    {
        "code"        : "BSC-DM",
        "nom"         : "BSC-DM - Direction Maintenance Conditionnement",
        "description" : "Direction maintenance des lignes de conditionnement BSC",
        "zones": [
            ("BSC-CADAT",   "Capture Donnees"),
            ("BSC-CDBCH",   "CD BCH"),
            ("BSC-CDBU",    "CD Bureau"),
            ("BSC-CP",      "Commande Process"),
            ("BSC-CPLSG",   "Commande Ligne Sous-Groupe"),
            ("BSC-CPM1",    "Commande Process M1"),
            ("BSC-CPM2",    "Commande Process M2"),
            ("BSC-CPMV",    "Commande Process MV"),
            ("BSC-CPV1",    "Commande Process V1"),
            ("BSC-CPV2",    "Commande Process V2"),
            ("BSC-CU",      "Commande Unite"),
            ("BSC-CUCLIM",  "Commande Unite Climatisation"),
            ("BSC-CUMV",    "Commande Unite MV"),
            ("BSC-CUT",     "Commande Unite T"),
            ("BSC-NPLH",    "Nouveau Process Ligne H"),
        ]
    },
    {
        "code"        : "BSC-LSC",
        "nom"         : "BSC-LSC - Lignes Sous Controle",
        "description" : "Lignes de conditionnement sous controle BSC",
        "zones": [
            ("BSC-AIR",     "Air Comprime BSC"),
            ("BSC-NPLA",    "Nouveau Process Ligne A"),
        ]
    },
    {
        "code"        : "BSC-N",
        "nom"         : "BSC-N - Nouveau Conditionnement Sucre",
        "description" : "Nouvelles lignes de conditionnement sucre",
        "zones": [
            ("BEJAIA",      "Zone Bejaia"),
            ("BSC-BN",      "Benne N"),
            ("BSC-BNBB",    "Benne B"),
            ("BSC-BNBB1",   "Benne B1"),
            ("BSC-BNBB2",   "Benne B2"),
            ("BSC-BNBB3",   "Benne B3"),
            ("BSC-BNBB4",   "Benne B4"),
            ("BSC-CPLSG",   "Commande Ligne Sous-Groupe"),
            ("BSC-N",       "Zone N"),
            ("BSC-NDBB",    "N Double B"),
            ("BSC-NP",      "Nouveau Process"),
            ("BSC-NPCP",    "Nouveau Process Commun"),
            ("BSC-NPCR",    "Nouveau Process Creation"),
            ("BSC-NPH",     "Nouveau Process H"),
            ("BSC-NPL10K",  "Nouveau Process Ligne 10K"),
            ("BSC-NPLA",    "Nouveau Process Ligne A"),
            ("BSC-NPLB",    "Nouveau Process Ligne B"),
            ("BSC-NPLC",    "Nouveau Process Ligne C"),
            ("BSC-NPLD",    "Nouveau Process Ligne D"),
            ("BSC-NPLE",    "Nouveau Process Ligne E"),
            ("BSC-NPLF",    "Nouveau Process Ligne F"),
            ("BSC-NPLG",    "Nouveau Process Ligne G"),
            ("BSC-NPLH",    "Nouveau Process Ligne H"),
            ("BSC-NPP",     "Nouveau Process Principal"),
            ("BSC-NPROUX",  "Nouveau Process Roux"),
            ("BSC-NPTB",    "Nouveau Process TB"),
            ("BSC-NUCLA",   "Nouveau Unite Climatisation A"),
            ("BSC-NUCLIM",  "Nouveau Unite Climatisation"),
            ("BSC-NUCOM",   "Nouveau Unite Commun"),
            ("BSC-NUDEP",   "Nouveau Unite Depot"),
            ("BSC-NUNC",    "Nouveau Unite NC"),
            ("BSC-NUNIV",   "Nouveau Unite Niveaux"),
            ("BSC-NURD",    "Nouveau Unite RD"),
            ("BSC-NUSTO",   "Nouveau Unite Stockage"),
            ("BSC-NUT",     "Nouveau Unite T"),
        ]
    },
    {
        "code"        : "BSI",
        "nom"         : "BSI - Systemes Informatiques",
        "description" : "Infrastructure informatique : routeurs, switches, firewall, imprimantes",
        "zones": [
            ("BSI-DC",      "Data Center"),
            ("BSI-FIRW",    "Firewall"),
            ("BSI-IMP",     "Imprimantes"),
            ("BSI-LOG_AP",  "Logiciels Applicatifs"),
            ("BSI-ROUT",    "Routeurs"),
            ("BSI-SWIT",    "Switches"),
        ]
    },
    {
        "code"        : "BSL",
        "nom"         : "BSL - Stockage et Logistique",
        "description" : "Stockage des matieres et logistique interne",
        "zones": [
            ("BSL",         "Zone Generale BSL"),
            ("BSL-120BS",   "Silo 120 BS"),
            ("BSL-120CA",   "Silo 120 CA"),
            ("BSL-120CE",   "Silo 120 CE"),
            ("BSL-120HS",   "Silo 120 HS"),
            ("BSL-120T3",   "Silo 120 T3"),
            ("BSL-120WA",   "Silo 120 WA"),
            ("BSL-50H",     "Silo 50H"),
            ("BSL-50H-TB",  "Silo 50H TB"),
            ("BSL-ATEL",    "Atelier"),
            ("BSL-BAT",     "Batiments"),
            ("BSL-EXPO",    "Export"),
            ("BSL-GE",      "Gestion"),
            ("BSL-RQ",      "Rack"),
            ("BSL-RQ-TB",   "Rack TB"),
            ("BSL-RT1",     "Rampe de Transfert 1"),
            ("BSL-RT2",     "Rampe de Transfert 2"),
            ("BSL-RT2-TB",  "Rampe de Transfert 2 TB"),
            ("BSL-SH150",   "Silo Horizontal 150"),
            ("BSL-T4",      "Tank 4"),
            ("BSL-T4-TB",   "Tank 4 TB"),
            ("BSL_APIHMI",  "API HMI BSL"),
            ("ZZONE",       "Zone Non Definie"),
        ]
    },
    {
        "code"        : "COJEK",
        "nom"         : "COJEK - Conditionnement Jus et Ketchup",
        "description" : "Production et conditionnement jus de fruits et ketchup",
        "zones": [
            ("COJEK-PPAT",  "Process Pate"),
            ("COJEK-RB1",   "Remplissage Bulk 1"),
            ("ELKS",        "Zone Generale Elkser"),
        ]
    },
    {
        "code"        : "DEFENT",
        "nom"         : "DEFENT - Defense et Entretien",
        "description" : "Entretien general et defense des installations",
        "zones": [
            ("ZZONE", "Zone Non Definie"),
        ]
    },
    {
        "code"        : "DMC",
        "nom"         : "DMC - Direction Maintenance Centrale",
        "description" : "Direction de la maintenance centralisee",
        "zones": [
            ("BEJAIA",   "Zone Bejaia"),
            ("BEU-AIRC", "Air Comprime BEU"),
            ("ZZONE",    "Zone Non Definie"),
        ]
    },
    {
        "code"        : "DMO",
        "nom"         : "DMO - Direction Methodes Operations",
        "description" : "Direction des methodes et operations industrielles",
        "zones": [
            ("ADM R3_UMO",   "Administration R3 UMO"),
            ("ATELIER",      "Atelier"),
            ("ATL-50",       "Atelier 50"),
            ("BCH_UMO",      "BCH UMO"),
            ("BEC",          "Zone BEC"),
            ("BEU_UMO",      "BEU UMO"),
            ("BMA_UMO",      "BMA UMO"),
            ("BRH_UMO",      "BRH UMO"),
            ("BS1_UMO",      "BS1 UMO"),
            ("BS2_UMO",      "BS2 UMO"),
            ("CDS_UMO",      "CDS UMO"),
            ("CMS",          "CMS"),
            ("CONS_UMO_P",   "Consommation UMO P"),
            ("DOP_UMO",      "DOP UMO"),
            ("ELKSER_UMO",   "Elkser UMO"),
            ("SUPL CHAIN",   "Supply Chain"),
            ("UFC-BRY3",     "UFC BRY3"),
            ("UFC_UMO",      "UFC UMO"),
            ("UMO-DIV",      "Divers UMO"),
            ("USS_UMO",      "USS UMO"),
            ("ZZONE",        "Zone Non Definie"),
        ]
    },
    {
        "code"        : "ELKS",
        "nom"         : "ELKS - Elkser General",
        "description" : "Zone generale Elkser - holding condiments",
        "zones": [
            ("ELKS", "Zone Generale Elkser"),
        ]
    },
    {
        "code"        : "ELKS_DM_MO",
        "nom"         : "ELKS DM MO - Direction Maintenance Operations Elkser",
        "description" : "Direction maintenance et operations Elkser",
        "zones": [
            ("ELKS",  "Zone Generale Elkser"),
            ("ZZONE", "Zone Non Definie"),
        ]
    },
    {
        "code"        : "ELKS_DM_UT",
        "nom"         : "ELKS DM UT - Utilites Elkser",
        "description" : "Gestion des utilites Elkser : air, chaufferie, froid, gaz",
        "zones": [
            ("ELKS_UT-AC",  "Utilites Air Comprime"),
            ("ELKS_UT-CH",  "Utilites Chaufferie"),
            ("ELKS_UT-EE",  "Utilites Electrique"),
            ("ELKS_UT-FR",  "Utilites Froid"),
            ("ELKS_UT-GZ",  "Utilites Gaz"),
            ("GDSEP-DIV",   "GDSEP Divers"),
        ]
    },
    {
        "code"        : "ELKS_GDSEP",
        "nom"         : "ELKS GDSEP - Gestion Distribution Separee",
        "description" : "Gestion de la distribution separee Elkser",
        "zones": [
            ("ELKS_GDSEP",  "Zone Generale GDSEP"),
            ("GDSEP-PE",    "GDSEP Petits Emballages"),
        ]
    },
    {
        "code"        : "ELKS_HSE",
        "nom"         : "ELKS HSE - Hygiene Securite Environnement",
        "description" : "Hygiene, securite et environnement Elkser",
        "zones": [
            ("ELKS",      "Zone Generale Elkser"),
            ("ELKS_HSE",  "Zone HSE Elkser"),
            ("HSE-RI",    "HSE Risque Industriel"),
        ]
    },
    {
        "code"        : "ELKS_UAP1",
        "nom"         : "Elkser UAP1 - Conditionnement et Preparation",
        "description" : "Unite conditionnement et preparation de base condiments : Mayonnaise, Moutarde, Ketchup",
        "zones": [
            ("COJEK-BS",    "Cojek Bloc Stockage"),
            ("COJEK-PET",   "Cojek Petits Conditionnements"),
            ("ELKS_UAP1",   "Zone Generale UAP1"),
            ("ELKS_UT-CH",  "Utilites Chaufferie"),
            ("UAP1-BB-PE",  "Bloc Basique Petits Emballages"),
            ("UAP1-BB-RB",  "Bloc Basique Restauration Bulk"),
            ("UAP1-BF",     "Bloc de Fabrication"),
            ("UAP1-BF-TF",  "Bloc Fabrication Transfert"),
            ("UAP1-BS",     "Bloc de Stockage"),
            ("UAP1-BS-L1",  "Stockage Ligne 1"),
            ("UAP1-BS-L2",  "Stockage Ligne 2"),
            ("UAP1-BS-PE",  "Stockage Petits Emballages"),
            ("UAP1-BS-SL",  "Stockage Semi-Liquides"),
            ("UAP1-BSCIP",  "Bloc Services Controle Industriel"),
            ("UAP1-DIV",    "Divers UAP1"),
        ]
    },
    {
        "code"        : "ELKS_UAP2",
        "nom"         : "Elkser UAP2 - Production Sauces",
        "description" : "Coeur de production des sauces : Mayonnaise, Moutarde, Ketchup",
        "zones": [
            ("ELKS_UAP2",   "Zone Generale UAP2"),
            ("UAP2-CO-LV",  "Conditionnement Gros Volume"),
            ("UAP2-COPET",  "Conditionnement Petits Formats"),
            ("UAP2-DIV",    "Divers UAP2"),
            ("UAP2-PR-1",   "Production Ligne 1"),
            ("UAP2-PR-2",   "Production Ligne 2"),
            ("UAP2-PR-LT",  "Production Longue Traite"),
            ("UAP2-PR-LV",  "Production Gros Volume"),
            ("UAP2-PR-MT",  "Production Moyenne Traite"),
            ("UAP2-PR-ST",  "Production Courte Traite"),
            ("UAP2-PRCIP",  "Precipitation et Emulsification"),
        ]
    },
    {
        "code"        : "LLK",
        "nom"         : "LLK - Lalla Khedidja Eau Minerale",
        "description" : "Production et conditionnement eau minerale naturelle Lalla Khedidja",
        "zones": [
            ("LLK-AC",     "Aire de Captage"),
            ("LLK-AT",     "Atelier de Traitement"),
            ("LLK-BAT",    "Batiment Principal"),
            ("LLK-BT",     "Basse Tension"),
            ("LLK-BV",     "Bouteilles Verre"),
            ("LLK-CF",     "Conditionnement Froid"),
            ("LLK-CTA",    "Centrale de Traitement Air"),
            ("LLK-DIVUT",  "Divers Utilites"),
            ("LLK-EG",     "Eau Glacee"),
            ("LLK-ENG",    "Engins et Chariots"),
            ("LLK-FL",     "Filtration"),
            ("LLK-HT",     "Haute Tension"),
            ("LLK-L1",     "Ligne de Production 1"),
            ("LLK-L2",     "Ligne de Production 2"),
            ("LLK-L3",     "Ligne de Production 3"),
            ("LLK-MT",     "Moyenne Tension"),
            ("LLK-RSI",    "Reseau Securite Incendie"),
            ("LLK-SCO2",   "Station CO2"),
            ("LLK-SF",     "Soufflage Flacons"),
            ("LLK-SGAZ",   "Station Gaz"),
            ("LLK-SGPL",   "Station GPL"),
            ("LLK-STEMUL", "Station Emulsion"),
            ("LLK-TE",     "Traitement des Eaux"),
            ("LLK-USP",    "Utilites Support Production"),
            ("LLK-VAP",    "Vapeur"),
        ]
    },
    {
        "code"        : "PCG",
        "nom"         : "PCG - Poste de Controle General",
        "description" : "Poste de controle general et supervision",
        "zones": [
            ("PCG", "Zone Generale PCG"),
        ]
    },
    {
        "code"        : "SES",
        "nom"         : "SES - Services Externes et Support",
        "description" : "Services externes et support general",
        "zones": [
            ("ZZONE", "Zone Non Definie"),
        ]
    },
    {
        "code"        : "SSC",
        "nom"         : "SSC - Stockage Sucre Conditionne",
        "description" : "Stockage du sucre conditionne",
        "zones": [
            ("BSL-50H", "Silo 50H"),
        ]
    },
    {
        "code"        : "UFC",
        "nom"         : "UFC - Unite de Fractionement des Corps Gras",
        "description" : "Fractionement et traitement des corps gras : huiles et graisses",
        "zones": [
            ("UFC-ABS",    "Absorption"),
            ("UFC-ACF",    "Acide Gras"),
            ("UFC-ACO",    "Acide Oleique"),
            ("UFC-BAT",    "Batiments"),
            ("UFC-BHF",    "Bac Huile Fractionnee"),
            ("UFC-BRY2",   "BRY 2"),
            ("UFC-CDF200", "CDF 200"),
            ("UFC-CLCIN",  "Clarification Continue"),
            ("UFC-CLF",    "Clarification F"),
            ("UFC-CLF2",   "Clarification F2"),
            ("UFC-CND",    "Condenseurs"),
            ("UFC-COMB",   "Combinateur"),
            ("UFC-COMB2",  "Combinateur 2"),
            ("UFC-COMP",   "Compresseurs"),
            ("UFC-COW",    "Cow"),
            ("UFC-CRIB",   "Cristalliseur B"),
            ("UFC-CV200",  "CV 200"),
            ("UFC-DCHRG",  "Dechargeur"),
            ("UFC-DCHRG2", "Dechargeur 2"),
            ("UFC-ECHP",   "Echangeur Principal"),
            ("UFC-ECHP2",  "Echangeur Principal 2"),
            ("UFC-EE",     "Electrique"),
            ("UFC-ENG",    "Engins"),
            ("UFC-FGS",    "Filtration Gras"),
            ("UFC-FOSS",   "Fosses"),
            ("UFC-FOUR2",  "Four 2"),
            ("UFC-FU",     "Filtration Unite"),
            ("UFC-HSE",    "Hygiene Securite Environnement"),
            ("UFC-HYD",    "Hydraulique"),
            ("UFC-HYD200", "Hydraulique 200"),
            ("UFC-LU",     "Ligne Unite"),
            ("UFC-PDG",    "PDG"),
            ("UFC-PV",     "Prise Vapeur"),
            ("UFC-RC",     "Refroidissement Central"),
            ("UFC-SHDIA",  "Shdia"),
            ("UFC-SHDIA2", "Shdia 2"),
            ("UFC-SKIP",   "Skip"),
            ("UFC-SKIP2",  "Skip 2"),
            ("UFC-STK",    "Stockage"),
            ("UFC-STK2",   "Stockage 2"),
            ("UFC-STOCK",  "Stock General"),
            ("UFC-STP",    "Station Pompage"),
            ("UFC-STR",    "Structure"),
            ("UFC-UE",     "Unite Electrique"),
            ("UFC-UT",     "Utilites"),
            ("ZZONE",      "Zone Non Definie"),
        ]
    },
    {
        "code"        : "UFC_METH",
        "nom"         : "UFC Methodes",
        "description" : "Methodes et planification maintenance UFC",
        "zones": [
            ("ZZONE", "Zone Non Definie"),
        ]
    },
    {
        "code"        : "UPL_B1",
        "nom"         : "UPL B1 - Unite Production Lignes Batch 1",
        "description" : "Unite de production lignes batch 1",
        "zones": [
            ("REB-BCH",  "Rebuts BCH"),
            ("UPL-ML",   "Ligne Principale"),
        ]
    },
    {
        "code"        : "UPL_B2",
        "nom"         : "UPL B2 - Unite Production Lignes Batch 2",
        "description" : "Unite de production lignes batch 2",
        "zones": [
            ("LLK-LIP3",  "LLK LIP3"),
            ("UPL-ACB",   "ACB"),
            ("UPL-DIVB",  "Divers B"),
            ("UPL-EEB",   "Electrique B"),
            ("UPL-FRB",   "Froid B"),
            ("UPL-PP",    "Pompes Process"),
            ("UPL-SAMB",  "SAM B"),
        ]
    },
    {
        "code"        : "UPL_S",
        "nom"         : "UPL S - Unite Production Lignes Standard",
        "description" : "Unite de production lignes standard : multi-lignes huile et condiments",
        "zones": [
            ("BCH11",       "BCH Ligne 11"),
            ("LLK-LIP1",    "LLK LIP1"),
            ("LLK-LIP3",    "LLK LIP3"),
            ("LLK-LIP4",    "LLK LIP4"),
            ("REB-BCH",     "Rebuts BCH"),
            ("UPL-ACTO",    "ACTO"),
            ("UPL-ML",      "Ligne Principale"),
            ("UPL-PI",      "PI"),
            ("UPL-RB",      "RB"),
            ("UPL-SCV",     "SCV"),
            ("UPL_B1",      "UPL B1"),
            ("UPL_S-AC",    "Air Comprime"),
            ("UPL_S-DIV",   "Divers"),
            ("UPL_S-EE",    "Electrique"),
            ("UPL_S-FR",    "Froid"),
            ("UPL_S-LI 6",  "Ligne 6"),
            ("UPL_S-LI 7",  "Ligne 7"),
            ("UPL_S-LI 8",  "Ligne 8"),
            ("UPL_S-LI 9",  "Ligne 9"),
            ("UPL_S-LI1",   "Ligne 1"),
            ("UPL_S-LI1K",  "Ligne 1K"),
            ("UPL_S-LI2",   "Ligne 2"),
            ("UPL_S-LI2B",  "Ligne 2B"),
            ("UPL_S-LI2K",  "Ligne 2K"),
            ("UPL_S-LI3",   "Ligne 3"),
            ("UPL_S-LI3B",  "Ligne 3B"),
            ("UPL_S-LI4",   "Ligne 4"),
            ("UPL_S-LI4B",  "Ligne 4B"),
            ("UPL_S-LI4K",  "Ligne 4K"),
            ("UPL_S-LI5",   "Ligne 5"),
            ("UPL_S-LI5B",  "Ligne 5B"),
            ("UPL_S-LI6B",  "Ligne 6B"),
            ("UPL_S-ML",    "Ligne Principale"),
            ("UPL_S-PR",    "Process"),
            ("UPL_S-SAM",   "SAM"),
        ]
    },
    {
        "code"        : "UPL_TO1",
        "nom"         : "UPL TO1 - Unite Production Tomate 1",
        "description" : "Unite de production tomate 1 : transformation et conditionnement",
        "zones": [
            ("LLK-ACPL",    "LLK ACPL"),
            ("UPL-ACTO",    "ACTO"),
            ("UPL-BN",      "BN"),
            ("UPL-BTPTO",   "BTP Tomate"),
            ("UPL-BV",      "BV"),
            ("UPL-DIVTO",   "Divers Tomate"),
            ("UPL-EETO",    "Electrique Tomate"),
            ("UPL-ENGTO",   "Engins Tomate"),
            ("UPL-FRTO",    "Froid Tomate"),
            ("UPL-LASS",    "LASS"),
            ("UPL-ML",      "Ligne Principale"),
            ("UPL-PI",      "PI"),
            ("UPL-PP",      "Pompes Process"),
            ("UPL-PRTO",    "Process Tomate"),
            ("UPL-RB",      "RB"),
            ("UPL-SAMTO",   "SAM Tomate"),
            ("UPL-SCV",     "SCV"),
            ("UPL_S-LI6B",  "Ligne 6B"),
        ]
    },
    {
        "code"        : "UPL_TO2",
        "nom"         : "UPL TO2 - Unite Production Tomate 2",
        "description" : "Unite de production tomate 2 : lignes supplementaires",
        "zones": [
            ("LLK-ACPL",    "LLK ACPL"),
            ("LLK-DIVPL",   "LLK Divers"),
            ("LLK-DIVUT",   "LLK Divers Utilites"),
            ("LLK-EGPL",    "LLK EG"),
            ("LLK-LIP",     "LLK LIP"),
            ("LLK-LIP1",    "LLK LIP1"),
            ("UPL-ACTO",    "ACTO"),
            ("UPL_S-LI 6",  "Ligne 6"),
            ("UPL_S-LI1K",  "Ligne 1K"),
            ("UPL_S-LI5",   "Ligne 5"),
        ]
    },
]


def run():
    print("=" * 60)
    print("SEED - Tous les Poles et Zones Cevital")
    print("=" * 60)
    print()

    db = SessionLocal()
    try:
        total_poles = 0
        total_zones = 0

        for pole_data in POLES_DATA:
            code = pole_data["code"]
            nom  = pole_data["nom"]

            existant = db.query(Pole).filter(
                Pole.code_pole == code
            ).first()

            if existant:
                print("[INFO] Pole deja existant : [" + code + "] " + nom)
                pole_obj = existant
                if not existant.description:
                    existant.description = pole_data["description"]
                    db.commit()
            else:
                pole_obj = Pole(
                    code_pole   = code,
                    nom_pole    = nom,
                    description = pole_data["description"],
                )
                db.add(pole_obj)
                db.flush()

                for nom_eq in [
                    "Equipe Alpha", "Equipe Bravo",
                    "Equipe Charlie", "Equipe Delta"
                ]:
                    eq = Equipe(nom_equipe=nom_eq, id_pole=pole_obj.id_pole)
                    db.add(eq)

                db.commit()
                db.refresh(pole_obj)
                total_poles += 1
                print("[OK] Pole cree : [" + code + "] " + nom)

            nb_zones_crees = 0
            for code_zone, _nom_zone in pole_data["zones"]:
                existante = db.query(Zone).filter_by(
                    code_zone = code_zone,
                    id_pole   = pole_obj.id_pole
                ).first()

                if not existante:
                    zone = Zone(
                        code_zone = code_zone,
                        id_pole   = pole_obj.id_pole,
                    )
                    db.add(zone)
                    nb_zones_crees += 1
                    total_zones += 1

            db.commit()
            print("    " + str(nb_zones_crees) + " zone(s) creee(s) / " + str(len(pole_data["zones"])) + " au total")
            print()

        print("=" * 60)
        print("SEED TERMINE")
        print("=" * 60)
        print("Poles crees  : " + str(total_poles))
        print("Zones creees : " + str(total_zones))
        print()
        print("Etat de la base :")
        print("  Total Poles : " + str(db.query(Pole).count()))
        print("  Total Zones : " + str(db.query(Zone).count()))
        print("=" * 60)

    except Exception as e:
        db.rollback()
        import traceback
        print("ERREUR : " + str(e))
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run()