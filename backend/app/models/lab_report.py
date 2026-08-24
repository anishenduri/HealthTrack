from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class LabReport(Base):

    __tablename__ = "lab_reports"

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

    report_date = Column(
        Date,
        nullable=True
    )

    report_type = Column(
        String(100),
        nullable=True
    )

    laboratory_name = Column(
        String(200),
        nullable=True
    )

    file_name = Column(
        String(300),
        nullable=True
    )

    uploaded_at = Column(
        DateTime,
        server_default=func.now()
    )