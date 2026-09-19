import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Layers, 
  RefreshCw, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Sliders, 
  Eye, 
  EyeOff, 
  FileCode, 
  Activity, 
  Sparkles, 
  Palette, 
  Search,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  TableProperties,
  Tag,
  Check,
  FileDown
} from 'lucide-react';
import { ColumnMapping } from '../../types/survey';
import { formatNumber, formatInteger } from '../../utils/formatters';
import { surveyApi } from '../../services/api';

interface ContoursViewProps {
  fileId?: string;
  columnMapping?: ColumnMapping | null;
  sourceCrs?: string | null;
  contoursData?: any | null;
  onUpdateContours?: (data: any) => void;
}

export const ContoursView: React.FC<ContoursViewProps> = ({
  fileId,
  columnMapping,
  sourceCrs,
  contoursData,
  onUpdateContours,
}) => {
  // Drawer States (Default closed for maximum 100% full screen view)
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState<boolean>(false);

  // Contour Generation Parameters
  const [interval, setInterval] = useState<number>(contoursData?.interval ?? 1.0);
  const [customInterval, setCustomInterval] = useState<string>(String(contoursData?.interval ?? 1.0));
  const [majorMultiplier, setMajorMultiplier] = useState<number>(5);
  const [resolution, setResolution] = useState<number>(1.0);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // 2D Viewer Display Settings
  const [colorScheme, setColorScheme] = useState<'hypsometric' | 'cad' | 'viridis' | 'terrain' | 'monochrome'>('hypsometric');
  const [showMajor, setShowMajor] = useState<boolean>(true);
  const [showMinor, setShowMinor] = useState<boolean>(true);
  const [smoothCurves, setSmoothCurves] = useState<boolean>(true);
  const [selectedElevation, setSelectedElevation] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // 2D Elevation Label Display Options
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [labelScope, setLabelScope] = useState<'major_only' | 'all' | 'minor_only'>('major_only');
  const [labelFormat, setLabelFormat] = useState<'unit' | 'rl' | 'numeric'>('unit');
  const [labelDensity, setLabelDensity] = useState<'standard' | 'dense' | 'sparse'>('standard');
  const [labelFontSize, setLabelFontSize] = useState<number>(11);

  // Canvas Pan & Zoom State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; elevation: number | null } | null>(null);

  const standardIntervals = [0.2, 0.5, 1.0, 2.0, 5.0, 10.0];

  // Calculate Bounds
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const allContours = [
      ...(contoursData?.major_contours || []),
      ...(contoursData?.minor_contours || []),
    ];

    allContours.forEach((c: any) => {
      c.points?.forEach((pt: number[]) => {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      });
    });

    if (minX === Infinity) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 };
    }
    return { minX, maxX, minY, maxY, width: maxX - minX || 1, height: maxY - minY || 1 };
  }, [contoursData]);

  // Aggregate Contour Levels & Lengths
  const contourLevels = useMemo(() => {
    const map = new Map<number, { elevation: number; isMajor: boolean; segmentCount: number; vertexCount: number; lengthMeters: number }>();
    const allContours = [
      ...(contoursData?.major_contours || []),
      ...(contoursData?.minor_contours || []),
    ];

    allContours.forEach((c: any) => {
      const elev = c.elevation;
      const pts = c.points || [];
      let len = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1][0] - pts[i][0];
        const dy = pts[i + 1][1] - pts[i][1];
        len += Math.sqrt(dx * dx + dy * dy);
      }

      if (!map.has(elev)) {
        map.set(elev, {
          elevation: elev,
          isMajor: c.is_major,
          segmentCount: 1,
          vertexCount: pts.length,
          lengthMeters: len,
        });
      } else {
        const item = map.get(elev)!;
        item.segmentCount += 1;
        item.vertexCount += pts.length;
        item.lengthMeters += len;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.elevation - b.elevation);
  }, [contoursData]);

  const totalLengthMeters = useMemo(() => {
    return contourLevels.reduce((acc, curr) => acc + curr.lengthMeters, 0);
  }, [contourLevels]);

  // Interpolate Color according to Elevation
  const getContourColor = (elev: number, isMajor: boolean): string => {
    const minZ = contoursData?.elevation_min ?? 0;
    const maxZ = contoursData?.elevation_max ?? 100;
    const t = Math.max(0, Math.min(1, (elev - minZ) / (maxZ - minZ || 1)));

    if (colorScheme === 'cad') {
      return isMajor ? '#ffffff' : '#38bdf8'; // CAD Index White + Cyan Minor
    } else if (colorScheme === 'monochrome') {
      return isMajor ? '#f8fafc' : '#64748b';
    } else if (colorScheme === 'viridis') {
      if (t < 0.25) return '#440154';
      if (t < 0.50) return '#3b528b';
      if (t < 0.75) return '#21918c';
      if (t < 0.90) return '#5ec962';
      return '#fde725';
    } else if (colorScheme === 'terrain') {
      if (t < 0.25) return '#15803d';
      if (t < 0.50) return '#84cc16';
      if (t < 0.75) return '#d97706';
      if (t < 0.90) return '#78350f';
      return '#f8fafc';
    } else {
      // GIS Hypsometric Rainbow
      if (t < 0.25) return '#2563eb';
      if (t < 0.50) return '#10b981';
      if (t < 0.75) return '#eab308';
      if (t < 0.90) return '#f97316';
      return '#ef4444';
    }
  };

  // Re-generate Vector Contours
  const handleRegenerate = async (intVal?: number) => {
    const chosenInterval = intVal ?? parseFloat(customInterval) ?? interval;
    if (isNaN(chosenInterval) || chosenInterval <= 0) return;
    if (!fileId || !columnMapping) return;

    setInterval(chosenInterval);
    setIsRegenerating(true);
    try {
      const res = await surveyApi.generateContours({
        file_id: fileId,
        column_mapping: columnMapping,
        source_crs: sourceCrs,
        interval: chosenInterval,
        major_multiplier: majorMultiplier,
        resolution: resolution,
      });
      if (onUpdateContours && res.contours) {
        onUpdateContours(res.contours);
      }
    } catch (err) {
      console.error('Contour regeneration error:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Reset 2D View to Fit Extents
  const handleFitExtents = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setSelectedElevation(null);
  };

  // Chaikin's Algorithm for Smooth Aesthetic Polylines
  const smoothPolyline = (pts: number[][]): number[][] => {
    if (!smoothCurves || pts.length < 3) return pts;
    const output: number[][] = [];
    output.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const q = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
      const r = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];
      output.push(q);
      output.push(r);
    }
    output.push(pts[pts.length - 1]);
    return output;
  };

  // Draw 2D Vector Contours on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Background GIS dark blueprint grid
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 40 * zoom;
    const startX = (pan.x % gridSize);
    const startY = (pan.y % gridSize);

    ctx.beginPath();
    for (let x = startX; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = startY; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    if (!contoursData) return;

    // Coordinate transformation
    const padding = 50;
    const scaleX = (width - padding * 2) / bounds.width;
    const scaleY = (height - padding * 2) / bounds.height;
    const baseScale = Math.min(scaleX, scaleY) * zoom;

    const offsetX = (width - bounds.width * baseScale) / 2 + pan.x;
    const offsetY = (height - bounds.height * baseScale) / 2 + pan.y;

    const worldToScreen = (wx: number, wy: number) => {
      const sx = offsetX + (wx - bounds.minX) * baseScale;
      const sy = height - (offsetY + (wy - bounds.minY) * baseScale); // Invert Y for GIS North-Up
      return { x: sx, y: sy };
    };

    const majorContours = contoursData.major_contours || [];
    const minorContours = contoursData.minor_contours || [];

    // Helper to render polyline group
    const renderContoursList = (list: any[], isMajor: boolean) => {
      list.forEach((contour: any) => {
        if (!contour.points || contour.points.length < 2) return;
        const elev = contour.elevation;
        const isSelected = selectedElevation !== null && selectedElevation === elev;

        const color = isSelected ? '#fbbf24' : getContourColor(elev, isMajor);
        const lineWidth = isSelected ? (isMajor ? 4 : 3) : (isMajor ? 2.2 : 1.0);

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const smoothed = smoothPolyline(contour.points);
        ctx.beginPath();
        const start = worldToScreen(smoothed[0][0], smoothed[0][1]);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < smoothed.length; i++) {
          const pt = worldToScreen(smoothed[i][0], smoothed[i][1]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Check if label should be shown based on user preferences
        const shouldShowThisLabel = showLabels && (
          isSelected ||
          (labelScope === 'all') ||
          (labelScope === 'major_only' && isMajor) ||
          (labelScope === 'minor_only' && !isMajor)
        );

        if (shouldShowThisLabel && smoothed.length >= 4) {
          // Format text based on user preference
          let labelText = `${elev.toFixed(1)}m`;
          if (labelFormat === 'rl') labelText = `RL ${elev.toFixed(1)}`;
          if (labelFormat === 'numeric') labelText = `${elev.toFixed(1)}`;

          // Determine label frequency / density
          let sampleIndices = [Math.floor(smoothed.length * 0.5)];
          if (labelDensity === 'dense' && isMajor && smoothed.length > 24) {
            sampleIndices = [
              Math.floor(smoothed.length * 0.25),
              Math.floor(smoothed.length * 0.5),
              Math.floor(smoothed.length * 0.75),
            ];
          } else if (labelDensity === 'sparse' && !isMajor) {
            sampleIndices = []; // Skip minor lines in sparse mode
          }

          sampleIndices.forEach((sIdx) => {
            const midPt = smoothed[sIdx];
            const screenPos = worldToScreen(midPt[0], midPt[1]);

            ctx.font = `bold ${labelFontSize}px JetBrains Mono, monospace`;
            const textWidth = ctx.measureText(labelText).width;

            // Draw small snug badge
            ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
            ctx.strokeStyle = isSelected ? '#fbbf24' : (isMajor ? '#c084fc' : '#38bdf8');
            ctx.lineWidth = 1.2;

            const bw = textWidth + 8;
            const bh = labelFontSize + 6;
            ctx.beginPath();
            ctx.roundRect(screenPos.x - bw / 2, screenPos.y - bh / 2, bw, bh, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, screenPos.x, screenPos.y);
          });
        }
      });
    };

    if (showMinor) renderContoursList(minorContours, false);
    if (showMajor) renderContoursList(majorContours, true);

  }, [
    contoursData,
    bounds,
    zoom,
    pan,
    colorScheme,
    showMajor,
    showMinor,
    showLabels,
    labelScope,
    labelFormat,
    labelDensity,
    labelFontSize,
    smoothCurves,
    selectedElevation,
  ]);

  // Handle Canvas Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    });
    resizeObserver.observe(parent);

    return () => resizeObserver.disconnect();
  }, []);

  // Pan & Zoom Events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // Hover detection
    const canvas = canvasRef.current;
    if (!canvas || !contoursData) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const padding = 50;
    const scaleX = (canvas.width - padding * 2) / bounds.width;
    const scaleY = (canvas.height - padding * 2) / bounds.height;
    const baseScale = Math.min(scaleX, scaleY) * zoom;
    const offsetX = (canvas.width - bounds.width * baseScale) / 2 + pan.x;
    const offsetY = (canvas.height - bounds.height * baseScale) / 2 + pan.y;

    const realX = bounds.minX + (mx - offsetX) / baseScale;
    const realY = bounds.minY + ((canvas.height - my) - offsetY) / baseScale;

    setHoverInfo({ x: realX, y: realY, elevation: null });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.2, Math.min(25, prev * zoomFactor)));
  };

  // Export CAD DWG / DXF Handler
  const handleExportCADDWG = async () => {
    if (!fileId || !columnMapping) return;
    try {
      const blob = await surveyApi.exportGISData({
        file_id: fileId,
        column_mapping: columnMapping,
        source_crs: sourceCrs,
        format: 'cad_dwg',
        interval: interval,
        resolution: resolution,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey_contours_${interval}m_CAD_DWG_DXF.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CAD DWG / DXF export error:', err);
    }
  };

  // Export GIS Shapefile Handler
  const handleExportShapefile = async () => {
    if (!fileId || !columnMapping) return;
    try {
      const blob = await surveyApi.exportGISData({
        file_id: fileId,
        column_mapping: columnMapping,
        source_crs: sourceCrs,
        format: 'shapefile',
        interval: interval,
        resolution: resolution,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey_contours_${interval}m_shp.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Shapefile export error:', err);
    }
  };

  // Export GeoJSON Handler
  const handleExportGeoJSON = async () => {
    if (!contoursData?.geojson) return;
    const blob = new Blob([JSON.stringify(contoursData.geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_contours_${interval}m.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export High-Res Map PNG
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `contours_map_${interval}m.png`;
    a.click();
  };

  const filteredLevels = contourLevels.filter((lvl) =>
    lvl.elevation.toFixed(2).includes(searchFilter) ||
    (lvl.isMajor ? 'major index' : 'minor intermediate').includes(searchFilter.toLowerCase())
  );

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 px-5 py-2.5 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <span>Topographic Vector Contour Studio</span>
              <span className="bg-blue-500/10 text-blue-400 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-500/20">
                Interval: {interval}m
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Interactive 2D Vector Isolines, Index Contours, Level Registry & CAD Exporters
            </p>
          </div>
        </div>

        {/* Quick Export Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportShapefile}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            title="Export Contours to GIS Shapefile"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Shapefile (.zip)</span>
          </button>

          <button
            onClick={handleExportCADDWG}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            title="Download AutoCAD (DWG / DXF) Vector Contours Package (.zip)"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>CAD File DWG/DXF (.zip)</span>
          </button>

          <button
            onClick={handleExportGeoJSON}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            title="Download Contours GeoJSON"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>GeoJSON</span>
          </button>

          <button
            onClick={handleExportPNG}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            title="Save High-Res Contours Map Image"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>Snapshot PNG</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body (100% Full Width Expansive Canvas) */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Left Drawer Toggle Button (When Closed) */}
        {!isLeftDrawerOpen && (
          <button
            onClick={() => setIsLeftDrawerOpen(true)}
            className="absolute top-4 left-4 z-30 flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md transition transform hover:scale-105"
            title="Open Interval Settings, Styling & Label Options"
          >
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span>Interval & Styling</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}

        {/* Left Sliding Drawer (Interval & Styling Settings + Label Controls) */}
        <div
          className={`absolute top-0 left-0 bottom-0 z-30 w-80 bg-slate-900/95 border-r border-slate-800 shadow-2xl backdrop-blur-md flex flex-col transition-transform duration-300 ease-in-out ${
            isLeftDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Interval & Styling</h3>
            </div>
            <button
              onClick={() => setIsLeftDrawerOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
              title="Close Drawer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Standard Interval Presets */}
            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-bold">Standard Interval Presets</label>
              <div className="grid grid-cols-3 gap-1.5">
                {standardIntervals.map((val) => (
                  <button
                    key={val}
                    disabled={isRegenerating}
                    onClick={() => {
                      setCustomInterval(String(val));
                      handleRegenerate(val);
                    }}
                    className={`py-1.5 rounded text-xs font-mono font-semibold transition ${
                      interval === val
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                    }`}
                  >
                    {val} m
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Interval */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Custom Interval (m)</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={customInterval}
                  onChange={(e) => setCustomInterval(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  disabled={isRegenerating}
                  onClick={() => handleRegenerate()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  <span>Apply</span>
                </button>
              </div>
            </div>

            {/* Major Multiplier */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <label className="text-xs text-slate-400">Index / Major Multiplier</label>
              <select
                value={majorMultiplier}
                onChange={(e) => {
                  setMajorMultiplier(parseInt(e.target.value));
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value={4}>Every 4th line (4x = {(interval * 4).toFixed(1)}m)</option>
                <option value={5}>Every 5th line (5x = {(interval * 5).toFixed(1)}m - Standard)</option>
                <option value={10}>Every 10th line (10x = {(interval * 10).toFixed(1)}m)</option>
              </select>
            </div>

            {/* DEM Grid Resolution */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">DEM Surface Grid Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(parseFloat(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value={0.5}>0.5m (Ultra High-Definition)</option>
                <option value={1.0}>1.0m (Standard GIS Grid)</option>
                <option value={2.0}>2.0m (Fast Lightweight)</option>
              </select>
            </div>

            {/* Color Scheme */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <label className="text-xs text-slate-400">Color Palette</label>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="hypsometric">GIS Hypsometric Rainbow</option>
                <option value="cad">Classic CAD (Index White + Cyan)</option>
                <option value="viridis">Viridis Spectral</option>
                <option value="terrain">Natural Topo Terrain</option>
                <option value="monochrome">Monochrome High-Contrast</option>
              </select>
            </div>

            {/* Layer Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-800 cursor-pointer">
                <span>Major / Index Contours</span>
                <input
                  type="checkbox"
                  checked={showMajor}
                  onChange={(e) => setShowMajor(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-800 cursor-pointer">
                <span>Minor / Intermediate Contours</span>
                <input
                  type="checkbox"
                  checked={showMinor}
                  onChange={(e) => setShowMinor(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-0"
                />
              </label>

              {/* 2D Elevation Text Badges Main Switch */}
              <label className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-800 cursor-pointer">
                <span className="flex items-center space-x-1.5 font-medium text-slate-200">
                  <Tag className="w-3.5 h-3.5 text-purple-400" />
                  <span>2D Elevation Text Badges</span>
                </span>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-0"
                />
              </label>

              {/* Granular Label Show Options (Visible under 2D Elevation Text Badges) */}
              {showLabels && (
                <div className="p-3 bg-slate-950/80 border border-purple-500/20 rounded-lg space-y-3 pl-3">
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                    <span>Label Display Options</span>
                  </div>

                  {/* 1. Label Scope / Lines to Label */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Show Labels On</label>
                    <select
                      value={labelScope}
                      onChange={(e) => setLabelScope(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="major_only">Major / Index Contours Only (Clean)</option>
                      <option value="all">All Contours (Major + Minor)</option>
                      <option value="minor_only">Minor Contours Only</option>
                    </select>
                  </div>

                  {/* 2. Label Text Format */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Text Format</label>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => setLabelFormat('unit')}
                        className={`py-1 rounded text-[10px] font-mono font-semibold transition ${
                          labelFormat === 'unit'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                        title="Format: 24.5m"
                      >
                        24.5m
                      </button>
                      <button
                        onClick={() => setLabelFormat('rl')}
                        className={`py-1 rounded text-[10px] font-mono font-semibold transition ${
                          labelFormat === 'rl'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                        title="Format: RL 24.5"
                      >
                        RL 24.5
                      </button>
                      <button
                        onClick={() => setLabelFormat('numeric')}
                        className={`py-1 rounded text-[10px] font-mono font-semibold transition ${
                          labelFormat === 'numeric'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                        }`}
                        title="Format: 24.5"
                      >
                        24.5
                      </button>
                    </div>
                  </div>

                  {/* 3. Label Density */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Label Density / Frequency</label>
                    <select
                      value={labelDensity}
                      onChange={(e) => setLabelDensity(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="standard">Standard (1-2 per line)</option>
                      <option value="dense">Dense (Multiple stations per line)</option>
                      <option value="sparse">Sparse (Only center on long lines)</option>
                    </select>
                  </div>

                  {/* 4. Font Size */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Label Font Size</span>
                      <span className="font-mono text-purple-300">{labelFontSize}px</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[9, 11, 13].map((size) => (
                        <button
                          key={size}
                          onClick={() => setLabelFontSize(size)}
                          className={`py-1 rounded text-[10px] font-mono transition ${
                            labelFontSize === size
                              ? 'bg-purple-600 text-white font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                        >
                          {size === 9 ? 'Small (9px)' : size === 11 ? 'Medium (11px)' : 'Large (13px)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Curve Smoothing */}
              <label className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-800 cursor-pointer">
                <span className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Smooth Curve Polishing</span>
                </span>
                <input
                  type="checkbox"
                  checked={smoothCurves}
                  onChange={(e) => setSmoothCurves(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Drawer Toggle Button (When Closed) */}
        {!isRightDrawerOpen && (
          <button
            onClick={() => setIsRightDrawerOpen(true)}
            className="absolute top-4 right-4 z-30 flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md transition transform hover:scale-105"
            title="Open Contour Level Registry"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            <TableProperties className="w-4 h-4 text-purple-400" />
            <span>Level Registry ({contourLevels.length})</span>
          </button>
        )}

        {/* Right Sliding Drawer (Contour Level Registry) */}
        <div
          className={`absolute top-0 right-0 bottom-0 z-30 w-80 bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-md flex flex-col transition-transform duration-300 ease-in-out ${
            isRightDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200">
              <TableProperties className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Level Registry ({contourLevels.length})
              </h3>
            </div>
            <button
              onClick={() => setIsRightDrawerOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
              title="Close Drawer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Search Filter */}
          <div className="p-3 border-b border-slate-800/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter by RL or Type..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/90 text-slate-400 sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="p-2">RL Elev</th>
                  <th className="p-2">Type</th>
                  <th className="p-2 text-right">Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredLevels.map((lvl) => {
                  const isSelected = selectedElevation === lvl.elevation;
                  const color = getContourColor(lvl.elevation, lvl.isMajor);

                  return (
                    <tr
                      key={lvl.elevation}
                      onClick={() => setSelectedElevation(isSelected ? null : lvl.elevation)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-amber-500/25 text-amber-300 font-bold'
                          : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <td className="p-2 flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block border border-slate-700 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className={lvl.isMajor ? 'font-bold text-slate-100' : 'text-slate-300'}>
                          {formatNumber(lvl.elevation, 2)} m
                        </span>
                      </td>
                      <td className="p-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            lvl.isMajor
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {lvl.isMajor ? 'Major' : 'Minor'}
                        </span>
                      </td>
                      <td className="p-2 text-right text-slate-400">
                        {lvl.lengthMeters.toFixed(1)} m
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Selection Actions */}
          {selectedElevation !== null && (
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
              <span className="text-xs text-amber-400 font-mono">
                Highlighted: {selectedElevation.toFixed(2)}m
              </span>
              <button
                onClick={() => setSelectedElevation(null)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline"
              >
                Clear Highlight
              </button>
            </div>
          )}
        </div>

        {/* Center Main 2D Vector Contour Map Canvas */}
        <div className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-crosshair active:cursor-grabbing"
          />

          {/* Floating Pan & Zoom Toolbar */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 flex items-center space-x-2 shadow-2xl backdrop-blur-md z-10">
            <button
              onClick={() => setZoom((prev) => Math.min(25, prev * 1.25))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((prev) => Math.max(0.2, prev * 0.8))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFitExtents}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Fit to Terrain Extents"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <span className="px-2 text-[11px] font-mono text-slate-400">
              Zoom: {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Hover Coordinate HUD */}
          {hoverInfo && (
            <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-300 shadow-xl backdrop-blur-md z-10 flex items-center space-x-4">
              <div><span className="text-slate-500">E (X):</span> {formatNumber(hoverInfo.x, 2)}</div>
              <div><span className="text-slate-500">N (Y):</span> {formatNumber(hoverInfo.y, 2)}</div>
              {selectedElevation !== null && (
                <div className="text-amber-400 font-bold">
                  <span>Selected RL:</span> {selectedElevation.toFixed(2)}m
                </div>
              )}
            </div>
          )}

          {/* Elevation Range Legend Indicator */}
          <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 shadow-xl backdrop-blur-md z-10 flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Elevation Span
            </span>
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-20 rounded shadow-inner"
                style={{
                  background: colorScheme === 'cad'
                    ? 'linear-gradient(to top, #38bdf8 0%, #ffffff 100%)'
                    : colorScheme === 'viridis'
                    ? 'linear-gradient(to top, #440154 0%, #3b528b 25%, #21918c 50%, #5ec962 75%, #fde725 100%)'
                    : colorScheme === 'terrain'
                    ? 'linear-gradient(to top, #15803d 0%, #84cc16 30%, #d97706 60%, #78350f 85%, #f8fafc 100%)'
                    : colorScheme === 'monochrome'
                    ? 'linear-gradient(to top, #64748b 0%, #f8fafc 100%)'
                    : 'linear-gradient(to top, #2563eb 0%, #10b981 25%, #eab308 50%, #f97316 75%, #ef4444 100%)'
                }}
              />
              <div className="flex flex-col justify-between h-20 text-[9px] font-mono text-slate-300">
                <span className="text-red-400 font-bold">{formatNumber(contoursData?.elevation_max, 1)}m</span>
                <span>{formatNumber(((contoursData?.elevation_min ?? 0) + (contoursData?.elevation_max ?? 100)) / 2, 1)}m</span>
                <span className="text-blue-400 font-bold">{formatNumber(contoursData?.elevation_min, 1)}m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
