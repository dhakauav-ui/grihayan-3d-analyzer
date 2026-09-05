import os
import math
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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

def sanitize_floats(obj):
    """Recursively cleans NaN and Inf values to comply with strict JSON standards."""
    if isinstance(obj, dict):
        return {k: sanitize_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_floats(v) for v in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    elif hasattr(obj, 'item'):
        val = obj.item()
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return 0.0
        return val
    return obj

class SafeJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        clean_content = sanitize_floats(content)
        return json.dumps(
            clean_content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(',', ':')
        ).encode('utf-8')

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Professional Survey GIS and 3D Surface Analysis Engine",
    default_response_class=SafeJSONResponse
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        "mode": "render-cloud"
    }

# Mount static frontend directory
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
if os.path.exists(static_dir):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": True, "message": "API route not found"})
        file_path = os.path.join(static_dir, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"error": True, "message": "index.html not found"})

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)

