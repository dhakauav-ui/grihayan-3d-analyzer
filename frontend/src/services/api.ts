import axios from 'axios';
import { RawPreviewResponse, ValidateRequest, ValidationSummary, CRSPreset, ColumnMapping } from '../types/survey';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 minutes for processing 150k+ point clouds
});

export const surveyApi = {
  uploadFile: async (file: File): Promise<RawPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<RawPreviewResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  validateData: async (req: ValidateRequest): Promise<ValidationSummary> => {
    const response = await apiClient.post<ValidationSummary>('/validate', req);
    return response.data;
  },

  generateSurface: async (req: {
    file_id: string;
    column_mapping: ColumnMapping;
    source_crs?: string | null;
    max_edge_length?: number;
    vertical_datum?: string;
  }): Promise<any> => {
    const response = await apiClient.post('/surface/generate', req);
    return response.data;
  },

  generateDEM: async (req: {
    file_id: string;
    column_mapping: ColumnMapping;
    source_crs?: string | null;
    resolution?: number;
    azimuth?: number;
    altitude?: number;
    z_factor?: number;
  }): Promise<any> => {
    const response = await apiClient.post('/dem/generate', req);
    return response.data;
  },

  generateContours: async (req: {
    file_id: string;
    column_mapping: ColumnMapping;
    source_crs?: string | null;
    interval?: number;
    major_multiplier?: number;
    resolution?: number;
  }): Promise<any> => {
    const response = await apiClient.post('/contours/generate', req);
    return response.data;
  },

  getElevationProfile: async (req: {
    file_id: string;
    column_mapping: ColumnMapping;
    source_crs?: string | null;
    start_x: number;
    start_y: number;
    end_x: number;
    end_y: number;
    num_samples?: number;
  }): Promise<any> => {
    const response = await apiClient.post('/analysis/profile', req);
    return response.data;
  },

  calculateVolume: async (req: {
    file_id: string;
    column_mapping: ColumnMapping;
    source_crs?: string | null;
    datum_elevation: number;
    resolution?: number;
  }): Promise<any> => {
    const response = await apiClient.post('/analysis/volume', req);
    return response.data;
  },

  exportGISData: async (req: {
    file_id: string;
    column_mapping: ColumnMapping;
    source_crs?: string | null;
    project_name?: string;
    format: string;
    resolution?: number;
    interval?: number;
  }): Promise<Blob> => {
    const response = await apiClient.post('/export', req, {
      responseType: 'blob',
    });
    return response.data;
  },

  getCRSPresets: async (): Promise<{ presets: CRSPreset[] }> => {
    const response = await apiClient.get<{ presets: CRSPreset[] }>('/presets/crs');
    return response.data;
  },

  getHealth: async (): Promise<any> => {
    const response = await apiClient.get('/health');
    return response.data;
  }
};
