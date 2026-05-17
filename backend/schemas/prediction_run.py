from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


class PredictionResultatRead(BaseModel):
    id_resultat:       int
    equipment_code:    str
    equipment_desc:    Optional[str]
    system_equipment:  Optional[str]
    pole:              Optional[str]
    zone:              Optional[str] = None
    comp_level:        Optional[int]
    rul_jours:         int
    statut:            str
    date_panne_prevue: Optional[date]
    confiance_pct:     Optional[int]
    source:            str
    stock_disponible:  Optional[int]
    alerte_stock:      Optional[str]

    class Config:
        from_attributes = True


class PredictionRunRead(BaseModel):
    id_run:          int
    id_modele:       int
    id_user:         int
    pole:            Optional[str]
    statut:          str
    nb_composants:   Optional[int]
    nb_critiques:    Optional[int]
    nb_urgents:      Optional[int]
    nb_surveillance: Optional[int]
    nb_ok:           Optional[int]
    duree_ms:        Optional[int]
    launched_at:     datetime
    finished_at:     Optional[datetime]
    resultats:       List[PredictionResultatRead] = []

    class Config:
        from_attributes = True


class PredictionRunSummary(BaseModel):
    """Version allégée sans la liste complète des résultats."""
    id_run:          int
    id_modele:       int
    pole:            Optional[str]
    statut:          str
    nb_composants:   Optional[int]
    nb_critiques:    Optional[int]
    nb_urgents:      Optional[int]
    nb_surveillance: Optional[int]
    nb_ok:           Optional[int]
    duree_ms:        Optional[int]
    launched_at:     datetime
    finished_at:     Optional[datetime]

    class Config:
        from_attributes = True


class LancerPredictionRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_type: Optional[str] = None   # "GRU" | "LSTM" — si None: utilise le modèle actif
