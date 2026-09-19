import React, { useState, useEffect, useRef } from 'react';
import { 
  BoxSelect, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Scale, 
  RefreshCw, 
  Download, 
  Sliders, 
  Sparkles, 
  Layers, 
  CheckCircle2,
  DollarSign,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Info,
  MapPin,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { ColumnMapping } from '../../types/survey';
import { formatNumber, formatInteger } from '../../utils/formatters';
import { surveyApi } from '../../services/api';

interface VolumeToolProps {
  fileId?: string;
  columnMapping?: ColumnMapping | null;
  sourceCrs?: string | null;
  minElevation?: number;
  maxElevation?: number;
}

export const VolumeTool: React.FC<VolumeToolProps> = ({
  fileId,
  columnMapping,
  sourceCrs,
  minElevation = 10,
  maxElevation = 40,
}) => {
  const defaultDatum = (minElevation + maxElevation) / 2;
  const [datumElevation, setDatumElevation] = useState<number>(Number(defaultDatum.toFixed(2)));
  const [volumeResult, setVolumeResult] = useState<any | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [resolution, setResolution] = useState<number>(1.0);

  // Cost Estimator State
  const [cutRate, setCutRate] = useState<number>(150); // BDT or Currency unit per m3
  const [fillRate, setFillRate] = useState<number>(220);
  const [bulkingFactor, setBulkingFactor] = useState<number>(1.15); // Compaction / expansion ratio
  const [showCostEstimator, setShowCostEstimator] = useState<boolean>(true);

  // Heatmap View Mode
  const [heatmapMode, setHeatmapMode] = useState<'all' | 'cut' | 'fill'>('all');
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; diff: number; surfaceZ: number } | null>(null);

  // Canvas Pan & Zoom State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const calculateVolume = async (datum: number, res: number = resolution) => {
    if (!fileId || !columnMapping) return;
    setIsCalculating(true);
    try {
      const response = await surveyApi.calculateVolume({
        file_id: fileId,
        column_mapping: columnMapping,
        source_crs: sourceCrs,
        datum_elevation: datum,
        resolution: res,
      });
      setVolumeResult(response.volume);
    } catch (err) {
      console.error('Failed to compute volume:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    calculateVolume(datumElevation, resolution);
  }, [fileId, columnMapping, datumElevation, resolution]);

  const cutVol = volumeResult?.cut_volume_m3 ?? 0;
  const fillVol = volumeResult?.fill_volume_m3 ?? 0;
  const netVol = volumeResult?.net_volume_m3 ?? 0;
  const totalVol = (cutVol + fillVol) || 1;
  const cutPct = (cutVol / totalVol) * 100;
  const fillPct = (fillVol / totalVol) * 100;

  const cutArea = volumeResult?.cut_area_m2 ?? 0;
  const fillArea = volumeResult?.fill_area_m2 ?? 0;
  const maxCutDepth = volumeResult?.max_cut_depth_m ?? 0;
  const maxFillDepth = volumeResult?.max_fill_depth_m ?? 0;
  const avgCutDepth = volumeResult?.avg_cut_depth_m ?? 0;
  const avgFillDepth = volumeResult?.avg_fill_depth_m ?? 0;
  const optimalBalanceDatum = volumeResult?.optimal_balanced_datum_m ?? defaultDatum;
  const depthDistribution = volumeResult?.depth_distribution || [];

  // Cost calculation
  const totalCutCost = cutVol * cutRate;
  const totalFillCost = fillVol * bulkingFactor * fillRate;
  const totalEarthworkCost = totalCutCost + totalFillCost;

  // Render 2D Heatmap Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !volumeResult?.heatmap?.matrix) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const matrix: (number | null)[][] = volumeResult.heatmap.matrix;
    const rows = matrix.length;
    const cols = matrix[0]?.length || 0;
    if (rows === 0 || cols === 0) return;

    // Resize canvas display buffer
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // Apply Pan and Zoom transformations
    ctx.translate(width / 2 + panOffset.x, height / 2 + panOffset.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    const cellW = (width * 0.85) / cols;
    const cellH = (height * 0.85) / rows;
    const startX = (width - cellW * cols) / 2;
    const startY = (height - cellH * rows) / 2;

    const maxAbsDiff = Math.max(maxCutDepth, maxFillDepth, 0.1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = matrix[r][c];
        if (val === null || val === undefined) continue;

        // Invert row index for typical Cartesian Y-up orientation
        const renderR = rows - 1 - r;
        const px = startX + c * cellW;
        const py = startY + renderR * cellH;

        if (val > 0) {
          // CUT AREA (Red/Amber)
          if (heatmapMode === 'fill') continue;
          const intensity = Math.min(1, Math.abs(val) / maxAbsDiff);
          ctx.fillStyle = `rgba(239, 68, 68, ${0.35 + intensity * 0.6})`;
          ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
        } else if (val < 0) {
          // FILL AREA (Green/Emerald)
          if (heatmapMode === 'cut') continue;
          const intensity = Math.min(1, Math.abs(val) / maxAbsDiff);
          ctx.fillStyle = `rgba(16, 185, 129, ${0.35 + intensity * 0.6})`;
          ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
        } else {
          // DAYLIGHT ZERO LINE (Gold)
          ctx.fillStyle = 'rgba(234, 179, 8, 0.9)';
          ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
        }
      }
    }

    // Draw Boundary Box
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, startY, cellW * cols, cellH * rows);

    ctx.restore();
  }, [volumeResult, zoom, panOffset, heatmapMode, maxCutDepth, maxFillDepth]);

  // Canvas Mouse Interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    const canvas = canvasRef.current;
    if (!canvas || !volumeResult?.heatmap?.matrix) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const matrix = volumeResult.heatmap.matrix;
    const rows = matrix.length;
    const cols = matrix[0]?.length || 0;
    if (rows === 0 || cols === 0) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellW = (width * 0.85) / cols;
    const cellH = (height * 0.85) / rows;
    const startX = (width - cellW * cols) / 2;
    const startY = (height - cellH * rows) / 2;

    // Transform mouse coordinates back from pan/zoom
    const adjustedX = (mouseX - (width / 2 + panOffset.x)) / zoom + width / 2;
    const adjustedY = (mouseY - (height / 2 + panOffset.y)) / zoom + height / 2;

    const col = Math.floor((adjustedX - startX) / cellW);
    const row = rows - 1 - Math.floor((adjustedY - startY) / cellH);

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      const diffVal = matrix[row]?.[col];
      if (diffVal !== null && diffVal !== undefined) {
        setHoverInfo({
          x: col,
          y: row,
          diff: diffVal,
          surfaceZ: datumElevation + diffVal,
        });
      } else {
        setHoverInfo(null);
      }
    } else {
      setHoverInfo(null);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.min(Math.max(0.4, prev * zoomFactor), 8));
  };

  // Export Detailed Earthwork CSV Schedule
  const handleExportVolumeCSV = () => {
    let csv = `GRIHAYAN 3D SURFACE ANALYZER - EARTHWORK VOLUME SCHEDULE\n`;
    csv += `Project Formation Level (Datum RL),${datumElevation.toFixed(3)} m\n`;
    csv += `Total Covered Surface Area,${(volumeResult?.covered_area_m2 ?? 0).toFixed(2)} m2\n`;
    csv += `Cut Volume (Excavation),${cutVol.toFixed(2)} m3\n`;
    csv += `Fill Volume (Embankment),${fillVol.toFixed(2)} m3\n`;
    csv += `Net Volume Difference,${netVol.toFixed(2)} m3\n`;
    csv += `Cut Planar Area,${cutArea.toFixed(2)} m2 (${volumeResult?.cut_area_pct ?? 0}%)\n`;
    csv += `Fill Planar Area,${fillArea.toFixed(2)} m2 (${volumeResult?.fill_area_pct ?? 0}%)\n`;
    csv += `Max Cut Depth,${maxCutDepth.toFixed(3)} m\n`;
    csv += `Max Fill Depth,${maxFillDepth.toFixed(3)} m\n`;
    csv += `Optimal 0-Net Balance Datum,${optimalBalanceDatum.toFixed(3)} m\n\n`;

    csv += `DEPTH CLASS DISTRIBUTION BREAKDOWN\n`;
    csv += `Depth_Range,Cut_Volume_m3,Fill_Volume_m3\n`;
    depthDistribution.forEach((d: any) => {
      csv += `${d.range},${d.cut_volume_m3},${d.fill_volume_m3}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earthwork_schedule_datum_${datumElevation.toFixed(2)}m.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* Top Header Action Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <BoxSelect className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <span>Civil Earthwork & Cut/Fill Volume Studio</span>
              {isCalculating && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />}
            </h2>
            <p className="text-[11px] text-slate-400">
              Spatial earthwork estimation, depth bin distribution, and cost analytics
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setDatumElevation(Number(optimalBalanceDatum.toFixed(2)))}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition"
            title="Snap to optimal datum where Cut Volume = Fill Volume"
          >
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>Optimal Balance ({optimalBalanceDatum.toFixed(2)}m)</span>
          </button>

          <button
            onClick={handleExportVolumeCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Schedule (.csv)</span>
          </button>
        </div>
      </header>

      {/* Dual Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control & Analytics Panel (420px) */}
        <div className="w-[440px] bg-slate-900/95 border-r border-slate-800 flex flex-col h-full overflow-y-auto p-4 space-y-4 flex-shrink-0">
          {/* Target Formation Datum Controller */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3 shadow-inner">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>Formation Datum Level</span>
              </label>
              <span className="text-xs font-mono text-blue-400 font-bold bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20">
                RL: {datumElevation.toFixed(3)} m
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={minElevation}
              max={maxElevation}
              step="0.05"
              value={datumElevation}
              onChange={(e) => setDatumElevation(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            {/* Step & Preset Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex space-x-1">
                {[-1.0, -0.5, -0.1].map((step) => (
                  <button
                    key={step}
                    onClick={() => setDatumElevation((prev) => Math.max(minElevation, Number((prev + step).toFixed(2))))}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono border border-slate-700 transition"
                  >
                    {step}m
                  </button>
                ))}
              </div>

              <div className="flex space-x-1">
                {[0.1, 0.5, 1.0].map((step) => (
                  <button
                    key={step}
                    onClick={() => setDatumElevation((prev) => Math.min(maxElevation, Number((prev + step).toFixed(2))))}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono border border-slate-700 transition"
                  >
                    +{step}m
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Preset Jumps */}
            <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
              <button onClick={() => setDatumElevation(Number(minElevation.toFixed(2)))} className="hover:text-blue-400">
                Min: {minElevation.toFixed(1)}m
              </button>
              <button onClick={() => setDatumElevation(Number(optimalBalanceDatum.toFixed(2)))} className="text-amber-400 hover:underline font-bold">
                0-Net: {optimalBalanceDatum.toFixed(2)}m
              </button>
              <button onClick={() => setDatumElevation(Number(maxElevation.toFixed(2)))} className="hover:text-blue-400">
                Max: {maxElevation.toFixed(1)}m
              </button>
            </div>
          </div>

          {/* KPI Volume Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Cut Card */}
            <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase">
                <span>Cut (Excavation)</span>
                <ArrowDownCircle className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold font-mono text-amber-300">
                {formatNumber(cutVol, 1)} <span className="text-xs font-normal text-slate-400">m³</span>
              </p>
              <div className="text-[10px] text-amber-500/90 font-mono flex justify-between pt-1 border-t border-amber-500/20">
                <span>Area: {formatNumber(cutArea, 0)} m²</span>
                <span>Max: {formatNumber(maxCutDepth, 2)}m</span>
              </div>
            </div>

            {/* Fill Card */}
            <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase">
                <span>Fill (Embankment)</span>
                <ArrowUpCircle className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold font-mono text-emerald-300">
                {formatNumber(fillVol, 1)} <span className="text-xs font-normal text-slate-400">m³</span>
              </p>
              <div className="text-[10px] text-emerald-500/90 font-mono flex justify-between pt-1 border-t border-emerald-500/20">
                <span>Area: {formatNumber(fillArea, 0)} m²</span>
                <span>Max: {formatNumber(maxFillDepth, 2)}m</span>
              </div>
            </div>
          </div>

          {/* Net Balance Card */}
          <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-blue-400 text-xs font-bold uppercase">
              <span>Net Volume Balance</span>
              <Scale className="w-4 h-4" />
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold font-mono text-blue-300">
                {netVol >= 0 ? '+' : ''}{formatNumber(netVol, 2)} <span className="text-xs font-normal text-slate-400">m³</span>
              </p>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                Math.abs(netVol) < 50
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : netVol > 0
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-blue-500/20 text-blue-300'
              }`}>
                {Math.abs(netVol) < 50 ? 'BALANCED' : netVol > 0 ? 'CUT SURPLUS' : 'FILL DEFICIT'}
              </span>
            </div>
            {/* Proportion Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span className="text-amber-400">Cut: {cutPct.toFixed(1)}%</span>
                <span className="text-emerald-400">Fill: {fillPct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                <div style={{ width: `${cutPct}%` }} className="bg-amber-500 h-full transition-all duration-200" />
                <div style={{ width: `${fillPct}%` }} className="bg-emerald-500 h-full transition-all duration-200" />
              </div>
            </div>
          </div>

          {/* Depth Distribution Breakdown Table */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Depth Distribution (m³)</span>
              <span className="text-[10px] text-slate-500 font-normal">Class Bins</span>
            </h4>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-[11px] font-mono text-left">
                <thead className="bg-slate-800/80 text-slate-400">
                  <tr>
                    <th className="px-2.5 py-1.5">Depth Class</th>
                    <th className="px-2.5 py-1.5 text-amber-400 text-right">Cut (m³)</th>
                    <th className="px-2.5 py-1.5 text-emerald-400 text-right">Fill (m³)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {depthDistribution.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="px-2.5 py-1 text-slate-400">{row.range}</td>
                      <td className="px-2.5 py-1 text-right text-amber-300 font-bold">{formatNumber(row.cut_volume_m3, 1)}</td>
                      <td className="px-2.5 py-1 text-right text-emerald-300 font-bold">{formatNumber(row.fill_volume_m3, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mass Haul Cost Estimator Tool */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Earthwork Cost Estimator</span>
              </h4>
              <button
                onClick={() => setShowCostEstimator(!showCostEstimator)}
                className="text-[10px] text-blue-400 hover:underline"
              >
                {showCostEstimator ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {showCostEstimator && (
              <div className="space-y-2 pt-1 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Cut Unit Rate (/m³)</label>
                    <input
                      type="number"
                      value={cutRate}
                      onChange={(e) => setCutRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200 mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Fill Unit Rate (/m³)</label>
                    <input
                      type="number"
                      value={fillRate}
                      onChange={(e) => setFillRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-200 mt-0.5"
                    />
                  </div>
                </div>

                <div className="flex justify-between py-1 border-t border-slate-800 text-[11px] font-mono">
                  <span className="text-slate-400">Excavation Cost:</span>
                  <span className="text-amber-400 font-bold">{formatInteger(totalCutCost)}</span>
                </div>
                <div className="flex justify-between py-1 border-t border-slate-800 text-[11px] font-mono">
                  <span className="text-slate-400">Embankment Cost:</span>
                  <span className="text-emerald-400 font-bold">{formatInteger(totalFillCost)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-t border-slate-800 text-xs font-mono bg-slate-900 p-2 rounded">
                  <span className="text-slate-200 font-bold font-sans">Total Estimated Cost:</span>
                  <span className="text-emerald-300 font-extrabold text-sm">{formatInteger(totalEarthworkCost)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Studio: Interactive 2D Spatial Cut-Fill Heatmap Canvas */}
        <div className="flex-1 relative flex flex-col bg-slate-950 overflow-hidden">
          {/* Canvas Floating Toolbar */}
          <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 shadow-xl backdrop-blur-md">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Heatmap Filter:</span>
            <button
              onClick={() => setHeatmapMode('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                heatmapMode === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Zones
            </button>
            <button
              onClick={() => setHeatmapMode('cut')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                heatmapMode === 'cut' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cut Only (🔴)
            </button>
            <button
              onClick={() => setHeatmapMode('fill')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                heatmapMode === 'fill' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fill Only (🟢)
            </button>
          </div>

          {/* Canvas Zoom Controls */}
          <div className="absolute top-4 right-4 z-20 flex items-center space-x-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 shadow-xl backdrop-blur-md">
            <button
              onClick={() => setZoom((prev) => Math.min(prev * 1.25, 8))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-slate-300 px-1">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((prev) => Math.max(prev * 0.8, 0.4))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive HTML5 Canvas */}
          <div className="flex-1 w-full h-full cursor-crosshair relative">
            <canvas
              ref={canvasRef}
              width={900}
              height={650}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              className="w-full h-full block"
            />
          </div>

          {/* Floating Hover Coordinates & Cut/Fill Depth HUD */}
          {hoverInfo && (
            <div className="absolute bottom-4 right-4 z-20 bg-slate-900/95 border border-slate-800 rounded-xl p-3 shadow-2xl backdrop-blur-md space-y-1 font-mono text-xs select-none">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-blue-400" />
                <span>Spatial Inspection Inspector</span>
              </div>
              <div className="flex justify-between space-x-4">
                <span className="text-slate-400 font-sans">Ground RL:</span>
                <span className="text-slate-200 font-bold">{formatNumber(hoverInfo.surfaceZ, 3)} m</span>
              </div>
              <div className="flex justify-between space-x-4">
                <span className="text-slate-400 font-sans">Formation RL:</span>
                <span className="text-blue-400 font-bold">{formatNumber(datumElevation, 3)} m</span>
              </div>
              <div className="flex justify-between space-x-4 pt-1 border-t border-slate-800">
                <span className="text-slate-400 font-sans">Depth ($\Delta Z$):</span>
                <span className={`font-bold ${hoverInfo.diff >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {hoverInfo.diff >= 0 ? `+${formatNumber(hoverInfo.diff, 3)}m (CUT)` : `${formatNumber(hoverInfo.diff, 3)}m (FILL)`}
                </span>
              </div>
            </div>
          )}

          {/* Floating 2D Heatmap Legend - Bottom Left */}
          <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-2xl backdrop-blur-md space-y-1.5 text-xs font-mono select-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cut / Fill Heatmap Legend</span>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-red-500 border border-red-400"></span>
                <span className="text-slate-300 text-[11px]">Cut Zone (Z &gt; Datum)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-400"></span>
                <span className="text-slate-300 text-[11px]">Fill Zone (Z &lt; Datum)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-yellow-400 border border-yellow-300"></span>
                <span className="text-slate-300 text-[11px]">Daylight Zero Line</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
