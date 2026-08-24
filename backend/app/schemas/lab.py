from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


# ==========================================
# LAB RESULT
# ==========================================

class LabResultCreate(BaseModel):

    component_name: str

    component_code: Optional[str] = None

    value_numeric: Optional[float] = None

    value_text: Optional[str] = None

    unit: Optional[str] = None

    reference_range_low: Optional[float] = None

    reference_range_high: Optional[float] = None

    reference_range_text: Optional[str] = None

    flag: Optional[str] = None


class LabResultResponse(BaseModel):

    id: int

    lab_report_id: int

    component_name: str

    component_code: Optional[str]

    value_numeric: Optional[float]

    value_text: Optional[str]

    unit: Optional[str]

    reference_range_low: Optional[float]

    reference_range_high: Optional[float]

    reference_range_text: Optional[str]

    flag: Optional[str]

    class Config:

        from_attributes = True


# ==========================================
# LAB REPORT
# ==========================================

class LabReportCreate(BaseModel):

    patient_id: int

    report_date: Optional[date] = None

    report_type: Optional[str] = None

    laboratory_name: Optional[str] = None

    file_name: Optional[str] = None


class LabReportResponse(BaseModel):

    id: int

    patient_id: int

    report_date: Optional[date]

    report_type: Optional[str]

    laboratory_name: Optional[str]

    file_name: Optional[str]

    uploaded_at: Optional[datetime]

    class Config:

        from_attributes = True