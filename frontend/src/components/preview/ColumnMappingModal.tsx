import React, { useState, useEffect } from 'react';
import { Settings2, CheckCircle, AlertTriangle, X, Loader2, ArrowRight, Compass } from 'lucide-react';
import { RawPreviewResponse, ColumnMapping, CRSPreset } from '../../types/survey';
import { formatInteger, formatBytes } from '../../utils/formatters';
import { surveyApi } from '../../services/api';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: RawPreviewResponse | null;
  onConfirmValidate: (
    mapping: ColumnMapping,
    sourceCrs: string | null,
    verticalDatum: string,
    horizontalUnit: string,
    verticalUnit: string
  ) => void;
  isValidating: boolean;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  previewData,
  onConfirmValidate,
  isValidating,
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>({
    point_id: '',
    x: '',
    y: '',
    rl: '',
    code: '',
  });

  const [crsPresets, setCrsPresets] = useState<CRSPreset[]>([]);
  const [selectedCrs, setSelectedCrs] = useState<string>('AUTO');
  const [customCrs, setCustomCrs] = useState<string>('');
  const [verticalDatum, setVerticalDatum] = useState<string>('Local TBM');
  const [horizontalUnit, setHorizontalUnit] = useState<string>('meter');
  const [verticalUnit, setVerticalUnit] = useState<string>('meter');

  useEffect(() => {
    if (previewData) {
      setMapping({
        point_id: previewData.detected_columns.point_id || previewData.headers[0] || '',
        x: previewData.detected_columns.x || previewData.headers[1] || '',
        y: previewData.detected_columns.y || previewData.headers[2] || '',
        rl: previewData.detected_columns.rl || previewData.headers[3] || '',
        code: previewData.detected_columns.code || '',
      });

      if (previewData.suggested_crs?.includes('32646')) {
        setSelectedCrs('EPSG:32646');
      } else if (previewData.suggested_crs?.includes('32645')) {
        setSelectedCrs('EPSG:32645');
      } else {
        setSelectedCrs('AUTO');
      }
    }
  }, [previewData]);

  useEffect(() => {
    surveyApi.getCRSPresets().then((res) => {
      if (res.presets) setCrsPresets(res.presets);
    }).catch(() => {});
  }, []);

  if (!isOpen || !previewData) return null;

  const headers = previewData.headers || [];

  const handleValidateClick = () => {
    let finalCrs: string | null = null;
    if (selectedCrs === 'CUSTOM') {
      finalCrs = customCrs.trim() || null;
    } else if (selectedCrs !== 'AUTO') {
      finalCrs = selectedCrs;
    }
    onConfirmValidate(mapping, finalCrs, verticalDatum, horizontalUnit, verticalUnit);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Survey Data Configuration & Column Mapping</h3>
              <p className="text-xs text-slate-400">
                Confirm columns and coordinate reference system before generating terrain surface
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* File Overview Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-slate-800/50 border border-slate-800 rounded-lg">
              <p className="text-[11px] text-slate-400">File Name</p>
              <p className="text-xs font-semibold text-slate-200 truncate" title={previewData.filename}>
                {previewData.filename}
              </p>
            </div>
            <div className="p-3 bg-slate-800/50 border border-slate-800 rounded-lg">
              <p className="text-[11px] text-slate-400">Total Rows</p>
              <p className="text-xs font-bold text-blue-400 font-mono">
                {formatInteger(previewData.total_rows)} points
              </p>
            </div>
            <div className="p-3 bg-slate-800/50 border border-slate-800 rounded-lg">
              <p className="text-[11px] text-slate-400">File Type / Size</p>
              <p className="text-xs font-semibold text-slate-200">
                {previewData.file_type} ({formatBytes(previewData.file_size_bytes)})
              </p>
            </div>
            <div className="p-3 bg-slate-800/50 border border-slate-800 rounded-lg">
              <p className="text-[11px] text-slate-400">Header Status</p>
              <p className="text-xs font-semibold text-emerald-400">
                {previewData.has_headers ? 'Headers Detected' : 'Headerless (Auto Index)'}
              </p>
            </div>
          </div>

          {/* Column Mapping Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Field Mapping
              </h4>
              <span className="text-[11px] text-slate-400 italic">
                * Please verify that columns correspond accurately to your survey data.
              </span>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {/* Point ID */}
              <div className="space-y-1.5 p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Point ID</span>
                  <span className="text-[10px] text-blue-400 font-mono">Req</span>
                </label>
                <select
                  value={mapping.point_id}
                  onChange={(e) => setMapping({ ...mapping, point_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* X / Easting */}
              <div className="space-y-1.5 p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>X (Easting)</span>
                  <span className="text-[10px] text-blue-400 font-mono">Req</span>
                </label>
                <select
                  value={mapping.x}
                  onChange={(e) => setMapping({ ...mapping, x: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Y / Northing */}
              <div className="space-y-1.5 p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Y (Northing)</span>
                  <span className="text-[10px] text-blue-400 font-mono">Req</span>
                </label>
                <select
                  value={mapping.y}
                  onChange={(e) => setMapping({ ...mapping, y: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* RL / Elevation */}
              <div className="space-y-1.5 p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>RL (Elevation)</span>
                  <span className="text-[10px] text-blue-400 font-mono">Req</span>
                </label>
                <select
                  value={mapping.rl}
                  onChange={(e) => setMapping({ ...mapping, rl: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Code / Description */}
              <div className="space-y-1.5 p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Code / Description</span>
                  <span className="text-[10px] text-slate-500 font-mono">Opt</span>
                </label>
                <select
                  value={mapping.code || ''}
                  onChange={(e) => setMapping({ ...mapping, code: e.target.value || null })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">(None / Ignore)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Coordinate Reference System (CRS) & Datum Settings */}
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-200">
                <Compass className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Coordinate Reference System (CRS) & Vertical Datum
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                Active: <strong className="text-blue-300">{selectedCrs === 'CUSTOM' ? (customCrs || 'Custom') : selectedCrs}</strong> • <strong className="text-emerald-300">{verticalDatum}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Projected CRS */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Projected CRS (EPSG)</span>
                  <span className="text-[10px] text-blue-400 font-mono">Horiz</span>
                </label>
                <select
                  value={selectedCrs}
                  onChange={(e) => setSelectedCrs(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="AUTO">Auto / Local Coordinate Grid</option>
                  <option value="EPSG:32646">EPSG:32646 - WGS 84 / UTM zone 46N (BD East)</option>
                  <option value="EPSG:32645">EPSG:32645 - WGS 84 / UTM zone 45N (BD West)</option>
                  <option value="EPSG:9678">EPSG:9678 - Gulshan 303 / BTM (Bangladesh)</option>
                  <option value="EPSG:4326">EPSG:4326 - WGS 84 (Geographic Lat/Lon)</option>
                  <option value="LOCAL">LOCAL - Engineering / Site Grid</option>
                  <option value="CUSTOM">Custom EPSG Code...</option>
                </select>
                {selectedCrs === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="e.g. EPSG:32646"
                    value={customCrs}
                    onChange={(e) => setCustomCrs(e.target.value)}
                    className="w-full mt-1.5 bg-slate-900 border border-blue-500 rounded px-2.5 py-1 text-xs text-blue-300 focus:outline-none font-mono placeholder-slate-600"
                  />
                )}
              </div>

              {/* 2. Vertical Datum Reference */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Vertical Datum</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Vert RL</span>
                </label>
                <select
                  value={verticalDatum.startsWith('Custom: ') ? 'Custom' : verticalDatum}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Custom') {
                      setVerticalDatum('Custom Project Datum');
                    } else {
                      setVerticalDatum(val);
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="Local TBM">Local TBM (Temporary Benchmark)</option>
                  <option value="PWD Datum">PWD Datum (Public Works Dept - Bangladesh)</option>
                  <option value="SoB Datum">SoB Datum (Survey of Bangladesh)</option>
                  <option value="MSL">Mean Sea Level (MSL)</option>
                  <option value="CD">Chart Datum (CD - Hydrographic)</option>
                  <option value="Custom Project Datum">Custom / Site Project Datum</option>
                </select>
                {verticalDatum === 'Custom Project Datum' && (
                  <input
                    type="text"
                    placeholder="Enter custom datum name..."
                    onChange={(e) => setVerticalDatum(e.target.value || 'Custom Project Datum')}
                    className="w-full mt-1.5 bg-slate-900 border border-emerald-500 rounded px-2.5 py-1 text-xs text-emerald-300 focus:outline-none font-sans placeholder-slate-600"
                  />
                )}
              </div>

              {/* 3. Horizontal Unit */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Horizontal Unit</span>
                  <span className="text-[10px] text-slate-400 font-mono">X / Y</span>
                </label>
                <select
                  value={horizontalUnit}
                  onChange={(e) => setHorizontalUnit(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="meter">Meter (m) - Metric</option>
                  <option value="feet">Feet (ft) - Imperial</option>
                </select>
              </div>

              {/* 4. Vertical Unit */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Vertical Unit</span>
                  <span className="text-[10px] text-slate-400 font-mono">RL (Z)</span>
                </label>
                <select
                  value={verticalUnit}
                  onChange={(e) => setVerticalUnit(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="meter">Meter (m) - Metric</option>
                  <option value="feet">Feet (ft) - Imperial</option>
                </select>
              </div>
            </div>

            {selectedCrs === 'AUTO' && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center space-x-2 text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Coordinate Reference System set to Auto. The system will visualize 3D terrain in survey grid coordinates with <strong>{verticalDatum}</strong> vertical datum.
                </span>
              </div>
            )}
          </div>


          {/* Raw Data Preview Table (First 20 rows) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Raw Data Preview (First 20 Rows)
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                Showing {Math.min(20, previewData.preview_rows.length)} of {formatInteger(previewData.total_rows)} rows
              </span>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-56 bg-slate-950/60">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-slate-800/80 sticky top-0 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-[11px] text-slate-400">#</th>
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold whitespace-nowrap">
                        {h}
                        {mapping.point_id === h && <span className="ml-1 text-[9px] text-blue-400 font-bold bg-blue-500/20 px-1 rounded">[ID]</span>}
                        {mapping.x === h && <span className="ml-1 text-[9px] text-emerald-400 font-bold bg-emerald-500/20 px-1 rounded">[X]</span>}
                        {mapping.y === h && <span className="ml-1 text-[9px] text-emerald-400 font-bold bg-emerald-500/20 px-1 rounded">[Y]</span>}
                        {mapping.rl === h && <span className="ml-1 text-[9px] text-amber-400 font-bold bg-amber-500/20 px-1 rounded">[RL]</span>}
                        {mapping.code === h && <span className="ml-1 text-[9px] text-purple-400 font-bold bg-purple-500/20 px-1 rounded">[Code]</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {previewData.preview_rows.slice(0, 20).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="px-3 py-1.5 text-slate-500 text-[11px]">{idx + 1}</td>
                      {headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 whitespace-nowrap">{String(row[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleValidateClick}
            disabled={isValidating || !mapping.x || !mapping.y || !mapping.rl}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-md text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-blue-500/20 transition"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validating {formatInteger(previewData.total_rows)} Survey Points...</span>
              </>
            ) : (
              <>
                <span>Validate & Process Data</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
