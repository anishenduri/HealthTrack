from pathlib import Path
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File
)

import os
import shutil

from sqlalchemy.orm import Session

from app.database import SessionLocal

from app.models.lab_report import LabReport
from app.models.lab_result import LabResult

from app.schemas.lab import (
    LabReportCreate,
    LabReportResponse,
    LabResultCreate,
    LabResultResponse
)

from app.services.lab_extractor import extract_text_from_pdf
from app.services.gemini_service import extract_lab_data


router = APIRouter(
    prefix="/labs",
    tags=["Lab Reports"]
)


# ==========================================
# DATABASE DEPENDENCY
# ==========================================

def get_db():

    db = SessionLocal()

    try:

        yield db

    finally:

        db.close()


# ==========================================
# CREATE LAB REPORT
# ==========================================

@router.post(
    "/reports",
    response_model=LabReportResponse
)
def create_lab_report(
    report: LabReportCreate,
    db: Session = Depends(get_db)
):

    new_report = LabReport(

        patient_id=report.patient_id,

        report_date=report.report_date,

        report_type=report.report_type,

        laboratory_name=report.laboratory_name,

        file_name=report.file_name

    )

    db.add(new_report)

    db.commit()

    db.refresh(new_report)

    return new_report


# ==========================================
# ADD RESULT TO LAB REPORT
# ==========================================

@router.post(
    "/reports/{report_id}/results",
    response_model=LabResultResponse
)
def add_lab_result(
    report_id: int,
    result: LabResultCreate,
    db: Session = Depends(get_db)
):

    report = (
        db.query(LabReport)
        .filter(
            LabReport.id == report_id
        )
        .first()
    )

    if not report:

        raise HTTPException(
            status_code=404,
            detail="Lab report not found"
        )


    new_result = LabResult(

        lab_report_id=report_id,

        component_name=result.component_name,

        component_code=result.component_code,

        value_numeric=result.value_numeric,

        value_text=result.value_text,

        unit=result.unit,

        reference_range_low=result.reference_range_low,

        reference_range_high=result.reference_range_high,

        reference_range_text=result.reference_range_text,

        flag=result.flag

    )

    db.add(new_result)

    db.commit()

    db.refresh(new_result)

    return new_result


# ==========================================
# GET PATIENT LAB REPORTS
# ==========================================

@router.get(
    "/patient/{patient_id}",
    response_model=list[LabReportResponse]
)
def get_patient_lab_reports(
    patient_id: int,
    db: Session = Depends(get_db)
):

    reports = (

        db.query(LabReport)

        .filter(
            LabReport.patient_id == patient_id
        )

        .order_by(
            LabReport.report_date.desc()
        )

        .all()

    )

    return reports


# ==========================================
# GET RESULTS OF A REPORT
# ==========================================

@router.get(
    "/reports/{report_id}/results",
    response_model=list[LabResultResponse]
)
def get_lab_results(
    report_id: int,
    db: Session = Depends(get_db)
):

    results = (

        db.query(LabResult)

        .filter(
            LabResult.lab_report_id == report_id
        )

        .all()

    )

    return results


# ==========================================
# UPLOAD LAB REPORT FILE
# ==========================================

@router.post(
    "/reports/{report_id}/upload"
)
def upload_lab_report(
    report_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    # --------------------------------------
    # Check whether report exists
    # --------------------------------------

    report = (
        db.query(LabReport)
        .filter(
            LabReport.id == report_id
        )
        .first()
    )

    if not report:

        raise HTTPException(
            status_code=404,
            detail="Lab report not found"
        )


    # --------------------------------------
    # Allowed file types
    # --------------------------------------

    allowed_extensions = [
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png"
    ]


    extension = os.path.splitext(
        file.filename
    )[1].lower()


    if extension not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only PDF, JPG, JPEG and PNG "
                "files are allowed"
            )
        )


    # --------------------------------------
    # Create uploads folder
    # --------------------------------------

    upload_directory = "uploads"

    os.makedirs(
        upload_directory,
        exist_ok=True
    )


    # --------------------------------------
    # Create unique filename
    # --------------------------------------

    saved_filename = (
        f"report_{report_id}{extension}"
    )


    file_path = os.path.join(
        upload_directory,
        saved_filename
    )


    # --------------------------------------
    # Save file
    # --------------------------------------

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )


    # --------------------------------------
    # Update database
    # --------------------------------------

    report.file_name = saved_filename

    db.commit()

    db.refresh(report)


    return {

        "status": "success",

        "message":
            "Lab report uploaded successfully",

        "report_id":
            report_id,

        "file_name":
            saved_filename,

        "file_path":
            file_path

    }


# ==========================================
# EXTRACT TEXT FROM LAB REPORT
# ==========================================

