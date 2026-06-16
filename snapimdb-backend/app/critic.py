import os
import json
import asyncio
import re
from google import genai
from google.genai import types
from dotenv import load_dotenv
from app.schemas import IMDBRecord, IMDBField, FIELD_KEYS

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

CRITIC_SYSTEM = """
You are a senior retail data quality auditor reviewing extracted 
Item Master Database (IMDB) records for West African FMCG products.

Your job is to review a merged product record for errors and 
inconsistencies, then return a corrected version.

WHAT TO CHECK:
1. BRAND vs MANUFACTURER mismatch
   - Example conflict: brand=NESTLE but manufacturer=UPFIELD
   - NESTLE products are made by NESTLE; BLUE BAND/FLORA are made by UPFIELD
   - Common Ghana brands: BLUE BAND/FLORA → UPFIELD, MAGGI → NESTLE,
     VIBE/SPRITE/FANTA → THE COCA COLA COMPANY, BAMA → GB FOODS

2. ITEM_NAME completeness
   - Should contain: BRAND + WEIGHT + PACKAGING + PRODUCT TYPE
   - Example good: "BLUE BAND 250G PLASTIC TUB SPREAD FOR BREAD MARGARINE"
   - Example bad: "BLUE BAND SPREAD" (missing weight and packaging)
   - If item_name is incomplete but other fields have the data, reconstruct it

3. BARCODE validity
   - Must be 8 to 14 digits only
   - If barcode contains letters or special characters, flag it
   - If barcode is clearly wrong length, lower confidence to 0.3

4. WEIGHT format
   - Must follow: NUMBER + UNIT e.g. 250G, 500 ML, 1.5 KG, 330 ML
   - If weight is like "250 Grams" or "half kg", flag and correct it

5. COUNTRY plausibility
   - Must be a real country name
   - "MADE IN GH" should become "GHANA"
   - If country seems implausible for the brand, flag it

6. PACKAGING_TYPE standardization
   - Must be one of: TUB, GLASS JAR, SACHET, PLASTIC BOTTLE, 
     GLASS BOTTLE, CAN, CARTON, POUCH, BOX, WRAPPER, TUBE, JAR, BOTTLE
   - Correct abbreviations or non-standard terms

7. EMPTY FIELD RECONSTRUCTION
   - If TYPE is empty but item_name contains "MAYONNAISE", set type to "MAYONNAISE"
   - If BRAND is empty but item_name starts with a known brand, extract it
   - Use cross-field logic to fill gaps where confident

8. CONFIDENCE ADJUSTMENT
   - If you correct a value, set its confidence to 0.85
   - If a value looks wrong but you cannot determine correct value, 
     set confidence to 0.3 and leave value as-is
   - If a value looks correct and was already high confidence, keep it

RESPONSE FORMAT:
Return ONLY a valid JSON object with this exact structure:
{
  "corrected_record": {
    "item_name":        {"value": "...", "confidence": 0.0},
    "barcode":          {"value": "...", "confidence": 0.0},
    "manufacturer":     {"value": "...", "confidence": 0.0},
    "brand":            {"value": "...", "confidence": 0.0},
    "weight":           {"value": "...", "confidence": 0.0},
    "packaging_type":   {"value": "...", "confidence": 0.0},
    "country":          {"value": "...", "confidence": 0.0},
    "variant":          {"value": "...", "confidence": 0.0},
    "type":             {"value": "...", "confidence": 0.0},
    "fragrance_flavor": {"value": "...", "confidence": 0.0},
    "promotion":        {"value": "...", "confidence": 0.0},
    "addons":           {"value": "...", "confidence": 0.0},
    "tagline":          {"value": "...", "confidence": 0.0}
  },
  "has_conflicts": true,
  "conflict_notes": "Brief description of what was wrong and what was fixed"
}

Return ONLY the JSON. No markdown. No explanation. No backticks.
"""


async def run_critic_pass(merged_record: dict) -> dict:
    """
    Sends the merged IMDBRecord dict to Gemini for a quality review.
    Returns a corrected record dict with conflict flags.
    """
    # Build a clean summary of the merged record for the critic
    record_summary = {}
    for field in FIELD_KEYS:
        raw = merged_record.get(field, {})
        if isinstance(raw, dict):
            record_summary[field] = {
                "value": raw.get("value", ""),
                "confidence": raw.get("confidence", 0.0),
            }
        else:
            record_summary[field] = {"value": "", "confidence": 0.0}

    prompt = f"""Review this extracted IMDB product record and return the corrected version:

{json.dumps(record_summary, indent=2)}

Check all fields against the rules in your instructions.
Return the corrected JSON only."""

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(
                system_instruction=CRITIC_SYSTEM,
                temperature=0.0,
            ),
        )

        raw_text = response.text.strip()

        # Strip markdown fences if present
        raw_text = re.sub(r"```json|```", "", raw_text).strip()

        result = json.loads(raw_text)

        corrected = result.get("corrected_record", record_summary)
        has_conflicts = result.get("has_conflicts", False)
        conflict_notes = result.get("conflict_notes", "")

        # Merge metadata back in
        corrected["image_id"] = merged_record.get("image_id", "")
        corrected["has_conflicts"] = has_conflicts
        corrected["conflict_notes"] = conflict_notes

        return corrected

    except json.JSONDecodeError as e:
        print(f"[critic] JSON parse error: {e}")
        # Return original if critic fails — don't crash the pipeline
        merged_record["has_conflicts"] = False
        merged_record["conflict_notes"] = "Critic pass failed — using raw fusion result"
        return merged_record

    except Exception as e:
        print(f"[critic] ERROR: {str(e)}")
        merged_record["has_conflicts"] = False
        merged_record["conflict_notes"] = "Critic pass unavailable"
        return merged_record