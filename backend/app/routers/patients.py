from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientResponse


router = APIRouter(
    prefix="/patients",
    tags=["Patients"]
)


def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


@router.post(
    "/",
    response_model=PatientResponse
)
def create_patient(
    patient: PatientCreate,
    db: Session = Depends(get_db)
):

    new_patient = Patient(
        name=patient.name,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender
    )

    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)

    return new_patient


@router.get(
    "/{patient_id}",
    response_model=PatientResponse
)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db)
):

    patient = db.query(Patient).filter(
        Patient.id == patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found"
        )

    return patient