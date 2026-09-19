import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export interface Export3DViewOptions {
  tinData: any;
  projectName?: string;
  verticalExaggeration: number;
  surfaceStyle: string;
  colorMap: string;
  meshDensity: 'classic' | 'full' | 'sparse';
  showSkirt: boolean;
  coordinateMode?: 'centered' | 'georeferenced';
  includeColors?: boolean;
}

// Multi-stop linear color interpolator for GIS precision (matching Viewport3D.tsx)
function interpolateColorStops(
  t: number,
  stops: Array<{ pos: number; r: number; g: number; b: number }>
): { r: number; g: number; b: number } {
  const clampedT = Math.max(0, Math.min(1, t));
  if (clampedT <= stops[0].pos) {
    return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
  }
  if (clampedT >= stops[stops.length - 1].pos) {
    const last = stops[stops.length - 1];
    return { r: last.r, g: last.g, b: last.b };
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (clampedT >= s0.pos && clampedT <= s1.pos) {
      const factor = (clampedT - s0.pos) / (s1.pos - s0.pos || 1);
      return {
        r: s0.r + factor * (s1.r - s0.r),
        g: s0.g + factor * (s1.g - s0.g),
        b: s0.b + factor * (s1.b - s0.b),
      };
    }
  }
  return { r: 0.5, g: 0.5, b: 0.5 };
}

export function getColorForElevation(
  z: number,
  minZ: number,
  maxZ: number,
  style: string,
  mapType: string
): { r: number; g: number; b: number } {
  if (style === 'monochrome') return { r: 148 / 255, g: 163 / 255, b: 184 / 255 };

  const t = Math.max(0, Math.min(1, (z - minZ) / (maxZ - minZ || 1)));

  if (mapType === 'viridis') {
    return interpolateColorStops(t, [
      { pos: 0.00, r: 68 / 255, g: 1 / 255, b: 84 / 255 },     // #440154
      { pos: 0.25, r: 59 / 255, g: 82 / 255, b: 139 / 255 },   // #3b528b
      { pos: 0.50, r: 33 / 255, g: 145 / 255, b: 140 / 255 },  // #21918c
      { pos: 0.75, r: 94 / 255, g: 201 / 255, b: 98 / 255 },   // #5ec962
      { pos: 1.00, r: 253 / 255, g: 231 / 255, b: 37 / 255 },  // #fde725
    ]);
  } else if (mapType === 'grayscale') {
    return interpolateColorStops(t, [
      { pos: 0.00, r: 0.10, g: 0.10, b: 0.10 },
      { pos: 1.00, r: 0.98, g: 0.98, b: 0.98 },
    ]);
  } else if (mapType === 'terrain') {
    return interpolateColorStops(t, [
      { pos: 0.00, r: 21 / 255, g: 128 / 255, b: 61 / 255 },    // #15803d lush green
      { pos: 0.30, r: 132 / 255, g: 204 / 255, b: 22 / 255 },   // #84cc16 olive
      { pos: 0.60, r: 217 / 255, g: 119 / 255, b: 6 / 255 },    // #d97706 ochre brown
      { pos: 0.85, r: 120 / 255, g: 53 / 255, b: 15 / 255 },    // #78350f rocky brown
      { pos: 1.00, r: 248 / 255, g: 250 / 255, b: 252 / 255 },  // #f8fafc peak white
    ]);
  } else {
    // Professional GIS Hypsometric Rainbow (Blue -> Cyan/Green -> Yellow -> Orange -> Red)
    return interpolateColorStops(t, [
      { pos: 0.00, r: 37 / 255, g: 99 / 255, b: 235 / 255 },   // #2563eb Blue
      { pos: 0.25, r: 16 / 255, g: 185 / 255, b: 129 / 255 },  // #10b981 Emerald
      { pos: 0.50, r: 234 / 255, g: 179 / 255, b: 8 / 255 },   // #eab308 Yellow
      { pos: 0.75, r: 249 / 255, g: 115 / 255, b: 22 / 255 },  // #f97316 Orange
      { pos: 1.00, r: 239 / 255, g: 68 / 255, b: 68 / 255 },   // #ef4444 Red
    ]);
  }
}

/**
 * Builds the exact vertices, colors, and triangle indices as currently configured in the 3D Viewport.
 */
