from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MonitoringCreate(BaseModel):

    patient_id: int

    time: Optional[datetime] = None

    bp: Optional[str] = None

    oxygen: Optional[float] = None

    pulse: Optional[float] = None

    temperature: Optional[float] = None

    glucose: Optional[float] = None

    urine_output: Optional[float] = None

    food_name: Optional[str] = None

    medicine_given: Optional[str] = None


class MonitoringResponse(BaseModel):

    id: int

    patient_id: int

    time: Optional[datetime] = None

    bp: Optional[str] = None

    oxygen: Optional[float] = None

    pulse: Optional[float] = None

    temperature: Optional[float] = None

    glucose: Optional[float] = None

    urine_output: Optional[float] = None

    food_name: Optional[str] = None

    medicine_given: Optional[str] = None

    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True