import React, { useState, useMemo } from 'react';
import { 
  Table, 
  Search, 
  Filter, 
  Download, 
  Sliders, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  FileSpreadsheet, 
  FileCode, 
  Layers, 
  MapPin, 
  Eye, 
  Copy, 
  Check, 
  Activity,
  Sparkles,
  Info
} from 'lucide-react';
import { ValidationSummary } from '../../types/survey';
import { formatNumber, formatInteger } from '../../utils/formatters';

interface PointTableStudioProps {
  summary?: ValidationSummary | null;
  onSelectPoint?: (pt: any) => void;
  sourceCrs?: string | null;
  projectName?: string;
}

export const PointTableStudio: React.FC<PointTableStudioProps> = ({
  summary,
  onSelectPoint,
  sourceCrs,
  projectName = 'Survey Project'
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCode, setSelectedCode] = useState<string>('ALL');
  const [minElevationFilter, setMinElevationFilter] = useState<string>('');
  const [maxElevationFilter, setMaxElevationFilter] = useState<string>('');

  // Sorting State
  const [sortField, setSortField] = useState<'row_index' | 'point_id' | 'x' | 'y' | 'rl' | 'code'>('row_index');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);

  // Selected Point Inspector
  const [inspectedPoint, setInspectedPoint] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract raw rows from summary
  const allRows: any[] = useMemo(() => {
    return summary?.preview_valid_rows || [];
  }, [summary]);

  // Extract all unique feature codes
  const uniqueCodes = useMemo(() => {
    const codes = new Set<string>();
    allRows.forEach((r) => {
      if (r.code) codes.add(String(r.code).trim().toUpperCase());
      else codes.add('RL');
    });
    return Array.from(codes).sort();
  }, [allRows]);

  // Filter & Sort Data
  const filteredAndSortedRows = useMemo(() => {
    let result = [...allRows];

    // 1. Search Filter (Point ID or Code or Coordinates)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((r) => {
        const idMatch = String(r.point_id).toLowerCase().includes(q);
        const codeMatch = String(r.code || 'RL').toLowerCase().includes(q);
        const xMatch = String(r.x).includes(q);
        const yMatch = String(r.y).includes(q);
        const rlMatch = String(r.rl).includes(q);
        return idMatch || codeMatch || xMatch || yMatch || rlMatch;
      });
    }

    // 2. Feature Code Filter
    if (selectedCode !== 'ALL') {
      result = result.filter((r) => {
        const c = String(r.code || 'RL').trim().toUpperCase();
        return c === selectedCode;
      });
    }

    // 3. Elevation Range Filter
    const minZ = parseFloat(minElevationFilter);
    const maxZ = parseFloat(maxElevationFilter);
    if (!isNaN(minZ)) {
      result = result.filter((r) => r.rl >= minZ);
    }
    if (!isNaN(maxZ)) {
      result = result.filter((r) => r.rl <= maxZ);
    }

    // 4. Sorting
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'point_id' || sortField === 'code') {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        return sortDirection === 'asc' 
          ? (valA as string).localeCompare(valB as string, undefined, { numeric: true }) 
          : (valB as string).localeCompare(valA as string, undefined, { numeric: true });
      } else {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortDirection === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
    });

    return result;
  }, [allRows, searchTerm, selectedCode, minElevationFilter, maxElevationFilter, sortField, sortDirection]);

  // Pagination Slice
  const totalRows = filteredAndSortedRows.length;
  const totalPages = rowsPerPage === -1 ? 1 : Math.ceil(totalRows / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    if (rowsPerPage === -1) return filteredAndSortedRows;
    const start = (currentPage - 1) * rowsPerPage;
    return filteredAndSortedRows.slice(start, start + rowsPerPage);
  }, [filteredAndSortedRows, currentPage, rowsPerPage]);

  // Handle Sort Click
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Copy Coordinates to Clipboard
  const handleCopyCoord = (pt: any) => {
    const str = `Point: ${pt.point_id} | Easting: ${pt.x} | Northing: ${pt.y} | RL: ${pt.rl} | Code: ${pt.code || 'RL'}`;
    navigator.clipboard.writeText(str);
    setCopiedId(pt.point_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export Filtered CSV
  const handleExportCSV = () => {
    let csv = `Point_ID,Easting_X,Northing_Y,RL_Elevation_m,Feature_Code\n`;
    filteredAndSortedRows.forEach((r) => {
      csv += `${r.point_id},${r.x},${r.y},${r.rl},${r.code || 'RL'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_survey_points_${filteredAndSortedRows.length}pts.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CAD Point Cloud DXF
  const handleExportDXF = () => {
    let dxf = `0\nSECTION\n2\nENTITIES\n`;
    filteredAndSortedRows.forEach((r) => {
      // 3D POINT Entity
      dxf += `0\nPOINT\n8\nSURVEY_POINTS\n10\n${r.x}\n20\n${r.y}\n30\n${r.rl}\n`;
      // Elevation Label TEXT Entity
      dxf += `0\nTEXT\n8\nPOINT_LABELS\n10\n${r.x + 0.4}\n20\n${r.y + 0.4}\n30\n${r.rl}\n40\n0.3\n1\n${r.point_id} (${Number(r.rl).toFixed(2)})\n`;
    });
    dxf += `0\nENDSEC\n0\nEOF\n`;

    const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_cad_points_${filteredAndSortedRows.length}pts.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export GeoJSON
  const handleExportGeoJSON = () => {
    const features = filteredAndSortedRows.map((r) => ({
      type: 'Feature',
      properties: {
        point_id: String(r.point_id),
        elevation: Number(r.rl),
        code: String(r.code || 'RL')
      },
      geometry: {
        type: 'Point',
        coordinates: [Number(r.x), Number(r.y), Number(r.rl)]
      }
    }));

    const doc = {
      type: 'FeatureCollection',
      crs: {
        type: 'name',
        properties: { name: sourceCrs || 'EPSG:32646' }
      },
      features
    };

    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_survey_points.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const minZ = summary?.bounds?.min_z ?? 0;
  const maxZ = summary?.bounds?.max_z ?? 100;
  const elevationRange = maxZ - minZ || 1;

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Table className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center space-x-2">
              <span>Survey Point Registry & Data Studio</span>
              <span className="bg-blue-500/10 text-blue-400 text-xs font-mono px-2.5 py-0.5 rounded border border-blue-500/20">
                {formatInteger(totalRows)} / {formatInteger(allRows.length || summary?.total_records)} Points
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Authoritative coordinate registry with real-time query, sorting, and CAD / GIS multi-format export
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            title="Download Standard CSV Spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV (.csv)</span>
          </button>

          <button
            onClick={handleExportDXF}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            title="Download AutoCAD DXF 3D Point Cloud"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span>CAD DXF (.dxf)</span>
          </button>

          <button
            onClick={handleExportGeoJSON}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            title="Download Standard GeoJSON Feature Collection"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>GeoJSON</span>
          </button>
        </div>
      </header>

      {/* KPI Summary Chips Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-2.5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-sans">Min RL:</span>
            <span className="text-blue-400 font-bold">{formatNumber(minZ, 3)} m</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-sans">Mean RL:</span>
            <span className="text-slate-200 font-bold">{formatNumber((minZ + maxZ) / 2, 3)} m</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-sans">Max RL:</span>
            <span className="text-red-400 font-bold">{formatNumber(maxZ, 3)} m</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-sans">Relief ($\Delta Z$):</span>
            <span className="text-emerald-400 font-bold">{formatNumber(elevationRange, 3)} m</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-slate-400 font-sans text-[11px]">
          <span>CRS Reference:</span>
          <span className="text-purple-400 font-mono font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
            {sourceCrs || 'Local Grid'}
          </span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between space-x-4 flex-shrink-0">
        {/* Left: Search Box */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Point ID, RL, Code, or Coordinate..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Feature Code Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-medium">Feature Code:</span>
          <select
            value={selectedCode}
            onChange={(e) => {
              setSelectedCode(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="ALL">All Feature Codes ({allRows.length})</option>
            {uniqueCodes.map((c) => (
              <option key={c} value={c}>
                Code: {c}
              </option>
            ))}
          </select>
        </div>

        {/* Elevation Range Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 font-medium">RL Range:</span>
          <input
            type="number"
            placeholder={`Min (${minZ.toFixed(1)})`}
            value={minElevationFilter}
            onChange={(e) => {
              setMinElevationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
          />
          <span className="text-slate-500">to</span>
          <input
            type="number"
            placeholder={`Max (${maxZ.toFixed(1)})`}
            value={maxElevationFilter}
            onChange={(e) => {
              setMaxElevationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
          />
          {(minElevationFilter || maxElevationFilter || searchTerm || selectedCode !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCode('ALL');
                setMinElevationFilter('');
                setMaxElevationFilter('');
                setCurrentPage(1);
              }}
              className="text-[11px] text-rose-400 hover:underline px-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Rows Per Page */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 font-medium">Rows:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={-1}>All ({filteredAndSortedRows.length})</option>
          </select>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto bg-slate-950">
          <table className="w-full text-xs font-mono text-left">
            <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
              <tr>
                <th 
                  onClick={() => handleSort('row_index')} 
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>#</span>
                    {sortField === 'row_index' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('point_id')} 
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>Point ID</span>
                    {sortField === 'point_id' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('x')} 
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>Easting (X)</span>
                    {sortField === 'x' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('y')} 
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>Northing (Y)</span>
                    {sortField === 'y' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('rl')} 
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-blue-400">RL Elevation (m)</span>
                    {sortField === 'rl' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('code')} 
                  className="px-4 py-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>Feature Code</span>
                    {sortField === 'code' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-sans">
                    No survey points matched the active search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((pt, i) => {
                  const elevationRatio = Math.max(0, Math.min(1, (pt.rl - minZ) / elevationRange));
                  const isSelected = inspectedPoint?.point_id === pt.point_id;

                  return (
                    <tr
                      key={i}
                      onClick={() => {
                        setInspectedPoint(pt);
                        if (onSelectPoint) onSelectPoint(pt);
                      }}
                      className={`hover:bg-blue-500/10 cursor-pointer transition ${
                        isSelected ? 'bg-blue-500/20 font-semibold' : ''
                      }`}
                    >
                      <td className="px-4 py-2 text-slate-500">{pt.row_index}</td>
                      <td className="px-4 py-2 font-bold text-slate-100">{pt.point_id}</td>
                      <td className="px-4 py-2">{formatNumber(pt.x, 3)}</td>
                      <td className="px-4 py-2">{formatNumber(pt.y, 3)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-blue-400 font-bold w-16">{formatNumber(pt.rl, 3)}</span>
                          {/* Mini Elevation Heat Bar */}
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${elevationRatio * 100}%` }}
                              className="bg-gradient-to-r from-blue-500 via-emerald-400 to-red-500 h-full"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {pt.code || 'RL'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleCopyCoord(pt)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                            title="Copy Coordinates"
                          >
                            {copiedId === pt.point_id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              setInspectedPoint(pt);
                              if (onSelectPoint) onSelectPoint(pt);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition"
                            title="Inspect Point Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Sidebar: Selected Point Inspector (When Open) */}
        {inspectedPoint && (
          <div className="w-80 bg-slate-900 border-l border-slate-800 p-4 flex flex-col space-y-4 overflow-y-auto z-10 shadow-2xl flex-shrink-0 animate-fadeIn select-none">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Point Inspector</h3>
              </div>
              <button
                onClick={() => setInspectedPoint(null)}
                className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-sans">Target Point Identifier</span>
              <p className="text-xl font-bold text-slate-100">{inspectedPoint.point_id}</p>
              <div className="text-[10px] text-slate-400 font-sans flex justify-between pt-1 border-t border-slate-800">
                <span>Row Position:</span>
                <span className="text-slate-200">#{inspectedPoint.row_index}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-sans flex justify-between">
                <span>Feature Code:</span>
                <span className="text-purple-400 font-bold">{inspectedPoint.code || 'RL (Reduced Level)'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5 text-xs font-mono">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-sans">Geodetic Coordinates</span>
              <div className="space-y-1.5">
                <div className="flex justify-between py-0.5 border-b border-slate-800/60">
                  <span className="text-slate-400 font-sans">Easting (X):</span>
                  <span className="text-slate-200 font-bold">{formatNumber(inspectedPoint.x, 4)} m</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/60">
                  <span className="text-slate-400 font-sans">Northing (Y):</span>
                  <span className="text-slate-200 font-bold">{formatNumber(inspectedPoint.y, 4)} m</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/60">
                  <span className="text-slate-400 font-sans">Elevation (RL):</span>
                  <span className="text-blue-400 font-bold">{formatNumber(inspectedPoint.rl, 4)} m</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400 font-sans">Relief Status:</span>
                  <span className="text-emerald-400 font-bold">
                    {inspectedPoint.rl >= (minZ + maxZ) / 2 ? 'Above Mean RL (+)' : 'Below Mean RL (-)'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleCopyCoord(inspectedPoint)}
              className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              {copiedId === inspectedPoint.point_id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Formatted Coordinates</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <footer className="h-12 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between flex-shrink-0 text-xs font-mono text-slate-400 z-10">
        <div>
          Showing <strong className="text-slate-200">{rowsPerPage === -1 ? totalRows : Math.min(totalRows, (currentPage - 1) * rowsPerPage + 1)}</strong> to <strong className="text-slate-200">{rowsPerPage === -1 ? totalRows : Math.min(totalRows, currentPage * rowsPerPage)}</strong> of <strong className="text-slate-200">{formatInteger(totalRows)}</strong> points
        </div>

        {rowsPerPage !== -1 && totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-300">
              Page <strong className="text-blue-400">{currentPage}</strong> of <strong className="text-slate-300">{totalPages}</strong>
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