export function buildViewedGeometryData(opts: Export3DViewOptions) {
  const { tinData, verticalExaggeration, surfaceStyle, colorMap, meshDensity, showSkirt, coordinateMode = 'centered' } = opts;
  if (!tinData || !tinData.geometry) {
    throw new Error('No 3D TIN surface data available to export.');
  }

  const { vertices, indices, raw_elevations, boundary_indices } = tinData.geometry;
  const { min_z, max_z } = tinData.bounds;
  const { center } = tinData;
  const numVerts = raw_elevations.length;

  const datumBaseZ = (min_z - center.z - (max_z - min_z) * 0.15 - 5) * verticalExaggeration;

  // 1. Build surface vertices & colors
  const surfacePositions: number[][] = [];
  const surfaceColors: number[][] = [];

  for (let i = 0; i < numVerts; i++) {
    const vx = vertices[i * 3 + 0];
    const vy = vertices[i * 3 + 1];
    const vz_local = vertices[i * 3 + 2];
    const raw_rl = raw_elevations[i];

    let x = vx;
    let y = vy;
    let z = vz_local * verticalExaggeration;

    if (coordinateMode === 'georeferenced') {
      x = vx + center.x;
      y = vy + center.y;
      z = (vz_local * verticalExaggeration) + center.z;
    }

    surfacePositions.push([x, y, z]);

    const c = getColorForElevation(raw_rl, min_z, max_z, surfaceStyle, colorMap);
    surfaceColors.push([c.r, c.g, c.b]);
  }

  // 2. Compute display indices based on meshDensity
  let surfaceIndices: number[] = [];
  if (meshDensity === 'classic') {
    for (let i = 0; i < indices.length; i += 6) {
      surfaceIndices.push(indices[i], indices[i + 1], indices[i + 2]);
    }
  } else if (meshDensity === 'sparse') {
    for (let i = 0; i < indices.length; i += 12) {
      surfaceIndices.push(indices[i], indices[i + 1], indices[i + 2]);
    }
  } else {
    // 'full'
    surfaceIndices = [...indices];
  }

  // 3. Build Skirt if enabled
  const skirtPositions: number[][] = [];
  const skirtColors: number[][] = [];
  const skirtIndices: number[][] = []; // indices relative to skirtPositions

  if (showSkirt && boundary_indices && boundary_indices.length > 2) {
    const numB = boundary_indices.length;
    const skirtColor = [30 / 255, 41 / 255, 59 / 255]; // Dark slate #1e293b

    const baseZVal = coordinateMode === 'georeferenced' ? datumBaseZ + center.z : datumBaseZ;

    for (let i = 0; i < numB; i++) {
      const idx = boundary_indices[i];
      const topPt = surfacePositions[idx];
      const topX = topPt[0];
      const topY = topPt[1];
      const topZ = topPt[2];

      skirtPositions.push([topX, topY, topZ]);
      skirtPositions.push([topX, topY, baseZVal]);

      skirtColors.push([...skirtColor]);
      skirtColors.push([...skirtColor]);
    }

    for (let i = 0; i < numB; i++) {
      const next = (i + 1) % numB;
      const topA = i * 2;
      const botA = i * 2 + 1;
      const topB = next * 2;
      const botB = next * 2 + 1;

      skirtIndices.push([topA, botA, topB]);
      skirtIndices.push([topB, botA, botB]);
    }
  }

  return {
    surfacePositions,
    surfaceColors,
    surfaceIndices,
    skirtPositions,
    skirtColors,
    skirtIndices,
    bounds: tinData.bounds,
    center: tinData.center,
    datumBaseZ,
    totalVertices: surfacePositions.length + skirtPositions.length,
    totalTriangles: (surfaceIndices.length / 3) + skirtIndices.length,
  };
}

/**
 * Trigger browser file download from Blob or string content.
 */
function downloadFile(content: Blob | string, filename: string, mimeType = 'application/octet-stream') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 1. Export Wavefront OBJ (.obj) matching current 3D view settings.
 */
