import React, { useState } from 'react';
import { Info, Copy, Check, FileCode, Shield, Layers, Calendar, HardDrive } from 'lucide-react';
import { formatNumber, formatInteger, formatBytes } from '../../utils/formatters';

interface MetadataViewProps {
  projectName: string;
  fileName?: string;
  summary?: any | null;
  projectStats?: any | null;
  tinData?: any | null;
  sourceCrs?: string | null;
  verticalDatum?: string;
}

export const MetadataView: React.FC<MetadataViewProps> = ({
  projectName,
  fileName,
  summary,
  projectStats,
  tinData,
  sourceCrs,
  verticalDatum = 'Local TBM',
}) => {
  const [copied, setCopied] = useState(false);
  const activeDatum = verticalDatum || summary?.vertical_datum || summary?.crs?.vertical_datum || summary?.crs?.datum || 'Local TBM';

  const projectMetadata = {
    project_name: projectName,
    source_file: fileName || 'survey_data.csv',
    software_version: 'GRIHAYAN 3D SURFACE ANALYZER v1.0.0',
    engine: 'Local-First Python FastAPI + NumPy / SciPy Delaunay / Three.js',
    processing_timestamp: new Date().toISOString(),
    geodesy: {
      source_crs: sourceCrs || summary?.crs?.epsg || 'Local Survey Grid (Unconfirmed)',
      processing_crs: sourceCrs || summary?.crs?.epsg || 'Local Coordinate System',
      vertical_datum: activeDatum,
      horizontal_unit: 'meter',
      vertical_unit: 'meter'
    },
    quality_audit: {
      total_survey_records: summary?.total_records ?? 0,
      valid_clean_points: summary?.valid_points ?? 0,
      rejected_invalid_rows: summary?.invalid_records ?? 0,
      duplicate_xy_conflicts: summary?.duplicate_xy_count ?? 0,
      missing_elevation_count: summary?.missing_rl_count ?? 0
    },
    topography: {
      min_elevation_rl: projectStats?.elevation?.min_rl ?? summary?.bounds?.min_z,
      max_elevation_rl: projectStats?.elevation?.max_rl ?? summary?.bounds?.max_z,
      elevation_range: projectStats?.elevation?.range_rl ?? summary?.bounds?.range_z,
      mean_elevation_rl: projectStats?.elevation?.mean_rl,
      std_deviation_rl: projectStats?.elevation?.std_dev_rl,
      planar_area_2d_sqm: projectStats?.spatial_area?.area_2d_sqm,
      planar_area_acres: projectStats?.spatial_area?.area_acres,
      surface_area_3d_sqm: projectStats?.spatial_area?.surface_area_3d_sqm,
      perimeter_m: projectStats?.spatial_area?.perimeter_m,
      tin_triangles_count: projectStats?.tin?.triangle_count ?? tinData?.triangle_count
    },
    extents: {
      min_x: summary?.bounds?.min_x,
      max_x: summary?.bounds?.max_x,
      min_y: summary?.bounds?.min_y,
      max_y: summary?.bounds?.max_y
    }
  };

  const jsonString = JSON.stringify(projectMetadata, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col p-6 overflow-y-auto select-none">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Project Metadata & Compliance Audit Log</h2>
              <p className="text-xs text-slate-400">
                Deterministic provenance parameters, coordinate lineage, and complete JSON specification
              </p>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-md border border-slate-700 text-slate-200 flex items-center space-x-1.5 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied JSON!' : 'Copy project.json'}</span>
          </button>
        </div>

        {/* Structured Info Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs font-bold text-blue-400 uppercase flex items-center space-x-1.5">
              <HardDrive className="w-4 h-4" />
              <span>File & Processing</span>
            </span>
            <div className="text-xs space-y-1 text-slate-300">
              <div><span className="text-slate-500">File:</span> {fileName || '—'}</div>
              <div><span className="text-slate-500">Engine:</span> Local Python Engine</div>
              <div><span className="text-slate-500">Status:</span> Deterministic Reproducible</div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs font-bold text-emerald-400 uppercase flex items-center space-x-1.5">
              <Layers className="w-4 h-4" />
              <span>Geodesy & CRS</span>
            </span>
            <div className="text-xs space-y-1 text-slate-300">
              <div><span className="text-slate-500">CRS:</span> {sourceCrs || summary?.crs?.epsg || 'Local Engineering Grid'}</div>
              <div><span className="text-slate-500">Datum:</span> {activeDatum}</div>
              <div><span className="text-slate-500">Units:</span> Meters (m)</div>
            </div>
          </div>


          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs font-bold text-purple-400 uppercase flex items-center space-x-1.5">
              <Shield className="w-4 h-4" />
              <span>Data Protection</span>
            </span>
            <div className="text-xs space-y-1 text-slate-300">
              <div><span className="text-slate-500">Cloud Sync:</span> 0% (Air-gapped)</div>
              <div><span className="text-slate-500">Precision:</span> 64-bit Floating Point</div>
              <div><span className="text-slate-500">Traceability:</span> Full Audit Log</div>
            </div>
          </div>
        </div>

        {/* JSON Code Viewer */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <FileCode className="w-4 h-4 text-blue-400" />
              <span>project.json Schema</span>
            </span>
            <span className="text-[11px] text-slate-500 font-mono">{jsonString.length} bytes</span>
          </div>
          <pre className="p-4 bg-slate-950 rounded-lg border border-slate-800/80 text-emerald-400 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
            {jsonString}
          </pre>
        </div>
      </div>
    </div>
  );
};
