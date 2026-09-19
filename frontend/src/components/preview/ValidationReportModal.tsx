import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertOctagon, 
  Copy, 
  FileWarning, 
  Layers, 
  ArrowRight, 
  X, 
  MapPin, 
  AlertTriangle,
  ListFilter
} from 'lucide-react';
import { ValidationSummary } from '../../types/survey';
import { formatInteger, formatNumber } from '../../utils/formatters';

interface ValidationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ValidationSummary | null;
  onProceedWithValid: () => void;
  verticalDatum?: string;
}

export const ValidationReportModal: React.FC<ValidationReportModalProps> = ({
  isOpen,
  onClose,
  summary,
  onProceedWithValid,
  verticalDatum = 'Local TBM',
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'issues' | 'valid_preview'>('summary');

  if (!isOpen || !summary) return null;

  const {
    total_records,
    valid_points,
    invalid_records,
    duplicate_xy_count,
    missing_rl_count,
    duplicate_id_count,
    bounds,
    crs,
    issues,
    preview_valid_rows,
  } = summary;

  const activeDatum = verticalDatum || summary.vertical_datum || summary.crs.vertical_datum || summary.crs.datum || 'Local TBM';


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Survey Data Validation Report</h3>
              <p className="text-xs text-slate-400">
                Quality audit complete. Inspect valid survey points and identified anomalies.
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Summary & Bounds
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'issues'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Identified Issues</span>
            {issues.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                {issues.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('valid_preview')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'valid_preview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Valid Points Preview (50)
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'summary' && (
            <>
              {/* Metric KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                {/* Total Points */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400">Total Survey Records</span>
                  <p className="text-xl font-bold font-mono text-slate-100 mt-1">
                    {formatInteger(total_records)}
                  </p>
                </div>

                {/* Valid Points */}
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg">
                  <span className="text-[11px] text-emerald-400 font-medium">Valid Points (Clean)</span>
                  <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {formatInteger(valid_points)}
                  </p>
                  <span className="text-[10px] text-emerald-500/80">
                    {((valid_points / (total_records || 1)) * 100).toFixed(1)}% of total
                  </span>
                </div>

                {/* Duplicate Coordinates */}
                <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-lg">
                  <span className="text-[11px] text-amber-400 font-medium">Duplicate XY Conflicts</span>
                  <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {formatInteger(duplicate_xy_count)}
                  </p>
                  <span className="text-[10px] text-amber-500/80">Conflicting elevations flagged</span>
                </div>

                {/* Missing / Non-numeric */}
                <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-lg">
                  <span className="text-[11px] text-rose-400 font-medium">Missing RL / Invalid Coords</span>
                  <p className="text-xl font-bold font-mono text-rose-400 mt-1">
                    {formatInteger(invalid_records)}
                  </p>
                  <span className="text-[10px] text-rose-500/80">
                    {missing_rl_count} missing RL
                  </span>
                </div>
              </div>

              {/* Coordinate Bounding Box */}
              {bounds && (
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex items-center space-x-2 text-slate-200">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      Coordinate Extents & Elevation Range
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 font-mono text-xs text-slate-300">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                      <p className="text-[11px] text-slate-400 font-sans mb-1">Easting (X)</p>
                      <div className="flex justify-between py-0.5"><span className="text-slate-500">Min:</span> <span>{formatNumber(bounds.min_x)}</span></div>
                      <div className="flex justify-between py-0.5"><span className="text-slate-500">Max:</span> <span>{formatNumber(bounds.max_x)}</span></div>
                      <div className="flex justify-between py-0.5 border-t border-slate-800 mt-1 pt-1"><span className="text-slate-500">Span:</span> <span className="text-blue-400">{formatNumber(bounds.range_x)} m</span></div>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                      <p className="text-[11px] text-slate-400 font-sans mb-1">Northing (Y)</p>
                      <div className="flex justify-between py-0.5"><span className="text-slate-500">Min:</span> <span>{formatNumber(bounds.min_y)}</span></div>
                      <div className="flex justify-between py-0.5"><span className="text-slate-500">Max:</span> <span>{formatNumber(bounds.max_y)}</span></div>
                      <div className="flex justify-between py-0.5 border-t border-slate-800 mt-1 pt-1"><span className="text-slate-500">Span:</span> <span className="text-blue-400">{formatNumber(bounds.range_y)} m</span></div>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                      <p className="text-[11px] text-slate-400 font-sans mb-1">RL / Elevation (Z)</p>
                      <div className="flex justify-between py-0.5"><span className="text-slate-500">Min RL:</span> <span className="text-blue-400">{formatNumber(bounds.min_z)} m</span></div>
                      <div className="flex justify-between py-0.5"><span className="text-slate-500">Max RL:</span> <span className="text-red-400">{formatNumber(bounds.max_z)} m</span></div>
                      <div className="flex justify-between py-0.5 border-t border-slate-800 mt-1 pt-1"><span className="text-slate-500">Delta Z:</span> <span className="text-emerald-400">{formatNumber(bounds.range_z)} m</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* CRS Banner */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/10 rounded text-blue-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      CRS: {crs.epsg || 'Local Coordinate Grid'} ({crs.name || 'Unconfirmed'}) • Datum: <strong className="text-emerald-300">{activeDatum}</strong>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Units: {crs.unit} • Geodesy Status: <strong className={crs.status === 'CONFIRMED' ? 'text-emerald-400' : 'text-amber-400'}>{crs.status}</strong>
                    </p>
                  </div>

                </div>
                {crs.warning && (
                  <span className="text-[11px] text-amber-300 max-w-sm text-right">
                    {crs.warning}
                  </span>
                )}
              </div>
            </>
          )}

          {activeTab === 'issues' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Survey Anomalies & Flagged Rows ({issues.length})
                </h4>
                <span className="text-[11px] text-slate-400">
                  Showing up to first 200 issues
                </span>
              </div>

              {issues.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-lg text-emerald-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-semibold">Clean Dataset!</p>
                  <p className="text-xs text-slate-400">Zero coordinate or elevation errors detected.</p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-96 bg-slate-950/60">
                  <table className="w-full text-xs font-mono text-left">
                    <thead className="bg-slate-800/80 sticky top-0 text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Row #</th>
                        <th className="px-3 py-2">Point ID</th>
                        <th className="px-3 py-2">Issue Type</th>
                        <th className="px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {issues.map((iss, i) => (
                        <tr key={i} className="hover:bg-slate-800/30 bg-rose-500/5">
                          <td className="px-3 py-1.5 text-amber-400 font-semibold">{iss.row_index}</td>
                          <td className="px-3 py-1.5 text-slate-200">{iss.point_id || '—'}</td>
                          <td className="px-3 py-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300">
                              {iss.issue_type}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-slate-300">{iss.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'valid_preview' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                First 50 Validated Survey Points
              </h4>
              <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-96 bg-slate-950/60">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-slate-800/80 sticky top-0 text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Row #</th>
                      <th className="px-3 py-2">Point ID</th>
                      <th className="px-3 py-2">Easting (X)</th>
                      <th className="px-3 py-2">Northing (Y)</th>
                      <th className="px-3 py-2">RL (m)</th>
                      <th className="px-3 py-2">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {preview_valid_rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 text-slate-500">{row.row_index}</td>
                        <td className="px-3 py-1.5 text-slate-200 font-semibold">{row.point_id}</td>
                        <td className="px-3 py-1.5">{formatNumber(row.x, 3)}</td>
                        <td className="px-3 py-1.5">{formatNumber(row.y, 3)}</td>
                        <td className="px-3 py-1.5 text-blue-400 font-medium">{formatNumber(row.rl, 3)}</td>
                        <td className="px-3 py-1.5 text-slate-400">{row.code || 'RL'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={() => setActiveTab('issues')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition flex items-center space-x-1.5"
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Review Issues ({issues.length})</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition"
            >
              Back
            </button>
            <button
              onClick={onProceedWithValid}
              disabled={valid_points === 0}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-md text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-emerald-500/20 transition"
            >
              <span>Continue with {formatInteger(valid_points)} Valid Points</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
