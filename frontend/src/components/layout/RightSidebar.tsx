import React, { useState } from 'react';
import { 
  RotateCcw, 
  Sliders, 
  Box, 
  SunMedium, 
  Sparkles, 
  Layers, 
  Crosshair, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Eye,
  Compass,
  Download
} from 'lucide-react';
import { Export3DModal } from '../preview/Export3DModal';

interface RightSidebarProps {
  tinData?: any | null;
  projectName?: string;
  surfaceStyle: string;
  onChangeSurfaceStyle: (val: string) => void;
  colorMap: string;
  onChangeColorMap: (val: string) => void;
  meshDensity: 'classic' | 'full' | 'sparse';
  onChangeMeshDensity: (val: 'classic' | 'full' | 'sparse') => void;
  verticalExaggeration: number;
  onChangeVerticalExaggeration: (val: number) => void;
  hillshadeEnabled: boolean;
  onToggleHillshade: (val: boolean) => void;
  hillshadeAzimuth: number;
  onChangeHillshadeAzimuth: (val: number) => void;
  hillshadeAltitude: number;
  onChangeHillshadeAltitude: (val: number) => void;
  inspectorEnabled: boolean;
  onToggleInspector: (val: boolean) => void;
  showAxes?: boolean;
  onToggleAxes?: (val: boolean) => void;
  pointSize: number;
  onChangePointSize: (val: number) => void;
  opacity: number;
  onChangeOpacity: (val: number) => void;
  showSkirt: boolean;
  onToggleSkirt: (val: boolean) => void;
  smoothShading: boolean;
  onToggleSmoothShading: (val: boolean) => void;
  onResetView: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  tinData,
  projectName = 'Survey_Project',
  surfaceStyle,
  onChangeSurfaceStyle,
  colorMap,
  onChangeColorMap,
  meshDensity,
  onChangeMeshDensity,
  verticalExaggeration,
  onChangeVerticalExaggeration,
  hillshadeEnabled,
  onToggleHillshade,
  hillshadeAzimuth,
  onChangeHillshadeAzimuth,
  hillshadeAltitude,
  onChangeHillshadeAltitude,
  inspectorEnabled,
  onToggleInspector,
  showAxes = false,
  onToggleAxes,
  pointSize,
  onChangePointSize,
  opacity,
  onChangeOpacity,
  showSkirt,
  onToggleSkirt,
  smoothShading,
  onToggleSmoothShading,
  onResetView,
}) => {
  // Drawer Open / Closed State (Default closed so the 3D surface gets 100% full screen)
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExport3DOpen, setIsExport3DOpen] = useState<boolean>(false);

  return (
    <>
      {/* Floating Toggle Button (When Closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute top-4 right-4 z-30 flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md transition transform hover:scale-105 select-none"
          title="Open 3D Display Settings Drawer"
        >
          <Sliders className="w-4 h-4 text-blue-400" />
          <span>Display Settings</span>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
        </button>
      )}

      {/* Sliding Drawer Container (When Open) */}
      <div
        className={`absolute top-0 right-0 bottom-0 z-40 w-80 bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-md flex flex-col transition-transform duration-300 ease-in-out select-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2 text-slate-200">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Display Settings</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-1 px-2 py-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded text-xs transition"
            title="Close Drawer"
          >
            <span>Close</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Surface Style */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Surface Style</label>
            <select
              value={surfaceStyle}
              onChange={(e) => onChangeSurfaceStyle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="elevation">Elevation</option>
              <option value="monochrome">Monochrome</option>
              <option value="hillshade">Hillshade</option>
              <option value="elevation_hillshade">Elevation + Hillshade</option>
              <option value="wireframe">Wireframe (TIN)</option>
            </select>
          </div>

          {/* Mesh Density / Mode Selection */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <label className="text-xs text-slate-300 font-bold flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Mesh Density / Look</span>
            </label>
            <select
              value={meshDensity}
              onChange={(e) => onChangeMeshDensity(e.target.value as 'classic' | 'full' | 'sparse')}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="classic">Classic Survey Mesh (Original - Non Full)</option>
              <option value="full">Full Solid Mesh (100% Watertight)</option>
              <option value="sparse">Sparse Lightweight (25%)</option>
            </select>
            <p className="text-[10px] text-slate-500 italic">
              * "Classic Survey Mesh" provides the original open-facet CAD look.
            </p>
          </div>

          {/* 3D Tools & Features */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Tools & Options</span>
            </div>

            {/* Terrain Inspector HUD Toggle */}
            <div className="flex justify-between items-center bg-slate-800/60 p-2 rounded-md border border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs text-slate-200 font-medium flex items-center space-x-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                  <span>Terrain Inspector HUD</span>
                </div>
                <p className="text-[10px] text-slate-500">Hover coordinates (E, N, RL) tooltip</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={inspectorEnabled}
                  onChange={(e) => onToggleInspector(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* 3D Geological Skirt Toggle */}
            <div className="flex justify-between items-center bg-slate-800/60 p-2 rounded-md border border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs text-slate-200 font-medium flex items-center space-x-1.5">
                  <Box className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3D Skirt (Solid Block)</span>
                </div>
                <p className="text-[10px] text-slate-500">Solid geological datum base</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSkirt}
                  onChange={(e) => onToggleSkirt(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Smooth vs Classic Faceted Shading Toggle */}
            <div className="flex justify-between items-center bg-slate-800/60 p-2 rounded-md border border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs text-slate-200 font-medium flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Smooth Shading</span>
                </div>
                <p className="text-[10px] text-slate-500">Gouraud vs flat faceted normal shading</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={smoothShading}
                  onChange={(e) => onToggleSmoothShading(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* 3D Coordinate Axes (XYZ Gizmo) Toggle */}
            <div className="flex justify-between items-center bg-slate-800/60 p-2 rounded-md border border-slate-800">
              <div className="space-y-0.5">
                <div className="text-xs text-slate-200 font-medium flex items-center space-x-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-400" />
                  <span>3D Coordinate Axes (XYZ)</span>
                </div>
                <p className="text-[10px] text-slate-500">Show Z(Up), Y(North), X(East) axis lines</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!showAxes}
                  onChange={(e) => onToggleAxes && onToggleAxes(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Color Palette */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <label className="text-xs text-slate-400 font-medium">Color Palette</label>
            <select
              value={colorMap}
              onChange={(e) => onChangeColorMap(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="elevation">Elevation (Blue → Red)</option>
              <option value="viridis">Viridis</option>
              <option value="terrain">Terrain (Green → Brown)</option>
              <option value="grayscale">Grayscale</option>
            </select>
          </div>

          {/* Vertical Exaggeration Slider */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Vertical Exaggeration</span>
              <span className="font-mono text-blue-400">{verticalExaggeration.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={verticalExaggeration}
              onChange={(e) => onChangeVerticalExaggeration(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Opacity Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Surface Opacity</span>
              <span className="font-mono text-blue-400">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Point Size Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Survey Point Size</span>
              <span className="font-mono text-blue-400">{pointSize.toFixed(1)}px</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={pointSize}
              onChange={(e) => onChangePointSize(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Dynamic Hillshade Lighting Group */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <SunMedium className="w-3.5 h-3.5 text-amber-400" />
                <span>Analytical Hillshade Lighting</span>
              </span>
              <input
                type="checkbox"
                checked={hillshadeEnabled}
                onChange={(e) => onToggleHillshade(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
              />
            </div>

            {hillshadeEnabled && (
              <div className="space-y-3 pl-2 border-l border-slate-800">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Sun Azimuth</span>
                    <span className="font-mono text-blue-400">{hillshadeAzimuth}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={hillshadeAzimuth}
                    onChange={(e) => onChangeHillshadeAzimuth(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Sun Altitude</span>
                    <span className="font-mono text-blue-400">{hillshadeAltitude}°</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={hillshadeAltitude}
                    onChange={(e) => onChangeHillshadeAltitude(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Download 3D TIN Surface (As Viewed) */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <button
              onClick={() => setIsExport3DOpen(true)}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-500/20 border border-blue-400/40 transition active:scale-98"
            >
              <Download className="w-4 h-4 text-blue-200" />
              <span>Download 3D TIN (As Viewed)</span>
            </button>
            <p className="text-[10px] text-slate-500 text-center leading-tight">
              Instant 1-click export of .OBJ, .GLB, .STL, .DXF (3DFACE), .PLY matching active view relief & palette.
            </p>
          </div>

          {/* Reset 3D View Button */}
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={onResetView}
              className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset 3D View Camera</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3D As-Viewed Export Modal */}
      {tinData && (
        <Export3DModal
          isOpen={isExport3DOpen}
          onClose={() => setIsExport3DOpen(false)}
          tinData={tinData}
          projectName={projectName}
          verticalExaggeration={verticalExaggeration}
          surfaceStyle={surfaceStyle}
          colorMap={colorMap}
          meshDensity={meshDensity}
          showSkirt={showSkirt}
        />
      )}
    </>
  );
};
