import os

from google import genai
from dotenv import load_dotenv


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY not found in .env"
    )


client = genai.Client(
    api_key=GEMINI_API_KEY
)


def generate_chatbot_response(
    question: str,
    patient_context: str
) -> str:

    system_prompt = """
You are the HealthTrack AI Assistant.

You are an AI assistant for a patient health-record
management application.

Answer questions ONLY using the HEALTH DATA CONTEXT
provided to you.

IMPORTANT RULES:

1. Never invent patient information.
2. Never guess missing values.
3. If information is unavailable, say so clearly.
4. Never fabricate laboratory results.
5. Never fabricate medications.
6. Never fabricate monitoring values.
7. Use actual numerical values from the context.
8. When asked for an average, use the provided calculated
   averages when available.
9. When asked about trends, use the historical data provided.
10. Keep responses concise and understandable.
11. Do not expose database implementation details.
12. Do not diagnose diseases.
13. Do not claim that a recorded value definitely means a
    particular disease.
14. For concerning medical information, explain the recorded
    information and recommend consultation with a qualified
    healthcare professional.

HEALTH DATA CONTEXT:
"""

    prompt = (
        system_prompt
        + "\n\n"
        + patient_context
        + "\n\n"
        + "USER QUESTION:\n"
        + question
    )

    try:

        response = client.models.generate_content(
            model="gemini-3.7-flash",
            contents=prompt
        )

        if not response.text:
            return (
                "I couldn't generate a response right now."
            )

        return response.text.strip()

    except Exception as e:

        print("\n==========================================")
        print("CHATBOT GEMINI ERROR")
        print("==========================================")
        print(type(e).__name__)
        print(str(e))
        print("==========================================\n")

        raise RuntimeError(
            f"Gemini error: {str(e)}"
        )