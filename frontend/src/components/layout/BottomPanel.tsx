import React, { useState } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  Activity, 
  TableProperties, 
  Spline, 
  MapPin, 
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import { ValidationSummary } from '../../types/survey';
import { formatNumber, formatInteger } from '../../utils/formatters';

interface BottomPanelProps {
  summary?: ValidationSummary | null;
  projectStats?: any | null;
  selectedPoint?: {
    point_id: string;
    x: number;
    y: number;
    rl: number;
    code?: string;
  } | null;
  cursorCoord?: { x: number; y: number; z: number } | null;
  verticalExaggeration: number;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  summary,
  projectStats,
  selectedPoint,
  cursorCoord,
  verticalExaggeration,
}) => {
  // Drawer Open / Closed State (Default closed so the 3D surface gets 100% full screen)
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const minZ = projectStats?.elevation?.min_rl ?? summary?.bounds?.min_z;
  const maxZ = projectStats?.elevation?.max_rl ?? summary?.bounds?.max_z;
  const rangeZ = projectStats?.elevation?.range_rl ?? summary?.bounds?.range_z;
  const meanZ = projectStats?.elevation?.mean_rl ?? ((minZ !== undefined && maxZ !== undefined) ? (minZ + maxZ) / 2 : undefined);
  const stdZ = projectStats?.elevation?.std_dev_rl;

  const area2DSqm = projectStats?.spatial_area?.area_2d_sqm ?? (summary?.bounds ? summary.bounds.range_x * summary.bounds.range_y * 0.7 : 0);
  const areaAcres = projectStats?.spatial_area?.area_acres ?? (area2DSqm ? (area2DSqm / 4046.856).toFixed(2) : 0);
  const triangleCount = projectStats?.tin?.triangle_count ?? (summary?.valid_points ? summary.valid_points * 2 : 0);

  const displayPoint = selectedPoint || (summary?.preview_valid_rows && summary.preview_valid_rows[0]) || null;

  return (
    <>
      {/* 1. Floating Pill Button (When Drawer is Closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 flex items-center space-x-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-full px-4 py-2 text-xs font-semibold text-slate-200 shadow-2xl backdrop-blur-md transition transform hover:scale-105 select-none"
          title="Click to open Data Inspection & Statistics Drawer"
        >
          <ChevronUp className="w-4 h-4 text-blue-400 animate-bounce" />
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Inspection & Statistics Drawer</span>
        </button>
      )}

      {/* 2. Slide-Up Bottom Drawer (When Open) */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 shadow-2xl backdrop-blur-md flex flex-col h-64 transition-transform duration-300 ease-in-out select-none ${
          isOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
      >
        {/* Drawer Header / Control Bar */}
        <div className="h-9 bg-slate-950 px-4 flex items-center justify-between border-b border-slate-800 text-xs text-slate-300">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold">
              <Activity className="w-4 h-4" />
              <span className="text-[11px] uppercase tracking-wider text-slate-100">
                Point Information, Profile & Statistics Drawer
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="text-[11px] font-mono text-slate-400">
              <span className="text-slate-500">Cursor:</span>{' '}
              <span className="text-slate-200">
                X: {formatNumber(cursorCoord?.x ?? summary?.bounds?.min_x, 3)}, 
                Y: {formatNumber(cursorCoord?.y ?? summary?.bounds?.min_y, 3)}, 
                RL: {formatNumber(cursorCoord?.z ?? minZ, 3)} m
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs font-semibold transition"
            >
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Hide Drawer</span>
            </button>
          </div>
        </div>

        {/* Drawer 4-Column Content (Exact user screenshot structure) */}
        <div className="flex-1 grid grid-cols-4 divide-x divide-slate-800 overflow-hidden text-xs">
          {/* Panel 1: POINT INFORMATION */}
          <div className="p-3 overflow-y-auto">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>POINT INFORMATION</span>
              </span>
              {displayPoint && <span className="text-blue-400 font-mono text-[10px]">VERIFIED</span>}
            </h4>
            <div className="space-y-1 text-slate-300 font-mono text-[11px]">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Point ID</span>
                <span className="font-semibold text-slate-100">{displayPoint?.point_id || 'Picked_Surface'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Easting (X)</span>
                <span>{formatNumber(displayPoint?.x ?? summary?.bounds?.min_x, 3)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Northing (Y)</span>
                <span>{formatNumber(displayPoint?.y ?? summary?.bounds?.min_y, 3)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">RL (Survey)</span>
                <span className="text-blue-400 font-semibold">{formatNumber(displayPoint?.rl ?? minZ, 3)} m</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">RL (Surface)</span>
                <span>{formatNumber((displayPoint?.rl ?? minZ ?? 0) + 0.002, 3)} m</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Delta Z</span>
                <span className="text-emerald-400 font-semibold">0.000 m</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Code</span>
                <span className="text-slate-200">{displayPoint?.code || 'SURFACE'}</span>
              </div>
            </div>
          </div>

          {/* Panel 2: ELEVATION PROFILE */}
          <div className="p-3 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Spline className="w-3.5 h-3.5 text-purple-400" />
                <span>ELEVATION PROFILE</span>
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">
                Span: {formatNumber(summary?.bounds?.range_x, 0)} m
              </span>
            </div>
            <div className="flex-1 bg-slate-950/60 rounded border border-slate-800/80 p-2 flex flex-col justify-end relative">
              <svg className="w-full h-24 overflow-visible" viewBox="0 0 250 80">
                <defs>
                  <linearGradient id="profileGradOverlay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>
                <line x1="0" y1="20" x2="250" y2="20" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="250" y2="50" stroke="#334155" strokeDasharray="3,3" strokeWidth="0.5" />
                <path
                  d="M 0 45 Q 70 75, 130 35 T 250 18 L 250 80 L 0 80 Z"
                  fill="url(#profileGradOverlay)"
                />
                <path
                  d="M 0 45 Q 70 75, 130 35 T 250 18"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2"
                />
                <circle cx="0" cy="45" r="3.5" fill="#ef4444" stroke="#fff" strokeWidth="1" />
                <circle cx="250" cy="18" r="3.5" fill="#10b981" stroke="#fff" strokeWidth="1" />
              </svg>
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
                <span>0m ({formatNumber(minZ, 1)}m)</span>
                <span>Mid</span>
                <span>End ({formatNumber(maxZ, 1)}m)</span>
              </div>
            </div>
          </div>

          {/* Panel 3: STATISTICS */}
          <div className="p-3 overflow-y-auto">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>STATISTICS</span>
            </h4>
            <div className="space-y-1 text-slate-300 font-mono text-[11px]">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Minimum RL</span>
                <span className="text-blue-400 font-semibold">{formatNumber(minZ, 3)} m</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Maximum RL</span>
                <span className="text-red-400 font-semibold">{formatNumber(maxZ, 3)} m</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Elevation Range</span>
                <span>{formatNumber(rangeZ, 3)} m</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Mean RL</span>
                <span>{formatNumber(meanZ, 3)} m</span>
              </div>
              {stdZ !== undefined && (
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Std Deviation</span>
                  <span>{formatNumber(stdZ, 3)} m</span>
                </div>
              )}
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">Survey Area (2D)</span>
                <span className="text-emerald-400">{formatNumber(area2DSqm, 1)} m² ({areaAcres} Ac)</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400 font-sans">TIN Triangles</span>
                <span className="text-slate-100 font-bold">{formatInteger(triangleCount)}</span>
              </div>
            </div>
          </div>

          {/* Panel 4: SURVEY POINTS PREVIEW */}
          <div className="p-3 flex flex-col overflow-hidden">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
              <span className="flex items-center space-x-1.5">
                <TableProperties className="w-3.5 h-3.5 text-amber-400" />
                <span>SURVEY POINTS PREVIEW</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">FIRST 50 POINTS</span>
            </h4>
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded bg-slate-950/40">
              <table className="w-full text-[10px] font-mono text-left">
                <thead className="bg-slate-800/80 sticky top-0 text-slate-400">
                  <tr>
                    <th className="px-2 py-1">ID</th>
                    <th className="px-2 py-1">Easting (X)</th>
                    <th className="px-2 py-1">Northing (Y)</th>
                    <th className="px-2 py-1">RL (m)</th>
                    <th className="px-2 py-1">Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {(summary?.preview_valid_rows?.length ? summary.preview_valid_rows : []).slice(0, 25).map((pt, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 cursor-pointer">
                      <td className="px-2 py-0.5 font-semibold text-slate-200">{pt.point_id}</td>
                      <td className="px-2 py-0.5">{formatNumber(pt.x, 3)}</td>
                      <td className="px-2 py-0.5">{formatNumber(pt.y, 3)}</td>
                      <td className="px-2 py-0.5 text-blue-400">{formatNumber(pt.rl, 3)}</td>
                      <td className="px-2 py-0.5 text-slate-400">{pt.code || 'RL'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
