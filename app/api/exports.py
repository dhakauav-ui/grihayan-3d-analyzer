from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from app.core.config import settings
from app.models.survey import ColumnMapping
from app.processing.reader import read_survey_file
from app.processing.validator import validate_survey_dataframe
from app.processing.tin import generate_tin_surface
from app.processing.dem import generate_raster_dem
from app.processing.contour import generate_vector_contours
from app.processing.statistics import calculate_project_statistics
from app.processing.exporters import (
    export_cleaned_csv,
    export_points_geojson,
    export_dem_geotiff,
    export_contours_shapefile,
    export_contours_geojson,
    export_contours_dxf,
    export_cad_dwg_dxf_zip,
    export_tin_obj,
    export_pdf_summary_report
)

router = APIRouter(prefix="/export", tags=["GIS & Report Export"])

class ExportRequest(BaseModel):
    file_id: str
    column_mapping: ColumnMapping
    source_crs: Optional[str] = None
    project_name: Optional[str] = "Survey_Project"
    format: str # "csv", "geojson_points", "geotiff", "shapefile", "geojson_contours", "obj", "pdf"
    resolution: float = 1.0
    interval: float = 1.0

@router.post("")
async def export_gis_data(req: ExportRequest):
    """
    Generates and downloads the requested GIS export format.
    """
    file_path = settings.UPLOAD_DIR / req.file_id
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Uploaded file '{req.file_id}' not found."
        )

    try:
        df, _, _ = read_survey_file(file_path)
        summary, cleaned_df = validate_survey_dataframe(df, req.column_mapping, req.source_crs)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    project_slug = req.project_name.replace(" ", "_")
    export_dir = settings.EXPORTS_DIR
    fmt = req.format.lower()

    if fmt == "csv":
        out_file = export_dir / f"{project_slug}_cleaned.csv"
        export_cleaned_csv(cleaned_df, out_file)
        return FileResponse(out_file, filename=out_file.name, media_type="text/csv")

    elif fmt == "geojson_points":
        out_file = export_dir / f"{project_slug}_points.geojson"
        export_points_geojson(cleaned_df, req.source_crs, out_file)
        return FileResponse(out_file, filename=out_file.name, media_type="application/geo+json")

    elif fmt == "geotiff":
        dem_res = generate_raster_dem(cleaned_df, resolution=req.resolution)
        out_file = export_dir / f"{project_slug}_DEM.tif"
        export_dem_geotiff(
            dem_array=dem_res["dem_array"],
            min_x=dem_res["min_x"],
            max_y=dem_res["max_y"],
            res_x=dem_res["resolution_x"],
            res_y=dem_res["resolution_y"],
            crs_code=req.source_crs,
            output_path=out_file
        )
        return FileResponse(out_file, filename=out_file.name, media_type="image/tiff")

    elif fmt == "shapefile":
        dem_res = generate_raster_dem(cleaned_df, resolution=req.resolution)
        cont_res = generate_vector_contours(
            dem_array=dem_res["dem_array"],
            min_x=dem_res["min_x"],
            max_x=dem_res["max_x"],
            min_y=dem_res["min_y"],
            max_y=dem_res["max_y"],
            interval=req.interval
        )
        out_file = export_dir / f"{project_slug}_contours_shp.zip"
        export_contours_shapefile(cont_res["geojson"], req.source_crs, out_file)
        return FileResponse(out_file, filename=out_file.name, media_type="application/zip")

    elif fmt == "geojson_contours":
        dem_res = generate_raster_dem(cleaned_df, resolution=req.resolution)
        cont_res = generate_vector_contours(
            dem_array=dem_res["dem_array"],
            min_x=dem_res["min_x"],
            max_x=dem_res["max_x"],
            min_y=dem_res["min_y"],
            max_y=dem_res["max_y"],
            interval=req.interval
        )
        out_file = export_dir / f"{project_slug}_contours.geojson"
        with open(out_file, "w", encoding="utf-8") as f:
            import json
            json.dump(cont_res["geojson"], f, indent=2)
    elif fmt in ["dxf", "cad_dwg", "dwg"]:
        dem_res = generate_raster_dem(cleaned_df, resolution=req.resolution)
        cont_res = generate_vector_contours(
            dem_array=dem_res["dem_array"],
            min_x=dem_res["min_x"],
            max_x=dem_res["max_x"],
            min_y=dem_res["min_y"],
            max_y=dem_res["max_y"],
            interval=req.interval
        )
        out_file = export_dir / f"{project_slug}_CAD_DWG_DXF.zip"
        export_cad_dwg_dxf_zip(
            major_contours=cont_res.get("major_contours", []),
            minor_contours=cont_res.get("minor_contours", []),
            output_zip_path=out_file,
            include_labels=True
        )
        return FileResponse(out_file, filename=out_file.name, media_type="application/zip")

    elif fmt == "obj":
        tin_res = generate_tin_surface(cleaned_df)
        out_file = export_dir / f"{project_slug}_TIN_Mesh.obj"
        export_tin_obj(tin_res, out_file)
        return FileResponse(out_file, filename=out_file.name, media_type="text/plain")

    elif fmt == "pdf":
        tin_res = generate_tin_surface(cleaned_df)
        stats_res = calculate_project_statistics(cleaned_df, summary.total_records, summary.invalid_records, tin_res["metrics"])
        out_file = export_dir / f"{project_slug}_Survey_Report.pdf"
        export_pdf_summary_report(
            project_name=req.project_name,
            file_name=req.file_id,
            crs_code=req.source_crs or "Local Grid",
            stats=stats_res,
            validation=summary.model_dump(),
            output_path=out_file
        )
        return FileResponse(out_file, filename=out_file.name, media_type="application/pdf")

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format '{fmt}'"
        )
