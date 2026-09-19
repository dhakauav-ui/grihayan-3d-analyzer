from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
