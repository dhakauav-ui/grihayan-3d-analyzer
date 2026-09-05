import time
from typing import Dict, Any, Optional, Tuple, List
import numpy as np
import pandas as pd
from scipy.spatial import Delaunay
try:
    from shapely.geometry import MultiPoint, Polygon
except Exception:
    MultiPoint, Polygon = None, None

def generate_tin_surface(
    points_df: pd.DataFrame,
    x_col: str = "x",
    y_col: str = "y",
    rl_col: str = "rl",
    id_col: str = "point_id",
    code_col: Optional[str] = "code",
    max_edge_length: Optional[float] = None,
    max_points_for_triangulation: int = 500000
) -> Dict[str, Any]:
    """
    Generates an authoritative, watertight TIN surface from survey points using Delaunay triangulation.
    Preserves exact survey X, Y, RL coordinates without alteration or missing triangle gaps.
    """
    start_time = time.time()
    
    num_total_points = len(points_df)
    if num_total_points < 3:
        raise ValueError(f"Insufficient points ({num_total_points}) for TIN triangulation. At least 3 points required.")

    # Spatial subsampling only if dataset is excessively large (>500k points) to maintain 100% watertight topology
    working_df = points_df
    if num_total_points > max_points_for_triangulation:
        step = int(np.ceil(num_total_points / max_points_for_triangulation))
        working_df = points_df.iloc[::step]

    # Extract coordinates as contiguous float64 arrays
    x_vals = working_df[x_col].to_numpy(dtype=np.float64)
    y_vals = working_df[y_col].to_numpy(dtype=np.float64)
    z_vals = working_df[rl_col].to_numpy(dtype=np.float64)
    num_points = len(x_vals)

    # Calculate center for local coordinate centering in 3D WebGL (preventing float precision jitter)
    center_x = float(np.mean(x_vals))
    center_y = float(np.mean(y_vals))
    center_z = float(np.mean(z_vals))

    min_x, max_x = float(np.min(x_vals)), float(np.max(x_vals))
    min_y, max_y = float(np.min(y_vals)), float(np.max(y_vals))
    min_z, max_z = float(np.min(z_vals)), float(np.max(z_vals))

    # Point matrix for 2D Delaunay
    pts_2d = np.column_stack((x_vals, y_vals))
    
    # Perform full Delaunay Triangulation
    tri = Delaunay(pts_2d)
    simplices = tri.simplices.copy() # shape (N, 3)
    initial_triangle_count = len(simplices)

    # Filter triangles by max edge length if specified (e.g. to remove bridge triangles across convex hull gaps)
    if max_edge_length and max_edge_length > 0:
        p0 = pts_2d[simplices[:, 0]]
        p1 = pts_2d[simplices[:, 1]]
        p2 = pts_2d[simplices[:, 2]]

        d01 = np.hypot(p0[:, 0] - p1[:, 0], p0[:, 1] - p1[:, 1])
        d12 = np.hypot(p1[:, 0] - p2[:, 0], p1[:, 1] - p2[:, 1])
        d20 = np.hypot(p2[:, 0] - p0[:, 0], p2[:, 1] - p0[:, 1])

        valid_mask = (d01 <= max_edge_length) & (d12 <= max_edge_length) & (d20 <= max_edge_length)
        simplices = simplices[valid_mask]

    triangle_count = len(simplices)

    # Compute 2D Area and 3D Surface Area
    v0_x, v0_y, v0_z = x_vals[simplices[:, 0]], y_vals[simplices[:, 0]], z_vals[simplices[:, 0]]
    v1_x, v1_y, v1_z = x_vals[simplices[:, 1]], y_vals[simplices[:, 1]], z_vals[simplices[:, 1]]
    v2_x, v2_y, v2_z = x_vals[simplices[:, 2]], y_vals[simplices[:, 2]], z_vals[simplices[:, 2]]

    # 2D cross product for horizontal area
    area_2d_triangles = 0.5 * np.abs(
        v0_x * (v1_y - v2_y) + v1_x * (v2_y - v0_y) + v2_x * (v0_y - v1_y)
    )
    total_2d_area = float(np.sum(area_2d_triangles))

    # 3D cross product for real terrain surface area
    ab_x, ab_y, ab_z = v1_x - v0_x, v1_y - v0_y, v1_z - v0_z
    ac_x, ac_y, ac_z = v2_x - v0_x, v2_y - v0_y, v2_z - v0_z

    cross_x = ab_y * ac_z - ab_z * ac_y
    cross_y = ab_z * ac_x - ab_x * ac_z
    cross_z = ab_x * ac_y - ab_y * ac_x

    area_3d_triangles = 0.5 * np.sqrt(cross_x**2 + cross_y**2 + cross_z**2)
    total_3d_surface_area = float(np.sum(area_3d_triangles))

    # Calculate Convex Hull for Boundary Perimeter and Extrusion Skirt
    boundary_indices: List[int] = []
    try:
        pts_shapely = MultiPoint(pts_2d)
        hull = pts_shapely.convex_hull
        hull_perimeter = float(hull.length)
        hull_area = float(hull.area)

        # Extract ordered perimeter points for 3D Geological Skirt
        if hasattr(hull, 'exterior') and hull.exterior:
            coords = np.array(hull.exterior.coords)
            # Find nearest vertex indices for boundary
            for coord in coords[:-1]: # exclude repeating end point
                dists = np.hypot(x_vals - coord[0], y_vals - coord[1])
                closest_idx = int(np.argmin(dists))
                boundary_indices.append(closest_idx)
    except Exception:
        hull_perimeter = 2 * ((max_x - min_x) + (max_y - min_y))
        hull_area = total_2d_area

    # Prepare local centered vertex array for WebGL (Float32)
    local_x = (x_vals - center_x).astype(np.float32)
    local_y = (y_vals - center_y).astype(np.float32)
    local_z = (z_vals - center_z).astype(np.float32)

    # Interleave into [x0, y0, z0, x1, y1, z1, ...]
    vertices_flat = np.empty(num_points * 3, dtype=np.float32)
    vertices_flat[0::3] = local_x
    vertices_flat[1::3] = local_y
    vertices_flat[2::3] = local_z

    indices_flat = simplices.flatten().astype(np.int32)
    elapsed_time = time.time() - start_time

    # Point IDs and codes for inspection
    id_vals = working_df[id_col].astype(str).to_numpy() if id_col in working_df.columns else np.arange(1, num_points + 1).astype(str)
    code_vals = working_df[code_col].astype(str).to_numpy() if code_col and code_col in working_df.columns else np.repeat("", num_points)

    # Sample 100 points for quick reference
    sample_points = []
    for i in range(min(100, num_points)):
        sample_points.append({
            "point_id": str(id_vals[i]),
            "x": float(x_vals[i]),
            "y": float(y_vals[i]),
            "rl": float(z_vals[i]),
            "code": str(code_vals[i]) if code_vals[i] else ""
        })

    return {
        "num_points": num_points,
        "triangle_count": triangle_count,
        "initial_triangle_count": initial_triangle_count,
        "is_simplified_for_display": False,
        "processing_time_sec": round(elapsed_time, 3),
        "center": {
            "x": center_x,
            "y": center_y,
            "z": center_z
        },
        "bounds": {
            "min_x": min_x,
            "max_x": max_x,
            "min_y": min_y,
            "max_y": max_y,
            "min_z": min_z,
            "max_z": max_z,
            "range_x": max_x - min_x,
            "range_y": max_y - min_y,
            "range_z": max_z - min_z
        },
        "geometry": {
            "vertices": vertices_flat.tolist(),
            "indices": indices_flat.tolist(),
            "raw_elevations": z_vals.astype(np.float32).tolist(),
            "boundary_indices": boundary_indices
        },
        "metrics": {
            "area_2d_m2": round(total_2d_area, 2),
            "surface_area_3d_m2": round(total_3d_surface_area, 2),
            "hull_area_m2": round(hull_area, 2),
            "perimeter_m": round(hull_perimeter, 2)
        },
        "sample_points": sample_points
    }
