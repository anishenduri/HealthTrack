from datetime import date, datetime
from statistics import mean

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.patient import Patient
from app.models.monitoring import MonitoringRecord
from app.models.lab_report import LabReport
from app.models.lab_result import LabResult
from app.services.chatbot_service import generate_chatbot_response


router = APIRouter(
    prefix="/chatbot",
    tags=["Health Assistant"]
)


# ============================================================
# REQUEST SCHEMA
# ============================================================

class ChatRequest(BaseModel):
    patient_id: int
    question: str


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_average(values):
    valid_values = [
        value for value in values
        if value is not None
    ]

    if not valid_values:
        return None

    return round(mean(valid_values), 2)


def format_value(value):
    if value is None:
        return "Not recorded"

    return str(value)


# ============================================================
# CHATBOT ENDPOINT
# ============================================================

@router.post("/ask")
def ask_health_assistant(
    request: ChatRequest,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # 1. Validate question
    # --------------------------------------------------------

    question = request.question.strip()

    if not question:

        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )


    # --------------------------------------------------------
    # 2. Find patient
    # --------------------------------------------------------

    patient = (
        db.query(Patient)
        .filter(
            Patient.id == request.patient_id
        )
        .first()
    )

    if not patient:

        raise HTTPException(
            status_code=404,
            detail="Patient not found"
        )


    # --------------------------------------------------------
    # 3. Get monitoring records
    # --------------------------------------------------------

    monitoring_records = (
        db.query(MonitoringRecord)
        .filter(
            MonitoringRecord.patient_id
            == request.patient_id
        )
        .order_by(
            MonitoringRecord.time.desc()
        )
        .limit(200)
        .all()
    )


    # --------------------------------------------------------
    # 4. Today's monitoring records
    # --------------------------------------------------------

    today = date.today()

    today_records = []

    for record in monitoring_records:

        if record.time:

            record_date = record.time.date()

            if record_date == today:
                today_records.append(record)


    # --------------------------------------------------------
    # 5. Calculate today's averages
    # --------------------------------------------------------

    today_average_pulse = calculate_average(
        [
            record.pulse
            for record in today_records
        ]
    )

    today_average_oxygen = calculate_average(
        [
            record.oxygen
            for record in today_records
        ]
    )

    today_average_temperature = calculate_average(
        [
            record.temperature
            for record in today_records
        ]
    )

    today_average_glucose = calculate_average(
        [
            record.glucose
            for record in today_records
        ]
    )

    today_average_urine = calculate_average(
        [
            record.urine_output
            for record in today_records
        ]
    )


    # --------------------------------------------------------
    # 6. Get lab reports
    # --------------------------------------------------------

    lab_reports = (
        db.query(LabReport)
        .filter(
            LabReport.patient_id
            == request.patient_id
        )
        .order_by(
            LabReport.report_date.desc()
        )
        .limit(100)
        .all()
    )


    # --------------------------------------------------------
    # 7. Build laboratory context
    # --------------------------------------------------------

    lab_context = []

    for report in lab_reports:

        results = (
            db.query(LabResult)
            .filter(
                LabResult.lab_report_id
                == report.id
            )
            .all()
        )

        for result in results:

            lab_context.append({

                "report_date":
                    str(report.report_date)
                    if report.report_date
                    else None,

                "component":
                    result.component_name,

                "value":
                    result.value_numeric
                    if result.value_numeric is not None
                    else result.value_text,

                "unit":
                    result.unit,

                "reference_range":
                    result.reference_range_text,

                "flag":
                    result.flag
            })


    # --------------------------------------------------------
    # 8. Build monitoring context
    # --------------------------------------------------------

    monitoring_context = []

    for record in monitoring_records:

        monitoring_context.append({

            "date":
                str(record.time.date())
                if record.time
                else None,

            "time":
                str(record.time.time())
                if record.time
                else None,

            "blood_pressure":
                record.bp,

            "oxygen":
                record.oxygen,

            "pulse":
                record.pulse,

            "temperature":
                record.temperature,

            "glucose":
                record.glucose,

            "urine_output":
                record.urine_output,

            "food":
                record.food_name,

            "medicine":
                record.medicine_given
        })


    # --------------------------------------------------------
    # 9. Build complete patient context
    # --------------------------------------------------------

    patient_context = f"""
PATIENT INFORMATION
-------------------
Patient ID: {patient.id}
Patient Name: {patient.name}
Date of Birth: {patient.date_of_birth}
Gender: {patient.gender}

CURRENT DATE
------------
{today}

TODAY'S MONITORING SUMMARY
--------------------------
Number of monitoring records today:
{len(today_records)}

Average Pulse:
{format_value(today_average_pulse)}

Average Oxygen Saturation:
{format_value(today_average_oxygen)}

Average Temperature:
{format_value(today_average_temperature)}

Average Blood Glucose:
{format_value(today_average_glucose)}

Average Urine Output:
{format_value(today_average_urine)}

TODAY'S MONITORING RECORDS
--------------------------
{today_records}

HISTORICAL MONITORING DATA
--------------------------
{monitoring_context}

LABORATORY RESULTS
------------------
{lab_context}
"""


    # --------------------------------------------------------
    # 10. Ask Gemini
    # --------------------------------------------------------

    try:

        answer = generate_chatbot_response(
            question=question,
            patient_context=patient_context
        )

    except Exception as e:

        

        print("\n==========================================")
        print("HEALTH ASSISTANT ERROR")
        print("==========================================")
        print(type(e).__name__)
        print(str(e))
        print("==========================================\n")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    # --------------------------------------------------------
    # 11. Return response
    # --------------------------------------------------------

    return {
        "status": "success",
        "patient_id": patient.id,
        "patient_name": patient.name,
        "question": question,
        "answer": answer
    }