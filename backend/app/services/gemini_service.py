import os
import json

from google import genai
from dotenv import load_dotenv


# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


if not GEMINI_API_KEY:

    raise ValueError(
        "GEMINI_API_KEY not found in .env"
    )


# ==========================================
# GEMINI CLIENT
# ==========================================

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# ==========================================
# LAB REPORT EXTRACTION
# ==========================================

def extract_lab_data(file_path: str):

    print("\n==========================================")
    print("GEMINI LAB ANALYSIS STARTED")
    print("==========================================")

    print(
        f"File path: {file_path}"
    )


    # ==========================================
    # CHECK FILE
    # ==========================================

    if not os.path.exists(file_path):

        raise FileNotFoundError(
            f"File not found: {file_path}"
        )


    print(
        f"File exists: {os.path.getsize(file_path)} bytes"
    )


    # ==========================================
    # UPLOAD FILE TO GEMINI
    # ==========================================

    print(
        "Uploading file to Gemini..."
    )


    uploaded_file = client.files.upload(
        file=file_path
    )


    print(
        "File uploaded successfully."
    )


    # ==========================================
    # PROMPT
    # ==========================================

    prompt = """

You are an expert medical laboratory report
data extraction system.

Analyze the uploaded laboratory report carefully.

Extract ALL clearly visible laboratory test
components from the report.

DO NOT guess.
DO NOT invent values.
DO NOT omit visible laboratory components.

Return the result using EXACTLY this JSON structure:

{
    "report_type": "string or null",
    "laboratory_name": "string or null",
    "report_date": "DD/MM/YYYY or null",
    "components": [
        {
            "component_name": "string",
            "value_numeric": 0,
            "value_text": null,
            "unit": "string or null",
            "reference_range_low": 0,
            "reference_range_high": 0,
            "reference_range_text": "string or null",
            "flag": "low"
        }
    ]
}

For EVERY laboratory test/component:

1. component_name
   - Use the exact visible test name.

2. value_numeric
   - If the result is numeric, put the number here.
   - Example: 9.2
   - If not numeric, use null.

3. value_text
   - Use this for textual results.
   - Examples:
     Positive
     Negative
     Reactive
     Non-Reactive
   - Otherwise use null.

4. unit
   - Preserve the visible laboratory unit.
   - Example:
     gm/dl
     %
     cells/cumm

5. reference_range_low
   - Extract the numerical lower limit if available.
   - Otherwise null.

6. reference_range_high
   - Extract the numerical upper limit if available.
   - Otherwise null.

7. reference_range_text
   - Preserve the reference range exactly as visible.
   - Example:
     "12 - 16"

8. flag
   - Determine based ONLY on the laboratory's reference range.
   - Allowed values:
     "low"
     "high"
     "normal"
     "positive"
     "negative"
     "unknown"

IMPORTANT:

- Extract ALL visible laboratory components.
- Do not stop after the first few rows.
- Do not summarize the report.
- Do not explain anything.
- Return ONLY valid JSON.
- Do not use Markdown.
- Do not use ```json.
- Do not add any text before or after the JSON.

Also extract:

- report_type
- laboratory_name
- report_date

"""


    # ==========================================
    # GEMINI REQUEST
    # ==========================================

    print(
        "Sending report to Gemini..."
    )


    response = client.models.generate_content(

        model="gemini-3.5-flash-lite",

        contents=[
            prompt,
            uploaded_file
        ],

        config={
            "response_mime_type": "application/json"
        }

    )


    # ==========================================
    # RAW RESPONSE
    # ==========================================

    raw_text = response.text


    print("\n==========================================")
    print("RAW GEMINI RESPONSE")
    print("==========================================")

    print(raw_text)


    # ==========================================
    # CHECK RESPONSE
    # ==========================================

    if not raw_text:

        raise ValueError(
            "Gemini returned an empty response."
        )


    # ==========================================
    # CLEAN RESPONSE
    # ==========================================

    cleaned_text = raw_text.strip()


    # Sometimes models still return Markdown
    # JSON despite response_mime_type.

    if cleaned_text.startswith(
        "```json"
    ):

        cleaned_text = (
            cleaned_text
            .replace("```json", "", 1)
            .strip()
        )


    if cleaned_text.endswith(
        "```"
    ):

        cleaned_text = (
            cleaned_text[:-3]
            .strip()
        )


    # ==========================================
    # PARSE JSON
    # ==========================================

    try:

        data = json.loads(
            cleaned_text
        )

    except json.JSONDecodeError as e:

        print(
            "\nJSON PARSING ERROR:"
        )

        print(e)

        raise ValueError(
            "Gemini returned invalid JSON."
        )


    # ==========================================
    # VALIDATE STRUCTURE
    # ==========================================

    if not isinstance(data, dict):

        raise ValueError(
            "Gemini response is not a JSON object."
        )


    # ==========================================
    # GET COMPONENTS
    # ==========================================

    components = data.get(
        "components"
    )


    if components is None:

        print(
            "\nWARNING: Gemini response "
            "does not contain 'components'."
        )

        components = []


    if not isinstance(
        components,
        list
    ):

        raise ValueError(
            "'components' must be a list."
        )


    # ==========================================
    # NORMALIZE COMPONENTS
    # ==========================================

    normalized_components = []


    for component in components:

        if not isinstance(
            component,
            dict
        ):

            continue


        component_name = component.get(
            "component_name"
        )


        if not component_name:

            continue


        normalized_component = {

            "component_name":
                component_name,

            "value_numeric":
                component.get(
                    "value_numeric"
                ),

            "value_text":
                component.get(
                    "value_text"
                ),

            "unit":
                component.get(
                    "unit"
                ),

            "reference_range_low":
                component.get(
                    "reference_range_low"
                ),

            "reference_range_high":
                component.get(
                    "reference_range_high"
                ),

            "reference_range_text":
                component.get(
                    "reference_range_text"
                ),

            "flag":
                component.get(
                    "flag",
                    "unknown"
                )

        }


        normalized_components.append(
            normalized_component
        )


    # ==========================================
    # FINAL DATA
    # ==========================================

    final_data = {

        "report_type":
            data.get(
                "report_type"
            ),

        "laboratory_name":
            data.get(
                "laboratory_name"
            ),

        "report_date":
            data.get(
                "report_date"
            ),

        "components":
            normalized_components

    }


    # ==========================================
    # DEBUG OUTPUT
    # ==========================================

    print("\n==========================================")
    print("STRUCTURED GEMINI DATA")
    print("==========================================")


    print(
        json.dumps(
            final_data,
            indent=4
        )
    )


    print("\n==========================================")
    print(
        f"COMPONENTS FOUND: "
        f"{len(normalized_components)}"
    )
    print("==========================================\n")


    # ==========================================
    # RETURN
    # ==========================================

    return final_data