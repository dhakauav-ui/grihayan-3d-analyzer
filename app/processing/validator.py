from typing import Tuple, List, Dict, Any, Optional
import numpy as np
import pandas as pd
from app.models.survey import (
    ColumnMapping,
    ValidationSummary,
    ValidationIssue,
    SurveyBounds,
    CRSDetails
)
from app.processing.crs import analyze_and_verify_crs
from app.core.errors import InsufficientPointsException

def validate_survey_dataframe(
    df: pd.DataFrame,
    mapping: ColumnMapping,
    source_crs: Optional[str] = None
) -> Tuple[ValidationSummary, pd.DataFrame]:
    """
    Performs high-performance validation on survey dataframe without modifying survey values.
    Returns: (ValidationSummary, valid_df_cleaned)
    """
    total_records = len(df)
    issues: List[ValidationIssue] = []

    # Verify required mapped columns exist in df
    for field_name, col_key in [("Point ID", mapping.point_id), ("X", mapping.x), ("Y", mapping.y), ("RL", mapping.rl)]:
        if col_key not in df.columns:
            raise ValueError(f"Column mapped to {field_name} ('{col_key}') was not found in the file.")

    # Extract series as strings
    id_series = df[mapping.point_id].astype(str).str.strip()
    x_raw = df[mapping.x].astype(str).str.strip()
    y_raw = df[mapping.y].astype(str).str.strip()
    rl_raw = df[mapping.rl].astype(str).str.strip()
    code_raw = df[mapping.code].astype(str).str.strip() if mapping.code and mapping.code in df.columns else None

    # Convert to numeric (coerce invalid to NaN)
    x_num = pd.to_numeric(x_raw, errors="coerce")
    y_num = pd.to_numeric(y_raw, errors="coerce")
    rl_num = pd.to_numeric(rl_raw, errors="coerce")

    # Boolean masks
    mask_null_x = x_num.isna()
    mask_null_y = y_num.isna()
    mask_null_rl = rl_num.isna()

    mask_invalid_coords = mask_null_x | mask_null_y
    mask_missing_rl = (~mask_invalid_coords) & mask_null_rl
    mask_valid_basic = (~mask_invalid_coords) & (~mask_null_rl)

    missing_rl_count = int(mask_missing_rl.sum())
    invalid_coord_count = int(mask_invalid_coords.sum())

    # Build issues for missing/non-numeric values (up to 100 entries for preview)
    invalid_indices = np.where(mask_invalid_coords | mask_missing_rl)[0]
    for idx in invalid_indices[:100]:
        r_id = id_series.iloc[idx] if idx < len(id_series) else f"Row_{idx+1}"
        row_raw = {
            "Point_ID": r_id,
            "X": x_raw.iloc[idx],
            "Y": y_raw.iloc[idx],
            "RL": rl_raw.iloc[idx],
            "Code": code_raw.iloc[idx] if code_raw is not None else ""
        }
        if mask_null_x.iloc[idx] or mask_null_y.iloc[idx]:
            issues.append(ValidationIssue(
                row_index=int(idx) + 1,
                point_id=r_id,
                issue_type="null_or_invalid_xy",
                message="X or Y coordinate is missing or not a valid number.",
                raw_values=row_raw
            ))
        elif mask_null_rl.iloc[idx]:
            issues.append(ValidationIssue(
                row_index=int(idx) + 1,
                point_id=r_id,
                issue_type="missing_rl",
                message="RL (Elevation) value is missing or non-numeric.",
                raw_values=row_raw
            ))

    # Working with numeric valid rows for duplicate and bounds check
    valid_idx = np.where(mask_valid_basic)[0]
    
    # Check duplicate XY coordinates
    dup_xy_conflict_count = 0
    duplicate_id_count = 0
    
    if len(valid_idx) > 0:
        valid_subset = pd.DataFrame({
            "orig_idx": valid_idx,
            "point_id": id_series.iloc[valid_idx].values,
            "x": x_num.iloc[valid_idx].values,
            "y": y_num.iloc[valid_idx].values,
            "rl": rl_num.iloc[valid_idx].values,
            "code": code_raw.iloc[valid_idx].values if code_raw is not None else ""
        })

        # Duplicate Point IDs
        dup_id_mask = valid_subset.duplicated(subset=["point_id"], keep=False)
        duplicate_id_count = int(dup_id_mask.sum())

        # Duplicate XY coordinates
        dup_xy_mask = valid_subset.duplicated(subset=["x", "y"], keep=False)
        dup_xy_indices = valid_subset[dup_xy_mask]

        if not dup_xy_indices.empty:
            # Group by XY to check if RL values conflict
            grouped = dup_xy_indices.groupby(["x", "y"])
            for (gx, gy), group in grouped:
                rl_values = group["rl"].unique()
                is_conflict = len(rl_values) > 1
                if is_conflict:
                    dup_xy_conflict_count += len(group)
                    if len(issues) < 150:
                        for _, row in group.iterrows():
                            issues.append(ValidationIssue(
                                row_index=int(row["orig_idx"]) + 1,
                                point_id=str(row["point_id"]),
                                issue_type="duplicate_xy_conflict",
                                message=f"Conflicting RL ({row['rl']}) at duplicate coordinate (X: {gx}, Y: {gy}).",
                                raw_values={"X": gx, "Y": gy, "RL": row["rl"], "Point_ID": row["point_id"]}
                            ))

        # Filter out first duplicates if needed or keep valid points
        # Keep first valid occurrence for clean surface processing if accepted
        cleaned_valid_df = valid_subset.drop_duplicates(subset=["x", "y"], keep="first").copy()
    else:
        cleaned_valid_df = pd.DataFrame(columns=["orig_idx", "point_id", "x", "y", "rl", "code"])

    valid_points_count = len(cleaned_valid_df)
    invalid_records_count = total_records - valid_points_count

    # Calculate coordinate bounds
    if valid_points_count > 0:
        min_x = float(cleaned_valid_df["x"].min())
        max_x = float(cleaned_valid_df["x"].max())
        min_y = float(cleaned_valid_df["y"].min())
        max_y = float(cleaned_valid_df["y"].max())
        min_z = float(cleaned_valid_df["rl"].min())
        max_z = float(cleaned_valid_df["rl"].max())

        bounds = SurveyBounds(
            min_x=min_x,
            max_x=max_x,
            min_y=min_y,
            max_y=max_y,
            min_z=min_z,
            max_z=max_z,
            range_x=float(max_x - min_x),
            range_y=float(max_y - min_y),
            range_z=float(max_z - min_z)
        )
    else:
        bounds = None
        min_x, max_x, min_y, max_y = 0.0, 0.0, 0.0, 0.0

    # CRS Analysis
    crs_info = analyze_and_verify_crs(source_crs, min_x, max_x, min_y, max_y)

    # Preview rows (first 50 valid and invalid)
    preview_valid = []
    if valid_points_count > 0:
        for _, row in cleaned_valid_df.head(50).iterrows():
            preview_valid.append({
                "row_index": int(row["orig_idx"]) + 1,
                "point_id": str(row["point_id"]),
                "x": float(row["x"]),
                "y": float(row["y"]),
                "rl": float(row["rl"]),
                "code": str(row["code"]) if row["code"] else ""
            })

    preview_invalid = [issue.model_dump() for issue in issues[:50]]

    summary = ValidationSummary(
        total_records=total_records,
        valid_points=valid_points_count,
        invalid_records=invalid_records_count,
        duplicate_xy_count=dup_xy_conflict_count,
        missing_rl_count=missing_rl_count,
        duplicate_id_count=duplicate_id_count,
        bounds=bounds,
        crs=crs_info,
        issues=issues[:200],
        preview_valid_rows=preview_valid,
        preview_invalid_rows=preview_invalid
    )

    return summary, cleaned_valid_df
