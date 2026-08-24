from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey
)

from app.database import Base


class LabResult(Base):

    __tablename__ = "lab_results"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    lab_report_id = Column(
        Integer,
        ForeignKey("lab_reports.id"),
        nullable=False
    )

    component_name = Column(
        String(200),
        nullable=False
    )

    component_code = Column(
        String(100),
        nullable=True
    )

    value_numeric = Column(
        Float,
        nullable=True
    )

    value_text = Column(
        String(300),
        nullable=True
    )

    unit = Column(
        String(100),
        nullable=True
    )

    reference_range_low = Column(
        Float,
        nullable=True
    )

    reference_range_high = Column(
        Float,
        nullable=True
    )

    reference_range_text = Column(
        String(200),
        nullable=True
    )

    flag = Column(
        String(50),
        nullable=True
    )