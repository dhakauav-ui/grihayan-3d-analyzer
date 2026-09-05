from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.models.survey import ColumnMapping
from app.processing.reader import read_survey_file
from app.processing.validator import validate_survey_dataframe
from app.processing.dem import generate_raster_dem
from app.processing.profile import compute_elevation_profile
from app.processing.volume import calculate_earthwork_volume

router = APIRouter(prefix="/analysis", tags=["Geospatial Analysis"])

class ProfileRequest(BaseModel):
    file_id: str
    column_mapping: ColumnMapping
    source_crs: Optional[str] = None
    start_x: float
    start_y: float
    end_x: float
    end_y: float
    num_samples: int = 100

class VolumeRequest(BaseModel):
    file_id: str
    column_mapping: ColumnMapping
    source_crs: Optional[str] = None
    datum_elevation: float
    resolution: float = 1.0

@router.post("/profile")
async def get_elevation_profile(req: ProfileRequest):
    """
    Computes cross-section elevation profile along a user-specified line.
    """
    file_path = settings.UPLOAD_DIR / req.file_id
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Uploaded file '{req.file_id}' not found."
        )

    try:
        df, _, _ = read_survey_file(file_path)
        _, cleaned_df = validate_survey_dataframe(df, req.column_mapping, req.source_crs)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    profile_res = compute_elevation_profile(
        points_df=cleaned_df,
        start_x=req.start_x,
        start_y=req.start_y,
        end_x=req.end_x,
        end_y=req.end_y,
        num_samples=req.num_samples
    )

    return {
        "success": True,
        "profile": profile_res
    }

@router.post("/volume")
async def get_earthwork_volume(req: VolumeRequest):
    """
    Calculates Cut, Fill, and Net volume relative to a design datum elevation.
    """
    file_path = settings.UPLOAD_DIR / req.file_id
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Uploaded file '{req.file_id}' not found."
        )

    try:
        df, _, _ = read_survey_file(file_path)
        _, cleaned_df = validate_survey_dataframe(df, req.column_mapping, req.source_crs)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    dem_res = generate_raster_dem(cleaned_df, resolution=req.resolution)
    volume_res = calculate_earthwork_volume(
        dem_array=dem_res["dem_array"],
        cell_size=dem_res["resolution_x"],
        datum_elevation=req.datum_elevation,
        bounds=dem_res.get("bounds")
    )

    return {
        "success": True,
        "volume": volume_res
    }
