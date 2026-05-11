from pydantic import BaseModel

class EquipeRead(BaseModel):
    id_equipe  : int
    nom_equipe : str
    id_pole    : int
    a_chef     : bool = False

    class Config:
        from_attributes = True