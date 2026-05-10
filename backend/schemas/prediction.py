from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class ModeleType(str, Enum):
    LSTM = "LSTM"
    GRU = "GRU"


class PredictionResult(BaseModel):
    equipment_code: str
    description: Optional[str] = None
    equipment_level: Optional[int] = None
    machine_racine: Optional[str] = None
    rul_jours: Optional[int] = None
    date_panne_prevue: Optional[date] = None
    criticite: Optional[str] = None
    confiance: str
    mode: str
    mtbf_moyen: Optional[float] = None
    derniere_panne: Optional[date] = None
    cout_moyen: Optional[float] = None
    stock_status: Optional[str] = None
    stock_piece: Optional[str] = None


class PredictionListItem(BaseModel):
    id_prediction: int
    equipment_code: str
    description: Optional[str] = None
    equipment_level: Optional[int] = None
    machine_racine: Optional[str] = None
    rul_jours: Optional[int] = None
    date_panne_prevue: Optional[date] = None
    criticite: Optional[str] = None
    confiance: Optional[str] = None
    mode: Optional[str] = None
    mtbf_moyen: Optional[float] = None
    cout_moyen: Optional[float] = None
    stock_status: Optional[str] = None
    statut: str
    id_ot_genere: Optional[int] = None


class PredictionDetail(BaseModel):
    equipment_code: str
    description: Optional[str] = None
    equipment_level: Optional[int] = None
    machine_racine: Optional[str] = None
    rul_jours: Optional[int] = None
    date_panne_prevue: Optional[date] = None
    criticite: Optional[str] = None
    confiance: str
    mode: str
    mtbf_moyen: Optional[float] = None
    derniere_panne: Optional[date] = None
    cout_moyen: Optional[float] = None
    stock_status: Optional[str] = None
    stock_piece: Optional[str] = None
    dernieres_pannes: List[dict] = []
    mtbf_par_annee: List[dict] = []


class PredictionRunResponse(BaseModel):
    total: int
    critiques: int
    attention: int
    sains: int
    insuffisants_count: int
    predictions: List[PredictionResult]
    donnees_insuffisantes: List[dict]


class PredictionListResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    predictions: List[PredictionListItem]


class CreateOTResponse(BaseModel):
    message: str
    id_ot: int
    numero_ot: str
    id_prediction: int
    priorite: str
    classe: str
    date_prevue: Optional[date] = None


class MembreGroupe(BaseModel):
    id_user: int
    nom: str
    prenom: str
    role_groupe: str


class GroupeDisponible(BaseModel):
    id_groupe: int
    nom_groupe: str
    quart: Optional[str] = None
    membres: List[MembreGroupe]


class DisponibilitesResponse(BaseModel):
    date: str
    id_pole: int
    classe: str
    groupes: List[GroupeDisponible]


class AssignerOTResponse(BaseModel):
    message: str
    id_ot: int
    id_assigne: int
    nom_assigne: str
    statut: str
    date_assignation: str