export function exportViewedOBJ(opts: Export3DViewOptions): string {
  const geo = buildViewedGeometryData(opts);
  const prefix = (opts.projectName || 'Grihayan_Survey').replace(/[\s-]+/g, '_');
  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `${prefix}_3D_Surface_View_${opts.verticalExaggeration}x_${opts.meshDensity}_${timeStr}.obj`;

  const lines: string[] = [];
  lines.push(`# GRIHAYAN 3D SURFACE ANALYZER - As-Viewed TIN Surface Export`);
  lines.push(`# Date: ${new Date().toISOString()}`);
  lines.push(`# Vertical Exaggeration: ${opts.verticalExaggeration}x`);
  lines.push(`# Mesh Density Look: ${opts.meshDensity}`);
  lines.push(`# Color Palette: ${opts.colorMap} (Style: ${opts.surfaceStyle})`);
  lines.push(`# Geological Skirt Included: ${opts.showSkirt ? 'Yes' : 'No'}`);
  lines.push(`# Coordinate System Mode: ${opts.coordinateMode || 'centered'}`);
  lines.push(`# Triangles: ${geo.totalTriangles}, Vertices: ${geo.totalVertices}`);
  lines.push(``);

  // Surface vertices with vertex colors: v X Y Z R G B
  lines.push(`g TIN_SURFACE_AS_VIEWED`);
  for (let i = 0; i < geo.surfacePositions.length; i++) {
    const [x, y, z] = geo.surfacePositions[i];
    const [r, g, b] = geo.surfaceColors[i];
    lines.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)} ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`);
  }

  // Surface faces (1-indexed)
  lines.push(``);
  for (let i = 0; i < geo.surfaceIndices.length; i += 3) {
    const i1 = geo.surfaceIndices[i] + 1;
    const i2 = geo.surfaceIndices[i + 1] + 1;
    const i3 = geo.surfaceIndices[i + 2] + 1;
    lines.push(`f ${i1} ${i2} ${i3}`);
  }

  // Skirt vertices and faces
  if (geo.skirtPositions.length > 0) {
    lines.push(``);
    lines.push(`g GEOLOGICAL_DATUM_SKIRT`);
    const offset = geo.surfacePositions.length;

    for (let i = 0; i < geo.skirtPositions.length; i++) {
      const [x, y, z] = geo.skirtPositions[i];
      const [r, g, b] = geo.skirtColors[i];
      lines.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)} ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`);
    }

    lines.push(``);
    for (let i = 0; i < geo.skirtIndices.length; i++) {
      const [i1, i2, i3] = geo.skirtIndices[i];
      lines.push(`f ${i1 + offset + 1} ${i2 + offset + 1} ${i3 + offset + 1}`);
    }
  }

  const objContent = lines.join('\n');
  downloadFile(objContent, filename, 'text/plain');
  return filename;
}

/**
 * 2. Export Binary GLTF / GLB (.glb) with materials and vertex colors.
 */
