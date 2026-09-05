from fastapi import HTTPException, status

class SurveyAppException(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)

class InvalidFileFormatException(SurveyAppException):
    def __init__(self, detail: str = "Unsupported file format. Please upload a CSV, XLSX, or TXT survey file."):
        super().__init__(detail=detail, status_code=status.HTTP_400_BAD_REQUEST)

class EmptyFileException(SurveyAppException):
    def __init__(self, detail: str = "The uploaded file contains no data rows."):
        super().__init__(detail=detail, status_code=status.HTTP_400_BAD_REQUEST)

class ColumnMappingException(SurveyAppException):
    def __init__(self, detail: str = "Please confirm the Point ID, X (Easting), Y (Northing), and RL (Elevation) columns."):
        super().__init__(detail=detail, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)

class InsufficientPointsException(SurveyAppException):
    def __init__(self, detail: str = "Not enough valid survey points to generate a surface (at least 3 points required for triangulation)."):
        super().__init__(detail=detail, status_code=status.HTTP_400_BAD_REQUEST)

class InvalidCRSException(SurveyAppException):
    def __init__(self, detail: str = "Invalid Coordinate Reference System (CRS) specified. Please provide a valid EPSG code."):
        super().__init__(detail=detail, status_code=status.HTTP_400_BAD_REQUEST)
