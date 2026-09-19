import React, { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  Map, 
  Layers, 
  FileText, 
  Box, 
  CheckCircle2, 
  X, 
  Loader2,
  Sliders,
  PenLine,
  Check,
  Globe,
  Printer
} from 'lucide-react';
import axios from 'axios';
import { ColumnMapping } from '../../types/survey';
import { 
  exportViewedOBJ, 
  exportViewedGLB, 
  exportViewedSTL, 
  exportViewedPLY 
} from '../../utils/export3DSurfaceAsViewed';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId?: string;
  columnMapping?: ColumnMapping | null;
  sourceCrs?: string | null;
  verticalDatum?: string;
  projectName: string;
  tinData?: any | null;
  verticalExaggeration?: number;
  surfaceStyle?: string;
  colorMap?: string;
  meshDensity?: 'classic' | 'full' | 'sparse';
  showSkirt?: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  fileId,
  columnMapping,
  sourceCrs,
  verticalDatum = 'Local TBM',
  projectName: initialProjectName,
  tinData,
  verticalExaggeration = 2.0,
  surfaceStyle = 'elevation',
  colorMap = 'elevation',
  meshDensity = 'classic',
  showSkirt = false,
}) => {
  const [downloadingFmt, setDownloadingFmt] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [customProjectName, setCustomProjectName] = useState(initialProjectName || 'Survey_Project');
  const [contourInterval, setContourInterval] = useState<number>(1.0);
  const [demResolution, setDemResolution] = useState<number>(1.0);

  if (!isOpen || !fileId || !columnMapping) return null;

  const exportFormats = [
    {
      id: 'pdf',
      title: 'PDF Topographic Survey Report',
      description: 'Official executive survey summary report with Gaussian elevation histogram, geodetic QA/QC, and KPI cards',
      icon: FileText,
      ext: '.pdf',
      badge: 'Certified PDF',
      badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
    {
      id: 'cad_dwg',
      title: 'AutoCAD CAD Package (DWG / DXF)',
      description: '3D Contours, 3D Survey Points, and RL Text Badges on distinct layers for AutoCAD 2018-2026 & Civil 3D',
      icon: Box,
      ext: '.zip',
      badge: 'AutoCAD / DWG',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'excel',
      title: 'Excel Topographic Workbook (.xlsx)',
      description: 'Multi-sheet spreadsheet with precision Survey Points table and Project Statistical QA/QC Summary',
      icon: FileSpreadsheet,
      ext: '.xlsx',
      badge: 'Excel Data',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'geotiff',
      title: 'DEM / DTM GeoTIFF Raster',
      description: 'Standard 32-bit floating point georeferenced raster elevation model with affine transform',
      icon: Layers,
      ext: '.tif',
      badge: 'GIS Raster',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    {
      id: 'shapefile',
      title: 'Contour ESRI Shapefile (.zip)',
      description: 'Vector contour polylines with elevation attributes, major index flags, and .prj georeferencing',
      icon: Map,
      ext: '.zip',
      badge: 'GIS Vector',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'geojson_contours',
      title: 'Contour GeoJSON',
      description: 'Web-ready LineString FeatureCollection of contour vectors for Mapbox, Leaflet, and QGIS',
      icon: Map,
      ext: '.geojson',
      badge: 'Web GIS',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    },
    {
      id: 'csv',
      title: 'Cleaned Survey Points CSV',
      description: 'Standardized survey point table with Easting, Northing, RL, and Code with preserved coordinate precision',
      icon: FileSpreadsheet,
      ext: '.csv',
      badge: 'Tabular Data',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    {
      id: 'dxf_points',
      title: 'Survey Points AutoCAD DXF (.dxf)',
      description: 'Native 3D point entities with elevation text and Point ID numbers for CAD drafting',
      icon: Box,
      ext: '.dxf',
      badge: 'CAD Points',
      badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    },
    {
      id: 'geojson_points',
      title: 'Survey Points GeoJSON',
      description: '3D Point coordinates with Point ID, Code, and elevation properties',
      icon: Map,
      ext: '.geojson',
      badge: 'Vector Points',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    {
      id: 'obj',
      title: 'TIN 3D Mesh (.obj)',
      description: 'Standard Wavefront 3D OBJ surface mesh with vertex colors and view vertical relief for Blender, 3ds Max, and Civil 3D',
      icon: Box,
      ext: '.obj',
      badge: '3D CAD / Mesh',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    {
      id: 'glb',
      title: 'Binary 3D GLTF (.glb)',
      description: 'Compact binary 3D model with baked hypsometric elevation colors. Viewable in Windows 3D Viewer and web 3D viewers',
      icon: Globe,
      ext: '.glb',
      badge: 'Web 3D / AR',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
    {
      id: 'stl',
      title: '3D Printing Solid STL (.stl)',
      badge: '3D Printing',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: Printer,
      desc: 'Watertight binary STL mesh with applied vertical exaggeration and base skirt for Cura, BambuStudio, and PrusaSlicer',
      ext: '.stl',
    },
    {
      id: 'ply',
      title: 'Stanford Polygon (.ply)',
      badge: 'Point Clouds / GIS',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: Layers,
      desc: 'Point-cloud compatible polygon mesh with per-vertex XYZ and RGB colors for CloudCompare, MeshLab, and QGIS',
      ext: '.ply',
    },
  ];

  const handleDownload = async (fmt: string, ext: string) => {
    setDownloadingFmt(fmt);
    setDownloadSuccess(null);
    try {
      // If client-side tinData is available for 3D formats, generate instant zero-latency export
      if (tinData && ['obj', 'glb', 'stl', 'ply'].includes(fmt)) {
        const viewOpts = {
          tinData,
          projectName: customProjectName || 'Survey_Project',
          verticalExaggeration,
          surfaceStyle,
          colorMap,
          meshDensity,
          showSkirt,
          coordinateMode: 'centered' as const,
        };

        if (fmt === 'obj') {
          exportViewedOBJ(viewOpts);
        } else if (fmt === 'glb') {
          await exportViewedGLB(viewOpts);
        } else if (fmt === 'stl') {
          exportViewedSTL(viewOpts);
        } else if (fmt === 'ply') {
          exportViewedPLY(viewOpts);
        }
        setDownloadSuccess(fmt);
        setTimeout(() => setDownloadSuccess(null), 3000);
        return;
      }

      const response = await axios.post(
        '/api/export',
        {
          file_id: fileId,
          column_mapping: columnMapping,
          source_crs: sourceCrs,
          vertical_datum: verticalDatum || 'Local TBM',
          project_name: customProjectName || 'Survey_Project',
          format: fmt,
          resolution: demResolution,
          interval: contourInterval,
        },
        { responseType: 'blob' }
      );

      // Create blob download link
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanSlug = (customProjectName || 'Survey_Project').replace(/\s+/g, '_');
      link.setAttribute('download', `${cleanSlug}_${fmt}${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setDownloadSuccess(fmt);
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Error generating export file'}`);
    } finally {
      setDownloadingFmt(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">GIS & Topographic Export Center</h3>
              <p className="text-xs text-slate-400">
                Download georeferenced raster surfaces, AutoCAD packages, CAD meshes, vector contours, and PDF reports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customization Toolbar */}
        <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <PenLine className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Export File Prefix:</span>
            <input
              type="text"
              value={customProjectName}
              onChange={(e) => setCustomProjectName(e.target.value)}
              className="bg-slate-900 border border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-slate-200 text-xs w-48 font-mono focus:outline-none"
              placeholder="Project Name"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Contour Interval:</span>
              <select
                value={contourInterval}
                onChange={(e) => setContourInterval(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
              >
                <option value={0.5}>0.5 meter (Detailed)</option>
                <option value={1.0}>1.0 meter (Standard)</option>
                <option value={2.0}>2.0 meters (Regional)</option>
                <option value={5.0}>5.0 meters (High Relief)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-400">DEM Resolution:</span>
              <select
                value={demResolution}
                onChange={(e) => setDemResolution(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
              >
                <option value={0.5}>0.5 m/cell (High Res)</option>
                <option value={1.0}>1.0 m/cell (Standard)</option>
                <option value={2.0}>2.0 m/cell (Fast)</option>
                <option value={5.0}>5.0 m/cell (Overview)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Export Cards Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-2 gap-3.5 flex-1">
          {exportFormats.map((fmt) => {
            const Icon = fmt.icon;
            const isBusy = downloadingFmt === fmt.id;
            const isSuccess = downloadSuccess === fmt.id;
            return (
              <div
                key={fmt.id}
                className="p-4 bg-slate-950/60 border border-slate-800/90 hover:border-blue-500/50 rounded-xl transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-slate-800 rounded-lg text-blue-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-200">{fmt.title}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${fmt.badgeColor}`}>
                      {fmt.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {fmt.description}
                  </p>
                </div>

                <button
                  disabled={isBusy || !!downloadingFmt}
                  onClick={() => handleDownload(fmt.id, fmt.ext)}
                  className={`w-full py-2 rounded-md text-xs font-semibold flex items-center justify-center space-x-2 transition border ${
                    isSuccess
                      ? 'bg-emerald-600/90 text-white border-emerald-500'
                      : 'bg-slate-800 hover:bg-blue-600 disabled:bg-slate-800/50 text-slate-200 hover:text-white border-slate-700 hover:border-blue-500'
                  }`}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating {fmt.ext}...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
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
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              All exports preserve CRS (<strong className="text-blue-300">{sourceCrs || 'Local Grid'}</strong>) and Vertical Datum (<strong className="text-emerald-300">{verticalDatum || 'Local TBM'}</strong>).
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};



