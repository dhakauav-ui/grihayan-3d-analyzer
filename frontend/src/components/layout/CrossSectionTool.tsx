import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Spline, 
  ArrowRight, 
  TrendingUp, 
  Navigation, 
  RefreshCw, 
  Download, 
  Sliders, 
  Maximize2, 
  MapPin, 
  Ruler, 
  TableProperties, 
  Search, 
  Activity, 
  X,
  Compass,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ColumnMapping } from '../../types/survey';
import { formatNumber, formatInteger } from '../../utils/formatters';
import { surveyApi } from '../../services/api';

interface CrossSectionToolProps {
  fileId?: string;
  columnMapping?: ColumnMapping | null;
  sourceCrs?: string | null;
  bounds?: any | null;
  contoursData?: any | null;
  tinData?: any | null;
}

export const CrossSectionTool: React.FC<CrossSectionToolProps> = ({
  fileId,
  columnMapping,
  sourceCrs,
  bounds,
  contoursData,
  tinData,
}) => {
  // Global Survey Extents
  const minX = bounds?.min_x ?? 0;
  const maxX = bounds?.max_x ?? 500;
  const minY = bounds?.min_y ?? 0;
  const maxY = bounds?.max_y ?? 500;
  const minZ = bounds?.min_z ?? 0;
  const maxZ = bounds?.max_z ?? 50;

  // Station Registry in Left Sidebar
  const [isRegistryExpanded, setIsRegistryExpanded] = useState<boolean>(true);

  // Section Baseline Coordinates
  const [startX, setStartX] = useState<number>(minX);
  const [startY, setStartY] = useState<number>((minY + maxY) / 2);
  const [endX, setEndX] = useState<number>(maxX);
  const [endY, setEndY] = useState<number>((minY + maxY) / 2);

  // Settings & Analysis Parameters
  const [numSamples, setNumSamples] = useState<number>(80);
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(5);
  const [designLevel, setDesignLevel] = useState<number>((minZ + maxZ) / 2);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Results & Interactive State
  const [profileResult, setProfileResult] = useState<any | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [hoveredStation, setHoveredStation] = useState<any | null>(null);
  const [selectedStationIdx, setSelectedStationIdx] = useState<number | null>(null);

  // 2D Baseline Alignment Canvas
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draggingNode, setDraggingNode] = useState<'start' | 'end' | null>(null);

  // Calculate Elevation Profile from Backend
  const calculateProfile = async (sx: number, sy: number, ex: number, ey: number, samples = numSamples) => {
    if (!fileId || !columnMapping) return;
    setIsCalculating(true);
    try {
      const res = await surveyApi.getElevationProfile({
        file_id: fileId,
        column_mapping: columnMapping,
        source_crs: sourceCrs,
        start_x: sx,
        start_y: sy,
        end_x: ex,
        end_y: ey,
        num_samples: samples,
      });
      setProfileResult(res.profile);
    } catch (err) {
      console.error('Failed to compute cross-section profile:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  // Initialize Baseline on load
  useEffect(() => {
    if (bounds) {
      const midY = (bounds.min_y + bounds.max_y) / 2;
      setStartX(bounds.min_x);
      setStartY(midY);
      setEndX(bounds.max_x);
      setEndY(midY);
      setDesignLevel(Number(((bounds.min_z + bounds.max_z) / 2).toFixed(2)));
      calculateProfile(bounds.min_x, midY, bounds.max_x, midY, numSamples);
    }
  }, [fileId, columnMapping, bounds]);

  const stations = profileResult?.stations || [];
  const profMinZ = profileResult?.min_elevation_m ?? minZ;
  const profMaxZ = profileResult?.max_elevation_m ?? maxZ;
  const totalDist = profileResult?.total_distance_m ?? 0;

  // Cut and Fill Calculations along Profile
  const cutFillMetrics = useMemo(() => {
    if (stations.length < 2) return { cutArea: 0, fillArea: 0, maxCut: 0, maxFill: 0 };
    let cutArea = 0;
    let fillArea = 0;
    let maxCut = 0;
    let maxFill = 0;

    for (let i = 0; i < stations.length - 1; i++) {
      const stA = stations[i];
      const stB = stations[i + 1];
      if (stA.elevation === null || stB.elevation === null) continue;

      const dx = stB.chainage - stA.chainage;
      const hA = stA.elevation - designLevel;
      const hB = stB.elevation - designLevel;

      if (hA > 0) maxCut = Math.max(maxCut, hA);
      if (hA < 0) maxFill = Math.max(maxFill, -hA);
      if (hB > 0) maxCut = Math.max(maxCut, hB);
      if (hB < 0) maxFill = Math.max(maxFill, -hB);

      if (hA >= 0 && hB >= 0) {
        cutArea += 0.5 * (hA + hB) * dx;
      } else if (hA <= 0 && hB <= 0) {
        fillArea += 0.5 * (-hA + -hB) * dx;
      } else {
        const t = Math.abs(hA) / (Math.abs(hA) + Math.abs(hB) || 1);
        const dx1 = dx * t;
        const dx2 = dx * (1 - t);
        if (hA > 0) {
          cutArea += 0.5 * hA * dx1;
          fillArea += 0.5 * (-hB) * dx2;
        } else {
          fillArea += 0.5 * (-hA) * dx1;
          cutArea += 0.5 * hB * dx2;
        }
      }
    }

    return {
      cutArea: roundNum(cutArea, 2),
      fillArea: roundNum(fillArea, 2),
      maxCut: roundNum(maxCut, 2),
      maxFill: roundNum(maxFill, 2),
    };
  }, [stations, designLevel]);

  function roundNum(val: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  // Draw 2D Alignment Map Canvas
  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark GIS blueprint background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 25) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const pad = 20;
    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
    const offX = (width - spanX * scale) / 2;
    const offY = (height - spanY * scale) / 2;

    const toScreen = (wx: number, wy: number) => ({
      x: offX + (wx - minX) * scale,
      y: height - (offY + (wy - minY) * scale),
    });

    // Draw Contours background if available
    if (contoursData?.major_contours) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      contoursData.major_contours.forEach((c: any) => {
        const pts = c.points || [];
        if (pts.length < 2) return;
        ctx.beginPath();
        const start = toScreen(pts[0][0], pts[0][1]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < pts.length; i++) {
          const p = toScreen(pts[i][0], pts[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      });
    }

    // Draw Survey Points
    if (tinData?.sample_points) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      tinData.sample_points.forEach((pt: any) => {
        const sp = toScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw Active Baseline Alignment
    const scrA = toScreen(startX, startY);
    const scrB = toScreen(endX, endY);

    // Glowing Alignment Polyline
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(scrA.x, scrA.y);
    ctx.lineTo(scrB.x, scrB.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hovered Station Indicator on 2D map
    if (hoveredStation) {
      const hScr = toScreen(hoveredStation.x, hoveredStation.y);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hScr.x, hScr.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hScr.x, hScr.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Node A (Start)
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(scrA.x, scrA.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', scrA.x, scrA.y);

    // Node B (End)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(scrB.x, scrB.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', scrB.x, scrB.y);

  }, [minX, maxX, minY, maxY, startX, startY, endX, endY, contoursData, tinData, hoveredStation]);

  // Handle Dragging Baseline Pins on 2D Alignment Canvas
  const handleMapMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const pad = 20;
    const scale = Math.min((canvas.width - pad * 2) / spanX, (canvas.height - pad * 2) / spanY);
    const offX = (canvas.width - spanX * scale) / 2;
    const offY = (canvas.height - spanY * scale) / 2;

    const scrA = {
      x: offX + (startX - minX) * scale,
      y: canvas.height - (offY + (startY - minY) * scale),
    };
    const scrB = {
      x: offX + (endX - minX) * scale,
      y: canvas.height - (offY + (endY - minY) * scale),
    };

    const distA = Math.hypot(mx - scrA.x, my - scrA.y);
    const distB = Math.hypot(mx - scrB.x, my - scrB.y);

    if (distA <= 15) {
      setDraggingNode('start');
    } else if (distB <= 15) {
      setDraggingNode('end');
    } else {
      const wx = minX + (mx - offX) / scale;
      const wy = minY + ((canvas.height - my) - offY) / scale;
      setEndX(roundNum(wx, 2));
      setEndY(roundNum(wy, 2));
      calculateProfile(startX, startY, wx, wy, numSamples);
    }
  };

  const handleMapMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingNode) return;
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const pad = 20;
    const scale = Math.min((canvas.width - pad * 2) / spanX, (canvas.height - pad * 2) / spanY);
    const offX = (canvas.width - spanX * scale) / 2;
    const offY = (canvas.height - spanY * scale) / 2;

    const wx = Math.max(minX, Math.min(maxX, minX + (mx - offX) / scale));
    const wy = Math.max(minY, Math.min(maxY, minY + ((canvas.height - my) - offY) / scale));

    if (draggingNode === 'start') {
      setStartX(roundNum(wx, 2));
      setStartY(roundNum(wy, 2));
    } else if (draggingNode === 'end') {
      setEndX(roundNum(wx, 2));
      setEndY(roundNum(wy, 2));
    }
  };

  const handleMapMouseUp = () => {
    if (draggingNode) {
      setDraggingNode(null);
      calculateProfile(startX, startY, endX, endY, numSamples);
    }
  };

  // SVG Chart Dimensions & Math
  const svgWidth = 850;
  const svgHeight = 260;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const graphMinZ = Math.min(profMinZ, designLevel) - 1.0;
  const graphMaxZ = Math.max(profMaxZ, designLevel) + 1.0;
  const graphRangeZ = graphMaxZ - graphMinZ || 1;

  const toGraphX = (ch: number) => padLeft + (ch / (totalDist || 1)) * plotWidth;
  const toGraphY = (z: number) => padTop + plotHeight - ((z - graphMinZ) / graphRangeZ) * plotHeight;

  // Build Profile Path
  let terrainPathD = '';
  if (stations.length > 1) {
    stations.forEach((st: any, i: number) => {
      const gx = toGraphX(st.chainage);
      const elev = st.elevation !== null ? st.elevation : graphMinZ;
      const gy = toGraphY(elev);
      if (i === 0) terrainPathD += `M ${gx} ${gy} `;
      else terrainPathD += `L ${gx} ${gy} `;
    });
  }

  const designY = toGraphY(designLevel);

  // Key Stations for Data Band Table (Sample ~8 key stations evenly spaced)
  const bandStations = useMemo(() => {
    if (stations.length <= 8) return stations;
    const step = (stations.length - 1) / 7;
    const result = [];
    for (let i = 0; i < 8; i++) {
      const idx = Math.min(stations.length - 1, Math.round(i * step));
      result.push(stations[idx]);
    }
    return result;
  }, [stations]);

  // Filtered stations for left sidebar registry table
  const filteredStations = useMemo(() => {
    if (!searchFilter) return stations;
    const q = searchFilter.toLowerCase();
    return stations.filter((s: any) =>
      s.chainage.toFixed(2).includes(q) ||
      (s.elevation !== null && s.elevation.toFixed(2).includes(q))
    );
  }, [stations, searchFilter]);

  // Export Profile CSV
  const handleExportCSV = () => {
    if (!stations.length) return;
    let csv = 'Station_ID,Chainage_m,Easting_X,Northing_Y,Ground_RL_m,Design_RL_m,Cut_Depth_m,Fill_Depth_m,Slope_Pct\n';
    stations.forEach((st: any) => {
      const elev = st.elevation !== null ? st.elevation : '';
      const diff = st.elevation !== null ? st.elevation - designLevel : 0;
      const cut = diff > 0 ? diff.toFixed(3) : '0.000';
      const fill = diff < 0 ? (-diff).toFixed(3) : '0.000';
      csv += `${st.station_idx},${st.chainage.toFixed(2)},${st.x.toFixed(3)},${st.y.toFixed(3)},${elev},${designLevel.toFixed(3)},${cut},${fill},${st.slope_pct ?? 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross_section_profile_L${totalDist.toFixed(0)}m.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Profile CAD DXF
  const handleExportDXF = () => {
    if (!stations.length) return;
    let dxf = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1024\n0\nENDSEC\n';
    dxf += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n4\n';
    dxf += '0\nLAYER\n2\nPROFILE_GROUND\n70\n0\n62\n4\n6\nCONTINUOUS\n';
    dxf += '0\nLAYER\n2\nPROFILE_DESIGN\n70\n0\n62\n1\n6\nCONTINUOUS\n';
    dxf += '0\nLAYER\n2\nPROFILE_GRID\n70\n0\n62\n8\n6\nCONTINUOUS\n';
    dxf += '0\nLAYER\n2\nPROFILE_TEXT\n70\n0\n62\n7\n6\nCONTINUOUS\n';
    dxf += '0\nENDTAB\n0\nENDSEC\n';
    dxf += '0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n';
    dxf += '0\nSECTION\n2\nENTITIES\n';

    dxf += '0\nPOLYLINE\n8\nPROFILE_GROUND\n66\n1\n70\n0\n';
    stations.forEach((st: any) => {
      const zVal = st.elevation !== null ? (st.elevation - graphMinZ) * verticalExaggeration : 0;
      dxf += `0\nVERTEX\n8\nPROFILE_GROUND\n10\n${st.chainage.toFixed(3)}\n20\n${zVal.toFixed(3)}\n30\n0.0\n`;
    });
    dxf += '0\nSEQEND\n';

    const desZ = (designLevel - graphMinZ) * verticalExaggeration;
    dxf += `0\nLINE\n8\nPROFILE_DESIGN\n10\n0.0\n20\n${desZ.toFixed(3)}\n30\n0.0\n11\n${totalDist.toFixed(3)}\n21\n${desZ.toFixed(3)}\n31\n0.0\n`;

    dxf += '0\nENDSEC\n0\nEOF\n';

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross_section_profile_CAD.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 px-5 py-2.5 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Spline className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <span>Civil Cross-Section & Elevation Profile Studio</span>
              <span className="bg-blue-500/10 text-blue-400 text-[10px] font-mono px-2 py-0.5 rounded border border-blue-500/20">
                Span: {formatNumber(totalDist, 1)}m
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Interactive 2D Baseline Alignment, Standard Civil Drawing Data Band, Cut/Fill & CAD Profile Exporter
            </p>
          </div>
        </div>

        {/* Quick Exporters */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            title="Download Full Station Chainage CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Profile (.csv)</span>
          </button>
          <button
            onClick={handleExportDXF}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-700 transition"
            title="Download AutoCAD 2D Cross-Section Drawing"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>CAD Profile (.dxf)</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Panel Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Panel: 2D Alignment, Design Controls & Station Registry Table */}
        <div className="w-80 bg-slate-900/90 border-r border-slate-800 flex flex-col overflow-y-auto p-4 space-y-4 shadow-xl">
          {/* 2D Interactive Plan Alignment Map */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300 uppercase">
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>2D Baseline Plan Alignment</span>
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                {profileResult?.azimuth_deg ?? 90}°
              </span>
            </div>
            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
              <canvas
                ref={mapCanvasRef}
                width={280}
                height={150}
                onMouseDown={handleMapMouseDown}
                onMouseMove={handleMapMouseMove}
                onMouseUp={handleMapMouseUp}
                onMouseLeave={handleMapMouseUp}
                className="w-full h-36 cursor-crosshair"
              />
              <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-500">
                Drag Node A & B
              </div>
            </div>
          </div>

          {/* Alignment Presets */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-bold uppercase">Alignment Presets</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  const my = (minY + maxY) / 2;
                  setStartX(minX); setStartY(my);
                  setEndX(maxX); setEndY(my);
                  calculateProfile(minX, my, maxX, my);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium border border-slate-700 transition text-left"
              >
                ↔️ W → E Center
              </button>
              <button
                onClick={() => {
                  const mx = (minX + maxX) / 2;
                  setStartX(mx); setStartY(minY);
                  setEndX(mx); setEndY(maxY);
                  calculateProfile(mx, minY, mx, maxY);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium border border-slate-700 transition text-left"
              >
                ↕️ S → N Center
              </button>
              <button
                onClick={() => {
                  setStartX(minX); setStartY(minY);
                  setEndX(maxX); setEndY(maxY);
                  calculateProfile(minX, minY, maxX, maxY);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium border border-slate-700 transition text-left"
              >
                ↗️ SW → NE Diag
              </button>
              <button
                onClick={() => {
                  setStartX(minX); setStartY(maxY);
                  setEndX(maxX); setEndY(minY);
                  calculateProfile(minX, maxY, maxX, minY);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium border border-slate-700 transition text-left"
              >
                ↘️ NW → SE Diag
              </button>
            </div>
          </div>

          {/* Formation Level Design */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex justify-between text-xs text-slate-300 font-bold">
              <span>Design Formation Level</span>
              <span className="font-mono text-red-400">{designLevel.toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min={minZ - 2}
              max={maxZ + 2}
              step="0.05"
              value={designLevel}
              onChange={(e) => setDesignLevel(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>Min: {(minZ - 2).toFixed(1)}m</span>
              <span>Max: {(maxZ + 2).toFixed(1)}m</span>
            </div>
          </div>

          {/* Vertical Exaggeration */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-bold">
              <span>Vertical Exaggeration</span>
              <span className="font-mono text-blue-400">{verticalExaggeration}x</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 5, 10, 20].map((vx) => (
                <button
                  key={vx}
                  onClick={() => setVerticalExaggeration(vx)}
                  className={`py-1 rounded text-xs font-mono font-semibold transition ${
                    verticalExaggeration === vx
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {vx}x
                </button>
              ))}
            </div>
          </div>

          {/* Sampling Density */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-bold uppercase">Sampling Density</label>
            <select
              value={numSamples}
              onChange={(e) => {
                const s = parseInt(e.target.value);
                setNumSamples(s);
                calculateProfile(startX, startY, endX, endY, s);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value={40}>40 Stations (Light)</option>
              <option value={80}>80 Stations (Standard)</option>
              <option value={150}>150 Stations (High Precision)</option>
              <option value={300}>300 Stations (Engineering Sub-cm)</option>
            </select>
          </div>

          {/* Station Registry Section (Positioned Directly Under Sampling Density) */}
          <div className="space-y-2 pt-2 border-t border-slate-800 flex flex-col">
            <div 
              onClick={() => setIsRegistryExpanded(!isRegistryExpanded)}
              className="flex justify-between items-center text-xs font-bold text-slate-200 uppercase cursor-pointer hover:text-purple-300 transition"
            >
              <span className="flex items-center space-x-1.5 text-purple-400">
                <TableProperties className="w-3.5 h-3.5" />
                <span>Station Registry ({stations.length})</span>
              </span>
              <button
                type="button"
                className="text-[10px] text-slate-400 hover:text-slate-200 font-mono flex items-center space-x-0.5"
              >
                <span>{isRegistryExpanded ? 'Hide' : 'Show'}</span>
                {isRegistryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {isRegistryExpanded && (
              <div className="flex flex-col bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shadow-inner">
                {/* Search Input */}
                <div className="p-1.5 border-b border-slate-800">
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                    <input
                      type="text"
                      placeholder="Search Chainage / RL..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded pl-7 pr-2 py-1 text-[10px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-y-auto max-h-56">
                  <table className="w-full text-left text-[10px] font-mono">
                    <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="px-2 py-1">CH (m)</th>
                        <th className="px-2 py-1">Ground RL</th>
                        <th className="px-2 py-1 text-right">Cut/Fill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-slate-300">
                      {filteredStations.map((st: any) => {
                        const isHovered = hoveredStation?.station_idx === st.station_idx;
                        const diff = st.elevation !== null ? st.elevation - designLevel : 0;
                        const isCut = diff > 0;

                        return (
                          <tr
                            key={st.station_idx}
                            onMouseEnter={() => setHoveredStation(st)}
                            onMouseLeave={() => setHoveredStation(null)}
                            onClick={() => setSelectedStationIdx(st.station_idx)}
                            className={`cursor-pointer transition ${
                              isHovered
                                ? 'bg-blue-500/20 text-blue-300 font-bold'
                                : 'hover:bg-slate-800/60'
                            }`}
                          >
                            <td className="px-2 py-1 text-slate-300">{st.chainage.toFixed(1)}m</td>
                            <td className="px-2 py-1 font-bold text-slate-100">
                              {st.elevation !== null ? `${st.elevation.toFixed(2)}m` : '—'}
                            </td>
                            <td className="px-2 py-1 text-right font-semibold">
                              {st.elevation !== null ? (
                                <span className={isCut ? 'text-red-400' : 'text-emerald-400'}>
                                  {isCut ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Main Panel: 100% Unobstructed Civil Profile Drawing Sheet */}
        <div className="flex-1 flex flex-col bg-slate-950 p-4 overflow-hidden relative">
          {/* Elevation Summary Badges */}
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center space-x-4 text-xs font-mono">
              <span className="flex items-center space-x-1.5 text-blue-400 font-bold">
                <span className="w-3 h-0.5 bg-blue-400"></span>
                <span>Existing Ground RL</span>
              </span>
              <span className="flex items-center space-x-1.5 text-red-400 font-bold">
                <span className="w-3 h-0.5 bg-red-500 border-b border-dashed border-red-500"></span>
                <span>Design Formation ({designLevel.toFixed(2)}m)</span>
              </span>
              <span className="text-red-400/90 font-bold">Cut: {cutFillMetrics.cutArea} m²</span>
              <span className="text-emerald-400/90 font-bold">Fill: {cutFillMetrics.fillArea} m²</span>
            </div>

            <div className="text-xs font-mono text-slate-400 space-x-3">
              <span>Max RL: <b className="text-red-400">{profMaxZ.toFixed(2)}m</b></span>
              <span>Min RL: <b className="text-blue-400">{profMinZ.toFixed(2)}m</b></span>
              <span>Relief ($\Delta Z$): <b className="text-emerald-400">{profileResult?.elevation_difference_m ?? 0}m</b></span>
            </div>
          </div>

          {/* Profile Graph Visualizer (SVG) */}
          <div className="flex-1 relative bg-slate-900/60 rounded-t-xl border border-slate-800 p-2 flex items-center justify-center overflow-hidden">
            {isCalculating ? (
              <div className="flex items-center space-x-2 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                <span>Computing high-resolution cross section...</span>
              </div>
            ) : terrainPathD ? (
              <svg 
                className="w-full h-full" 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              >
                {/* Horizontal Grid Datum Lines */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((t) => {
                  const z = graphMinZ + t * graphRangeZ;
                  const gy = toGraphY(z);
                  return (
                    <g key={t}>
                      <line 
                        x1={padLeft} 
                        y1={gy} 
                        x2={svgWidth - padRight} 
                        y2={gy} 
                        stroke="#1e293b" 
                        strokeWidth="1" 
                        strokeDasharray={t === 0 ? 'none' : '3,3'} 
                      />
                      <text 
                        x={padLeft - 6} 
                        y={gy + 3} 
                        fill="#64748b" 
                        fontSize="9" 
                        fontFamily="JetBrains Mono" 
                        textAnchor="end"
                      >
                        {z.toFixed(1)}m
                      </text>
                    </g>
                  );
                })}

                {/* Ground Area Fill */}
                <path
                  d={`${terrainPathD} L ${padLeft + plotWidth} ${padTop + plotHeight} L ${padLeft} ${padTop + plotHeight} Z`}
                  fill="rgba(56, 189, 248, 0.07)"
                />

                {/* Design Formation Level Line */}
                <line
                  x1={padLeft}
                  y1={designY}
                  x2={padLeft + plotWidth}
                  y2={designY}
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4,3"
                />

                {/* Main Ground Surface Curve */}
                <path
                  d={terrainPathD}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Hover Indicator Crosshair */}
                {hoveredStation && hoveredStation.elevation !== null && (
                  <g>
                    <line
                      x1={toGraphX(hoveredStation.chainage)}
                      y1={padTop}
                      x2={toGraphX(hoveredStation.chainage)}
                      y2={padTop + plotHeight}
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                    />
                    <circle
                      cx={toGraphX(hoveredStation.chainage)}
                      cy={toGraphY(hoveredStation.elevation)}
                      r="4.5"
                      fill="#fbbf24"
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>
            ) : (
              <div className="text-xs text-slate-500">No profile data computed.</div>
            )}

            {/* Hover Tooltip */}
            {hoveredStation && hoveredStation.elevation !== null && (
              <div 
                className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-slate-950/95 border border-amber-500/50 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-200 shadow-2xl backdrop-blur-md flex items-center space-x-4 z-20 pointer-events-none"
              >
                <div><span className="text-slate-500">CH:</span> <span className="font-bold text-amber-400">{hoveredStation.chainage.toFixed(2)}m</span></div>
                <div><span className="text-slate-500">Ground RL:</span> <span className="font-bold text-blue-400">{hoveredStation.elevation.toFixed(2)}m</span></div>
                <div>
                  <span className="text-slate-500">Cut/Fill:</span>{' '}
                  <span className={hoveredStation.elevation >= designLevel ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {hoveredStation.elevation >= designLevel 
                      ? `+${(hoveredStation.elevation - designLevel).toFixed(2)}m (Cut)`
                      : `${(hoveredStation.elevation - designLevel).toFixed(2)}m (Fill)`}
                  </span>
                </div>
                <div><span className="text-slate-500">Slope:</span> {hoveredStation.slope_pct}%</div>
              </div>
            )}
          </div>

          {/* Standard Civil Engineering Data Band Table (Directly Beneath Graph) */}
          <div className="border-x border-b border-slate-800 rounded-b-xl bg-slate-950 overflow-x-auto shadow-xl">
            <table className="w-full text-[11px] font-mono border-collapse">
              <tbody>
                {/* Row 1: Existing Ground RL */}
                <tr className="border-b border-slate-800/80 bg-slate-900/40">
                  <td className="p-2 font-bold text-blue-400 bg-slate-900 border-r border-slate-800 w-44">
                    Existing Ground RL (m)
                  </td>
                  {bandStations.map((st: any, i: number) => (
                    <td 
                      key={i} 
                      onMouseEnter={() => setHoveredStation(st)}
                      onMouseLeave={() => setHoveredStation(null)}
                      className="p-1.5 text-center border-r border-slate-800/50 hover:bg-blue-500/10 cursor-pointer text-slate-200"
                    >
                      {st.elevation !== null ? st.elevation.toFixed(2) : '—'}
                    </td>
                  ))}
                </tr>

                {/* Row 2: Design Formation RL */}
                <tr className="border-b border-slate-800/80 bg-slate-900/20">
                  <td className="p-2 font-bold text-red-400 bg-slate-900 border-r border-slate-800">
                    Design Formation (m)
                  </td>
                  {bandStations.map((st: any, i: number) => (
                    <td key={i} className="p-1.5 text-center border-r border-slate-800/50 text-red-300/80 font-semibold">
                      {designLevel.toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* Row 3: Cut (+) / Fill (-) Depth */}
                <tr className="border-b border-slate-800/80 bg-slate-900/40">
                  <td className="p-2 font-bold text-amber-400 bg-slate-900 border-r border-slate-800">
                    Cut (+) / Fill (-) (m)
                  </td>
                  {bandStations.map((st: any, i: number) => {
                    const diff = st.elevation !== null ? st.elevation - designLevel : null;
                    const isCut = diff !== null && diff >= 0;
                    return (
                      <td key={i} className="p-1.5 text-center border-r border-slate-800/50 font-bold">
                        {diff !== null ? (
                          <span className={isCut ? 'text-red-400' : 'text-emerald-400'}>
                            {isCut ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                    );
                  })}
                </tr>

                {/* Row 4: Chainage Station (m) */}
                <tr className="bg-slate-950">
                  <td className="p-2 font-bold text-slate-300 bg-slate-900 border-r border-slate-800">
                    Chainage (m)
                  </td>
                  {bandStations.map((st: any, i: number) => (
                    <td 
                      key={i} 
                      onMouseEnter={() => setHoveredStation(st)}
                      onMouseLeave={() => setHoveredStation(null)}
                      className="p-1.5 text-center border-r border-slate-800/50 text-slate-300 font-bold hover:bg-amber-500/10 cursor-pointer"
                    >
                      {st.chainage.toFixed(1)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
