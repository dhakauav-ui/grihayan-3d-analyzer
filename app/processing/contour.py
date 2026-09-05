import time
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import matplotlib.pyplot as plt

def generate_vector_contours(
    dem_array: np.ndarray,
    min_x: float,
    max_x: float,
    min_y: float,
    max_y: float,
    interval: float = 1.0,
    major_interval_multiplier: int = 5
) -> Dict[str, Any]:
    """
    Generates exact vector contour polylines from the DEM surface with major/minor categorization
    and elevation labeling.
    """
    start_time = time.time()
    
    rows, cols = dem_array.shape
    valid_mask = ~np.isnan(dem_array)
    if not np.any(valid_mask):
        return {
            "interval": interval,
            "major_interval": interval * major_interval_multiplier,
            "elevation_min": 0.0,
            "elevation_max": 0.0,
            "total_lines": 0,
            "major_count": 0,
            "minor_count": 0,
            "total_vertices": 0,
            "processing_time_sec": 0.0,
            "major_contours": [],
            "minor_contours": [],
            "geojson": {"type": "FeatureCollection", "features": []}
        }

    min_z = float(np.nanmin(dem_array))
    max_z = float(np.nanmax(dem_array))

    # Calculate discrete contour levels
    start_level = np.floor(min_z / interval) * interval
    end_level = np.ceil(max_z / interval) * interval
    levels = np.arange(start_level, end_level + interval, interval)
    levels = levels[(levels >= min_z) & (levels <= max_z)]

    if len(levels) == 0:
        levels = np.array([min_z, (min_z + max_z) / 2, max_z])

    major_interval = interval * major_interval_multiplier

    # Coordinate vectors
    gx = np.linspace(min_x, max_x, cols)
    gy = np.linspace(max_y, min_y, rows) # matching top-to-bottom

    # Use matplotlib contour engine without displaying
    fig, ax = plt.subplots(figsize=(1, 1))
    cs = ax.contour(gx, gy, dem_array, levels=levels)
    plt.close(fig)

    major_contours: List[Dict[str, Any]] = []
    minor_contours: List[Dict[str, Any]] = []
    geojson_features: List[Dict[str, Any]] = []

    total_vertices = 0

    # Extract contour line segments across matplotlib versions
    all_segs = cs.allsegs if hasattr(cs, "allsegs") else []
    levels_list = list(cs.levels)

    for level, segs in zip(levels_list, all_segs):
        elev = float(level)
        # Check if major (multiple of major_interval)
        is_major = (round(elev, 4) % round(major_interval, 4) < 1e-4) or (abs(elev % major_interval - major_interval) < 1e-4)

        for polyline in segs:
            if len(polyline) < 2:
                continue

            coords_3d = [[round(float(pt[0]), 3), round(float(pt[1]), 3), round(elev, 3)] for pt in polyline]
            coords_2d = [[round(float(pt[0]), 3), round(float(pt[1]), 3)] for pt in polyline]
            
            total_vertices += len(coords_3d)

            contour_obj = {
                "elevation": round(elev, 3),
                "is_major": bool(is_major),
                "point_count": len(coords_3d),
                "points": coords_3d
            }

            if is_major:
                major_contours.append(contour_obj)
            else:
                minor_contours.append(contour_obj)

            geojson_features.append({
                "type": "Feature",
                "properties": {
                    "elevation": round(elev, 3),
                    "is_major": bool(is_major),
                    "interval": interval
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords_2d
                }
            })

    elapsed_time = time.time() - start_time

    return {
        "interval": interval,
        "major_interval": major_interval,
        "elevation_min": round(min_z, 3),
        "elevation_max": round(max_z, 3),
        "total_lines": len(major_contours) + len(minor_contours),
        "major_count": len(major_contours),
        "minor_count": len(minor_contours),
        "total_vertices": total_vertices,
        "processing_time_sec": round(elapsed_time, 3),
        "major_contours": major_contours,
        "minor_contours": minor_contours,
        "geojson": {
            "type": "FeatureCollection",
            "features": geojson_features
        }
    }
