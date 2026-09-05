import time
from typing import Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd
from matplotlib.tri import Triangulation, LinearTriInterpolator

def generate_raster_dem(
    points_df: pd.DataFrame,
    resolution: float = 1.0,
    x_col: str = "x",
    y_col: str = "y",
    rl_col: str = "rl",
    max_grid_dimension: int = 1000
) -> Dict[str, Any]:
    """
    Generates a regular grid Digital Elevation Model (DEM) from survey points using
    linear interpolation from the TIN, strictly masking outside-TIN cells as NoData (NaN).
    """
    start_time = time.time()

    x_vals = points_df[x_col].to_numpy(dtype=np.float64)
    y_vals = points_df[y_col].to_numpy(dtype=np.float64)
    z_vals = points_df[rl_col].to_numpy(dtype=np.float64)

    min_x, max_x = float(np.min(x_vals)), float(np.max(x_vals))
    min_y, max_y = float(np.min(y_vals)), float(np.max(y_vals))
    min_z, max_z = float(np.min(z_vals)), float(np.max(z_vals))

    span_x = max_x - min_x
    span_y = max_y - min_y

    # Auto-adjust resolution if grid size exceeds max dimensions
    cols = int(np.ceil(span_x / resolution)) + 1
    rows = int(np.ceil(span_y / resolution)) + 1

    actual_res = resolution
    if max(cols, rows) > max_grid_dimension:
        scale_factor = max(cols, rows) / max_grid_dimension
        actual_res = resolution * scale_factor
        cols = int(np.ceil(span_x / actual_res)) + 1
        rows = int(np.ceil(span_y / actual_res)) + 1

    # Coordinate vectors
    grid_x = np.linspace(min_x, min_x + (cols - 1) * actual_res, cols)
    grid_y = np.linspace(min_y, min_y + (rows - 1) * actual_res, rows)

    # 2D Grid coordinates (grid_y is reversed for raster row indexing top-to-bottom)
    grid_y_rev = grid_y[::-1]
    gx, gy = np.meshgrid(grid_x, grid_y_rev)

    # Fast Triangulation-based Linear Interpolation
    tri = Triangulation(x_vals, y_vals)
    interpolator = LinearTriInterpolator(tri, z_vals)
    interpolated_grid = interpolator(gx, gy) # MaskedArray

    # Convert MaskedArray cleanly to standard numpy float array with np.nan for masked
    if hasattr(interpolated_grid, "filled"):
        dem_grid = interpolated_grid.filled(np.nan).astype(np.float64)
    else:
        dem_grid = np.array(interpolated_grid, dtype=np.float64)

    # Fill mask
    valid_mask = ~np.isnan(dem_grid)
    valid_cells = int(np.sum(valid_mask))
    nodata_cells = int(np.sum(~valid_mask))

    dem_min = float(np.nanmin(dem_grid)) if valid_cells > 0 else min_z
    dem_max = float(np.nanmax(dem_grid)) if valid_cells > 0 else max_z
    dem_mean = float(np.nanmean(dem_grid)) if valid_cells > 0 else (min_z + max_z) / 2

    elapsed_time = time.time() - start_time

    # Safe float representation replacing NaN with None for JSON serialization
    sample_step = max(1, int(max(rows, cols) / 200))
    sampled_rows = dem_grid[::sample_step, ::sample_step]
    
    dem_list = []
    for r in range(sampled_rows.shape[0]):
        row_vals = []
        for c in range(sampled_rows.shape[1]):
            val = sampled_rows[r, c]
            if np.isnan(val) or np.isinf(val):
                row_vals.append(None)
            else:
                row_vals.append(round(float(val), 3))
        dem_list.append(row_vals)

    return {
        "dem_array": dem_grid,  # raw numpy array for internal hillshade/contour processing
        "rows": rows,
        "cols": cols,
        "resolution_x": actual_res,
        "resolution_y": actual_res,
        "origin_x": min_x,
        "origin_y": max_y,  # Top-left corner for GeoTIFF transform
        "min_x": min_x,
        "max_x": max_x,
        "min_y": min_y,
        "max_y": max_y,
        "min_z": round(dem_min, 3),
        "max_z": round(dem_max, 3),
        "mean_z": round(dem_mean, 3),
        "valid_cells": valid_cells,
        "nodata_cells": nodata_cells,
        "processing_time_sec": round(elapsed_time, 3),
        "sampled_preview": {
            "rows": sampled_rows.shape[0],
            "cols": sampled_rows.shape[1],
            "grid": dem_list
        }
    }
