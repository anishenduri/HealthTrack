from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class MonitoringRecord(Base):

    __tablename__ = "monitoring_records"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False
    )

    time = Column(
        DateTime,
        nullable=True
    )

    bp = Column(
        String(20),
        nullable=True
    )

    oxygen = Column(
        Float,
        nullable=True
    )

    pulse = Column(
        Float,
        nullable=True
    )

    temperature = Column(
        Float,
        nullable=True
    )

    glucose = Column(
        Float,
        nullable=True
    )

    urine_output = Column(
        Float,
        nullable=True
    )

    food_name = Column(
        String(200),
        nullable=True
    )

    medicine_given = Column(
        String(300),
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )