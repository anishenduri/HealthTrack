from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.models.patient import Patient
from app.models.monitoring import MonitoringRecord
from app.models.lab_report import LabReport
from app.models.lab_result import LabResult
from app.routers import patients
from app.routers import monitoring
from app.routers import lab
from app.routers import chatbot


app = FastAPI()


# -----------------------------
# CORS Configuration
# -----------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Create Database Tables
# -----------------------------

Base.metadata.create_all(bind=engine)


# -----------------------------
# Register API Routers
# -----------------------------

app.include_router(patients.router)

app.include_router(monitoring.router)
app.include_router(lab.router)
app.include_router(chatbot.router)
# -----------------------------
# Home Endpoint
# -----------------------------

@app.get("/")
def home():

    return {
        "message": "HealthTrack API is running"
    }


# -----------------------------
# Database Test Endpoint
# -----------------------------

@app.get("/test-db")
def test_database():

    try:

        with engine.connect():

            return {
                "status": "success",
                "message": "PostgreSQL connection successful"
            }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e)
        }