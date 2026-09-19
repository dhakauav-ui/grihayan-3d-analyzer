from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from app.core.config import settings
from app.core.errors import SurveyAppException
from app.api.upload import router as upload_router
from app.api.validate import router as validate_router
from app.api.presets import router as presets_router
from app.api.surface import router as surface_router
from app.api.dem import router as dem_router
from app.api.contours import router as contours_router
from app.api.exports import router as exports_router
from app.api.analysis import router as analysis_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Professional Local-First Survey GIS and 3D Surface Analysis Engine"
)

# CORS middleware for local frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers for user-friendly error responses
@app.exception_handler(SurveyAppException)
async def survey_exception_handler(request: Request, exc: SurveyAppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": exc.detail}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": f"Processing Error: {str(exc)}"}
    )

# Include API Routers
app.include_router(upload_router, prefix=settings.API_PREFIX)
app.include_router(validate_router, prefix=settings.API_PREFIX)
app.include_router(presets_router, prefix=settings.API_PREFIX)
app.include_router(surface_router, prefix=settings.API_PREFIX)
app.include_router(dem_router, prefix=settings.API_PREFIX)
app.include_router(contours_router, prefix=settings.API_PREFIX)
app.include_router(exports_router, prefix=settings.API_PREFIX)
app.include_router(analysis_router, prefix=settings.API_PREFIX)

@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mode": "local-first"
    }

# -----------------------------------------------------------------------------
# Static Frontend Files & SPA Routing (For Render / Production Web Hosting)
# -----------------------------------------------------------------------------
base_dir = Path(__file__).resolve().parent.parent
static_dir = base_dir / "static"
if not static_dir.exists() or not (static_dir / "index.html").exists():
    static_dir = base_dir.parent / "frontend" / "dist"
if not static_dir.exists() or not (static_dir / "index.html").exists():
    static_dir = base_dir / "frontend" / "dist"
if not static_dir.exists() or not (static_dir / "index.html").exists():
    static_dir = Path("static")

assets_dir = static_dir / "assets"

# Try mounting StaticFiles if available
if assets_dir.exists():
    try:
        from fastapi.staticfiles import StaticFiles
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
    except Exception:
        pass

@app.get("/assets/{file_name:path}")
async def serve_static_asset(file_name: str):
    """Fallback asset handler ensuring CSS/JS are served with correct MIME types."""
    target = assets_dir / file_name
    if target.is_file():
        ext = target.suffix.lower()
        media_types = {
            ".js": "application/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".wasm": "application/wasm",
            ".ico": "image/x-icon",
        }
        return FileResponse(target, media_type=media_types.get(ext, None))
    raise HTTPException(status_code=404, detail="Asset not found")

@app.get("/")
async def serve_spa_root():
    """Serves the main single page React application."""
    index_file = static_dir / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "message": "Frontend static build not found. Visit /docs to test the API."
    }

@app.get("/{full_path:path}")
async def serve_spa_fallback(full_path: str):
    """Catch-all for SPA client routing."""
    # Never intercept backend API or documentation paths
    if full_path.startswith("api/") or full_path == "api" or full_path.startswith("docs") or full_path.startswith("openapi.json"):
        raise HTTPException(status_code=404, detail="Not Found")

    file_path = static_dir / full_path
    if file_path.is_file():
        return FileResponse(file_path)

    index_file = static_dir / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Not Found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

