from pydantic import BaseModel, Field


class IMDBField(BaseModel):
    """A single IMDB attribute with its extracted value and confidence score."""
    value: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class IMDBRecord(BaseModel):
    """
    Full 13-column Item Master Database record.
    Each field carries a value + confidence score (0.0 - 1.0).
    """
    item_name:        IMDBField = Field(default_factory=IMDBField)
    barcode:          IMDBField = Field(default_factory=IMDBField)
    manufacturer:     IMDBField = Field(default_factory=IMDBField)
    brand:            IMDBField = Field(default_factory=IMDBField)
    weight:           IMDBField = Field(default_factory=IMDBField)
    packaging_type:   IMDBField = Field(default_factory=IMDBField)
    country:          IMDBField = Field(default_factory=IMDBField)
    variant:          IMDBField = Field(default_factory=IMDBField)
    type:             IMDBField = Field(default_factory=IMDBField)
    fragrance_flavor: IMDBField = Field(default_factory=IMDBField)
    promotion:        IMDBField = Field(default_factory=IMDBField)
    addons:           IMDBField = Field(default_factory=IMDBField)
    tagline:          IMDBField = Field(default_factory=IMDBField)

    # Metadata — not exported to Excel
    image_id:       str  = ""
    has_conflicts:  bool = False
    conflict_notes: str  = ""


class ExtractionResult(BaseModel):
    """Wrapper returned by the extraction pipeline for one product."""
    record:       IMDBRecord
    source_files: list[str] = []
    is_duplicate: bool      = False
    duplicate_of: str       = ""


FIELD_KEYS = [
    "item_name", "barcode", "manufacturer", "brand", "weight",
    "packaging_type", "country", "variant", "type",
    "fragrance_flavor", "promotion", "addons", "tagline",
]

EXCEL_COLUMN_NAMES = [
    "ITEM_NAME", "BARCODE", "MANUFACTURER", "BRAND", "WEIGHT",
    "PACKAGING TYPE", "COUNTRY", "VARIANT", "TYPE",
    "FRAGRANCE_FLAVOR", "PROMOTION", "ADDONS", "TAGLINE",
]