import re
from app.schemas import IMDBRecord, FIELD_KEYS


def _normalize_for_comparison(value: str) -> str:
    """
    Strip punctuation, extra spaces, lowercase.
    Used for fuzzy comparison of field values.
    """
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9\s]", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _barcode_match(a: str, b: str) -> bool:
    """Exact match on cleaned barcodes."""
    return bool(a and b and a == b)


def _brand_match(a: str, b: str) -> bool:
    """Normalized brand match."""
    return bool(
        a and b and
        _normalize_for_comparison(a) == _normalize_for_comparison(b)
    )


def _weight_match(a: str, b: str) -> bool:
    """Normalized weight match — strips spaces before comparing."""
    a_clean = re.sub(r"\s+", "", a.upper().strip())
    b_clean = re.sub(r"\s+", "", b.upper().strip())
    return bool(a_clean and b_clean and a_clean == b_clean)


def _name_similarity(a: str, b: str) -> float:
    """
    Simple word-overlap similarity between two item names.
    Returns a score from 0.0 to 1.0.
    """
    if not a or not b:
        return 0.0
    words_a = set(_normalize_for_comparison(a).split())
    words_b = set(_normalize_for_comparison(b).split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def _get_field_value(record: dict, field: str) -> str:
    """Safely extract a field value from a record dict."""
    raw = record.get(field, {})
    if isinstance(raw, dict):
        return raw.get("value", "")
    return str(raw) if raw else ""


def check_duplicate(
    new_record: dict,
    existing_records: list[dict],
    barcode_weight: float = 0.5,
    brand_weight: float = 0.25,
    name_weight: float = 0.25,
    threshold: float = 0.75,
) -> tuple[bool, str]:
    """
    Compare a new record against all existing records.

    Scoring logic:
    - Barcode exact match = 0.5 points
    - Brand exact match   = 0.25 points
    - Item name similarity ≥ 0.7 = 0.25 points

    If total score ≥ threshold (default 0.75), flag as duplicate.

    Returns:
        (is_duplicate: bool, duplicate_of: str)
        duplicate_of is the image_id of the matching existing record.
    """
    new_barcode  = _get_field_value(new_record, "barcode")
    new_brand    = _get_field_value(new_record, "brand")
    new_weight   = _get_field_value(new_record, "weight")
    new_name     = _get_field_value(new_record, "item_name")

    for existing in existing_records:
        ex_barcode = _get_field_value(existing, "barcode")
        ex_brand   = _get_field_value(existing, "brand")
        ex_weight  = _get_field_value(existing, "weight")
        ex_name    = _get_field_value(existing, "item_name")

        score = 0.0

        # Barcode match is the strongest signal
        if _barcode_match(new_barcode, ex_barcode):
            score += barcode_weight

        # Brand match
        if _brand_match(new_brand, ex_brand):
            score += brand_weight

        # Item name similarity
        name_sim = _name_similarity(new_name, ex_name)
        if name_sim >= 0.7:
            score += name_weight * name_sim

        if score >= threshold:
            duplicate_of = existing.get("image_id", "unknown")
            return True, duplicate_of

    return False, ""


def run_duplicate_check(
    records: list[dict],
) -> list[dict]:
    """
    Run duplicate detection across an entire batch of records.
    Marks each record with is_duplicate and duplicate_of fields.
    Processes records in order — first occurrence is always the original.
    """
    seen: list[dict] = []
    results = []

    for record in records:
        is_dup, dup_of = check_duplicate(record, seen)

        enriched = {**record}
        enriched["is_duplicate"] = is_dup
        enriched["duplicate_of"] = dup_of

        if not is_dup:
            seen.append(record)

        results.append(enriched)

    return results