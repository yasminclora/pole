from pydantic import BaseModel, field_validator
from datetime import date
from typing import Optional, List
from models.machine import StatutMachine

# ── Composante ──────────────────────────────────────────────────────

class ComposanteCreate(BaseModel):
    equipment_code : str
    description    : str
    install_date   : Optional[date] = None
    category       : Optional[str]  = None
    statut         : StatutMachine  = StatutMachine.NORMAL

class ComposanteRead(BaseModel):
    id_composante  : int
    equipment_code : str
    description    : str
    install_date   : Optional[date] = None
    category       : Optional[str]  = None
    statut         : str
    id_machine     : int

    class Config:
        from_attributes = True

# ── Machine ─────────────────────────────────────────────────────────

class MachineCreate(BaseModel):
    equipment_code : str
    description    : str
    install_date   : Optional[date] = None
    category       : Optional[str]  = None
    statut         : StatutMachine  = StatutMachine.NORMAL
    id_pole        : int
    id_zone        : int
    composantes    : List[ComposanteCreate] = []

    @field_validator('equipment_code')
    def code_non_vide(cls, v):
        if not v.strip():
            raise ValueError('Le code équipement est obligatoire')
        return v.strip().upper()

class MachineUpdate(BaseModel):
    description  : Optional[str]          = None
    install_date : Optional[date]          = None
    category     : Optional[str]           = None
    statut       : Optional[StatutMachine] = None
    id_zone      : Optional[int]           = None

class MachineRead(BaseModel):
    id_machine     : int
    equipment_code : str
    description    : str
    install_date   : Optional[date] = None
    category       : Optional[str]  = None
    statut         : str
    id_pole        : int
    id_zone        : int
    nom_pole       : Optional[str]  = None
    nom_zone       : Optional[str]  = None
    nb_composantes : int            = 0

    class Config:
        from_attributes = True

class MachineDetail(MachineRead):
    composantes : List[ComposanteRead] = []

# ── Zone ─────────────────────────────────────────────────────────────

class ZoneCreate(BaseModel):
    code_zone : str
    id_pole   : int

class ZoneRead(BaseModel):
    id_zone   : int
    code_zone : str
    id_pole   : int
    nom_pole  : Optional[str] = None

    class Config:
        from_attributes = True