import os
import io
import asyncio
from PIL import Image
from google import genai
from google.genai import types
from dotenv import load_dotenv
from app.schemas import IMDBRecord, IMDBField, FIELD_KEYS

load_dotenv()

# Initialize client after env is loaded
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_INSTRUCTION = """
You are an expert automated retail data ingestion agent specializing in 
West African FMCG products. Your sole purpose is to analyze product 
images and extract attributes to populate an Item Master Database (IMDB).

RULES:
1. Analyze ALL visible text on labels, barcodes, packaging, and stickers.
2. Look at every part of the image — front, back, sides, bottom.
3. For ITEM_NAME: construct a full descriptive name combining brand + 
   product type + variant + weight + packaging. Example:
   "BLUE BAND 250G PLASTIC TUB SPREAD FOR BREAD MARGARINE"
4. For BARCODE: extract digits only — no spaces, no dashes, no letters.
5. For WEIGHT: use format like 250G, 500 ML, 1.5 KG — number then unit.
6. For PACKAGING_TYPE: use standard terms — TUB, GLASS JAR, SACHET, 
   PLASTIC BOTTLE, GLASS BOTTLE, CAN, CARTON, POUCH, BOX.
7. For COUNTRY: full country name — GHANA, NIGERIA, CHINA etc.
8. For VARIANT: only if explicitly stated — ORIGINAL, LOW FAT, EXTRA HOT.
   Leave empty if not stated.
9. For FRAGRANCE_FLAVOR: flavor or scent if stated — STRAWBERRY, LEMON.
   Leave empty if not applicable.
10. For PROMOTION: any on-pack promo text — "50% MORE FREE", "BUY 2 GET 1".
    Leave empty if none.
11. For ADDONS: extra pack contents — "FREE SPOON", "RECIPE BOOKLET INSIDE".
    Leave empty if none.
12. For TAGLINE: short marketing phrase on pack. Leave empty if none.
13. Confidence scoring:
    - 1.0: text is crystal clear and unambiguous
    - 0.8-0.9: clearly visible, minor uncertainty
    - 0.6-0.79: partially visible or slightly blurry
    - 0.4-0.59: inferred from context, not directly readable
    - 0.0-0.39: not visible — use empty string for value
14. If a field is not visible or not applicable, set value to "" 
    and confidence to 0.0. NEVER guess or hallucinate values.
"""


async def extract_from_single_image(
    file_bytes: bytes,
    media_type: str = "image/jpeg",
    filename: str = ""
) -> dict:
    """
    Send one product image to Gemini 2.5 Flash.
    Returns a dict matching IMDBRecord field structure.
    """
    if not os.getenv("GEMINI_API_KEY"):
        raise ValueError("GEMINI_API_KEY not set in .env")

    try:
        # Convert bytes to PIL Image for the GenAI SDK
        image = Image.open(io.BytesIO(file_bytes))

        # Run in thread to avoid blocking the async event loop
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=[
                image,
                "Analyze this product image and extract all 13 IMDB attributes. "
                "Look carefully at every part of the label including the image tag "
                "at the bottom which contains a descriptive product name."
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.0,
                response_mime_type="application/json",
                response_schema=IMDBRecord,
            ),
        )

        if response.parsed:
            result = response.parsed.model_dump()
            # Inject filename as image_id
            result["image_id"] = filename
            return result

        # Fallback: try parsing raw text
        print(f"[extraction] No parsed response for {filename}, got: {response.text[:200]}")
        return _empty_record(filename)

    except Exception as e:
        print(f"[extraction] ERROR on {filename}: {str(e)}")
        return _empty_record(filename)


async def extract_from_multiple_images(
    images: list[tuple[bytes, str, str]]  # (file_bytes, media_type, filename)
) -> list[dict]:
    """
    Run extraction on multiple images in parallel.
    Returns a list of raw extraction dicts.
    """
    tasks = [
        extract_from_single_image(file_bytes, media_type, filename)
        for file_bytes, media_type, filename in images
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    clean = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            print(f"[extraction] Task {i} raised: {r}")
            clean.append(_empty_record(f"image_{i}"))
        else:
            clean.append(r)
    return clean


def _empty_record(image_id: str = "") -> dict:
    """Return a blank IMDBRecord dict with zero confidence on all fields."""
    base = IMDBRecord(image_id=image_id)
    return base.model_dump()