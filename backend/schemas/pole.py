from pydantic import BaseModel

class PoleCreate(BaseModel):
    nom_pole    : str
    description : str | None = None

class PoleRead(BaseModel):
    id_pole     : int
    nom_pole    : str
    description : str | None = None

    class Config:
        from_attributes = True