from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PatientCreate(BaseModel):

    name: str
    date_of_birth: date
    gender: str


class PatientResponse(BaseModel):

    id: int
    name: str
    date_of_birth: date
    gender: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)