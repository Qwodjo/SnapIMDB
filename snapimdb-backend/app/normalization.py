import re
from app.schemas import IMDBRecord, IMDBField, FIELD_KEYS


# Lookup tables 

PACKAGING_MAP = {
    # Bottles
    "plastic bottle": "PLASTIC BOTTLE",
    "plstc bottle":   "PLASTIC BOTTLE",
    "plstc btl":      "PLASTIC BOTTLE",
    "plstc bttl":     "PLASTIC BOTTLE",
    "plastic btl":    "PLASTIC BOTTLE",
    "plastic bttl":   "PLASTIC BOTTLE",
    "bttle":          "BOTTLE",
    "bttl":           "BOTTLE",
    "bottle":         "BOTTLE",
    # Glass
    "glass jar":      "GLASS JAR",
    "glss jar":       "GLASS JAR",
    "glass bottle":   "GLASS BOTTLE",
    "glss btl":       "GLASS BOTTLE",
    "glss bottle":    "GLASS BOTTLE",
    # Sachets / pouches
    "sachet":         "SACHET",
    "scht":           "SACHET",
    "pouch":          "POUCH",
    # Tubs
    "tub":            "TUB",
    "plastic tub":    "TUB",
    "plstc tub":      "TUB",
    # Cans / tins
    "can":            "CAN",
    "tin":            "TIN",
    # Boxes / cartons
    "carton":         "CARTON",
    "box":            "BOX",
    "packet":         "PACKET",
    "bag":            "BAG",
    "wrapper":        "WRAPPER",
    "tube":           "TUBE",
    "jar":            "JAR",
}

COUNTRY_MAP = {
    # Africa
    "gh":           "GHANA",
    "ghana":        "GHANA",
    "ng":           "NIGERIA",
    "nigeria":      "NIGERIA",
    "ke":           "KENYA",
    "kenya":        "KENYA",
    "za":           "SOUTH AFRICA",
    "south africa": "SOUTH AFRICA",
    "et":           "ETHIOPIA",
    "ethiopia":     "ETHIOPIA",
    "tz":           "TANZANIA",
    "tanzania":     "TANZANIA",
    "eg":           "EGYPT",
    "egypt":        "EGYPT",
    "ci":           "COTE D'IVOIRE",
    "ivory coast":  "COTE D'IVOIRE",
    # Europe
    "uk":           "UNITED KINGDOM",
    "gb":           "UNITED KINGDOM",
    "united kingdom": "UNITED KINGDOM",
    "de":           "GERMANY",
    "germany":      "GERMANY",
    "fr":           "FRANCE",
    "france":       "FRANCE",
    "nl":           "NETHERLANDS",
    "netherlands":  "NETHERLANDS",
    "ch":           "SWITZERLAND",
    "switzerland":  "SWITZERLAND",
    # Americas
    "us":           "USA",
    "usa":          "USA",
    "united states": "USA",
    "br":           "BRAZIL",
    "brazil":       "BRAZIL",
    # Asia
    "cn":           "CHINA",
    "china":        "CHINA",
    "in":           "INDIA",
    "india":        "INDIA",
    "id":           "INDONESIA",
    "indonesia":    "INDONESIA",
    "vn":           "VIETNAM",
    "vietnam":      "VIETNAM",
    "th":           "THAILAND",
    "thailand":     "THAILAND",
    "my":           "MALAYSIA",
    "malaysia":     "MALAYSIA",
}

WEIGHT_UNIT_MAP = {
    "grams":      "G",
    "gram":       "G",
    "gm":         "G",
    "g":          "G",
    "kg":         "KG",
    "kilograms":  "KG",
    "kilogram":   "KG",
    "ml":         "ML",
    "milliliter": "ML",
    "millilitre": "ML",
    "milliliters":"ML",
    "millilitres":"ML",
    "l":          "L",
    "liter":      "L",
    "litre":      "L",
    "liters":     "L",
    "litres":     "L",
    "cl":         "CL",
    "oz":         "OZ",
    "ounce":      "OZ",
    "ounces":     "OZ",
    "lb":         "LB",
    "lbs":        "LB",
    "pound":      "LB",
    "pounds":     "LB",
}


# Individual field normalizers 

def normalize_packaging(val: str) -> str:
    key = val.lower().strip()
    return PACKAGING_MAP.get(key, val.upper().strip())


def normalize_country(val: str) -> str:
    key = val.lower().strip().rstrip(".")
    return COUNTRY_MAP.get(key, val.upper().strip())


def normalize_weight(val: str) -> str:
    """
    Standardizes weight strings to hackathon format: 250G, 500 ML, 1.5 KG
    Handles: '250g', '500ml', '1.5kg', '250 Grams', '500 Millilitres' etc.
    """
    val = val.strip()
    # Extract number and unit separately
    match = re.match(
        r"^([\d]+(?:[.,]\d+)?)\s*([a-zA-Z]+)$",
        val.replace(",", ".")
    )
    if not match:
        return val.upper().strip()

    number = match.group(1)
    unit_raw = match.group(2).lower().strip()
    unit = WEIGHT_UNIT_MAP.get(unit_raw, unit_raw.upper())

    # Format: no space for G and KG, space for ML and L (matching ground truth)
    if unit in ("G", "KG"):
        return f"{number}{unit}"
    return f"{number} {unit}"


def normalize_barcode(val: str) -> str:
    """Strip all non-digit characters."""
    return re.sub(r"[^\d]", "", val).strip()


def validate_barcode(val: str) -> bool:
    """Valid barcodes are 8–14 digits (EAN-8 to EAN-14)."""
    return bool(re.match(r"^\d{8,14}$", val))


def normalize_text(val: str) -> str:
    """Uppercase and strip all plain text fields."""
    return val.upper().strip()


#  Master normalizer 

def normalize_record(record: IMDBRecord) -> IMDBRecord:
    """
    Run all field-specific normalizers over a full IMDBRecord.
    Downgrades confidence on invalid barcodes.
    Returns the cleaned record.
    """
    # Text fields — just uppercase + strip
    text_fields = [
        "item_name", "manufacturer", "brand", "variant",
        "type", "fragrance_flavor", "promotion", "addons", "tagline",
    ]
    for key in text_fields:
        field: IMDBField = getattr(record, key)
        if field.value:
            field.value = normalize_text(field.value)

    # Packaging
    if record.packaging_type.value:
        record.packaging_type.value = normalize_packaging(record.packaging_type.value)

    # Country
    if record.country.value:
        record.country.value = normalize_country(record.country.value)

    # Weight
    if record.weight.value:
        record.weight.value = normalize_weight(record.weight.value)

    # Barcode — clean then validate
    if record.barcode.value:
        record.barcode.value = normalize_barcode(record.barcode.value)
        if not validate_barcode(record.barcode.value):
            # Invalid barcode — flag it
            record.barcode.confidence = min(record.barcode.confidence, 0.35)

    return record


def normalize_field_value(key: str, value: str) -> str:
    """
    Normalize a single field value by key name.
    Used when the user edits a cell in the frontend.
    """
    if key == "packaging_type":
        return normalize_packaging(value)
    if key == "country":
        return normalize_country(value)
    if key == "weight":
        return normalize_weight(value)
    if key == "barcode":
        return normalize_barcode(value)
    return normalize_text(value)