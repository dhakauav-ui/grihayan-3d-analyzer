import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.core.config import settings
from app.core.errors import InvalidFileFormatException
from app.models.survey import RawPreviewResponse
from app.processing.reader import read_survey_file
from app.processing.detector import detect_columns

router = APIRouter(prefix="/upload", tags=["Upload & Detection"])

@router.post("", response_model=RawPreviewResponse)
async def upload_survey_file(file: UploadFile = File(...)):
    """
    Uploads a survey file (CSV/XLSX/TXT), parses metadata, auto-detects columns,
    and returns the first 50 rows for user confirmation.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided.")
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise InvalidFileFormatException(
            f"Unsupported file format '{file_ext}'. Allowed formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    file_id = str(uuid.uuid4())
    saved_filename = f"{file_id}_{Path(file.filename).name}"
    saved_path = settings.UPLOAD_DIR / saved_filename

    # Save uploaded file safely
    try:
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {str(e)}"
        )
    finally:
        file.file.close()

    file_size_bytes = saved_path.stat().st_size

    # Read and parse file
    try:
        df, has_headers, headers = read_survey_file(saved_path)
    except Exception as e:
        if saved_path.exists():
            saved_path.unlink()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Detect columns
    column_mapping, confidence_scores, suggested_crs = detect_columns(df, has_headers)

    # Sample preview rows (up to 50)
    preview_df = df.head(50)
    preview_rows = preview_df.to_dict(orient="records")

    return RawPreviewResponse(
        file_id=saved_filename,
        filename=file.filename,
        file_type=file_ext.replace(".", "").upper(),
        file_size_bytes=file_size_bytes,
        total_rows=len(df),
        total_columns=len(headers),
        has_headers=has_headers,
        headers=headers,
        detected_columns=column_mapping,
        column_confidence=confidence_scores,
        preview_rows=preview_rows,
        suggested_crs=suggested_crs
    )
