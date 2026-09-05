from typing import Optional, Any
from pydantic import BaseModel, Field

class ColumnMapping(BaseModel):
    point_id: str = Field(..., description="Column name or index for Point ID")
    x: str = Field(..., description="Column name or index for X / Easting")
    y: str = Field(..., description="Column name or index for Y / Northing")
    rl: str = Field(..., description="Column name or index for Reduced Level / Elevation / Z")
    code: Optional[str] = Field(None, description="Optional column name or index for Code / Description")

class RawPreviewResponse(BaseModel):
    file_id: str
    filename: str
    file_type: str
    file_size_bytes: int
    total_rows: int
    total_columns: int
    has_headers: bool
    headers: list[str]
    detected_columns: ColumnMapping
    column_confidence: dict[str, float]
    preview_rows: list[dict[str, Any]]
    suggested_crs: Optional[str] = None

class ValidationIssue(BaseModel):
    row_index: int
    point_id: Optional[str] = None
    issue_type: str  # "missing_rl", "null_xy", "non_numeric", "duplicate_xy_conflict", "duplicate_id", "outlier"
    message: str
    raw_values: dict[str, Any]

class SurveyBounds(BaseModel):
    min_x: float
    max_x: float
    min_y: float
    max_y: float
    min_z: float
    max_z: float
    range_x: float
    range_y: float
    range_z: float

class CRSDetails(BaseModel):
    epsg: Optional[str] = None
    name: Optional[str] = None
    is_projected: Optional[bool] = None
    unit: str = "meter"
    datum: Optional[str] = None
    status: str  # "CONFIRMED", "UNCONFIRMED", "LOCAL_GRID"
    warning: Optional[str] = None

class ValidationSummary(BaseModel):
    total_records: int
    valid_points: int
    invalid_records: int
    duplicate_xy_count: int
    missing_rl_count: int
    duplicate_id_count: int
    bounds: Optional[SurveyBounds] = None
    crs: CRSDetails
    issues: list[ValidationIssue]
    preview_valid_rows: list[dict[str, Any]]
    preview_invalid_rows: list[dict[str, Any]]

class ValidateRequest(BaseModel):
    file_id: str
    column_mapping: ColumnMapping
    has_headers: bool = True
    source_crs: Optional[str] = None
    vertical_datum: Optional[str] = "Local TBM"
    horizontal_unit: str = "meter"
    vertical_unit: str = "meter"
    accept_valid_only: bool = False

class ProjectMetadata(BaseModel):
    project_id: str
    project_name: str
    created_at: str
    updated_at: str
    source_file: str
    file_size_bytes: int
    source_crs: Optional[str]
    processing_crs: Optional[str]
    elevation_datum: str
    horizontal_unit: str
    vertical_unit: str
    column_mapping: ColumnMapping
    point_count: int
    valid_point_count: int
    rejected_point_count: int
    bounds: Optional[SurveyBounds] = None
    software_version: str = "1.0.0"
