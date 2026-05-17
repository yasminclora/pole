from pydantic import BaseModel
from datetime import datetime


class ModeleMLRead(BaseModel):
    id_modele     : int
    version       : str
    type_modele   : str
    nom           : str
    description   : str | None = None
    path_keras    : str
    path_scaler_x : str
    path_scaler_y : str
    is_active     : bool
    uploaded_by   : int
    uploaded_at   : datetime

    class Config:
        from_attributes = True
