from pydantic import BaseModel, field_validator
from datetime import date
from models.user import RoleEnum, GenreEnum

class UserCreate(BaseModel):
    nom            : str
    prenom         : str
    genre          : GenreEnum
    date_naissance : date
    date_embauche  : date
    telephone      : str | None = None
    role           : RoleEnum
    id_pole        : int | None = None
    id_equipe      : int | None = None

    @field_validator('date_naissance')
    def valider_naissance(cls, v):
        if v.year > 2006:
            raise ValueError('Doit avoir au moins 20 ans')
        return v

    @field_validator('date_embauche')
    def valider_embauche(cls, v):
        if v >= date.today():
            raise ValueError("Doit être antérieure à aujourd'hui")
        return v

class UserUpdate(BaseModel):
    nom            : str | None = None
    prenom         : str | None = None
    genre          : GenreEnum | None = None
    date_naissance : date | None = None
    date_embauche  : date | None = None
    telephone      : str | None = None
    role           : RoleEnum | None = None
    id_pole        : int | None = None
    id_equipe      : int | None = None

class UserRead(BaseModel):
    id_user        : int
    nom            : str
    prenom         : str
    email          : str
    identifiant    : str
    role           : str
    genre          : str
    date_naissance : str
    date_embauche  : str
    telephone      : str | None = None
    id_pole        : int | None = None
    id_equipe      : int | None = None
    nom_pole       : str | None = None
    nom_equipe     : str | None = None

    class Config:
        from_attributes = True