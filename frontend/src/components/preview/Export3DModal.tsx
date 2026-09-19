import React, { useState } from 'react';
import { 
  Download, 
  Box, 
  Printer, 
  Layers, 
  Camera, 
  Sparkles, 
  Check, 
  X, 
  Sliders, 
  Compass, 
  CheckCircle2, 
  FileCode,
  Globe
} from 'lucide-react';
import { 
  exportViewedOBJ, 
  exportViewedGLB, 
  exportViewedSTL, 
  exportViewedDXF3DFace, 
  exportViewedPLY 
} from '../../utils/export3DSurfaceAsViewed';

interface Export3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  tinData: any;
  projectName: string;
  verticalExaggeration: number;
  surfaceStyle: string;
  colorMap: string;
  meshDensity: 'classic' | 'full' | 'sparse';
  showSkirt: boolean;
  onCaptureSnapshot?: () => void;
}

export const Export3DModal: React.FC<Export3DModalProps> = ({
  isOpen,
  onClose,
  tinData,
  projectName,
  verticalExaggeration,
  surfaceStyle,
  colorMap,
  meshDensity,
  showSkirt,
  onCaptureSnapshot,
}) => {
  const [coordinateMode, setCoordinateMode] = useState<'centered' | 'georeferenced'>('centered');
  const [applyExaggeration, setApplyExaggeration] = useState<boolean>(true);
  const [includeSkirt, setIncludeSkirt] = useState<boolean>(showSkirt);
  const [downloadingFmt, setDownloadingFmt] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen || !tinData) return null;

  const currentExaggeration = applyExaggeration ? verticalExaggeration : 1.0;

  const getOptions = () => ({
    tinData,
    projectName: projectName || 'Grihayan_Survey',
    verticalExaggeration: currentExaggeration,
    surfaceStyle,
    colorMap,
    meshDensity,
    showSkirt: includeSkirt,
    coordinateMode,
  });

  const handleDownloadFmt = async (fmtId: string) => {
    setDownloadingFmt(fmtId);
    setDownloadSuccess(null);
    try {
      const opts = getOptions();
      if (fmtId === 'obj') {
        exportViewedOBJ(opts);
      } else if (fmtId === 'glb') {
        await exportViewedGLB(opts);
      } else if (fmtId === 'stl') {
        exportViewedSTL(opts);
      } else if (fmtId === 'dxf') {
        exportViewedDXF3DFace(opts);
      } else if (fmtId === 'ply') {
        exportViewedPLY(opts);
      } else if (fmtId === 'png' && onCaptureSnapshot) {
        onCaptureSnapshot();
      }
      setDownloadSuccess(fmtId);
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err: any) {
      alert(`Export error: ${err.message || 'Failed to generate 3D file'}`);
    } finally {
      setDownloadingFmt(null);
    }
  };

  const formats = [
    {
      id: 'obj',
      title: 'Wavefront 3D (.obj)',
      badge: 'Blender / CAD / 3ds Max',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      icon: Box,
      desc: 'Industry standard 3D mesh with embedded per-vertex elevation RGB colors. Works seamlessly with Blender, 3ds Max, Maya, SketchUp, Rhino, and Unreal Engine.',
      ext: '.obj',
    },
    {
      id: 'glb',
      title: 'Binary GLTF (.glb)',
      badge: 'Web 3D / Windows 3D / AR',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      icon: Globe,
      desc: 'Compact binary 3D format containing geometry and hypsometric palette colors. Double-click to open natively in Windows 3D Viewer, PowerPoint 3D, and web viewers.',
      ext: '.glb',
    },
    {
      id: 'stl',
      title: '3D Printing STL (.stl)',
      badge: 'Cura / Bambu / Prusa / CNC',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      icon: Printer,
      desc: 'Binary StereoLithography surface with vertical relief and solid geological base skirt. Direct 1-click import into 3D print slicers (Cura, BambuStudio, PrusaSlicer).',
      ext: '.stl',
    },
    {
      id: 'dxf',
      title: 'AutoCAD 3DFACE Mesh (.dxf)',
      badge: 'AutoCAD / Civil 3D',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      icon: FileCode,
      desc: 'Native AutoCAD 3DFACE triangular surface with 24-bit TrueColor elevation shading and separate skirt layer for Civil 3D, AutoCAD 2000-2026, and MicroStation.',
      ext: '.dxf',
    },
    {
      id: 'ply',
      title: 'Stanford Polygon (.ply)',
      badge: 'CloudCompare / MeshLab / GIS',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      icon: Layers,
      desc: 'Precision polygon format with XYZ float coordinates and RGB color properties per vertex. Ideal for CloudCompare, MeshLab, Agisoft, and GIS point cloud tools.',
      ext: '.ply',
    },
    {
      id: 'png',
      title: 'High-Res Topo Snapshot (.png)',
      badge: '4K Ultra HD Graphic',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      icon: Camera,
      desc: 'Crystal-clear 4K screenshot of the active 3D camera angle with embedded Elevation (RL) color ramp legend card and geodetic watermark.',
      ext: '.png',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-100">Download 3D TIN Surface (As Viewed)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  WYSIWYG 3D Export
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Exports the 3D surface model exactly as currently configured in your 3D viewport (relief, density, palette, and skirt).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active View State Summary Pill Bar */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Active View Settings:</span>
          
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-800/90 text-blue-300 border border-slate-700 font-mono text-[11px]">
            <span>Relief:</span>
            <strong className="text-white">{verticalExaggeration.toFixed(1)}x</strong>
          </span>

          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-800/90 text-purple-300 border border-slate-700 text-[11px]">
            <span>Density:</span>
            <strong className="text-white uppercase">{meshDensity}</strong>
          </span>

          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-800/90 text-emerald-300 border border-slate-700 text-[11px]">
            <span>Palette:</span>
            <strong className="text-white capitalize">{colorMap}</strong>
          </span>

          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-slate-800/90 text-amber-300 border border-slate-700 text-[11px]">
            <span>Skirt Base:</span>
            <strong className="text-white">{includeSkirt ? 'Enabled (Solid)' : 'Disabled'}</strong>
          </span>
        </div>

        {/* Export Configuration Controls */}
        <div className="px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Coordinate System Mode Selection */}
          <div className="flex items-center space-x-2">
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-medium">Coordinates:</span>
            <div className="inline-flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setCoordinateMode('centered')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                  coordinateMode === 'centered'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Centers the model at origin (0, 0, 0) - Ideal for Blender, 3D printing, 3ds Max"
              >
                Centered (0, 0, 0)
              </button>
              <button
                type="button"
                onClick={() => setCoordinateMode('georeferenced')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                  coordinateMode === 'georeferenced'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Preserves real UTM / Local survey Easting & Northing coordinates - Ideal for AutoCAD / Civil 3D / GIS"
              >
                Georeferenced (UTM / Grid)
              </button>
            </div>
          </div>

          {/* Quick Toggles */}
          <div className="flex items-center space-x-5">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyExaggeration}
                onChange={(e) => setApplyExaggeration(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="text-slate-300">
                Apply Vertical Relief (<strong className="text-blue-400">{verticalExaggeration.toFixed(1)}x</strong>)
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSkirt}
                onChange={(e) => setIncludeSkirt(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="text-slate-300">Include 3D Geological Skirt</span>
            </label>
          </div>
        </div>

        {/* Format Download Cards Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 flex-1">
          {formats.map((fmt) => {
            const Icon = fmt.icon;
            const isBusy = downloadingFmt === fmt.id;
            const isSuccess = downloadSuccess === fmt.id;
            return (
              <div
                key={fmt.id}
                className="p-4 bg-slate-950/60 border border-slate-800/90 hover:border-blue-500/50 rounded-xl transition flex flex-col justify-between group shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-slate-800/90 rounded-lg text-blue-400 group-hover:text-blue-300 transition">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-200">{fmt.title}</h4>
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${fmt.badgeColor}`}>
                      {fmt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {fmt.desc}
                  </p>
                </div>

                <button
                  disabled={isBusy}
                  onClick={() => handleDownloadFmt(fmt.id)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition border ${
                    isSuccess
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 hover:bg-blue-600 disabled:bg-slate-800/50 text-slate-200 hover:text-white border-slate-700 hover:border-blue-500 active:scale-98'
                  }`}
                >
                  {isBusy ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating {fmt.ext}...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white animate-bounce" />
                      <span>Downloaded {fmt.ext}!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {fmt.ext}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Generated instantly client-side with 0 server latency. All vertex positions and color maps match your screen.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
