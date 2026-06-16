from app.schemas import IMDBRecord, IMDBField, FIELD_KEYS
from app.normalization import normalize_record


def fuse_multiple_images(records: list[dict]) -> dict:
    """
    Takes raw extraction dicts from multiple images of the same product.
    For each field, picks the value with the highest confidence score.
    Falls back to the next best if the winner has an empty value.
    Returns a single merged dict ready for the critic pass.
    """
    if not records:
        return IMDBRecord().model_dump()

    if len(records) == 1:
        return records[0]

    fused = {}

    for field in FIELD_KEYS:
        # Collect all (value, confidence) pairs for this field
        candidates = []
        for rec in records:
            field_data = rec.get(field, {})
            if isinstance(field_data, dict):
                value = field_data.get("value", "").strip()
                confidence = float(field_data.get("confidence", 0.0))
            else:
                value = ""
                confidence = 0.0

            if value:  # Only consider non-empty values
                candidates.append((value, confidence))

        if not candidates:
            # No image had a value for this field
            fused[field] = {"value": "", "confidence": 0.0}
            continue

        # Sort by confidence descending — best evidence wins
        candidates.sort(key=lambda x: x[1], reverse=True)
        best_value, best_confidence = candidates[0]

        # Bonus: if multiple images agree on the same value,
        # boost confidence slightly (agreement = more trust)
        agreement_count = sum(
            1 for v, _ in candidates
            if v.upper().strip() == best_value.upper().strip()
        )
        if agreement_count > 1:
            boost = min(0.05 * (agreement_count - 1), 0.15)
            best_confidence = min(best_confidence + boost, 1.0)

        fused[field] = {
            "value": best_value,
            "confidence": round(best_confidence, 3),
        }

    # Carry over metadata from the first record
    fused["image_id"] = records[0].get("image_id", "")
    fused["has_conflicts"] = False
    fused["conflict_notes"] = ""

    # Normalize the fused result
    record = _dict_to_record(fused)
    record = normalize_record(record)
    return record.model_dump()


def _dict_to_record(d: dict) -> IMDBRecord:
    """Convert a raw fusion dict back into a typed IMDBRecord."""
    kwargs = {}
    for field in FIELD_KEYS:
        raw = d.get(field, {})
        if isinstance(raw, dict):
            kwargs[field] = IMDBField(
                value=raw.get("value", ""),
                confidence=float(raw.get("confidence", 0.0)),
            )
        else:
            kwargs[field] = IMDBField()

    kwargs["image_id"] = d.get("image_id", "")
    kwargs["has_conflicts"] = d.get("has_conflicts", False)
    kwargs["conflict_notes"] = d.get("conflict_notes", "")
    return IMDBRecord(**kwargs)


def group_images_by_product(
    filenames: list[str],
) -> dict[str, list[int]]:
    """
    Groups image indices by product prefix.
    Example:
      S221234199_550719011.jpg  →  prefix: S221234199
      S221234199_550719012.jpg  →  prefix: S221234199
      S221712802_552034736.jpg  →  prefix: S221712802

    Returns: { "S221234199": [0, 1], "S221712802": [2] }
    """
    groups: dict[str, list[int]] = {}
    for idx, name in enumerate(filenames):
        # Strip extension
        stem = name.rsplit(".", 1)[0]
        # Take everything before the last underscore+number block
        parts = stem.split("_")
        if len(parts) >= 2:
            prefix = parts[0]
        else:
            prefix = stem
        if prefix not in groups:
            groups[prefix] = []
        groups[prefix].append(idx)
    return groups