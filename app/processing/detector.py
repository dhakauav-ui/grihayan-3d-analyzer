import re
from typing import Dict, List, Tuple, Optional
import pandas as pd
from app.models.survey import ColumnMapping

# Alias patterns
ALIASES_POINT_ID = [
    r"^point[_ ]?id$", r"^pt[_ ]?id$", r"^p[_ ]?id$", r"^pid$", r"^id$",
    r"^point$", r"^pt$", r"^name$", r"^station$", r"^stn$", r"^sl([_ ]?no)?$", r"^serial$"
]

ALIASES_X = [
    r"^easting$", r"^east$", r"^e$", r"^x$", r"^x[_ ]?coord(inate)?$",
    r"^longitude$", r"^lon$", r"^long$"
]

ALIASES_Y = [
    r"^northing$", r"^north$", r"^n$", r"^y$", r"^y[_ ]?coord(inate)?$",
    r"^latitude$", r"^lat$"
]

ALIASES_RL = [
    r"^rl$", r"^reduced[_ ]?level$", r"^reducedlevel$", r"^elevation$",
    r"^elev$", r"^height$", r"^ht$", r"^z$", r"^z[_ ]?coord(inate)?$", r"^level$"
]

ALIASES_CODE = [
    r"^code$", r"^desc(ription)?$", r"^feature$", r"^remark(s)?$",
    r"^comment(s)?$", r"^type$", r"^layer$", r"^string$", r"^raw[_ ]?code$"
]

def _match_pattern(name: str, patterns: List[str]) -> bool:
    clean = name.strip().lower()
    for pat in patterns:
        if re.match(pat, clean):
            return True
    return False

def detect_columns(df: pd.DataFrame, has_headers: bool) -> Tuple[ColumnMapping, Dict[str, float], Optional[str]]:
    """
    Intelligently detects Point ID, X, Y, RL, and Code columns.
    Returns: (ColumnMapping, confidence_scores_dict, suggested_crs_hint)
    """
    cols = list(df.columns)
    num_cols = len(cols)
    mapping = {
        "point_id": cols[0] if num_cols > 0 else "",
        "x": cols[1] if num_cols > 1 else "",
        "y": cols[2] if num_cols > 2 else "",
        "rl": cols[3] if num_cols > 3 else "",
        "code": cols[4] if num_cols > 4 else None
    }
    confidence = {
        "point_id": 0.5,
        "x": 0.5,
        "y": 0.5,
        "rl": 0.5,
        "code": 0.5 if mapping["code"] else 0.0
    }
    suggested_crs = None

    # Step 1: If headers exist, match by name aliases
    if has_headers:
        found = {}
        for c in cols:
            if "point_id" not in found and _match_pattern(c, ALIASES_POINT_ID):
                found["point_id"] = c
                confidence["point_id"] = 0.95
            elif "x" not in found and _match_pattern(c, ALIASES_X):
                found["x"] = c
                confidence["x"] = 0.95
            elif "y" not in found and _match_pattern(c, ALIASES_Y):
                found["y"] = c
                confidence["y"] = 0.95
            elif "rl" not in found and _match_pattern(c, ALIASES_RL):
                found["rl"] = c
                confidence["rl"] = 0.95
            elif "code" not in found and _match_pattern(c, ALIASES_CODE):
                found["code"] = c
                confidence["code"] = 0.90

        for k, v in found.items():
            mapping[k] = v

    # Step 2: Value-based heuristics on sample rows (up to 100)
    sample_df = df.head(100).copy()
    col_stats = {}

    for c in cols:
        series = sample_df[c].astype(str).str.strip()
        num_vals = []
        is_numeric = []
        for val in series:
            try:
                n = float(val)
                num_vals.append(n)
                is_numeric.append(True)
            except ValueError:
                is_numeric.append(False)

        numeric_ratio = sum(is_numeric) / len(is_numeric) if is_numeric else 0.0
        avg_val = sum(num_vals) / len(num_vals) if num_vals else 0.0
        min_val = min(num_vals) if num_vals else 0.0
        max_val = max(num_vals) if num_vals else 0.0

        col_stats[c] = {
            "numeric_ratio": numeric_ratio,
            "avg": avg_val,
            "min": min_val,
            "max": max_val,
            "sample_first": series.iloc[0] if not series.empty else ""
        }

    # Heuristics if confidence is not already high (e.g. headerless files like Semple Data Spot_Level.csv)
    if not has_headers or any(confidence[k] < 0.8 for k in ["x", "y", "rl"]):
        # Identify text/code column
        text_cols = [c for c in cols if col_stats[c]["numeric_ratio"] < 0.3]
        if text_cols:
            mapping["code"] = text_cols[0]
            confidence["code"] = 0.85

        # Separate numeric candidate columns
        num_candidates = [c for c in cols if col_stats[c]["numeric_ratio"] >= 0.8]

        # In standard survey data:
        # Typical UTM northing: 1,000,000 - 10,000,000 (Bangladesh UTM Zone 45/46 is ~ 2,200,000 - 2,900,000)
        # Typical UTM easting: 100,000 - 900,000 (Bangladesh UTM is ~ 200,000 - 700,000)
        # Typical RL / Elevation: -500 - 9000
        # Typical Point ID: 1, 2, 3, ... (small sequential ints)
        
        assigned = set()
        if mapping.get("code") in num_candidates:
            num_candidates.remove(mapping["code"])

        # Check Northing (Y) - largest numbers (> 1,000,000)
        y_candidates = [c for c in num_candidates if col_stats[c]["avg"] > 1_000_000]
        if y_candidates:
            mapping["y"] = y_candidates[0]
            confidence["y"] = 0.90
            assigned.add(y_candidates[0])
            suggested_crs = "EPSG:32646 (WGS 84 / UTM zone 46N) or EPSG:32645"

        # Check Easting (X) - 100,000 - 999,999
        x_candidates = [c for c in num_candidates if c not in assigned and 100_000 <= col_stats[c]["avg"] <= 999_999]
        if x_candidates:
            mapping["x"] = x_candidates[0]
            confidence["x"] = 0.90
            assigned.add(x_candidates[0])

        # Remaining numeric columns for RL and Point ID
        remaining_num = [c for c in num_candidates if c not in assigned]
        
        if len(remaining_num) >= 2:
            # First one is usually ID if it starts at 1, 2, 3...
            # Second is RL (elevations like 10-100m)
            col_a, col_b = remaining_num[0], remaining_num[1]
            first_val_a = col_stats[col_a]["sample_first"]
            if first_val_a in ("1", "0", "1.0", "101", "P1"):
                mapping["point_id"] = col_a
                mapping["rl"] = col_b
            else:
                mapping["point_id"] = col_a
                mapping["rl"] = col_b
            confidence["point_id"] = 0.85
            confidence["rl"] = 0.85
        elif len(remaining_num) == 1:
            mapping["rl"] = remaining_num[0]
            confidence["rl"] = 0.80

    column_mapping = ColumnMapping(
        point_id=str(mapping.get("point_id", cols[0] if cols else "Col_1")),
        x=str(mapping.get("x", cols[1] if len(cols) > 1 else "Col_2")),
        y=str(mapping.get("y", cols[2] if len(cols) > 2 else "Col_3")),
        rl=str(mapping.get("rl", cols[3] if len(cols) > 3 else "Col_4")),
        code=str(mapping.get("code")) if mapping.get("code") else None
    )

    return column_mapping, confidence, suggested_crs
