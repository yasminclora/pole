from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Zone(Base):
    __tablename__ = "zones"

    id_zone   = Column(Integer, primary_key=True, index=True)
    code_zone = Column(String(50), nullable=False)
    id_pole   = Column(Integer, ForeignKey("poles.id_pole"), nullable=False)

    pole     = relationship("Pole", back_populates="zones")
