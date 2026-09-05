from fastapi import APIRouter
from app.processing.crs import get_crs_presets

router = APIRouter(prefix="/presets", tags=["Presets & Reference Data"])

@router.get("/crs")
async def list_crs_presets():
    """
    Returns common survey Coordinate Reference Systems for selection.
    """
    return {"presets": get_crs_presets()}
