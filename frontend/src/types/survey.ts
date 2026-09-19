export interface ColumnMapping {
  point_id: string;
  x: string;
  y: string;
  rl: string;
  code?: string | null;
}

export interface RawPreviewResponse {
  file_id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  total_rows: number;
  total_columns: number;
  has_headers: boolean;
  headers: string[];
  detected_columns: ColumnMapping;
  column_confidence: Record<string, number>;
  preview_rows: Record<string, any>[];
  suggested_crs?: string | null;
}

export interface ValidationIssue {
  row_index: number;
  point_id?: string | null;
  issue_type: string;
  message: string;
  raw_values: Record<string, any>;
}

export interface SurveyBounds {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  min_z: number;
  max_z: number;
  range_x: number;
  range_y: number;
  range_z: number;
}

export interface CRSDetails {
  epsg?: string | null;
  name?: string | null;
  is_projected?: boolean | null;
  unit: string;
  datum?: string | null;
  vertical_datum?: string | null;
  status: 'CONFIRMED' | 'UNCONFIRMED' | 'LOCAL_GRID';
  warning?: string | null;
}

export interface ValidationSummary {
  total_records: number;
  valid_points: number;
  invalid_records: number;
  duplicate_xy_count: number;
  missing_rl_count: number;
  duplicate_id_count: number;
  bounds?: SurveyBounds | null;
  crs: CRSDetails;
  vertical_datum?: string | null;
  issues: ValidationIssue[];
  preview_valid_rows: Record<string, any>[];
  preview_invalid_rows: Record<string, any>[];
}


export interface CRSPreset {
  code: string;
  name: string;
  type: string;
  unit: string;
}

export interface ValidateRequest {
  file_id: string;
  column_mapping: ColumnMapping;
  has_headers: boolean;
  source_crs?: string | null;
  vertical_datum?: string | null;
  horizontal_unit?: string;
  vertical_unit?: string;
  accept_valid_only?: boolean;
}
