from typing import Dict, Any, List
import numpy as np

def calculate_earthwork_volume(
    dem_array: np.ndarray,
    cell_size: float = 1.0,
    datum_elevation: float = 10.0,
    bounds: Dict[str, float] = None
) -> Dict[str, Any]:
    """
    Calculates comprehensive Cut, Fill, and Net earthwork volumes,
    surface areas, depth distributions, optimal balance datum, and 2D spatial difference grid.
    """
    valid_mask = ~np.isnan(dem_array)
    valid_z = dem_array[valid_mask]

    if len(valid_z) == 0:
        return {
            "datum_elevation_m": datum_elevation,
            "cut_volume_m3": 0.0,
            "fill_volume_m3": 0.0,
            "net_volume_m3": 0.0,
            "covered_area_m2": 0.0,
            "cut_area_m2": 0.0,
            "fill_area_m2": 0.0,
            "max_cut_depth_m": 0.0,
            "max_fill_depth_m": 0.0,
            "avg_cut_depth_m": 0.0,
            "avg_fill_depth_m": 0.0,
            "optimal_balanced_datum_m": datum_elevation,
            "depth_distribution": [],
            "heatmap": None
        }

    cell_area = cell_size * cell_size
    diff = valid_z - datum_elevation

    cut_mask = diff > 0
    fill_mask = diff < 0

    cut_depths = diff[cut_mask]
    fill_depths = -diff[fill_mask]

    cut_volume = float(np.sum(cut_depths) * cell_area) if len(cut_depths) > 0 else 0.0
    fill_volume = float(np.sum(fill_depths) * cell_area) if len(fill_depths) > 0 else 0.0
    net_volume = cut_volume - fill_volume
    covered_area = float(len(valid_z) * cell_area)

    cut_area = float(np.sum(cut_mask) * cell_area)
    fill_area = float(np.sum(fill_mask) * cell_area)

    max_cut_depth = float(np.max(cut_depths)) if len(cut_depths) > 0 else 0.0
    max_fill_depth = float(np.max(fill_depths)) if len(fill_depths) > 0 else 0.0

    avg_cut_depth = float(np.mean(cut_depths)) if len(cut_depths) > 0 else 0.0
    avg_fill_depth = float(np.mean(fill_depths)) if len(fill_depths) > 0 else 0.0

    # Optimal zero-balance datum where Net Volume == 0 (Mean Surface RL)
    optimal_balanced_datum = float(np.mean(valid_z))

    # Depth Distribution Bins
    bin_ranges = [
        ("0.0 - 0.5m", 0.0, 0.5),
        ("0.5 - 1.0m", 0.5, 1.0),
        ("1.0 - 2.0m", 1.0, 2.0),
        ("2.0 - 3.0m", 2.0, 3.0),
        ("> 3.0m", 3.0, 99999.0)
    ]

    depth_distribution: List[Dict[str, Any]] = []
    for label, low, high in bin_ranges:
        c_in_bin = cut_depths[(cut_depths >= low) & (cut_depths < high)] if len(cut_depths) > 0 else np.array([])
        f_in_bin = fill_depths[(fill_depths >= low) & (fill_depths < high)] if len(fill_depths) > 0 else np.array([])

        c_vol = float(np.sum(c_in_bin) * cell_area) if len(c_in_bin) > 0 else 0.0
        f_vol = float(np.sum(f_in_bin) * cell_area) if len(f_in_bin) > 0 else 0.0

        depth_distribution.append({
            "range": label,
            "cut_volume_m3": round(c_vol, 2),
            "fill_volume_m3": round(f_vol, 2),
            "cut_count": int(len(c_in_bin)),
            "fill_count": int(len(f_in_bin))
        })

    # Generate Downsampled 2D Difference Heatmap Grid for fast Canvas Rendering
    # Matrix of (Z - datum), where >0 is Cut (red), <0 is Fill (green), NaN is no data
    diff_grid = np.where(valid_mask, dem_array - datum_elevation, np.nan)
    h, w = diff_grid.shape
    max_res = 120
    step_y = max(1, h // max_res)
    step_x = max(1, w // max_res)
    downsampled_grid = diff_grid[::step_y, ::step_x]

    # Convert to JSON serializable nested list (replacing nan with null/None)
    heatmap_matrix = [
        [round(float(v), 2) if not np.isnan(v) else None for v in row]
        for row in downsampled_grid
    ]

    return {
        "datum_elevation_m": round(datum_elevation, 3),
        "cut_volume_m3": round(cut_volume, 2),
        "fill_volume_m3": round(fill_volume, 2),
        "net_volume_m3": round(net_volume, 2),
        "covered_area_m2": round(covered_area, 2),
        "cut_area_m2": round(cut_area, 2),
        "fill_area_m2": round(fill_area, 2),
        "cut_area_pct": round((cut_area / covered_area) * 100, 1) if covered_area > 0 else 0.0,
        "fill_area_pct": round((fill_area / covered_area) * 100, 1) if covered_area > 0 else 0.0,
        "max_cut_depth_m": round(max_cut_depth, 3),
        "max_fill_depth_m": round(max_fill_depth, 3),
        "avg_cut_depth_m": round(avg_cut_depth, 3),
        "avg_fill_depth_m": round(avg_fill_depth, 3),
        "mean_surface_elevation_m": round(float(np.mean(valid_z)), 3),
        "optimal_balanced_datum_m": round(optimal_balanced_datum, 3),
        "depth_distribution": depth_distribution,
        "heatmap": {
            "matrix": heatmap_matrix,
            "rows": len(heatmap_matrix),
            "cols": len(heatmap_matrix[0]) if heatmap_matrix else 0,
            "bounds": bounds
        }
    }
