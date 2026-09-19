import React, { useState } from 'react';
import { 
  Box, 
  Layers, 
  Map, 
  Compass, 
  Maximize2, 
  Table, 
  Info, 
  CheckCircle2,
  Activity,
  ChevronRight,
  Globe,
  Mountain,
  MapPin,
  Triangle,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Hash
} from 'lucide-react';
import { ValidationSummary } from '../../types/survey';
import { formatNumber, formatInteger } from '../../utils/formatters';

export type NavTab = '3d' | '2d' | 'contours' | 'profile' | 'volume' | 'qaqc' | 'points' | 'stats' | 'metadata';

export interface LeftSidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  projectName?: string;
  fileName?: string;
  summary?: ValidationSummary | null;
  tinData?: any | null;
  projectStats?: any | null;
  sourceCrs?: string | null;
  verticalDatum?: string;
  colorMap?: string;
  layers: {
    surface: boolean;
    points: boolean;
    pointLabels: boolean;
    wireframe: boolean;
    contour: boolean;
    contourLabels: boolean;
    hillshade: boolean;
  };
  onToggleLayer: (layer: keyof LeftSidebarProps['layers']) => void;
  onOpenReport?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeTab,
  onSelectTab,
  projectName = 'Survey Project',
  fileName,
  summary,
  tinData,
  projectStats,
  sourceCrs,
  verticalDatum = 'Local TBM',
  colorMap = 'elevation',
  layers,
  onToggleLayer,
  onOpenReport,
}) => {
  const [projectInfoTab, setProjectInfoTab] = useState<'specs' | 'extents' | 'terrain'>('specs');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const navItems: { id: NavTab; label: string; icon: any }[] = [
    { id: '3d', label: '3D Surface (TIN)', icon: Box },
    { id: '2d', label: 'Top View (2D)', icon: Map },
    { id: 'contours', label: 'Contours', icon: Layers },
    { id: 'profile', label: 'Cross Section', icon: Compass },
    { id: 'volume', label: 'Cut & Fill Volume', icon: Maximize2 },
    { id: 'qaqc', label: 'QA / QC Control', icon: CheckCircle2 },
    { id: 'points', label: 'Point Table', icon: Table },
    { id: 'stats', label: 'Statistics', icon: Activity },
    { id: 'metadata', label: 'Metadata & CRS', icon: Info },
  ];

  // Elevation & Extent calculations
  const minElevation = projectStats?.elevation?.min_rl ?? summary?.bounds?.min_z ?? 0;
  const maxElevation = projectStats?.elevation?.max_rl ?? summary?.bounds?.max_z ?? 0;
  const elevationRelief = projectStats?.elevation?.range_rl ?? summary?.bounds?.range_z ?? (maxElevation - minElevation);
  const meanElevation = projectStats?.elevation?.mean_rl ?? ((minElevation + maxElevation) / 2);

  const minX = summary?.bounds?.min_x ?? 0;
  const maxX = summary?.bounds?.max_x ?? 0;
  const minY = summary?.bounds?.min_y ?? 0;
  const maxY = summary?.bounds?.max_y ?? 0;
  const widthX = summary?.bounds?.range_x ?? (maxX - minX);
  const heightY = summary?.bounds?.range_y ?? (maxY - minY);

  const totalPoints = summary?.total_records ?? 0;
  const validPoints = summary?.valid_points ?? 0;
  const duplicateCount = summary?.duplicate_xy_count ?? 0;
  const validPercentage = totalPoints > 0 ? ((validPoints / totalPoints) * 100).toFixed(1) : '100';

  const area2d = projectStats?.spatial_area?.area_2d_sqm ?? tinData?.metrics?.area_2d_m2 ?? (widthX * heightY);
  const areaAcres = projectStats?.spatial_area?.area_acres ?? (area2d / 4046.856).toFixed(2);
  const area3d = projectStats?.spatial_area?.surface_area_3d_sqm ?? tinData?.metrics?.surface_area_3d_m2 ?? (area2d * 1.02);
  const triangleCount = tinData?.triangle_count ?? projectStats?.tin?.triangle_count ?? (validPoints > 2 ? (validPoints * 2 - 5) : 0);
  const perimeter = projectStats?.spatial_area?.perimeter_m ?? tinData?.metrics?.perimeter_m ?? (2 * (widthX + heightY));

  const hasData = validPoints > 0;
  const activeDatum = verticalDatum || summary?.vertical_datum || summary?.crs?.vertical_datum || summary?.crs?.datum || 'Local TBM';

  const handleCopySummary = () => {
    const text = `========================================
GRIHAYAN 3D SURFACE ANALYZER - PROJECT SPECS
========================================
Project Name   : ${projectName}
Source File    : ${fileName || 'survey_points.csv'}
CRS Projection : ${sourceCrs || summary?.crs?.epsg || 'Local Engineering Grid'}
Vertical Datum : ${activeDatum}
Units (H / V)  : Meters (m) / Meters (m)

SURVEY POINT AUDIT:
Total Records  : ${totalPoints.toLocaleString()}
Valid Points   : ${validPoints.toLocaleString()} (${validPercentage}%)
Duplicate XY   : ${duplicateCount.toLocaleString()}

ELEVATION RELIEF (Z):
Min Elevation  : ${minElevation.toFixed(3)} m
Max Elevation  : ${maxElevation.toFixed(3)} m
Relief (Delta Z): ${elevationRelief.toFixed(3)} m
Mean Elevation : ${meanElevation.toFixed(3)} m

SPATIAL BOUNDS & AREA:
Easting (X)    : ${minX.toFixed(3)} to ${maxX.toFixed(3)} m (Width: ${widthX.toFixed(2)} m)
Northing (Y)   : ${minY.toFixed(3)} to ${maxY.toFixed(3)} m (Height: ${heightY.toFixed(2)} m)
Planar 2D Area : ${Number(area2d).toLocaleString(undefined, { maximumFractionDigits: 2 })} m2 (${areaAcres} Acres)
3D Surface Area: ${Number(area3d).toLocaleString(undefined, { maximumFractionDigits: 2 })} m2
TIN Triangles  : ${triangleCount.toLocaleString()}
========================================`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <aside className="w-72 bg-slate-900/95 border-r border-slate-800 flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto select-none scrollbar-thin scrollbar-thumb-slate-800">
      {/* Navigation Tools */}
      <div className="p-3 border-b border-slate-800 space-y-1">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
          ANALYSIS & VIEWS
        </h4>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
            </button>
          );
        })}
      </div>

      {/* Upgraded Project Information Section */}
      <div className="p-3.5 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              PROJECT INFORMATION
            </h4>
          </div>
          <div className="flex items-center space-x-1">
            {hasData && (
              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active</span>
              </span>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-2.5">
            {/* Sub-Tabs: Specs | Extents | Terrain */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-semibold">
              <button
                onClick={() => setProjectInfoTab('specs')}
                className={`py-1 rounded transition text-center ${
                  projectInfoTab === 'specs'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Specs
              </button>
              <button
                onClick={() => setProjectInfoTab('extents')}
                className={`py-1 rounded transition text-center ${
                  projectInfoTab === 'extents'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bounds
              </button>
              <button
                onClick={() => setProjectInfoTab('terrain')}
                className={`py-1 rounded transition text-center ${
                  projectInfoTab === 'terrain'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Terrain
              </button>
            </div>

            {/* TAB 1: SPECS (Geodesy & Points Audit) */}
            {projectInfoTab === 'specs' && (
              <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px] flex items-center space-x-1">
                    <Info className="w-3 h-3 text-slate-500" />
                    <span>Project</span>
                  </span>
                  <span className="text-slate-100 font-semibold truncate max-w-[130px]" title={projectName}>
                    {projectName}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px] flex items-center space-x-1">
                    <Globe className="w-3 h-3 text-blue-400" />
                    <span>CRS</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {sourceCrs || summary?.crs?.epsg || 'Local Grid'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px] flex items-center space-x-1">
                    <Mountain className="w-3 h-3 text-emerald-400" />
                    <span>Datum</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {activeDatum}
                  </span>
                </div>


                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px] flex items-center space-x-1">
                    <Hash className="w-3 h-3 text-slate-500" />
                    <span>Total Points</span>
                  </span>
                  <span className="text-slate-200 font-bold">{formatInteger(totalPoints)}</span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px] flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Valid Points</span>
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {formatInteger(validPoints)}
                    <span className="text-[10px] text-emerald-500/80 font-normal ml-1">({validPercentage}%)</span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Duplicate XY</span>
                  <span className={`font-bold ${duplicateCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {formatInteger(duplicateCount)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-sans text-[11px] flex items-center space-x-1">
                    <Mountain className="w-3 h-3 text-red-400" />
                    <span>Relief (ΔZ)</span>
                  </span>
                  <span className="text-red-400 font-bold">{elevationRelief.toFixed(2)} m</span>
                </div>
              </div>
            )}

            {/* TAB 2: EXTENTS (Geodetic Bounds & Centroid) */}
            {projectInfoTab === 'extents' && (
              <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1 font-sans">
                  <MapPin className="w-3 h-3 text-indigo-400" />
                  <span>Geodetic Bounding Frame</span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Easting Min (X)</span>
                  <span className="text-slate-200">{minX.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Easting Max (X)</span>
                  <span className="text-slate-200">{maxX.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Easting Span (W)</span>
                  <span className="text-cyan-400 font-semibold">{widthX.toFixed(2)} m</span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Northing Min (Y)</span>
                  <span className="text-slate-200">{minY.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Northing Max (Y)</span>
                  <span className="text-slate-200">{maxY.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-sans text-[11px]">Northing Span (H)</span>
                  <span className="text-cyan-400 font-semibold">{heightY.toFixed(2)} m</span>
                </div>
              </div>
            )}

            {/* TAB 3: TERRAIN (3D Surface Area, Triangles & Elevations) */}
            {projectInfoTab === 'terrain' && (
              <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Min Elevation (RL)</span>
                  <span className="text-emerald-400 font-bold">{minElevation.toFixed(3)} m</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Max Elevation (RL)</span>
                  <span className="text-red-400 font-bold">{maxElevation.toFixed(3)} m</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Mean Elevation (RL)</span>
                  <span className="text-slate-200">{meanElevation.toFixed(3)} m</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">2D Planar Area</span>
                  <span className="text-slate-200 font-semibold">{Number(area2d).toLocaleString(undefined, { maximumFractionDigits: 0 })} m²</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">Area in Acres</span>
                  <span className="text-emerald-400 font-bold">{areaAcres} Ac</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                  <span className="text-slate-400 font-sans text-[11px]">3D Surface Area</span>
                  <span className="text-purple-400 font-bold">{Number(area3d).toLocaleString(undefined, { maximumFractionDigits: 0 })} m²</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-sans text-[11px] flex items-center space-x-1">
                    <Triangle className="w-3 h-3 text-amber-400" />
                    <span>TIN Triangles</span>
                  </span>
                  <span className="text-amber-400 font-bold">{formatInteger(triangleCount)}</span>
                </div>
              </div>
            )}

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={handleCopySummary}
                className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold flex items-center justify-center space-x-1.5 transition border border-slate-700/80"
                title="Copy Project Geodetic Specifications"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                <span>{copied ? 'Copied!' : 'Copy Specs'}</span>
              </button>

              <button
                onClick={() => onSelectTab('metadata')}
                className="py-1.5 px-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded text-[10px] font-semibold flex items-center justify-center space-x-1.5 transition border border-slate-700/80 hover:border-blue-500"
                title="Open Full Metadata & Provenance Audit"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Full Audit</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Layer Control */}
      <div className="p-3.5 border-b border-slate-800">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          LAYER CONTROL
        </h4>
        <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800/80 space-y-2 text-xs">
          <label className="flex items-center space-x-2.5 text-slate-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={layers.surface}
              onChange={() => onToggleLayer('surface')}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>3D Surface</span>
          </label>
          <label className="flex items-center space-x-2.5 text-slate-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={layers.points}
              onChange={() => onToggleLayer('points')}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Survey Points</span>
          </label>
          <label className="flex items-center space-x-2.5 text-slate-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={layers.pointLabels}
              onChange={() => onToggleLayer('pointLabels')}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Point Labels</span>
          </label>
          <label className="flex items-center space-x-2.5 text-slate-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={layers.wireframe}
              onChange={() => onToggleLayer('wireframe')}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Wireframe (TIN)</span>
          </label>
          <label className="flex items-center space-x-2.5 text-slate-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={layers.contour}
              onChange={() => onToggleLayer('contour')}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Contour Lines</span>
          </label>
          <label className="flex items-center space-x-2.5 text-slate-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={layers.contourLabels}
              onChange={() => onToggleLayer('contourLabels')}
              className="rounded bg-slate-800 border-slate-700 text-purple-500 focus:ring-0"
            />
            <span className="flex items-center space-x-1.5">
              <span>Contour Elevation (RL)</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            </span>
          </label>
          <label className="flex items-center space-x-2.5 text-slate-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={layers.hillshade}
              onChange={() => onToggleLayer('hillshade')}
              className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Hillshade</span>
          </label>
        </div>
      </div>
    </aside>
  );
};

