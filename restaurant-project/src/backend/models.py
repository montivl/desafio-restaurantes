from sqlalchemy import Boolean, Column, Float, Integer, String, Text
from database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String,  nullable=False)
    type      = Column(String,  nullable=False)
    schedule  = Column(String,  nullable=False)
    location  = Column(String,  nullable=False)
    category  = Column(String,  nullable=False)
    rate      = Column(Float,   nullable=True)
    visited   = Column(Boolean, default=False, nullable=False)
    image_url = Column(Text, nullable=True)