export async function exportViewedGLB(opts: Export3DViewOptions): Promise<string> {
  const geo = buildViewedGeometryData(opts);
  const prefix = (opts.projectName || 'Grihayan_Survey').replace(/[\s-]+/g, '_');
  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `${prefix}_3D_Surface_View_${opts.verticalExaggeration}x_${opts.meshDensity}_${timeStr}.glb`;

  // Create Three.js Scene containing Surface and optional Skirt
  const scene = new THREE.Scene();
  scene.name = `${prefix}_TIN_View`;

  // 1. Surface BufferGeometry
  const surfPositionsFlat = new Float32Array(geo.surfacePositions.length * 3);
  const surfColorsFlat = new Float32Array(geo.surfaceColors.length * 3);

  for (let i = 0; i < geo.surfacePositions.length; i++) {
    surfPositionsFlat[i * 3 + 0] = geo.surfacePositions[i][0];
    surfPositionsFlat[i * 3 + 1] = geo.surfacePositions[i][1];
    surfPositionsFlat[i * 3 + 2] = geo.surfacePositions[i][2];

    surfColorsFlat[i * 3 + 0] = geo.surfaceColors[i][0];
    surfColorsFlat[i * 3 + 1] = geo.surfaceColors[i][1];
    surfColorsFlat[i * 3 + 2] = geo.surfaceColors[i][2];
  }

  const surfGeo = new THREE.BufferGeometry();
  surfGeo.setAttribute('position', new THREE.BufferAttribute(surfPositionsFlat, 3));
  surfGeo.setAttribute('color', new THREE.BufferAttribute(surfColorsFlat, 3));
  surfGeo.setIndex(geo.surfaceIndices);
  surfGeo.computeVertexNormals();

  const surfMat = new THREE.MeshStandardMaterial({
    vertexColors: opts.surfaceStyle !== 'monochrome',
    color: opts.surfaceStyle === 'monochrome' ? 0x94a3b8 : 0xffffff,
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const surfMesh = new THREE.Mesh(surfGeo, surfMat);
  surfMesh.name = 'TIN_Surface';
  scene.add(surfMesh);

  // 2. Skirt BufferGeometry
  if (geo.skirtPositions.length > 0) {
    const skirtPositionsFlat = new Float32Array(geo.skirtPositions.length * 3);
    const skirtColorsFlat = new Float32Array(geo.skirtColors.length * 3);

    for (let i = 0; i < geo.skirtPositions.length; i++) {
      skirtPositionsFlat[i * 3 + 0] = geo.skirtPositions[i][0];
      skirtPositionsFlat[i * 3 + 1] = geo.skirtPositions[i][1];
      skirtPositionsFlat[i * 3 + 2] = geo.skirtPositions[i][2];

      skirtColorsFlat[i * 3 + 0] = geo.skirtColors[i][0];
      skirtColorsFlat[i * 3 + 1] = geo.skirtColors[i][1];
      skirtColorsFlat[i * 3 + 2] = geo.skirtColors[i][2];
    }

    const skirtIndicesFlat: number[] = [];
    for (let i = 0; i < geo.skirtIndices.length; i++) {
      skirtIndicesFlat.push(geo.skirtIndices[i][0], geo.skirtIndices[i][1], geo.skirtIndices[i][2]);
    }

    const skirtGeo = new THREE.BufferGeometry();
    skirtGeo.setAttribute('position', new THREE.BufferAttribute(skirtPositionsFlat, 3));
    skirtGeo.setAttribute('color', new THREE.BufferAttribute(skirtColorsFlat, 3));
    skirtGeo.setIndex(skirtIndicesFlat);
    skirtGeo.computeVertexNormals();

    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.name = 'Geological_Skirt';
    scene.add(skirtMesh);
  }

  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          downloadFile(blob, filename, 'model/gltf-binary');
          resolve(filename);
        } else {
          const output = JSON.stringify(result, null, 2);
          const blob = new Blob([output], { type: 'application/json' });
          downloadFile(blob, filename.replace('.glb', '.gltf'), 'application/json');
          resolve(filename);
        }
      },
      (error) => {
        console.error('GLTF export error:', error);
        reject(error);
      },
      { binary: true }
    );
  });
}

/**
 * 3. Export Binary STL (.stl) for 3D Printing / CNC Milling / CAD with relief + solid base.
 */
export function exportViewedSTL(opts: Export3DViewOptions): string {
  const geo = buildViewedGeometryData(opts);
  const prefix = (opts.projectName || 'Grihayan_Survey').replace(/[\s-]+/g, '_');
  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `${prefix}_3D_Print_Surface_${opts.verticalExaggeration}x_${opts.meshDensity}_${timeStr}.stl`;

  // Aggregate all triangles (Surface + Skirt)
  const triangles: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [];

  // 1. Surface Triangles
  for (let i = 0; i < geo.surfaceIndices.length; i += 3) {
    const p1 = geo.surfacePositions[geo.surfaceIndices[i]] as [number, number, number];
    const p2 = geo.surfacePositions[geo.surfaceIndices[i + 1]] as [number, number, number];
    const p3 = geo.surfacePositions[geo.surfaceIndices[i + 2]] as [number, number, number];
    triangles.push([p1, p2, p3]);
  }

  // 2. Skirt Triangles
  for (let i = 0; i < geo.skirtIndices.length; i++) {
    const [i1, i2, i3] = geo.skirtIndices[i];
    const p1 = geo.skirtPositions[i1] as [number, number, number];
    const p2 = geo.skirtPositions[i2] as [number, number, number];
    const p3 = geo.skirtPositions[i3] as [number, number, number];
    triangles.push([p1, p2, p3]);
  }

  const numTriangles = triangles.length;
  // Binary STL: 80 bytes header + 4 bytes numTriangles + 50 bytes per triangle
  const bufferSize = 84 + numTriangles * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // 80-byte header
  const headerStr = `GRIHAYAN 3D SURFACE ANALYZER STL - Exaggeration: ${opts.verticalExaggeration}x`;
  for (let i = 0; i < Math.min(80, headerStr.length); i++) {
    view.setUint8(i, headerStr.charCodeAt(i));
  }

  // Number of triangles (little-endian uint32 at offset 80)
  view.setUint32(80, numTriangles, true);

  let offset = 84;
  for (let t = 0; t < numTriangles; t++) {
    const [v1, v2, v3] = triangles[t];

    // Compute Face Normal: (v2 - v1) x (v3 - v1)
    const ax = v2[0] - v1[0];
    const ay = v2[1] - v1[1];
    const az = v2[2] - v1[2];

    const bx = v3[0] - v1[0];
    const by = v3[1] - v1[1];
    const bz = v3[2] - v1[2];

    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;

    const len = Math.hypot(nx, ny, nz);
    if (len > 0) {
      nx /= len;
      ny /= len;
      nz /= len;
    } else {
      nx = 0;
      ny = 0;
      nz = 1;
    }

    // Normal (float32 x 3)
    view.setFloat32(offset + 0, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);

    // Vertex 1 (float32 x 3)
    view.setFloat32(offset + 12, v1[0], true);
    view.setFloat32(offset + 16, v1[1], true);
    view.setFloat32(offset + 20, v1[2], true);

    // Vertex 2 (float32 x 3)
    view.setFloat32(offset + 24, v2[0], true);
    view.setFloat32(offset + 28, v2[1], true);
    view.setFloat32(offset + 32, v2[2], true);

    // Vertex 3 (float32 x 3)
    view.setFloat32(offset + 36, v3[0], true);
    view.setFloat32(offset + 40, v3[1], true);
    view.setFloat32(offset + 44, v3[2], true);

    // Attribute byte count (uint16 = 0)
    view.setUint16(offset + 48, 0, true);

    offset += 50;
  }

  const blob = new Blob([buffer], { type: 'model/stl' });
  downloadFile(blob, filename, 'model/stl');
  return filename;
}

