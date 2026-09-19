import { ColumnMapping, RawPreviewResponse, ValidationSummary } from '../types/survey';

/**
 * Realistic Geodetic & Topographic Sample Project Generator for Instant Demo / Netlify Deployment
 */
export function generateSampleSurveyProject(projectName: string = 'Khagrachari_1000Acre_Survey') {
  const originX = 353500;
  const originY = 2536200;
  const width = 1200;
  const height = 900;
  const rows = 35;
  const cols = 45;

  const points: any[] = [];
  const indices: number[] = [];

  let minZ = 999999;
  let maxZ = -999999;
  let sumZ = 0;

  // Generate realistic undulating hilly terrain with multiple Gaussian hills & valleys
  const grid: { x: number; y: number; z: number; id: number; code: string }[][] = [];

  let idCounter = 1;
  const featureCodes = ['SPOT', 'RIDGE', 'VALLEY', 'BM', 'ROAD', 'TOE', 'TOP', 'BENCH'];

  for (let r = 0; r < rows; r++) {
    const rowArr: { x: number; y: number; z: number; id: number; code: string }[] = [];
    const ty = r / (rows - 1);
    const y = originY + ty * height + (Math.random() - 0.5) * 8;

    for (let c = 0; c < cols; c++) {
      const tx = c / (cols - 1);
      const x = originX + tx * width + (Math.random() - 0.5) * 8;

      // Topographic landscape equation: 2 major hills, 1 ridge, 1 depression valley
      const hill1 = Math.exp(-Math.pow((tx - 0.35) * 3.5, 2) - Math.pow((ty - 0.45) * 3.5, 2)) * 38;
      const hill2 = Math.exp(-Math.pow((tx - 0.75) * 4.0, 2) - Math.pow((ty - 0.7) * 4.0, 2)) * 28;
      const ridge = Math.sin(tx * Math.PI * 2.2) * Math.cos(ty * Math.PI * 1.8) * 8;
      const valley = -Math.exp(-Math.pow((tx - 0.5) * 3.0, 2) - Math.pow((ty - 0.2) * 5.0, 2)) * 12;
      const noise = (Math.sin(tx * 25 + ty * 30) + Math.cos(tx * 18 - ty * 22)) * 1.5;

      const z = Math.round((12.5 + hill1 + hill2 + ridge + valley + noise) * 1000) / 1000;

      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      sumZ += z;

      const code = (r === 0 || r === rows - 1 || c === 0 || c === cols - 1)
        ? 'BND'
        : (z > 45 ? 'TOP' : (z < 16 ? 'TOE' : featureCodes[idCounter % featureCodes.length]));

      const ptObj = {
        id: idCounter,
        point_id: `PT-${String(idCounter).padStart(4, '0')}`,
        easting: x,
        northing: y,
        elevation: z,
        x,
        y,
        z,
        rl: z,
        code
      };

      points.push(ptObj);
      rowArr.push(ptObj);
      idCounter++;
    }
    grid.push(rowArr);
  }

  const rangeZ = Math.max(0.001, maxZ - minZ);
  const meanZ = sumZ / points.length;

  // Build Triangles
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i0 = r * cols + c;
      const i1 = r * cols + (c + 1);
      const i2 = (r + 1) * cols + c;
      const i3 = (r + 1) * cols + (c + 1);

      // Triangle 1
      indices.push(i0, i1, i2);
      // Triangle 2
      indices.push(i1, i3, i2);
    }
  }

  const bounds = {
    min_x: originX,
    max_x: originX + width,
    min_y: originY,
    max_y: originY + height,
    min_z: minZ,
    max_z: maxZ,
    range_x: width,
    range_y: height,
    range_z: rangeZ
  };

  const centerX = (bounds.min_x + bounds.max_x) / 2;
  const centerY = (bounds.min_y + bounds.max_y) / 2;
  const centerZ = (bounds.min_z + bounds.max_z) / 2;

  // Centered vertices and raw elevations for Viewport3D
  const localVertices: number[] = [];
  const rawElevations: number[] = [];
  points.forEach(p => {
    localVertices.push(p.x - centerX, p.y - centerY, p.z - centerZ);
    rawElevations.push(p.z);
  });

  // Boundary indices for 3D skirt
  const boundaryIndices: number[] = [];
  for (let c = 0; c < cols; c++) boundaryIndices.push(c);
  for (let r = 1; r < rows; r++) boundaryIndices.push(r * cols + (cols - 1));
  for (let c = cols - 2; c >= 0; c--) boundaryIndices.push((rows - 1) * cols + c);
  for (let r = rows - 2; r > 0; r--) boundaryIndices.push(r * cols);

  // Generate Contour Lines
  const majorContours: any[] = [];
  const minorContours: any[] = [];
  const allContours: any[] = [];
  const contourInterval = 1.0;
  const minContourZ = Math.ceil(minZ / contourInterval) * contourInterval;
  const maxContourZ = Math.floor(maxZ / contourInterval) * contourInterval;

  for (let cz = minContourZ; cz <= maxContourZ; cz += contourInterval) {
    const isMajor = Math.abs(cz % 5.0) < 0.001;
    const linePoints: [number, number, number][] = [];
    const steps = 60;
    for (let s = 0; s <= steps; s++) {
      const angle = (s / steps) * Math.PI * 2;
      const radiusX = (width * 0.35) * (1 - (cz - minZ) / (rangeZ * 1.3));
      const radiusY = (height * 0.32) * (1 - (cz - minZ) / (rangeZ * 1.3));
      if (radiusX > 20 && radiusY > 20) {
        const px = originX + width * 0.45 + Math.cos(angle) * radiusX + Math.sin(angle * 3) * 15;
        const py = originY + height * 0.5 + Math.sin(angle) * radiusY + Math.cos(angle * 2) * 15;
        linePoints.push([px, py, cz]);
      }
    }
    if (linePoints.length > 5) {
      const cObj = {
        elevation: cz,
        is_major: isMajor,
        points: linePoints,
        length_m: linePoints.length * 15
      };
      allContours.push(cObj);
      if (isMajor) majorContours.push(cObj);
      else minorContours.push(cObj);
    }
  }

  const planarAreaSqm = width * height * 0.88;
  const areaAcres = planarAreaSqm / 4046.856;

  const columnMapping: ColumnMapping = {
    point_id: 'Point_ID',
    x: 'Easting',
    y: 'Northing',
    rl: 'Elevation',
    code: 'Code'
  };

  const previewValidRows = points.map((p, idx) => ({
    row_index: idx + 1,
    point_id: p.point_id,
    x: p.x,
    y: p.y,
    rl: p.z,
    z: p.z,
    code: p.code,
    Point_ID: p.point_id,
    Easting: p.x,
    Northing: p.y,
    Elevation: p.z,
    Code: p.code
  }));

  const summary: ValidationSummary = {
    total_records: points.length,
    valid_points: points.length,
    invalid_records: 0,
    duplicate_xy_count: 0,
    missing_rl_count: 0,
    duplicate_id_count: 0,
    bounds,
    crs: {
      epsg: 'EPSG:32646',
      name: 'WGS 84 / UTM zone 46N',
      is_projected: true,
      unit: 'meter',
      datum: 'WGS 84',
      status: 'CONFIRMED'
    },
    issues: [],
    preview_valid_rows: previewValidRows,
    preview_invalid_rows: []
  };

  const tinData = {
    triangle_count: indices.length / 3,
    vertex_count: points.length,
    is_simplified_for_display: false,
    bounds,
    center: {
      x: centerX,
      y: centerY,
      z: centerZ
    },
    geometry: {
      vertices: localVertices,
      indices,
      raw_elevations: rawElevations,
      boundary_indices: boundaryIndices
    },
    sample_points: points.slice(0, 100).map(p => ({
      point_id: p.point_id,
      x: p.x,
      y: p.y,
      rl: p.z,
      code: p.code
    })),
    points: points.slice(0, 500).map(p => ({
      point_id: p.point_id,
      x: p.x,
      y: p.y,
      rl: p.z,
      code: p.code
    })),
    metrics: {
      area_2d_m2: planarAreaSqm,
      surface_area_3d_m2: planarAreaSqm * 1.042,
      perimeter_m: (width + height) * 2 * 0.92,
      triangle_count: indices.length / 3,
      is_simplified_for_display: false
    }
  };

  const demData = {
    resolution: 5.0,
    bounds,
    elevation_min: minZ,
    elevation_max: maxZ,
    grid_z: grid.map(row => row.map(p => p.z))
  };

  const contoursData = {
    interval: contourInterval,
    major_multiplier: 5,
    count: allContours.length,
    contours: allContours,
    major_contours: majorContours,
    minor_contours: minorContours
  };

  const projectStats = {
    point_counts: {
      total_records: points.length,
      valid_points: points.length,
      invalid_points: 0,
      duplicate_xy_count: 0
    },
    elevation: {
      min_rl: minZ,
      max_rl: maxZ,
      range_rl: rangeZ,
      mean_rl: meanZ,
      std_dev_rl: 6.798
    },
    spatial_area: {
      area_2d_sqm: planarAreaSqm,
      area_acres: areaAcres,
      surface_area_3d_sqm: planarAreaSqm * 1.042,
      surface_rugosity_ratio: 1.042,
      perimeter_m: (width + height) * 2 * 0.92
    },
    tin: {
      triangle_count: indices.length / 3
    }
  };

  const previewData: RawPreviewResponse = {
    file_id: 'demo_sample_project_id',
    filename: `${projectName}.csv`,
    file_type: 'csv',
    file_size_bytes: 84520,
    total_rows: points.length,
    total_columns: 5,
    has_headers: true,
    headers: ['Point_ID', 'Easting', 'Northing', 'Elevation', 'Code'],
    detected_columns: columnMapping,
    column_confidence: {
      Point_ID: 0.99,
      Easting: 0.99,
      Northing: 0.99,
      Elevation: 0.99,
      Code: 0.95
    },
    preview_rows: points.slice(0, 20).map(p => ({
      Point_ID: p.point_id,
      Easting: p.easting.toFixed(3),
      Northing: p.northing.toFixed(3),
      Elevation: p.elevation.toFixed(3),
      Code: p.code
    })),
    suggested_crs: 'EPSG:32646'
  };

  return {
    projectName,
    summary,
    tinData,
    demData,
    contoursData,
    projectStats,
    previewData,
    points
  };
}
