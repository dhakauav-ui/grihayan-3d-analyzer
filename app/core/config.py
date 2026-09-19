from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
PROJECTS_DIR = BASE_DIR / "projects"
EXPORTS_DIR = BASE_DIR / "exports"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

class Settings:
    PROJECT_NAME: str = "GRIHAYAN 3D SURFACE ANALYZER"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    UPLOAD_DIR: Path = UPLOAD_DIR
    PROJECTS_DIR: Path = PROJECTS_DIR
    EXPORTS_DIR: Path = EXPORTS_DIR
    MAX_UPLOAD_SIZE_MB: int = 150
    ALLOWED_EXTENSIONS: set = {".csv", ".xlsx", ".xls", ".txt"}
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ]

settings = Settings()
