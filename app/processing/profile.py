from typing import Dict, Any, List
import numpy as np
from matplotlib.tri import Triangulation, LinearTriInterpolator
import pandas as pd

def compute_elevation_profile(
    points_df: pd.DataFrame,
    start_x: float,
    start_y: float,
    end_x: float,
    end_y: float,
    num_samples: int = 100,
    x_col: str = "x",
    y_col: str = "y",
    rl_col: str = "rl"
) -> Dict[str, Any]:
    """
    Interpolates a cross-section elevation profile along a defined 2D polyline.
    """
    total_dist = float(np.hypot(end_x - start_x, end_y - start_y))
    if total_dist == 0:
        return {"total_distance": 0, "stations": []}

    # Sample points along line
    t_vals = np.linspace(0.0, 1.0, num_samples)
    sample_x = start_x + t_vals * (end_x - start_x)
    sample_y = start_y + t_vals * (end_y - start_y)
    chainage_vals = t_vals * total_dist

    # Interpolate from TIN
    x_arr = points_df[x_col].to_numpy(dtype=np.float64)
    y_arr = points_df[y_col].to_numpy(dtype=np.float64)
    z_arr = points_df[rl_col].to_numpy(dtype=np.float64)

    tri = Triangulation(x_arr, y_arr)
    interp = LinearTriInterpolator(tri, z_arr)
    sample_z = interp(sample_x, sample_y)

    stations: List[Dict[str, Any]] = []
    valid_elevations = []

    for i in range(num_samples):
        elev_val = float(sample_z[i]) if not np.isnan(sample_z[i]) else None
        if elev_val is not None:
            valid_elevations.append(elev_val)
        
        # Calculate localized slope between consecutive stations
        slope_pct = 0.0
        if i > 0 and elev_val is not None and stations[i - 1]["elevation"] is not None:
            d_dist = float(chainage_vals[i] - chainage_vals[i - 1])
            d_elev = float(elev_val - stations[i - 1]["elevation"])
            if d_dist > 0:
                slope_pct = round((d_elev / d_dist) * 100.0, 2)

        stations.append({
            "station_idx": i + 1,
            "chainage": round(float(chainage_vals[i]), 2),
            "x": round(float(sample_x[i]), 3),
            "y": round(float(sample_y[i]), 3),
            "elevation": round(elev_val, 3) if elev_val is not None else None,
            "slope_pct": slope_pct
        })

    min_elev = float(np.min(valid_elevations)) if valid_elevations else 0.0
    max_elev = float(np.max(valid_elevations)) if valid_elevations else 0.0
    mean_elev = float(np.mean(valid_elevations)) if valid_elevations else 0.0
    elev_diff = max_elev - min_elev
    overall_slope_pct = round((elev_diff / total_dist) * 100.0, 2) if total_dist > 0 else 0.0
    azimuth = round((float(np.degrees(np.arctan2(end_x - start_x, end_y - start_y))) + 360.0) % 360.0, 2)

    return {
        "total_distance_m": round(total_dist, 2),
        "min_elevation_m": round(min_elev, 3),
        "max_elevation_m": round(max_elev, 3),
        "mean_elevation_m": round(mean_elev, 3),
        "elevation_difference_m": round(elev_diff, 3),
        "overall_slope_pct": overall_slope_pct,
        "azimuth_deg": azimuth,
        "stations": stations
    }

