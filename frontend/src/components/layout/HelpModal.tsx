import React from 'react';
import { HelpCircle, X, Compass, Layers, MousePointer, Download, ShieldCheck } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">GRIHAYAN 3D Surface Analyzer — User Guide</h3>
              <p className="text-xs text-slate-400">Controls, navigation, and surveying workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5">
            <h4 className="font-bold text-blue-400 flex items-center space-x-1.5">
              <MousePointer className="w-4 h-4" />
              <span>3D Navigation Controls</span>
            </h4>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li><strong>Left Mouse Drag:</strong> Orbit / Rotate 3D terrain surface.</li>
              <li><strong>Right Mouse Drag:</strong> Pan camera horizontally and vertically.</li>
              <li><strong>Mouse Scroll Wheel:</strong> Smooth zoom in and zoom out.</li>
              <li><strong>Hover over Terrain:</strong> Real-time raycasting inspection showing exact Easting ($X$), Northing ($Y$), and Elevation ($RL$).</li>
            </ul>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5">
            <h4 className="font-bold text-emerald-400 flex items-center space-x-1.5">
              <Layers className="w-4 h-4" />
              <span>Survey Workflow</span>
            </h4>
            <ol className="list-decimal list-inside text-slate-400 space-y-1">
              <li>Upload CSV/XLSX survey file via <strong>"Upload Survey File"</strong>.</li>
              <li>Confirm Point ID, X (Easting), Y (Northing), and RL (Elevation) column mapping.</li>
              <li>Select your Coordinate Reference System (CRS) or use Local Grid.</li>
              <li>Inspect the quality audit report and continue with clean points.</li>
              <li>Analyze contours, cross-sections, cut/fill volumes, and export GeoTIFF/Shapefile outputs.</li>
            </ol>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5">
            <h4 className="font-bold text-purple-400 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Local-First & Data Security</span>
            </h4>
            <p className="text-slate-400 leading-relaxed">
              All computation, triangulation, and GIS raster operations execute 100% locally on your computer. Survey data is never transmitted to external cloud APIs or third-party servers.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
