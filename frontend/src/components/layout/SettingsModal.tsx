import React, { useState } from 'react';
import { Settings, X, Check, Compass, Layers } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  units: { horizontal: string; vertical: string };
  onChangeUnits: (units: { horizontal: string; vertical: string }) => void;
  currentCrs?: string | null;
  currentDatum?: string;
  onUpdateGeodesy?: (crs: string | null, datum: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  units,
  onChangeUnits,
  currentCrs,
  currentDatum = 'Local TBM',
  onUpdateGeodesy,
}) => {
  const [horiz, setHoriz] = useState(units.horizontal);
  const [vert, setVert] = useState(units.vertical);
  const [crs, setCrs] = useState<string>(currentCrs || 'AUTO');
  const [datum, setDatum] = useState<string>(currentDatum || 'Local TBM');

  if (!isOpen) return null;

  const handleSave = () => {
    onChangeUnits({ horizontal: horiz, vertical: vert });
    if (onUpdateGeodesy) {
      onUpdateGeodesy(crs === 'AUTO' ? null : crs, datum);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-slate-800 rounded-lg text-blue-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Project & Geodesy Settings</h3>
              <p className="text-xs text-slate-400">Coordinate systems, vertical datums & display units</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Geodesy / CRS Section */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-slate-200 font-semibold">
              <Compass className="w-4 h-4 text-blue-400" />
              <span>Geodesy & Reference Datums</span>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Projected Coordinate System (CRS)</label>
              <select
                value={crs}
                onChange={(e) => setCrs(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
              >
                <option value="AUTO">Auto / Local Coordinate Grid</option>
                <option value="EPSG:32646">EPSG:32646 - WGS 84 / UTM zone 46N (Bangladesh East)</option>
                <option value="EPSG:32645">EPSG:32645 - WGS 84 / UTM zone 45N (Bangladesh West)</option>
                <option value="EPSG:9678">EPSG:9678 - Gulshan 303 / BTM (Bangladesh)</option>
                <option value="EPSG:4326">EPSG:4326 - WGS 84 (Geographic Lat/Lon)</option>
                <option value="LOCAL">LOCAL - Engineering Survey Grid</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Vertical Datum Reference (Elevation)</label>
              <select
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Local TBM">Local TBM (Temporary Benchmark)</option>
                <option value="PWD Datum">PWD Datum (Public Works Dept - Bangladesh)</option>
                <option value="SoB Datum">SoB Datum (Survey of Bangladesh)</option>
                <option value="MSL">Mean Sea Level (MSL)</option>
                <option value="CD">Chart Datum (CD - Hydrographic)</option>
                <option value="Custom Project Datum">Custom Project Datum</option>
              </select>
            </div>
          </div>

          {/* Units Section */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Horizontal Unit</label>
              <select
                value={horiz}
                onChange={(e) => setHoriz(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="meter">Meter (m) - Metric</option>
                <option value="feet">US Survey Feet (ft) - Imperial</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Vertical Unit</label>
              <select
                value={vert}
                onChange={(e) => setVert(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="meter">Meter (m) - Metric</option>
                <option value="feet">Feet (ft) - Imperial</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

