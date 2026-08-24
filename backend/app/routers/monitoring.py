from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.monitoring import MonitoringRecord
from app.schemas.monitoring import (
    MonitoringCreate,
    MonitoringResponse
)


router = APIRouter(
    prefix="/monitoring",
    tags=["Monitoring"]
)


def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# --------------------------------
# Create Monitoring Record
# --------------------------------

@router.post(
    "/",
    response_model=MonitoringResponse
)
def create_monitoring_record(
    record: MonitoringCreate,
    db: Session = Depends(get_db)
):

    new_record = MonitoringRecord(
        patient_id=record.patient_id,
        time=record.time,
        bp=record.bp,
        oxygen=record.oxygen,
        pulse=record.pulse,
        temperature=record.temperature,
        glucose=record.glucose,
        urine_output=record.urine_output,
        food_name=record.food_name,
        medicine_given=record.medicine_given
    )

    db.add(new_record)

    db.commit()

    db.refresh(new_record)

    return new_record


# --------------------------------
# Get Monitoring Records
# --------------------------------

@router.get(
    "/patient/{patient_id}",
    response_model=list[MonitoringResponse]
)
def get_patient_monitoring_records(
    patient_id: int,
    db: Session = Depends(get_db)
):

    records = (
        db.query(MonitoringRecord)
        .filter(
            MonitoringRecord.patient_id == patient_id
        )
        .order_by(
            MonitoringRecord.time.desc()
        )
        .all()
    )

    return records

# --------------------------------
# Get One Monitoring Record
# --------------------------------

@router.get(
    "/{record_id}",
    response_model=MonitoringResponse
)
def get_monitoring_record(
    record_id: int,
    db: Session = Depends(get_db)
):

    record = (
        db.query(MonitoringRecord)
        .filter(
            MonitoringRecord.id == record_id
        )
        .first()
    )

    if not record:

        raise HTTPException(
            status_code=404,
            detail="Monitoring record not found"
        )

    return record