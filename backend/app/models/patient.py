from sqlalchemy import Column, Integer, String, Date, DateTime
from sqlalchemy.sql import func

from app.database import Base


class Patient(Base):

    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), nullable=False)

    date_of_birth = Column(Date, nullable=False)

    gender = Column(String(20), nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )