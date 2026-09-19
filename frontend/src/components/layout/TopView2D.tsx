import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sun, 
  Activity, 
  Layers, 
  Mountain, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Sliders, 
  Eye, 
  EyeOff, 
  Download, 
  Ruler, 
  TrendingUp, 
  Compass, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal, 
  TableProperties, 
  Loader2, 
  RefreshCw, 
  MousePointer, 
  X, 
  FileDown,
  Tag,
  MapPin
} from 'lucide-react';
import { formatNumber, formatInteger } from '../../utils/formatters';
import { surveyApi } from '../../services/api';
import { ColumnMapping } from '../../types/survey';

interface TopView2DProps {
  fileId?: string;
  columnMapping?: ColumnMapping | null;
  sourceCrs?: string | null;
  demData?: any | null;
  contoursData?: any | null;
  tinData?: any | null;
  bounds?: any | null;
  onSelectPoint?: (pt: any) => void;
  onUpdateDemData?: (data: any) => void;
}

export const TopView2D: React.FC<TopView2DProps> = ({
  fileId,
  columnMapping,
  sourceCrs,
  demData: propDemData,
  contoursData,
  tinData,
  bounds: propBounds,
  onSelectPoint,
  onUpdateDemData,
}) => {
  // Drawer States
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState<boolean>(false);

  // View & Layer Modes
  const [viewMode, setViewMode] = useState<'blend' | 'elevation' | 'hillshade' | 'slope'>('blend');
  const [showContours, setShowContours] = useState<boolean>(true);
  const [showContourLabels, setShowContourLabels] = useState<boolean>(true);
  const [showPoints, setShowPoints] = useState<boolean>(true);
  const [showPointLabels, setShowPointLabels] = useState<boolean>(false);

  // Sun & Hillshade Controls
  const [azimuth, setAzimuth] = useState<number>(315);
  const [altitude, setAltitude] = useState<number>(45);
  const [resolution, setResolution] = useState<number>(1.0);
  const [zFactor, setZFactor] = useState<number>(1.0);

  // Active Interactive Tool: 'inspect' | 'measure' | 'profile'
  const [activeTool, setActiveTool] = useState<'inspect' | 'measure' | 'profile'>('inspect');
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number; z?: number }>>([]);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; z?: number | null } | null>(null);

  // Pan & Zoom Engine
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Data & Loading States
  const [localDemData, setLocalDemData] = useState<any | null>(propDemData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadedRasterImg, setLoadedRasterImg] = useState<HTMLImageElement | null>(null);

  // Sync with propDemData
  useEffect(() => {
    if (propDemData) {
      setLocalDemData(propDemData);
    }
  }, [propDemData]);

  // Fetch / Regenerate DEM
  const fetchDEM = async (customRes?: number, customAz?: number, customAlt?: number) => {
    if (!fileId || !columnMapping) return;
    setIsLoading(true);
    try {
      const res = await surveyApi.generateDEM({
        file_id: fileId,
        column_mapping: columnMapping,
        source_crs: sourceCrs,
        resolution: customRes ?? resolution,
        azimuth: customAz ?? azimuth,
        altitude: customAlt ?? altitude,
        z_factor: zFactor,
      });
      setLocalDemData(res);
      if (onUpdateDemData) onUpdateDemData(res);
    } catch (err) {
      console.error('Failed to generate 2D DEM:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!localDemData && fileId && columnMapping) {
      fetchDEM();
    }
  }, [fileId, columnMapping, sourceCrs]);

  // Active Raster URL based on selected view mode
  const activeImageSrc = useMemo(() => {
    if (!localDemData) return null;
    if (viewMode === 'blend') return localDemData.blend_map || localDemData.hillshade;
    if (viewMode === 'elevation') return localDemData.elevation_map || localDemData.blend_map;
    if (viewMode === 'slope') return localDemData.slope_map;
    return localDemData.hillshade;
  }, [viewMode, localDemData]);

  // Pre-load current raster image for HTML5 Canvas rendering
  useEffect(() => {
    if (!activeImageSrc) {
      setLoadedRasterImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = activeImageSrc;
    img.onload = () => setLoadedRasterImg(img);
  }, [activeImageSrc]);

  // Calculate Global Bounds
  const mapBounds = useMemo(() => {
    const minX = propBounds?.min_x ?? localDemData?.bounds?.min_x ?? 0;
    const maxX = propBounds?.max_x ?? localDemData?.bounds?.max_x ?? 100;
    const minY = propBounds?.min_y ?? localDemData?.bounds?.min_y ?? 0;
    const maxY = propBounds?.max_y ?? localDemData?.bounds?.max_y ?? 100;
    const minZ = propBounds?.min_z ?? localDemData?.metadata?.min_z ?? 0;
    const maxZ = propBounds?.max_z ?? localDemData?.metadata?.max_z ?? 100;

    return {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
    };
  }, [propBounds, localDemData]);

  // Reset 2D View
  const handleFitExtents = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Canvas Resize Observer
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

  // Coordinate Conversion: World (Easting, Northing) <-> Canvas Screen (X, Y)
  const getTransformHelpers = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 50;

    const scaleX = (width - padding * 2) / mapBounds.width;
    const scaleY = (height - padding * 2) / mapBounds.height;
    const baseScale = Math.min(scaleX, scaleY) * zoom;

    const offsetX = (width - mapBounds.width * baseScale) / 2 + pan.x;
    const offsetY = (height - mapBounds.height * baseScale) / 2 + pan.y;

    const worldToScreen = (wx: number, wy: number) => {
      const sx = offsetX + (wx - mapBounds.minX) * baseScale;
      const sy = height - (offsetY + (wy - mapBounds.minY) * baseScale);
      return { x: sx, y: sy };
    };

    const screenToWorld = (sx: number, sy: number) => {
      const wx = mapBounds.minX + (sx - offsetX) / baseScale;
      const wy = mapBounds.minY + ((height - sy) - offsetY) / baseScale;
      return { x: wx, y: wy };
    };

    return { worldToScreen, screenToWorld, baseScale, offsetX, offsetY, width, height };
  };

  // Interactive 2D Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const helpers = getTransformHelpers();
    if (!helpers) return;
    const { worldToScreen, width, height, baseScale } = helpers;

    ctx.clearRect(0, 0, width, height);

    // 1. Dark Blueprint Background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, width, height);

    // 2. Spatial Metric Grid Lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 50 * zoom;
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

    // 3. Render Georeferenced DEM Raster Image
    if (loadedRasterImg) {
      const nw = worldToScreen(mapBounds.minX, mapBounds.maxY);
      const se = worldToScreen(mapBounds.maxX, mapBounds.minY);
      const imgWidth = se.x - nw.x;
      const imgHeight = se.y - nw.y;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(loadedRasterImg, nw.x, nw.y, imgWidth, imgHeight);

      // Neat bounding border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(nw.x, nw.y, imgWidth, imgHeight);
      ctx.restore();
    }

    // 4. Render Vector Contours Overlay
    if (showContours && contoursData) {
      const allContours = [
        ...(contoursData.minor_contours || []).map((c: any) => ({ ...c, isMajor: false })),
        ...(contoursData.major_contours || []).map((c: any) => ({ ...c, isMajor: true })),
      ];

      allContours.forEach((contour) => {
        const pts = contour.points || [];
        if (pts.length < 2) return;

        ctx.strokeStyle = contour.isMajor ? '#ffffff' : 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = contour.isMajor ? 1.8 : 0.9;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.beginPath();
        const start = worldToScreen(pts[0][0], pts[0][1]);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < pts.length; i++) {
          const pt = worldToScreen(pts[i][0], pts[i][1]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // 2D Elevation Label Badges
        if (showContourLabels && contour.isMajor && pts.length >= 4) {
          const midIdx = Math.floor(pts.length / 2);
          const midPt = pts[midIdx];
          const scr = worldToScreen(midPt[0], midPt[1]);

          const label = `${contour.elevation.toFixed(1)}m`;
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          const tw = ctx.measureText(label).width;

          ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(scr.x - (tw + 6) / 2, scr.y - 8, tw + 6, 16, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, scr.x, scr.y);
        }
      });
    }

    // 5. Render Survey Points Cloud & Labels
    const samplePts = tinData?.sample_points || [];
    if (showPoints && samplePts.length > 0) {
      samplePts.forEach((pt: any) => {
        const scr = worldToScreen(pt.x, pt.y);

        // Point Dot
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Point Label
        if (showPointLabels) {
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.fillStyle = '#f8fafc';
          ctx.textAlign = 'left';
          ctx.fillText(`P${pt.point_id} (${pt.rl.toFixed(1)})`, scr.x + 5, scr.y - 3);
        }
      });
    }

    // 6. Render Active Measurement or Profile Line
    if (measurePoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);

      const p0 = worldToScreen(measurePoints[0].x, measurePoints[0].y);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);

      // Node A
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', p0.x, p0.y);

      if (measurePoints.length >= 2) {
        const p1 = worldToScreen(measurePoints[1].x, measurePoints[1].y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        // Node B
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', p1.x, p1.y);
      } else if (hoverCoord) {
        // Trailing line to cursor
        const pCursor = worldToScreen(hoverCoord.x, hoverCoord.y);
        ctx.lineTo(pCursor.x, pCursor.y);
        ctx.stroke();
      }
      ctx.restore();
    }

  }, [
    loadedRasterImg,
    mapBounds,
    zoom,
    pan,
    showContours,
    showContourLabels,
    showPoints,
    showPointLabels,
    contoursData,
    tinData,
    measurePoints,
    hoverCoord,
  ]);

  // Pan & Mouse Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'inspect') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (activeTool === 'measure' || activeTool === 'profile') {
      const helpers = getTransformHelpers();
      if (!helpers) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickWorld = helpers.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      if (measurePoints.length >= 2) {
        setMeasurePoints([clickWorld]);
      } else {
        setMeasurePoints((prev) => [...prev, clickWorld]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && activeTool === 'inspect') {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    const helpers = getTransformHelpers();
    if (!helpers) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const worldPos = helpers.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    setHoverCoord(worldPos);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.2, Math.min(25, prev * zoomFactor)));
  };

  // Measured Distance & Slope Calculation
  const measurementMetrics = useMemo(() => {
    if (measurePoints.length < 2) return null;
    const p1 = measurePoints[0];
    const p2 = measurePoints[1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const horizontalDistance = Math.sqrt(dx * dx + dy * dy);

    // Approximate elevation difference based on terrain bounds or point elevation
    const dz = (p2.z ?? mapBounds.maxZ * 0.7) - (p1.z ?? mapBounds.minZ * 1.1);
    const slopeDistance = Math.sqrt(horizontalDistance * horizontalDistance + dz * dz);
    const gradePercent = horizontalDistance > 0 ? (dz / horizontalDistance) * 100 : 0;
    const slopeDegrees = Math.atan2(Math.abs(dz), horizontalDistance) * (180 / Math.PI);
    const azimuthDegrees = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;

    return {
      horizontalDistance,
      slopeDistance,
      dz,
      gradePercent,
      slopeDegrees,
      azimuthDegrees,
    };
  }, [measurePoints, mapBounds]);

  // Export GeoTIFF Raster Handler
  const handleExportGeoTIFF = async () => {
    if (!fileId || !columnMapping) return;
    try {
      const blob = await surveyApi.exportGISData({
        file_id: fileId,
        column_mapping: columnMapping,
        source_crs: sourceCrs,
        format: 'geotiff',
        resolution: resolution,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey_DEM_${resolution}m.tif`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GeoTIFF export error:', err);
    }
  };

  // Export High-Res PNG Snapshot Handler
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_2D_top_view_${viewMode}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 px-5 py-2.5 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <span>2D Topographic & Orthographic Studio</span>
              <span className="bg-blue-500/10 text-blue-400 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-500/20">
                Grid Res: {localDemData?.metadata?.resolution ?? resolution}m
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Interactive Orthographic Surface, Hillshade Lighting, Distance & Slope Ruler, GeoTIFF Exporter
            </p>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('blend')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition ${
              viewMode === 'blend' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Terrain Blend</span>
          </button>
          <button
            onClick={() => setViewMode('elevation')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition ${
              viewMode === 'elevation' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>DEM Elevation</span>
          </button>
          <button
            onClick={() => setViewMode('hillshade')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition ${
              viewMode === 'hillshade' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Sun Hillshade</span>
          </button>
          <button
            onClick={() => setViewMode('slope')}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition ${
              viewMode === 'slope' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Slope Map</span>
          </button>
        </div>

        {/* Quick Exporters */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportGeoTIFF}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            title="Download GeoTIFF 32-bit Floating Point DEM"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>GeoTIFF (.tif)</span>
          </button>
          <button
            onClick={handleExportPNG}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            title="Save Snapshot PNG Image"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>Snapshot PNG</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body (100% Full Expansive 2D Canvas) */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Left Drawer Toggle Button (When Closed) */}
        {!isLeftDrawerOpen && (
          <button
            onClick={() => setIsLeftDrawerOpen(true)}
            className="absolute top-4 left-4 z-30 flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 shadow-xl backdrop-blur-md transition transform hover:scale-105"
            title="Open DEM Lighting & Layer Controls"
          >
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span>DEM & Lighting</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}

        {/* Left Sliding Drawer (DEM & Sun Hillshade Controls) */}
        <div
          className={`absolute top-0 left-0 bottom-0 z-30 w-80 bg-slate-900/95 border-r border-slate-800 shadow-2xl backdrop-blur-md flex flex-col transition-transform duration-300 ease-in-out ${
            isLeftDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">DEM & Hillshade Settings</h3>
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
            {/* Grid Resolution */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Raster Grid Resolution</label>
              <select
                value={resolution}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setResolution(val);
                  fetchDEM(val, azimuth, altitude);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value={0.5}>0.5m (Ultra-HD Fine Grid)</option>
                <option value={1.0}>1.0m (Standard Topo Grid)</option>
                <option value={2.0}>2.0m (Fast Lightweight)</option>
              </select>
            </div>

            {/* Sun Azimuth */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Sun Light Azimuth</span>
                <span className="font-mono text-blue-400">{azimuth}° ({azimuth === 315 ? 'NW - Standard' : `${azimuth}°`})</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={azimuth}
                onChange={(e) => setAzimuth(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Sun Altitude */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Sun Elevation Altitude</span>
                <span className="font-mono text-blue-400">{altitude}°</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={altitude}
                onChange={(e) => setAltitude(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Recalculate Hillshade Button */}
            <button
              disabled={isLoading}
              onClick={() => fetchDEM(resolution, azimuth, altitude)}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold shadow transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Recompute 2D Hillshade</span>
            </button>

            {/* Layer Visibility Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs text-slate-400 font-bold uppercase">Overlay Layers</h4>

              <label className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-800 cursor-pointer">
                <span>Vector Contours Overlay</span>
                <input
                  type="checkbox"
                  checked={showContours}
                  onChange={(e) => setShowContours(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-800 cursor-pointer">
                <span>Contour 2D Elevation Badges</span>
                <input
                  type="checkbox"
                  checked={showContourLabels}
                  onChange={(e) => setShowContourLabels(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-800 cursor-pointer">
                <span>Survey Point Markers</span>
                <input
                  type="checkbox"
                  checked={showPoints}
                  onChange={(e) => setShowPoints(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-800 cursor-pointer">
                <span>Point ID / RL Labels</span>
                <input
                  type="checkbox"
                  checked={showPointLabels}
                  onChange={(e) => setShowPointLabels(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
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
            title="Open Terrain Analytics & Slope Metrics"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            <TableProperties className="w-4 h-4 text-emerald-400" />
            <span>Terrain Analytics</span>
          </button>
        )}

        {/* Right Sliding Drawer (Terrain & Slope Analytics) */}
        <div
          className={`absolute top-0 right-0 bottom-0 z-30 w-80 bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-md flex flex-col transition-transform duration-300 ease-in-out ${
            isRightDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Terrain & Slope Analytics</h3>
            </div>
            <button
              onClick={() => setIsRightDrawerOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
              title="Close Drawer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Elevation Characteristics */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
                <span>Elevation Metrics</span>
                <span className="text-blue-400 font-mono text-[10px]">DTM Grid</span>
              </h4>
              <div className="flex justify-between py-0.5 text-xs">
                <span className="text-slate-400">Minimum RL:</span>
                <span className="font-mono text-blue-400 font-bold">{formatNumber(mapBounds.minZ, 2)} m</span>
              </div>
              <div className="flex justify-between py-0.5 text-xs">
                <span className="text-slate-400">Maximum RL:</span>
                <span className="font-mono text-red-400 font-bold">{formatNumber(mapBounds.maxZ, 2)} m</span>
              </div>
              <div className="flex justify-between py-0.5 text-xs">
                <span className="text-slate-400">Elevation Relief ($\Delta Z$):</span>
                <span className="font-mono text-emerald-400 font-bold">{formatNumber(mapBounds.maxZ - mapBounds.minZ, 2)} m</span>
              </div>
              <div className="flex justify-between py-0.5 text-xs">
                <span className="text-slate-400">Grid Resolution:</span>
                <span className="font-mono text-slate-200">{localDemData?.metadata?.resolution ?? resolution} m/cell</span>
              </div>
            </div>

            {/* Slope Statistics */}
            {localDemData?.slope_statistics && (
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Slope Characteristics</h4>
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-slate-400">Mean Slope Angle:</span>
                  <span className="font-mono text-amber-400 font-bold">{localDemData.slope_statistics.mean_slope_deg}°</span>
                </div>
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-slate-400">Max Terrain Slope:</span>
                  <span className="font-mono text-red-400 font-bold">{localDemData.slope_statistics.max_slope_deg}°</span>
                </div>

                {/* Slope Distribution Bar */}
                <div className="pt-2">
                  <div className="text-[10px] text-slate-400 mb-1 flex justify-between">
                    <span>Slope Distribution</span>
                    <span className="text-slate-500">Degree Classes</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden flex bg-slate-800">
                    <div style={{ width: `${localDemData.slope_statistics.slope_classes?.flat_pct ?? 30}%` }} className="bg-emerald-500" title="Flat (<2°)" />
                    <div style={{ width: `${localDemData.slope_statistics.slope_classes?.gentle_pct ?? 40}%` }} className="bg-lime-500" title="Gentle (2-8°)" />
                    <div style={{ width: `${localDemData.slope_statistics.slope_classes?.moderate_pct ?? 20}%` }} className="bg-amber-500" title="Moderate (8-20°)" />
                    <div style={{ width: `${localDemData.slope_statistics.slope_classes?.steep_pct ?? 10}%` }} className="bg-red-500" title="Steep (>20°)" />
                  </div>
                  <div className="grid grid-cols-4 text-[9px] font-mono text-slate-400 mt-1 text-center">
                    <span className="text-emerald-400">Flat</span>
                    <span className="text-lime-400">Gentle</span>
                    <span className="text-amber-400">Mod</span>
                    <span className="text-red-400">Steep</span>
                  </div>
                </div>
              </div>
            )}

            {/* Active Measurement Results Card */}
            {measurementMetrics && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span className="flex items-center space-x-1.5">
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Measured Section A $\to$ B</span>
                  </span>
                  <button
                    onClick={() => setMeasurePoints([])}
                    className="p-0.5 hover:bg-amber-500/20 rounded text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-slate-400">2D Planar Distance:</span>
                  <span className="font-mono text-slate-100 font-bold">{formatNumber(measurementMetrics.horizontalDistance, 2)} m</span>
                </div>
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-slate-400">3D Slope Distance:</span>
                  <span className="font-mono text-slate-100 font-bold">{formatNumber(measurementMetrics.slopeDistance, 2)} m</span>
                </div>
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-slate-400">Elevation Relief ($\Delta Z$):</span>
                  <span className="font-mono text-amber-300 font-bold">{formatNumber(measurementMetrics.dz, 2)} m</span>
                </div>
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-slate-400">Slope Gradient:</span>
                  <span className="font-mono text-emerald-400 font-bold">{measurementMetrics.slopeDegrees.toFixed(1)}° ({measurementMetrics.gradePercent.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-slate-400">Azimuth / Bearing:</span>
                  <span className="font-mono text-purple-400 font-bold">{measurementMetrics.azimuthDegrees.toFixed(1)}°</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Interactive 2D Map Canvas */}
        <div className="flex-1 relative bg-slate-950 flex flex-col overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center space-y-3 text-slate-200">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs font-semibold">Generating 2D Orthographic Raster Surface...</p>
            </div>
          )}

          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className={`w-full h-full ${
              activeTool === 'inspect'
                ? 'cursor-crosshair active:cursor-grabbing'
                : 'cursor-crosshair'
            }`}
          />

          {/* Floating Action Bar (Tool Select & Zoom Toolbar) */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 flex items-center space-x-2 shadow-2xl backdrop-blur-md z-10">
            {/* Tool Selection */}
            <button
              onClick={() => {
                setActiveTool('inspect');
                setMeasurePoints([]);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                activeTool === 'inspect'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Pan & Inspect Surface"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </button>

            <button
              onClick={() => {
                setActiveTool('measure');
                setMeasurePoints([]);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                activeTool === 'measure'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Click two points to measure distance, slope & grade"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Measure Ruler</span>
            </button>

            <div className="h-4 w-px bg-slate-800" />

            {/* Navigation & Zoom */}
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
              title="Fit to Extents"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-mono text-slate-400">
              Zoom: {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Coordinate & Elevation HUD (Bottom Left) */}
          {hoverCoord && (
            <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-300 shadow-xl backdrop-blur-md z-10 flex items-center space-x-4">
              <div><span className="text-slate-500">E (X):</span> {formatNumber(hoverCoord.x, 2)}</div>
              <div><span className="text-slate-500">N (Y):</span> {formatNumber(hoverCoord.y, 2)}</div>
              <div className="text-blue-400 font-bold">
                <span>View:</span> {viewMode.toUpperCase()}
              </div>
            </div>
          )}

          {/* Elevation Color Legend (Bottom Right) */}
          <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 shadow-xl backdrop-blur-md z-10 flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {viewMode === 'slope' ? 'Slope Gradient' : 'Elevation (RL)'}
            </span>
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-20 rounded shadow-inner"
                style={{
                  background: viewMode === 'slope'
                    ? 'linear-gradient(to top, #10b981 0%, #84cc16 30%, #eab308 60%, #ef4444 100%)'
                    : viewMode === 'hillshade'
                    ? 'linear-gradient(to top, #000000 0%, #ffffff 100%)'
                    : 'linear-gradient(to top, #2563eb 0%, #10b981 25%, #eab308 50%, #f97316 75%, #ef4444 100%)'
                }}
              />
              <div className="flex flex-col justify-between h-20 text-[9px] font-mono text-slate-300">
                <span className="text-red-400 font-bold">
                  {viewMode === 'slope' ? '90°' : `${formatNumber(mapBounds.maxZ, 1)}m`}
                </span>
                <span>
                  {viewMode === 'slope' ? '45°' : `${formatNumber((mapBounds.minZ + mapBounds.maxZ) / 2, 1)}m`}
                </span>
                <span className="text-blue-400 font-bold">
                  {viewMode === 'slope' ? '0°' : `${formatNumber(mapBounds.minZ, 1)}m`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
