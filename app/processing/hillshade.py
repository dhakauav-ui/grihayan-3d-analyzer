import io
import base64
from typing import Dict, Any, Tuple
import numpy as np
from PIL import Image

def calculate_hillshade_and_slope(
    dem_array: np.ndarray,
    cell_size: float = 1.0,
    azimuth: float = 315.0,
    altitude: float = 45.0,
    z_factor: float = 1.0
) -> Dict[str, Any]:
    """
    Computes Horn (1981) hillshade, slope degrees, hypsometric tint, and blended rasters from DEM.
    Strictly preserves NoData (NaN) pixels as transparent.
    """
    nan_mask = np.isnan(dem_array)
    valid_mask = ~nan_mask
    rows, cols = dem_array.shape

    if not np.any(valid_mask):
        return {
            "hillshade_data_url": "",
            "elevation_data_url": "",
            "slope_data_url": "",
            "blend_data_url": "",
            "slope_statistics": {"min_slope_deg": 0.0, "max_slope_deg": 0.0, "mean_slope_deg": 0.0}
        }

    # Replace NaNs temporarily with nearest valid values for gradient calculation
    min_z = float(np.nanmin(dem_array))
    max_z = float(np.nanmax(dem_array))
    filled_dem = np.nan_to_num(dem_array, nan=min_z)

    # Compute spatial gradients dz/dx and dz/dy using 2nd order central difference
    dz_dy, dz_dx = np.gradient(filled_dem, cell_size, cell_size)
    dz_dx = dz_dx * z_factor
    dz_dy = dz_dy * z_factor

    # Slope in radians and degrees
    slope_rad = np.arctan(np.hypot(dz_dx, dz_dy))
    slope_deg = np.rad2deg(slope_rad)
    slope_deg[nan_mask] = np.nan

    # Aspect in radians
    aspect_rad = np.arctan2(dz_dy, -dz_dx)

    # Convert sun illumination geometry
    azimuth_math = 360.0 - azimuth + 90.0
    azimuth_rad = np.deg2rad(azimuth_math % 360.0)
    zenith_rad = np.deg2rad(90.0 - altitude)

    # Horn's Hillshade equation
    shaded = 255.0 * (
        (np.cos(zenith_rad) * np.cos(slope_rad)) +
        (np.sin(zenith_rad) * np.sin(slope_rad) * np.cos(azimuth_rad - aspect_rad))
    )
    shaded = np.clip(shaded, 0.0, 255.0)
    shaded[nan_mask] = np.nan

    # 1. Generate Hillshade RGBA Image
    rgba_hillshade = np.zeros((rows, cols, 4), dtype=np.uint8)
    shaded_uint8 = np.nan_to_num(shaded, nan=0).astype(np.uint8)
    rgba_hillshade[valid_mask, 0] = shaded_uint8[valid_mask]
    rgba_hillshade[valid_mask, 1] = shaded_uint8[valid_mask]
    rgba_hillshade[valid_mask, 2] = shaded_uint8[valid_mask]
    rgba_hillshade[valid_mask, 3] = 255

    img_hillshade = Image.fromarray(rgba_hillshade, mode="RGBA")
    buf_hs = io.BytesIO()
    img_hillshade.save(buf_hs, format="PNG")
    hs_data_url = f"data:image/png;base64,{base64.b64encode(buf_hs.getvalue()).decode('utf-8')}"

    # 2. Generate Hypsometric Tint (Elevation Color Ramp) Image
    rgba_elev = np.zeros((rows, cols, 4), dtype=np.uint8)
    z_norm = np.clip((np.nan_to_num(dem_array, nan=min_z) - min_z) / (max_z - min_z or 1.0), 0.0, 1.0)
    
    # Precise 5-stop GIS Hypsometric interpolation:
    # 0.00: Blue (37, 99, 235)
    # 0.25: Emerald (16, 185, 129)
    # 0.50: Yellow (234, 179, 8)
    # 0.75: Orange (249, 115, 22)
    # 1.00: Red (239, 68, 68)
    r_elev = np.zeros_like(z_norm)
    g_elev = np.zeros_like(z_norm)
    b_elev = np.zeros_like(z_norm)

    # Segment 0: 0.00 to 0.25
    m0 = (z_norm <= 0.25)
    f0 = z_norm[m0] / 0.25
    r_elev[m0] = 37 + f0 * (16 - 37)
    g_elev[m0] = 99 + f0 * (185 - 99)
    b_elev[m0] = 235 + f0 * (129 - 235)

    # Segment 1: 0.25 to 0.50
    m1 = (z_norm > 0.25) & (z_norm <= 0.50)
    f1 = (z_norm[m1] - 0.25) / 0.25
    r_elev[m1] = 16 + f1 * (234 - 16)
    g_elev[m1] = 185 + f1 * (179 - 185)
    b_elev[m1] = 129 + f1 * (8 - 129)

    # Segment 2: 0.50 to 0.75
    m2 = (z_norm > 0.50) & (z_norm <= 0.75)
    f2 = (z_norm[m2] - 0.50) / 0.25
    r_elev[m2] = 234 + f2 * (249 - 234)
    g_elev[m2] = 179 + f2 * (115 - 179)
    b_elev[m2] = 8 + f2 * (22 - 8)

    # Segment 3: 0.75 to 1.00
    m3 = (z_norm > 0.75)
    f3 = (z_norm[m3] - 0.75) / 0.25
    r_elev[m3] = 249 + f3 * (239 - 249)
    g_elev[m3] = 115 + f3 * (68 - 115)
    b_elev[m3] = 22 + f3 * (68 - 22)

    rgba_elev[valid_mask, 0] = np.clip(r_elev[valid_mask], 0, 255).astype(np.uint8)
    rgba_elev[valid_mask, 1] = np.clip(g_elev[valid_mask], 0, 255).astype(np.uint8)
    rgba_elev[valid_mask, 2] = np.clip(b_elev[valid_mask], 0, 255).astype(np.uint8)
    rgba_elev[valid_mask, 3] = 255

    img_elev = Image.fromarray(rgba_elev, mode="RGBA")
    buf_elev = io.BytesIO()
    img_elev.save(buf_elev, format="PNG")
    elev_data_url = f"data:image/png;base64,{base64.b64encode(buf_elev.getvalue()).decode('utf-8')}"

    # 3. Generate Combined DEM + Hillshade Blended Image
    rgba_blend = np.zeros((rows, cols, 4), dtype=np.uint8)
    hs_factor = (shaded_uint8 / 255.0) * 1.2
    r_blend = np.clip(r_elev * hs_factor, 0, 255)
    g_blend = np.clip(g_elev * hs_factor, 0, 255)
    b_blend = np.clip(b_elev * hs_factor, 0, 255)

    rgba_blend[valid_mask, 0] = r_blend[valid_mask].astype(np.uint8)
    rgba_blend[valid_mask, 1] = g_blend[valid_mask].astype(np.uint8)
    rgba_blend[valid_mask, 2] = b_blend[valid_mask].astype(np.uint8)
    rgba_blend[valid_mask, 3] = 255

    img_blend = Image.fromarray(rgba_blend, mode="RGBA")
    buf_blend = io.BytesIO()
    img_blend.save(buf_blend, format="PNG")
    blend_data_url = f"data:image/png;base64,{base64.b64encode(buf_blend.getvalue()).decode('utf-8')}"

    # 4. Generate Slope Map Image (Green -> Yellow -> Red)
    rgba_slope = np.zeros((rows, cols, 4), dtype=np.uint8)
    slope_norm = np.clip(np.nan_to_num(slope_deg, nan=0) / 45.0, 0.0, 1.0)
    
    r_slope = np.clip(slope_norm * 2.0, 0.0, 1.0) * 255
    g_slope = np.clip((1.0 - slope_norm) * 2.0, 0.0, 1.0) * 255
    b_slope = np.zeros_like(slope_norm) * 255

    rgba_slope[valid_mask, 0] = r_slope[valid_mask].astype(np.uint8)
    rgba_slope[valid_mask, 1] = g_slope[valid_mask].astype(np.uint8)
    rgba_slope[valid_mask, 2] = b_slope[valid_mask].astype(np.uint8)
    rgba_slope[valid_mask, 3] = 255

    img_slope = Image.fromarray(rgba_slope, mode="RGBA")
    buf_sl = io.BytesIO()
    img_slope.save(buf_sl, format="PNG")
    sl_data_url = f"data:image/png;base64,{base64.b64encode(buf_sl.getvalue()).decode('utf-8')}"

    valid_slopes = slope_deg[valid_mask]
    min_slope = float(np.nanmin(valid_slopes)) if len(valid_slopes) > 0 else 0.0
    max_slope = float(np.nanmax(valid_slopes)) if len(valid_slopes) > 0 else 0.0
    mean_slope = float(np.nanmean(valid_slopes)) if len(valid_slopes) > 0 else 0.0

    return {
        "hillshade_data_url": hs_data_url,
        "elevation_data_url": elev_data_url,
        "slope_data_url": sl_data_url,
        "blend_data_url": blend_data_url,
        "parameters": {
            "azimuth": azimuth,
            "altitude": altitude,
            "z_factor": z_factor
        },
        "slope_statistics": {
            "min_slope_deg": round(min_slope, 2),
            "max_slope_deg": round(max_slope, 2),
            "mean_slope_deg": round(mean_slope, 2)
        }
    }
