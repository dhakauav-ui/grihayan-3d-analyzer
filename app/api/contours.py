from typing import Optional
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.models.survey import ColumnMapping
from app.processing.reader import read_survey_file
from app.processing.validator import validate_survey_dataframe
from app.processing.dem import generate_raster_dem
from app.processing.contour import generate_vector_contours

router = APIRouter(prefix="/contours", tags=["Contours"])

class GenerateContoursRequest(BaseModel):
    file_id: str
    column_mapping: ColumnMapping
    source_crs: Optional[str] = None
    interval: float = 1.0
    major_multiplier: int = 5
    resolution: float = 1.0

@router.post("/generate")
async def generate_contours(req: GenerateContoursRequest):
    """
    Generates exact vector contour polylines with major/minor split and GeoJSON.
    """
    file_path = settings.UPLOAD_DIR / req.file_id
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Uploaded survey file '{req.file_id}' not found."
        )

    try:
        df, _, _ = read_survey_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        summary, cleaned_df = validate_survey_dataframe(
            df=df,
            mapping=req.column_mapping,
            source_crs=req.source_crs
        )

        if len(cleaned_df) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not enough valid survey points to generate contour lines."
            )

        # Generate DEM for contour extraction
        dem_result = generate_raster_dem(
            points_df=cleaned_df,
            resolution=req.resolution
        )

        # Generate vector contours
        contour_result = generate_vector_contours(
            dem_array=dem_result["dem_array"],
            min_x=dem_result["min_x"],
            max_x=dem_result["max_x"],
            min_y=dem_result["min_y"],
            max_y=dem_result["max_y"],
            interval=req.interval,
            major_interval_multiplier=req.major_multiplier
        )

        return {
            "success": True,
            "contours": contour_result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Contour generation failed: {str(e)}"
        )
