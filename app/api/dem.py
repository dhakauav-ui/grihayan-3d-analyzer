from typing import Optional
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.models.survey import ColumnMapping
from app.processing.reader import read_survey_file
from app.processing.validator import validate_survey_dataframe
from app.processing.dem import generate_raster_dem
from app.processing.hillshade import calculate_hillshade_and_slope

router = APIRouter(prefix="/dem", tags=["DTM / DEM & Hillshade"])

class GenerateDEMRequest(BaseModel):
    file_id: str
    column_mapping: ColumnMapping
    source_crs: Optional[str] = None
    resolution: float = 1.0
    azimuth: float = 315.0
    altitude: float = 45.0
    z_factor: float = 1.0

@router.post("/generate")
async def generate_dem_and_hillshade(req: GenerateDEMRequest):
    """
    Generates a high-precision raster DTM/DEM, Horn hillshade texture, and slope statistics.
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
                detail="Not enough valid survey points to generate a DEM surface."
            )

        # Generate DEM grid
        dem_result = generate_raster_dem(
            points_df=cleaned_df,
            resolution=req.resolution
        )

        # Compute Hillshade and Slope from raw DEM array
        hs_result = calculate_hillshade_and_slope(
            dem_array=dem_result["dem_array"],
            cell_size=dem_result["resolution_x"],
            azimuth=req.azimuth,
            altitude=req.altitude,
            z_factor=req.z_factor
        )

        return {
            "success": True,
            "metadata": {
                "rows": dem_result["rows"],
                "cols": dem_result["cols"],
                "resolution": dem_result["resolution_x"],
                "min_z": dem_result["min_z"],
                "max_z": dem_result["max_z"],
                "mean_z": dem_result["mean_z"],
                "valid_cells": dem_result["valid_cells"],
                "nodata_cells": dem_result["nodata_cells"],
                "processing_time_sec": dem_result["processing_time_sec"]
            },
            "bounds": {
                "min_x": dem_result["min_x"],
                "max_x": dem_result["max_x"],
                "min_y": dem_result["min_y"],
                "max_y": dem_result["max_y"],
                "origin_x": dem_result["origin_x"],
                "origin_y": dem_result["origin_y"]
            },
            "preview_grid": dem_result["sampled_preview"],
            "hillshade": hs_result["hillshade_data_url"],
            "elevation_map": hs_result["elevation_data_url"],
            "blend_map": hs_result["blend_data_url"],
            "slope_map": hs_result["slope_data_url"],
            "slope_statistics": hs_result["slope_statistics"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DEM and Hillshade generation failed: {str(e)}"
        )