@router.get(
    "/reports/{report_id}/extract-text"
)
def extract_lab_report_text(
    report_id: int,
    db: Session = Depends(get_db)
):

    report = (
        db.query(LabReport)
        .filter(
            LabReport.id == report_id
        )
        .first()
    )


    if not report:

        raise HTTPException(
            status_code=404,
            detail="Lab report not found"
        )


    if not report.file_name:

        raise HTTPException(
            status_code=400,
            detail="No file uploaded for this report"
        )


    file_path = os.path.join(
        "uploads",
        report.file_name
    )


    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="Uploaded file not found"
        )


    extension = Path(
        file_path
    ).suffix.lower()


    # --------------------------------------
    # PDF text extraction
    # --------------------------------------

    if extension == ".pdf":

        extracted_text = (
            extract_text_from_pdf(
                file_path
            )
        )


        return {

            "status": "success",

            "file_type": "pdf",

            "text": extracted_text

        }


    # --------------------------------------
    # Images are handled by Gemini
    # --------------------------------------

    return {

        "status": "success",

        "message":
            "Image file detected. "
            "Use the analyze endpoint for "
            "AI extraction.",

        "file_type": extension

    }


# ==========================================
# ANALYZE LAB REPORT WITH GEMINI
# ==========================================

@router.post(
    "/reports/{report_id}/analyze"
)
def analyze_lab_report(
    report_id: int,
    db: Session = Depends(get_db)
):

    # --------------------------------------
    # 1. Find lab report
    # --------------------------------------

    report = (
        db.query(LabReport)
        .filter(
            LabReport.id == report_id
        )
        .first()
    )


    if not report:

        raise HTTPException(
            status_code=404,
            detail="Lab report not found"
        )


    # --------------------------------------
    # 2. Check uploaded file
    # --------------------------------------

    if not report.file_name:

        raise HTTPException(
            status_code=400,
            detail="No file uploaded for this report"
        )


    file_path = os.path.join(
        "uploads",
        report.file_name
    )


    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="Uploaded file not found"
        )


    # --------------------------------------
    # 3. Send report to Gemini
    # --------------------------------------

    try:

        data = extract_lab_data(
            file_path
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Gemini analysis failed: {str(e)}"
            )
        )


    # --------------------------------------
    # 4. Update lab report information
    # --------------------------------------

    report.report_type = data.get(
        "report_type"
    )

    report.laboratory_name = data.get(
        "laboratory_name"
    )


    # --------------------------------------
    # 5. Update report date
    # --------------------------------------

    report_date = data.get(
        "report_date"
    )


    if report_date:

        try:

            report.report_date = (
                datetime.strptime(
                    report_date,
                    "%d/%m/%Y"
                ).date()
            )

        except ValueError:

            report.report_date = None


    # --------------------------------------
    # 6. Delete previous results
    # --------------------------------------

    db.query(LabResult).filter(
        LabResult.lab_report_id == report_id
    ).delete(
        synchronize_session=False
    )


    # --------------------------------------
    # 7. Get Gemini components
    # --------------------------------------

    components = data.get(
        "components",
        []
    )


    inserted_results = []


    # --------------------------------------
    # 8. Insert components
    # --------------------------------------

    for component in components:

        component_name = component.get(
            "component_name"
        )


        # Skip invalid components

        if not component_name:

            continue


        new_result = LabResult(

            lab_report_id=report_id,

            component_name=component_name,

            component_code=None,

            value_numeric=component.get(
                "value_numeric"
            ),

            value_text=component.get(
                "value_text"
            ),

            unit=component.get(
                "unit"
            ),

            reference_range_low=component.get(
                "reference_range_low"
            ),

            reference_range_high=component.get(
                "reference_range_high"
            ),

            reference_range_text=component.get(
                "reference_range_text"
            ),

            flag=component.get(
                "flag"
            )

        )


        db.add(new_result)

        inserted_results.append(
            new_result
        )


    # --------------------------------------
    # 9. Save database changes
    # --------------------------------------

    db.commit()


    # --------------------------------------
    # 10. Return response
    # --------------------------------------

    return {

        "status": "success",

        "message":
            "Lab report analyzed successfully",

        "report_id":
            report_id,

        "report_type":
            report.report_type,

        "laboratory_name":
            report.laboratory_name,

        "components_extracted":
            len(inserted_results)

    }
# ==========================================
# GET HISTORICAL TREND FOR LAB COMPONENT
# ==========================================

@router.get(
    "/patient/{patient_id}/trends/{component_name}"
)
def get_lab_component_trend(
    patient_id: int,
    component_name: str,
    db: Session = Depends(get_db)
):

    results = (

        db.query(
            LabReport.report_date,
            LabResult.component_name,
            LabResult.value_numeric,
            LabResult.value_text,
            LabResult.unit,
            LabResult.flag
        )

        .join(
            LabResult,
            LabReport.id ==
            LabResult.lab_report_id
        )

        .filter(
            LabReport.patient_id == patient_id
        )

        .filter(
    LabResult.component_name.ilike(
        f"%{component_name}%"
    )
)

        .order_by(
            LabReport.report_date.asc()
        )

        .all()

    )


    trend = []


    for result in results:

        trend.append({

            "report_date":
                result.report_date,

            "component_name":
                result.component_name,

            "value":
                result.value_numeric,

            "value_text":
                result.value_text,

            "unit":
                result.unit,

            "flag":
                result.flag

        })


    return trend