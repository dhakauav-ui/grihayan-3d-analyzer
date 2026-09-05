from typing import Optional
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.models.survey import ColumnMapping
from app.processing.reader import read_survey_file
from app.processing.validator import validate_survey_dataframe
from app.processing.tin import generate_tin_surface
from app.processing.statistics import calculate_project_statistics

router = APIRouter(prefix="/surface", tags=["Surface Generation & TIN"])

class GenerateSurfaceRequest(BaseModel):
    file_id: str
    column_mapping: ColumnMapping
    source_crs: Optional[str] = None
    max_edge_length: Optional[float] = None
    vertical_datum: Optional[str] = "Local TBM"

@router.post("/generate")
async def generate_surface_model(req: GenerateSurfaceRequest):
    """
    Generates an authoritative Delaunay TIN surface and comprehensive project statistics
    from the validated survey file.
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
        # Validate data
        summary, cleaned_df = validate_survey_dataframe(
            df=df,
            mapping=req.column_mapping,
            source_crs=req.source_crs
        )

        if len(cleaned_df) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not enough valid survey points to generate a surface (at least 3 points required)."
            )

        # Generate TIN
        tin_result = generate_tin_surface(
            points_df=cleaned_df,
            x_col="x",
            y_col="y",
            rl_col="rl",
            id_col="point_id",
            code_col="code",
            max_edge_length=req.max_edge_length
        )

        # Compute Project Statistics
        stats_result = calculate_project_statistics(
            points_df=cleaned_df,
            total_raw_records=summary.total_records,
            rejected_count=summary.invalid_records,
            tin_metrics={
                "area_2d_m2": tin_result["metrics"]["area_2d_m2"],
                "surface_area_3d_m2": tin_result["metrics"]["surface_area_3d_m2"],
                "perimeter_m": tin_result["metrics"]["perimeter_m"],
                "triangle_count": tin_result["triangle_count"],
                "is_simplified_for_display": tin_result["is_simplified_for_display"]
            }
        )

        return {
            "success": True,
            "tin": tin_result,
            "statistics": stats_result,
            "crs": summary.crs.model_dump(),
            "validation_summary": summary.model_dump()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TIN Surface generation failed: {str(e)}"
        )