/**
 * 4. Export AutoCAD DXF 3D Mesh (3DFACE entities) with true elevation relief and TrueColor shading.
 */
export function exportViewedDXF3DFace(opts: Export3DViewOptions): string {
  const geo = buildViewedGeometryData(opts);
  const prefix = (opts.projectName || 'Grihayan_Survey').replace(/[\s-]+/g, '_');
  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `${prefix}_3D_Surface_AutoCAD_3DFACE_${opts.verticalExaggeration}x_${timeStr}.dxf`;

  const lines: string[] = [];
  // DXF Header
  lines.push('0\nSECTION\n2\nHEADER');
  lines.push('9\n$ACADVER\n1\nAC1024'); // AutoCAD 2010/2018
  lines.push('9\n$INSUNITS\n70\n6'); // Meters
  lines.push('0\nENDSEC');

  // DXF Tables
  lines.push('0\nSECTION\n2\nTABLES');
  lines.push('0\nTABLE\n2\nLAYER\n70\n2');
  lines.push('0\nLAYER\n2\nTIN_SURFACE_3DFACE\n70\n0\n62\n7\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nGEOLOGICAL_SKIRT_3DFACE\n70\n0\n62\n8\n6\nCONTINUOUS');
  lines.push('0\nENDTAB\n0\nENDSEC');

  // DXF Entities
  lines.push('0\nSECTION\n2\nENTITIES');

  // 1. Surface 3DFACE Entities
  for (let i = 0; i < geo.surfaceIndices.length; i += 3) {
    const idx1 = geo.surfaceIndices[i];
    const idx2 = geo.surfaceIndices[i + 1];
    const idx3 = geo.surfaceIndices[i + 2];

    const p1 = geo.surfacePositions[idx1];
    const p2 = geo.surfacePositions[idx2];
    const p3 = geo.surfacePositions[idx3];

    // Compute average face color for AutoCAD 24-bit TrueColor (code 420)
    const c1 = geo.surfaceColors[idx1];
    const c2 = geo.surfaceColors[idx2];
    const c3 = geo.surfaceColors[idx3];
    const r = Math.round(((c1[0] + c2[0] + c3[0]) / 3) * 255);
    const g = Math.round(((c1[1] + c2[1] + c3[1]) / 3) * 255);
    const b = Math.round(((c1[2] + c2[2] + c3[2]) / 3) * 255);
    const trueColor = (r << 16) | (g << 8) | b;

    lines.push('0\n3DFACE');
    lines.push('8\nTIN_SURFACE_3DFACE');
    lines.push(`420\n${trueColor}`);
    // Point 1
    lines.push(`10\n${p1[0].toFixed(4)}\n20\n${p1[1].toFixed(4)}\n30\n${p1[2].toFixed(4)}`);
    // Point 2
    lines.push(`11\n${p2[0].toFixed(4)}\n21\n${p2[1].toFixed(4)}\n31\n${p2[2].toFixed(4)}`);
    // Point 3
    lines.push(`12\n${p3[0].toFixed(4)}\n22\n${p3[1].toFixed(4)}\n32\n${p3[2].toFixed(4)}`);
    // Point 4 (duplicate point 3 for triangles)
    lines.push(`13\n${p3[0].toFixed(4)}\n23\n${p3[1].toFixed(4)}\n33\n${p3[2].toFixed(4)}`);
  }

  // 2. Skirt 3DFACE Entities
  for (let i = 0; i < geo.skirtIndices.length; i++) {
    const [i1, i2, i3] = geo.skirtIndices[i];
    const p1 = geo.skirtPositions[i1];
    const p2 = geo.skirtPositions[i2];
    const p3 = geo.skirtPositions[i3];

    lines.push('0\n3DFACE');
    lines.push('8\nGEOLOGICAL_SKIRT_3DFACE');
    lines.push('62\n8'); // Dark Gray ACI
    lines.push(`10\n${p1[0].toFixed(4)}\n20\n${p1[1].toFixed(4)}\n30\n${p1[2].toFixed(4)}`);
    lines.push(`11\n${p2[0].toFixed(4)}\n21\n${p2[1].toFixed(4)}\n31\n${p2[2].toFixed(4)}`);
    lines.push(`12\n${p3[0].toFixed(4)}\n22\n${p3[1].toFixed(4)}\n32\n${p3[2].toFixed(4)}`);
    lines.push(`13\n${p3[0].toFixed(4)}\n23\n${p3[1].toFixed(4)}\n33\n${p3[2].toFixed(4)}`);
  }

  lines.push('0\nENDSEC\n0\nEOF');

  const dxfContent = lines.join('\n');
  downloadFile(dxfContent, filename, 'application/dxf');
  return filename;
}

