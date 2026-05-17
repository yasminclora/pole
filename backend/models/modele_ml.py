from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from database import Base
import enum


class TypeModeleEnum(str, enum.Enum):
    LSTM = "LSTM"
    GRU  = "GRU"


class ModeleML(Base):
    __tablename__ = "modeles_ml"

    id_modele      = Column(Integer, primary_key=True, index=True)
    version        = Column(String(50),  unique=True, nullable=False)
    type_modele    = Column(Enum(TypeModeleEnum), nullable=False)
    nom            = Column(String(200), nullable=False)
    description    = Column(Text,        nullable=True)

    path_keras     = Column(String(500), nullable=False)
    path_scaler_x  = Column(String(500), nullable=False)
    path_scaler_y  = Column(String(500), nullable=False)

    is_active      = Column(Boolean, nullable=False, default=False)

    uploaded_by    = Column(Integer, ForeignKey("utilisateurs.id_user"), nullable=False)
    uploaded_at    = Column(DateTime, server_default=func.now(), nullable=False)
