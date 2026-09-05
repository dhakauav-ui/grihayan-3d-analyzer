from typing import Optional, List, Dict
try:
    import pyproj
except Exception:
    pyproj = None
from app.models.survey import CRSDetails

COMMON_CRS_PRESETS = [
    {"code": "EPSG:32646", "name": "WGS 84 / UTM zone 46N (Bangladesh East)", "type": "Projected", "unit": "meter"},
    {"code": "EPSG:32645", "name": "WGS 84 / UTM zone 45N (Bangladesh West)", "type": "Projected", "unit": "meter"},
    {"code": "EPSG:9678", "name": "Gulshan 303 / Bangladesh Transverse Mercator (BTM)", "type": "Projected", "unit": "meter"},
    {"code": "EPSG:3106", "name": "Gulshan 303 / BTM 2000", "type": "Projected", "unit": "meter"},
    {"code": "EPSG:4326", "name": "WGS 84 (Geographic 2D - Lat/Lon)", "type": "Geographic", "unit": "degree"},
    {"code": "EPSG:3857", "name": "WGS 84 / Pseudo-Mercator (Web)", "type": "Projected", "unit": "meter"},
    {"code": "LOCAL", "name": "Local Engineering Survey Grid / TBM Datum", "type": "Local", "unit": "meter"},
]

def get_crs_presets() -> List[Dict]:
    return COMMON_CRS_PRESETS

def analyze_and_verify_crs(
    crs_input: Optional[str],
    min_x: float,
    max_x: float,
    min_y: float,
    max_y: float
) -> CRSDetails:
    """
    Validates CRS input against coordinate bounds and pyproj registry.
    """
    if not crs_input or crs_input.strip().upper() in ("AUTO", "NONE", "UNKNOWN", ""):
        # Check if coordinates look like UTM or Geographic
        is_geographic = (-180.0 <= min_x <= 180.0) and (-90.0 <= max_y <= 90.0)
        
        warning = "Coordinate Reference System has not been confirmed. Local 3D visualization is fully enabled, but geospatial GIS exports require a confirmed CRS."
        return CRSDetails(
            epsg=None,
            name="Unconfirmed / Local Grid",
            is_projected=not is_geographic,
            unit="degree" if is_geographic else "meter",
            datum=None,
            status="UNCONFIRMED",
            warning=warning
        )

    if crs_input.strip().upper() == "LOCAL":
        return CRSDetails(
            epsg="LOCAL",
            name="Local Survey Coordinate System",
            is_projected=True,
            unit="meter",
            datum="Local TBM",
            status="LOCAL_GRID",
            warning="Data uses a local engineering reference grid."
        )

    clean_code = crs_input.strip()
    if not clean_code.upper().startswith("EPSG:") and clean_code.isdigit():
        clean_code = f"EPSG:{clean_code}"

    try:
        proj_crs = pyproj.CRS.from_user_input(clean_code)
        is_projected = proj_crs.is_projected
        crs_name = proj_crs.name
        datum_name = proj_crs.datum.name if proj_crs.datum else None
        
        # Check units
        axis_info = proj_crs.axis_info
        unit_name = axis_info[0].unit_name if axis_info else "meter"

        warning = None
        # Sanity check: if user chose geographic (EPSG:4326) but values are > 1000
        if not is_projected and (abs(min_x) > 180 or abs(max_x) > 180 or abs(min_y) > 90 or abs(max_y) > 90):
            warning = f"Warning: Selected CRS ({clean_code}) is Geographic (degrees), but coordinate values (X: {min_x:.1f}, Y: {min_y:.1f}) are outside [-180, 180] degrees. The data appears to be Projected (meters)."

        return CRSDetails(
            epsg=clean_code.upper(),
            name=crs_name,
            is_projected=is_projected,
            unit=unit_name,
            datum=datum_name,
            status="CONFIRMED",
            warning=warning
        )
    except Exception as e:
        return CRSDetails(
            epsg=clean_code,
            name="Custom / Unverified CRS",
            is_projected=True,
            unit="meter",
            datum=None,
            status="UNCONFIRMED",
            warning=f"CRS '{clean_code}' could not be resolved by PROJ registry ({str(e)}). Processing will continue in local coordinates."
        )
