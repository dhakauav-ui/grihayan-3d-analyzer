from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.models.survey import ValidateRequest, ValidationSummary
from app.processing.reader import read_survey_file
from app.processing.validator import validate_survey_dataframe

router = APIRouter(prefix="/validate", tags=["Validation"])

@router.post("", response_model=ValidationSummary)
async def validate_survey_data(req: ValidateRequest):
    """
    Validates uploaded survey data against user-confirmed column mapping and CRS.
    Returns complete validation metrics, issue lists, and preview rows.
    """
    file_path = settings.UPLOAD_DIR / req.file_id
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Uploaded file '{req.file_id}' not found. Please upload the survey file again."
        )

    try:
        df, _, _ = read_survey_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        summary, _ = validate_survey_dataframe(
            df=df,
            mapping=req.column_mapping,
            source_crs=req.source_crs
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Validation failed: {str(e)}"
        )
