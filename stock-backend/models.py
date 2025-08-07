from sqlalchemy import Column, String, Integer
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)      # Firebase UID
    email = Column(String, unique=True, index=True)
    credits = Column(Integer, default=10)


