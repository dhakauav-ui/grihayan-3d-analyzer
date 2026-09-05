from typing import Dict, Any, Optional
import numpy as np
import pandas as pd

def calculate_project_statistics(
    points_df: pd.DataFrame,
    total_raw_records: int,
    rejected_count: int,
    tin_metrics: Optional[Dict[str, Any]] = None,
    rl_col: str = "rl",
    x_col: str = "x",
    y_col: str = "y"
) -> Dict[str, Any]:
    """
    Computes professional survey statistics from validated survey points and TIN model.
    """
    x_vals = points_df[x_col].to_numpy(dtype=np.float64)
    y_vals = points_df[y_col].to_numpy(dtype=np.float64)
    z_vals = points_df[rl_col].to_numpy(dtype=np.float64)

    valid_points = len(z_vals)
    if valid_points == 0:
        return {}

    # Elevation Statistics
    min_rl = float(np.min(z_vals))
    max_rl = float(np.max(z_vals))
    range_rl = max_rl - min_rl
    mean_rl = float(np.mean(z_vals))
    median_rl = float(np.median(z_vals))
    std_rl = float(np.std(z_vals))
    variance_rl = float(np.var(z_vals))

    # Horizontal Coordinate Extents
    min_x = float(np.min(x_vals))
    max_x = float(np.max(x_vals))
    range_x = max_x - min_x

    min_y = float(np.min(y_vals))
    max_y = float(np.max(y_vals))
    range_y = max_y - min_y

    # Area conversions (1 Hectare = 10,000 m2, 1 Acre = 4046.856 m2)
    area_2d_m2 = tin_metrics.get("area_2d_m2", range_x * range_y) if tin_metrics else range_x * range_y
    area_3d_m2 = tin_metrics.get("surface_area_3d_m2", area_2d_m2) if tin_metrics else area_2d_m2
    perimeter_m = tin_metrics.get("perimeter_m", 2 * (range_x + range_y)) if tin_metrics else 2 * (range_x + range_y)

    area_acres = round(area_2d_m2 / 4046.8564224, 3)
    area_hectares = round(area_2d_m2 / 10000.0, 3)

    return {
        "point_counts": {
            "total_records": total_raw_records,
            "valid_points": valid_points,
            "rejected_points": rejected_count,
            "valid_percentage": round((valid_points / (total_raw_records or 1)) * 100, 2)
        },
        "elevation": {
            "min_rl": round(min_rl, 3),
            "max_rl": round(max_rl, 3),
            "range_rl": round(range_rl, 3),
            "mean_rl": round(mean_rl, 3),
            "median_rl": round(median_rl, 3),
            "std_dev_rl": round(std_rl, 3),
            "variance_rl": round(variance_rl, 4)
        },
        "horizontal": {
            "min_x": round(min_x, 3),
            "max_x": round(max_x, 3),
            "range_x": round(range_x, 3),
            "min_y": round(min_y, 3),
            "max_y": round(max_y, 3),
            "range_y": round(range_y, 3)
        },
        "spatial_area": {
            "area_2d_sqm": round(area_2d_m2, 2),
            "area_acres": area_acres,
            "area_hectares": area_hectares,
            "surface_area_3d_sqm": round(area_3d_m2, 2),
            "perimeter_m": round(perimeter_m, 2),
            "surface_rugosity_ratio": round(area_3d_m2 / (area_2d_m2 or 1), 4)
        },
        "tin": {
            "triangle_count": tin_metrics.get("triangle_count", 0) if tin_metrics else 0,
            "is_simplified_for_display": tin_metrics.get("is_simplified_for_display", False) if tin_metrics else False
        }
    }