/**
 * 5. Export Stanford Polygon PLY (.ply) format with vertex XYZ + RGB colors.
 */
export function exportViewedPLY(opts: Export3DViewOptions): string {
  const geo = buildViewedGeometryData(opts);
  const prefix = (opts.projectName || 'Grihayan_Survey').replace(/[\s-]+/g, '_');
  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `${prefix}_3D_Surface_View_${opts.verticalExaggeration}x_${timeStr}.ply`;

  const allPositions = [...geo.surfacePositions, ...geo.skirtPositions];
  const allColors = [...geo.surfaceColors, ...geo.skirtColors];
  const numVertices = allPositions.length;

  const surfTriCount = geo.surfaceIndices.length / 3;
  const skirtTriCount = geo.skirtIndices.length;
  const numFaces = surfTriCount + skirtTriCount;

  const lines: string[] = [];
  lines.push('ply');
  lines.push('format ascii 1.0');
  lines.push(`comment Created by GRIHAYAN 3D SURFACE ANALYZER`);
  lines.push(`comment Exaggeration: ${opts.verticalExaggeration}x, Mesh: ${opts.meshDensity}`);
  lines.push(`element vertex ${numVertices}`);
  lines.push('property float x');
  lines.push('property float y');
  lines.push('property float z');
  lines.push('property uchar red');
  lines.push('property uchar green');
  lines.push('property uchar blue');
  lines.push(`element face ${numFaces}`);
  lines.push('property list uchar int vertex_indices');
  lines.push('end_header');

  // Vertices
  for (let i = 0; i < numVertices; i++) {
    const [x, y, z] = allPositions[i];
    const [r, g, b] = allColors[i];
    const ir = Math.round(r * 255);
    const ig = Math.round(g * 255);
    const ib = Math.round(b * 255);
    lines.push(`${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)} ${ir} ${ig} ${ib}`);
  }

  // Surface Faces
  for (let i = 0; i < geo.surfaceIndices.length; i += 3) {
    const i1 = geo.surfaceIndices[i];
    const i2 = geo.surfaceIndices[i + 1];
    const i3 = geo.surfaceIndices[i + 2];
    lines.push(`3 ${i1} ${i2} ${i3}`);
  }

  // Skirt Faces
  const offset = geo.surfacePositions.length;
  for (let i = 0; i < geo.skirtIndices.length; i++) {
    const [i1, i2, i3] = geo.skirtIndices[i];
    lines.push(`3 ${i1 + offset} ${i2 + offset} ${i3 + offset}`);
  }

  const plyContent = lines.join('\n');
  downloadFile(plyContent, filename, 'text/plain');
  return filename;
}
