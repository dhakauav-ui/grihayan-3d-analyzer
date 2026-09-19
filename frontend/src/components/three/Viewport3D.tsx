import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ValidationSummary } from '../../types/survey';
import { formatNumber } from '../../utils/formatters';
import { RotateCw, Play, Pause, Sparkles, Camera, Check, Download, Box } from 'lucide-react';
import { Export3DModal } from '../preview/Export3DModal';

interface Viewport3DProps {
  projectName?: string;
  summary: ValidationSummary | null;
  tinData?: any | null;
  contoursData?: any | null;
  verticalExaggeration: number;
  surfaceStyle: string;
  colorMap: string;
  meshDensity?: 'classic' | 'full' | 'sparse';
  onChangeMeshDensity?: (val: 'classic' | 'full' | 'sparse') => void;
  pointSize: number;
  opacity: number;
  hillshadeEnabled?: boolean;
  hillshadeAzimuth?: number;
  hillshadeAltitude?: number;
  showSkirt?: boolean;
  onToggleSkirt?: (val: boolean) => void;
  smoothShading?: boolean;
  onToggleSmoothShading?: (val: boolean) => void;
  inspectorEnabled?: boolean;
  onToggleInspector?: (val: boolean) => void;
  showAxes?: boolean;
  onToggleAxes?: (val: boolean) => void;
  layers: {
    surface: boolean;
    points: boolean;
    pointLabels: boolean;
    wireframe: boolean;
    contour: boolean;
    contourLabels: boolean;
    hillshade: boolean;
  };
  onToggleLayer?: (layer: keyof Viewport3DProps['layers']) => void;
  onCursorMove?: (coord: { x: number; y: number; z: number } | null) => void;
  onSelectPoint?: (point: any) => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  projectName = 'Survey_Project',
  summary,
  tinData,
  contoursData,
  verticalExaggeration,
  surfaceStyle,
  colorMap,
  meshDensity = 'classic',
  onChangeMeshDensity,
  pointSize,
  opacity,
  hillshadeEnabled = true,
  hillshadeAzimuth = 315,
  hillshadeAltitude = 45,
  showSkirt = false,
  onToggleSkirt,
  smoothShading = false,
  onToggleSmoothShading,
  inspectorEnabled = true,
  onToggleInspector,
  showAxes = false,
  onToggleAxes,
  layers,
  onToggleLayer,
  onCursorMove,
  onSelectPoint,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const terrainGroupRef = useRef<THREE.Group | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);

  const [activeTool, setActiveTool] = useState<'select' | 'rotate' | 'pan'>('select');
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const [rotationSpeed, setRotationSpeed] = useState<number>(2.0);
  const [snapshotTaken, setSnapshotTaken] = useState<boolean>(false);
  const [isExport3DOpen, setIsExport3DOpen] = useState<boolean>(false);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    z: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Sync Auto-Rotation with OrbitControls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotating;
      controlsRef.current.autoRotateSpeed = rotationSpeed;
    }
  }, [isAutoRotating, rotationSpeed]);

  // Sync Axes Helper Visibility with showAxes prop
  useEffect(() => {
    if (axesHelperRef.current) {
      axesHelperRef.current.visible = !!showAxes;
    }
  }, [showAxes]);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
    camera.position.set(0, -500, 350);
    camera.up.set(0, 0, 1); // Z is Up for GIS
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance' 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.15);
    sunLight.position.set(-400, -400, 600);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.3);
    fillLight.position.set(400, 400, -200);
    scene.add(fillLight);

    // Helpers: Soft, subtle ground reference grid (subdued dark slate)
    const gridHelper = new THREE.GridHelper(1000, 20, 0x1e293b, 0x0f172a);
    gridHelper.rotation.x = Math.PI / 2;
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.25;
    }
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    const axesHelper = new THREE.AxesHelper(100);
    axesHelper.visible = !!showAxes;
    scene.add(axesHelper);
    axesHelperRef.current = axesHelper;

    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);
    terrainGroupRef.current = terrainGroup;

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Dynamic Solar Hillshade Lighting
  useEffect(() => {
    if (!sunLightRef.current || !ambientLightRef.current) return;
    const isHillshadeOn = layers.hillshade && hillshadeEnabled;

    if (isHillshadeOn) {
      const azRad = THREE.MathUtils.degToRad(360 - hillshadeAzimuth + 90);
      const altRad = THREE.MathUtils.degToRad(hillshadeAltitude);
      const dist = 1000;

      const lx = dist * Math.cos(altRad) * Math.cos(azRad);
      const ly = dist * Math.cos(altRad) * Math.sin(azRad);
      const lz = dist * Math.sin(altRad);

      sunLightRef.current.position.set(lx, ly, lz);
      sunLightRef.current.intensity = 1.35;
      ambientLightRef.current.intensity = 0.45;
    } else {
      sunLightRef.current.position.set(0, 0, 1000);
      sunLightRef.current.intensity = 0.5;
      ambientLightRef.current.intensity = 1.05;
    }
  }, [layers.hillshade, hillshadeEnabled, hillshadeAzimuth, hillshadeAltitude]);

  // High-Resolution Compact Billboard Text Sprite for Point Labels
  const createTextSprite = (pointId: string, rl: number, scaleSize: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.roundRect(2, 2, 156, 44, 6);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 13px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PT: ${pointId}`, 80, 20);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 12px JetBrains Mono, monospace';
      ctx.fillText(`RL: ${rl.toFixed(2)}m`, 80, 38);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ 
      map: texture, 
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scaleSize * 1.6, scaleSize * 0.5, 1);
    return sprite;
  };

  // High-Resolution Snug Contour Line Elevation Text Badge
  const createContourTextSprite = (rl: number, scaleSize: number) => {
    const text = `${rl.toFixed(1)}m`;
    const font = 'bold 20px JetBrains Mono, monospace';

    // Measure text width using an offscreen canvas to make the box perfectly snug
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (measureCtx) {
      measureCtx.font = font;
    }
    const textWidth = measureCtx ? measureCtx.measureText(text).width : 60;

    const padX = 8; // Minimal snug left-right padding
    const canvasWidth = Math.ceil(textWidth + padX * 2);
    const canvasHeight = 30;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.roundRect(1.5, 1.5, canvasWidth - 3, canvasHeight - 3, 5);
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ 
      map: texture, 
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    const aspect = canvasWidth / canvasHeight;
    const heightScale = scaleSize * 0.32;
    sprite.scale.set(heightScale * aspect, heightScale, 1);
    return sprite;
  };

  // Multi-stop linear color interpolator for GIS precision
  const interpolateColorStops = (
    t: number,
    stops: Array<{ pos: number; r: number; g: number; b: number }>
  ): THREE.Color => {
    const clampedT = Math.max(0, Math.min(1, t));
    if (clampedT <= stops[0].pos) {
      return new THREE.Color(stops[0].r, stops[0].g, stops[0].b);
    }
    if (clampedT >= stops[stops.length - 1].pos) {
      const last = stops[stops.length - 1];
      return new THREE.Color(last.r, last.g, last.b);
    }
    for (let i = 0; i < stops.length - 1; i++) {
      const s0 = stops[i];
      const s1 = stops[i + 1];
      if (clampedT >= s0.pos && clampedT <= s1.pos) {
        const factor = (clampedT - s0.pos) / (s1.pos - s0.pos || 1);
        const r = s0.r + factor * (s1.r - s0.r);
        const g = s0.g + factor * (s1.g - s0.g);
        const b = s0.b + factor * (s1.b - s0.b);
        return new THREE.Color(r, g, b);
      }
    }
    return new THREE.Color(0.5, 0.5, 0.5);
  };

  // Color Mapping Helper
  const getColorForElevation = (z: number, minZ: number, maxZ: number, style: string, mapType: string) => {
    if (style === 'monochrome') return new THREE.Color(0x94a3b8);

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
  };

  // Build authoritative 3D TIN Mesh, Geological Skirt, Wireframe, Points, Contours & Point Labels
  useEffect(() => {
    if (!terrainGroupRef.current) return;
    const group = terrainGroupRef.current;
    group.clear();
    meshRef.current = null;

    if (tinData && tinData.geometry) {
      const { vertices, indices, raw_elevations, boundary_indices } = tinData.geometry;
      const { min_x, max_x, min_y, max_y, min_z, max_z } = tinData.bounds;
      const { center } = tinData;
      const numVerts = raw_elevations.length;
      const span = Math.max(max_x - min_x, max_y - min_y);
      const datumBaseZ = (min_z - center.z - (max_z - min_z) * 0.15 - 5) * verticalExaggeration;

      if (gridHelperRef.current) {
        gridHelperRef.current.position.set(0, 0, datumBaseZ);
      }

      // Build positions with dynamic vertical exaggeration
      const positions = new Float32Array(numVerts * 3);
      const colors = new Float32Array(numVerts * 3);

      for (let i = 0; i < numVerts; i++) {
        const vx = vertices[i * 3 + 0];
        const vy = vertices[i * 3 + 1];
        const vz_local = vertices[i * 3 + 2];
        const raw_rl = raw_elevations[i];

        positions[i * 3 + 0] = vx;
        positions[i * 3 + 1] = vy;
        positions[i * 3 + 2] = vz_local * verticalExaggeration;

        const c = getColorForElevation(raw_rl, min_z, max_z, surfaceStyle, colorMap);
        colors[i * 3 + 0] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      // Compute display indices according to meshDensity
      let displayIndices = indices;
      if (meshDensity === 'classic') {
        // Classic non-full open survey look (step = 2)
        const classicArr: number[] = [];
        for (let i = 0; i < indices.length; i += 6) {
          classicArr.push(indices[i], indices[i + 1], indices[i + 2]);
        }
        displayIndices = classicArr;
      } else if (meshDensity === 'sparse') {
        const sparseArr: number[] = [];
        for (let i = 0; i < indices.length; i += 12) {
          sparseArr.push(indices[i], indices[i + 1], indices[i + 2]);
        }
        displayIndices = sparseArr;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setIndex(displayIndices);

      if (smoothShading) {
        geometry.computeVertexNormals();
      }

      const isHillshadeActive = layers.hillshade && hillshadeEnabled;

      // 1. Solid Surface Mesh
      if (layers.surface) {
        const material = new THREE.MeshStandardMaterial({
          vertexColors: surfaceStyle !== 'monochrome',
          color: surfaceStyle === 'monochrome' ? 0x94a3b8 : 0xffffff,
          transparent: opacity < 1.0,
          opacity: opacity,
          roughness: isHillshadeActive ? 0.85 : 0.45,
          metalness: isHillshadeActive ? 0.05 : 0.0,
          flatShading: !smoothShading,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        meshRef.current = mesh;
      }

      // 2. 3D Geological Skirt / Solid Terrain Block Base
      if (showSkirt && boundary_indices && boundary_indices.length > 2 && layers.surface) {
        const skirtGroup = new THREE.Group();
        const skirtPositions: number[] = [];
        const skirtIndices: number[] = [];
        const numB = boundary_indices.length;

        for (let i = 0; i < numB; i++) {
          const idx = boundary_indices[i];
          const topX = positions[idx * 3 + 0];
          const topY = positions[idx * 3 + 1];
          const topZ = positions[idx * 3 + 2];

          skirtPositions.push(topX, topY, topZ);
          skirtPositions.push(topX, topY, datumBaseZ);
        }

        for (let i = 0; i < numB; i++) {
          const next = (i + 1) % numB;
          const topA = i * 2;
          const botA = i * 2 + 1;
          const topB = next * 2;
          const botB = next * 2 + 1;

          skirtIndices.push(topA, botA, topB);
          skirtIndices.push(topB, botA, botB);
        }

        const skirtGeo = new THREE.BufferGeometry();
        skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPositions, 3));
        skirtGeo.setIndex(skirtIndices);
        skirtGeo.computeVertexNormals();

        const skirtMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.9,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });

        const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
        skirtGroup.add(skirtMesh);

        const baseLinePts: THREE.Vector3[] = [];
        for (let i = 0; i <= numB; i++) {
          const idx = boundary_indices[i % numB];
          const bx = positions[idx * 3 + 0];
          const by = positions[idx * 3 + 1];
          baseLinePts.push(new THREE.Vector3(bx, by, datumBaseZ));
        }
        const baseLineGeo = new THREE.BufferGeometry().setFromPoints(baseLinePts);
        const baseLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
        skirtGroup.add(new THREE.Line(baseLineGeo, baseLineMat));

        group.add(skirtGroup);
      }

      // 3. Wireframe (TIN) Triangular Grid Layer (Exact Delaunay Survey Geometry)
      if (layers.wireframe || surfaceStyle === 'wireframe') {
        const wireGeo = new THREE.WireframeGeometry(geometry);
        const isOverlay = layers.surface && surfaceStyle !== 'wireframe';
        const wireMat = new THREE.LineBasicMaterial({
          color: isOverlay ? 0x0f172a : 0x0284c7, // Soft dark hairline overlay or clean subdued architectural cyan
          transparent: true,
          opacity: isOverlay ? 0.28 : 0.50,      // Calibrated soft opacity to prevent harsh highlight glare
          linewidth: 1,
          depthTest: true,
        });
        const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
        group.add(wireMesh);
      }

      // 4. Survey Points Cloud Layer
      if (layers.points) {
        const pointGeo = new THREE.BufferGeometry();
        pointGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pointGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const pointMat = new THREE.PointsMaterial({
          size: pointSize * 2.0,
          vertexColors: true,
          sizeAttenuation: true,
        });
        const pointCloud = new THREE.Points(pointGeo, pointMat);
        group.add(pointCloud);
      }

      // 5. Point Labels Layer (Distinct Micro 3D Badges)
      if (layers.pointLabels) {
        const labelsGroup = new THREE.Group();
        const ptsToLabel = (tinData.sample_points && tinData.sample_points.length > 0)
          ? tinData.sample_points.slice(0, 60)
          : [];

        const labelScale = Math.max(span * 0.014, 5.0);

        ptsToLabel.forEach((pt: any) => {
          const lx = pt.x - center.x;
          const ly = pt.y - center.y;
          const lz = ((pt.rl - center.z) * verticalExaggeration) + (labelScale * 0.4);

          const sprite = createTextSprite(String(pt.point_id), pt.rl, labelScale);
          sprite.position.set(lx, ly, lz);
          labelsGroup.add(sprite);
        });

        group.add(labelsGroup);
      }

      // 6. 3D Vector Contours & Contour Elevation (RL) Labels Overlay
      if (contoursData && (layers.contour || layers.contourLabels)) {
        const contourGroup = new THREE.Group();
        const contourLabelsGroup = new THREE.Group();
        const majorMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2.5 });
        const minorMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 });

        // Micro scale for contour elevation badges
        const contourLabelScale = Math.max(span * 0.0035, 1.4);

        const processContourLines = (lines: any[], isMajor: boolean) => {
          lines.forEach((line) => {
            if (!line.points || line.points.length < 2) return;
            const pts: THREE.Vector3[] = [];
            line.points.forEach((p: number[]) => {
              const lx = p[0] - center.x;
              const ly = p[1] - center.y;
              const lz = ((p[2] - center.z) * verticalExaggeration) + 0.25;
              pts.push(new THREE.Vector3(lx, ly, lz));
            });

            // 6a. Render Contour Polylines if layer is ON
            if (layers.contour) {
              const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
              const lineMesh = new THREE.Line(lineGeo, isMajor ? majorMat : minorMat);
              contourGroup.add(lineMesh);
            }

            // 6b. Render Micro Contour Elevation RL Labels if layer is ON
            if (layers.contourLabels && line.points.length >= 4) {
              // Pick sample stations along the polyline (1 label per line, or 2 for long major lines)
              const sampleIndices = isMajor && pts.length > 20
                ? [Math.floor(pts.length * 0.35), Math.floor(pts.length * 0.70)]
                : [Math.floor(pts.length * 0.5)];

              sampleIndices.forEach(idx => {
                const pt = pts[idx];
                const sprite = createContourTextSprite(line.elevation, contourLabelScale);
                sprite.position.set(pt.x, pt.y, pt.z + contourLabelScale * 0.15);
                contourLabelsGroup.add(sprite);

                // Micro subtle node dot on the line
                const nodeGeo = new THREE.SphereGeometry(contourLabelScale * 0.03, 6, 6);
                const nodeMat = new THREE.MeshBasicMaterial({ color: isMajor ? 0xc084fc : 0x38bdf8 });
                const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
                nodeMesh.position.set(pt.x, pt.y, pt.z);
                contourLabelsGroup.add(nodeMesh);
              });
            }
          });
        };

        if (contoursData.major_contours) processContourLines(contoursData.major_contours, true);
        if (contoursData.minor_contours) processContourLines(contoursData.minor_contours, false);

        if (layers.contour) group.add(contourGroup);
        if (layers.contourLabels) group.add(contourLabelsGroup);
      }
    }
  }, [
    tinData, 
    contoursData, 
    verticalExaggeration, 
    surfaceStyle, 
    colorMap, 
    meshDensity,
    opacity, 
    layers, 
    pointSize,
    hillshadeEnabled,
    hillshadeAzimuth,
    hillshadeAltitude,
    showSkirt,
    smoothShading
  ]);

  // Viewport Toolbar Actions
  const handleZoomIn = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.multiplyScalar(0.8);
    controlsRef.current.update();
  };

  const handleZoomOut = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.multiplyScalar(1.25);
    controlsRef.current.update();
  };

  const handleFitExtents = () => {
    if (!cameraRef.current || !controlsRef.current || !tinData) return;
    const { min_x, max_x, min_y, max_y } = tinData.bounds;
    const span = Math.max(max_x - min_x, max_y - min_y);
    const dist = Math.max(span * 1.3, 100);
    cameraRef.current.position.set(0, -dist, dist * 0.7);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const handleSetClassicView = () => {
    if (onChangeMeshDensity) onChangeMeshDensity('classic');
    if (onToggleSkirt) onToggleSkirt(false);
    if (onToggleSmoothShading) onToggleSmoothShading(false);
  };

  // Mouse Raycasting Inspection & Point Picking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !meshRef.current || !cameraRef.current || !tinData) return;
    
    // If inspector is disabled, hide tooltip and skip raycast
    if (!inspectorEnabled) {
      if (hoverInfo) setHoverInfo(null);
      return;
    }

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    mouseRef.current.set(x, y);
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const intersects = raycasterRef.current.intersectObject(meshRef.current);
    if (intersects.length > 0) {
      const hit = intersects[0].point;
      const { center } = tinData;

      const realX = hit.x + center.x;
      const realY = hit.y + center.y;
      const realZ = (hit.z / verticalExaggeration) + center.z;

      setHoverInfo({
        x: realX,
        y: realY,
        z: realZ,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      });

      if (onCursorMove) {
        onCursorMove({ x: realX, y: realY, z: realZ });
      }
    } else {
      setHoverInfo(null);
      if (onCursorMove) onCursorMove(null);
    }
  };

  const handleClick = () => {
    if (hoverInfo && onSelectPoint) {
      onSelectPoint({
        point_id: 'Picked_Surface',
        x: hoverInfo.x,
        y: hoverInfo.y,
        rl: hoverInfo.z,
        code: 'SURFACE'
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
    if (onCursorMove) onCursorMove(null);
  };

  // High-Resolution 3D Viewport Snapshot / Screenshot Capture with embedded Elevation (RL) Legend
  const handleCaptureSnapshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    
    // Explicitly re-render immediately before capturing
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    
    const webglCanvas = rendererRef.current.domElement;
    const w = webglCanvas.width;
    const h = webglCanvas.height;

    // Create 2D offscreen canvas to compose WebGL 3D Model + Elevation (RL) Legend Card
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = w;
    compositeCanvas.height = h;
    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw 3D WebGL render
    ctx.drawImage(webglCanvas, 0, 0, w, h);

    // 2. Draw Elevation (RL) Legend Card if survey bounds exist
    if (summary?.bounds) {
      const minZ = summary.bounds.min_z;
      const maxZ = summary.bounds.max_z;
      const rangeZ = Math.max(0.001, maxZ - minZ);

      // Dynamic scale factor for crisp rendering across all screen resolutions
      const scale = Math.max(1, w / 1280);
      const cardW = 165 * scale;
      const cardH = 150 * scale;
      const cardX = 24 * scale;
      const cardY = h - cardH - 24 * scale;
      const pad = 12 * scale;

      ctx.save();

      // Card Background Box (Dark Slate translucent rounded box)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
      ctx.lineWidth = 1.5 * scale;
      
      const r = 12 * scale;
      ctx.beginPath();
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + cardW - r, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
      ctx.lineTo(cardX + cardW, cardY + cardH - r);
      ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
      ctx.lineTo(cardX + r, cardY + cardH);
      ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
      ctx.lineTo(cardX, cardY + r);
      ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Header: ELEVATION (RL)   METER
      ctx.font = `bold ${10 * scale}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = '#94a3b8'; // Slate 400
      ctx.fillText('ELEVATION (RL)', cardX + pad, cardY + pad + 8 * scale);

      ctx.font = `bold ${9 * scale}px monospace`;
      ctx.fillStyle = '#60a5fa'; // Blue 400
      ctx.fillText('METER', cardX + cardW - pad - (40 * scale), cardY + pad + 8 * scale);

      // Vertical Color Bar
      const barX = cardX + pad;
      const barY = cardY + pad + 18 * scale;
      const barW = 14 * scale;
      const barH = 100 * scale;
      const barR = barW / 2;

      const grad = ctx.createLinearGradient(0, barY + barH, 0, barY);
      if (colorMap === 'viridis') {
        grad.addColorStop(0, '#440154');
        grad.addColorStop(0.25, '#3b528b');
        grad.addColorStop(0.5, '#21918c');
        grad.addColorStop(0.75, '#5ec962');
        grad.addColorStop(1, '#fde725');
      } else if (colorMap === 'terrain') {
        grad.addColorStop(0, '#15803d');
        grad.addColorStop(0.3, '#84cc16');
        grad.addColorStop(0.6, '#d97706');
        grad.addColorStop(0.85, '#78350f');
        grad.addColorStop(1, '#f8fafc');
      } else if (colorMap === 'grayscale') {
        grad.addColorStop(0, '#111827');
        grad.addColorStop(0.5, '#4b5563');
        grad.addColorStop(1, '#f9fafb');
      } else {
        // default elevation palette: Blue -> Green -> Yellow -> Orange -> Red
        grad.addColorStop(0, '#2563eb');
        grad.addColorStop(0.25, '#10b981');
        grad.addColorStop(0.5, '#eab308');
        grad.addColorStop(0.75, '#f97316');
        grad.addColorStop(1, '#ef4444');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(barX + barR, barY);
      ctx.lineTo(barX + barW - barR, barY);
      ctx.quadraticCurveTo(barX + barW, barY, barX + barW, barY + barR);
      ctx.lineTo(barX + barW, barY + barH - barR);
      ctx.quadraticCurveTo(barX + barW, barY + barH, barX + barW - barR, barY + barH);
      ctx.lineTo(barX + barR, barY + barH);
      ctx.quadraticCurveTo(barX, barY + barH, barX, barY + barH - barR);
      ctx.lineTo(barX, barY + barR);
      ctx.quadraticCurveTo(barX, barY, barX + barR, barY);
      ctx.closePath();
      ctx.fill();

      // Elevation Text Labels next to color bar
      const textX = barX + barW + (10 * scale);
      
      // Max RL (Red)
      ctx.font = `bold ${10 * scale}px monospace`;
      ctx.fillStyle = '#f87171'; // Red 400
      ctx.fillText('Max: ', textX, barY + 9 * scale);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(`${formatNumber(maxZ, 2)}m`, textX + (30 * scale), barY + 9 * scale);

      // Intermediate RL values (75%, 50%, 25%)
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${9.5 * scale}px monospace`;
      ctx.fillText(`${formatNumber(minZ + rangeZ * 0.75, 1)}m`, textX, barY + barH * 0.32);
      ctx.fillText(`${formatNumber(minZ + rangeZ * 0.50, 1)}m`, textX, barY + barH * 0.55);
      ctx.fillText(`${formatNumber(minZ + rangeZ * 0.25, 1)}m`, textX, barY + barH * 0.78);

      // Min RL (Blue)
      ctx.font = `bold ${10 * scale}px monospace`;
      ctx.fillStyle = '#60a5fa'; // Blue 400
      ctx.fillText('Min: ', textX, barY + barH);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(`${formatNumber(minZ, 2)}m`, textX + (28 * scale), barY + barH);

      // Subtle Brand Watermark in Bottom-Right
      const brandScale = Math.max(1, w / 1400);
      ctx.font = `bold ${11 * brandScale}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.textAlign = 'right';
      ctx.fillText('GRIHAYAN 3D SURFACE ANALYZER', w - (24 * brandScale), h - (20 * brandScale));

      ctx.restore();
    }

    const dataUrl = compositeCanvas.toDataURL('image/png', 1.0);
    const now = new Date();
    const timeStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const fileName = `Grihayan_3D_Surface_View_${timeStr}.png`;
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Brief visual confirmation
    setSnapshotTaken(true);
    setTimeout(() => setSnapshotTaken(false), 2000);
  };

  return (
    <div 
      className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Inspection Tooltip Box (Visible only when inspectorEnabled is true) */}
      {inspectorEnabled && hoverInfo && (
        <div
          className="absolute z-20 pointer-events-none bg-slate-900/95 border border-blue-500/60 rounded-lg p-2.5 shadow-2xl backdrop-blur-sm text-[11px] font-mono text-slate-200 transition-transform duration-75"
          style={{
            left: `${hoverInfo.screenX + 15}px`,
            top: `${hoverInfo.screenY + 15}px`,
          }}
        >
          <div className="flex items-center space-x-1.5 text-blue-400 font-bold mb-1 border-b border-slate-800 pb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>Terrain Inspector</span>
          </div>
          <div className="space-y-0.5">
            <div><span className="text-slate-500 font-sans">Easting (X):</span> {formatNumber(hoverInfo.x, 3)}</div>
            <div><span className="text-slate-500 font-sans">Northing (Y):</span> {formatNumber(hoverInfo.y, 3)}</div>
            <div><span className="text-slate-500 font-sans">Elevation (RL):</span> <span className="text-emerald-400 font-bold">{formatNumber(hoverInfo.z, 3)} m</span></div>
          </div>
        </div>
      )}

      {/* Floating Interactive 3D Toolbar */}
      <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-800 rounded-lg p-1 flex items-center space-x-1.5 shadow-lg backdrop-blur-sm z-10">
        <button 
          onClick={() => setActiveTool('select')}
          className={`p-1.5 rounded transition ${activeTool === 'select' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`} 
          title="Pointer / Inspect Mode"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 0l16 12.279-6.951 1.17 4.325 8.817-3.596 1.734-4.35-8.879-5.428 5.428z"/>
          </svg>
        </button>

        {/* Terrain Inspector HUD Toggle Button */}
        <button
          onClick={() => onToggleInspector && onToggleInspector(!inspectorEnabled)}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center space-x-1 ${
            inspectorEnabled
              ? 'bg-amber-600 text-white shadow'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
          title="Toggle Floating Terrain Inspector HUD Tooltip On / Off"
        >
          <span>Inspector</span>
          <span className={`w-1.5 h-1.5 rounded-full ${inspectorEnabled ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
        </button>

        {/* Contour Elevation RL Toggle Button */}
        <button
          onClick={() => onToggleLayer && onToggleLayer('contourLabels')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center space-x-1 ${
            layers.contourLabels
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
          title="Toggle Contour Line Elevation (RL) Labels On / Off"
        >
          <span>Contour RL</span>
          <span className={`w-1.5 h-1.5 rounded-full ${layers.contourLabels ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
        </button>

        {/* 1-Click Classic Original Look Button */}
        <button
          onClick={handleSetClassicView}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
            meshDensity === 'classic' && !showSkirt && !smoothShading
              ? 'bg-blue-600 text-white shadow'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Switch to Classic Original Look (Non-full Survey Mesh)"
        >
          Classic Look
        </button>

        {/* Full Solid Mesh Toggle */}
        <button
          onClick={() => onChangeMeshDensity && onChangeMeshDensity(meshDensity === 'full' ? 'classic' : 'full')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
            meshDensity === 'full'
              ? 'bg-purple-600 text-white shadow'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
          title="Toggle Full Solid 100% Watertight Mesh"
        >
          Full Solid
        </button>

        {/* 3D Skirt Toggle */}
        <button 
          onClick={() => onToggleSkirt && onToggleSkirt(!showSkirt)}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
            showSkirt 
              ? 'bg-emerald-600 text-white shadow' 
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
          title="Click to toggle 3D Solid Geological Base Skirt"
        >
          3D Skirt
        </button>

        {/* Smooth vs Faceted Toggle */}
        <button 
          onClick={() => onToggleSmoothShading && onToggleSmoothShading(!smoothShading)}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
            smoothShading 
              ? 'bg-blue-600 text-white shadow' 
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
          title="Click to toggle Smooth DTM Normals vs Classic Facets"
        >
          {smoothShading ? 'Smooth' : 'Faceted'}
        </button>

        {/* 360° Auto Rotate Animation Toggle */}
        <button 
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition shadow-md ${
            isAutoRotating 
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white ring-2 ring-amber-400/60 shadow-orange-500/20' 
              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title={isAutoRotating ? 'Click to Pause 360° Auto-Rotation' : 'Click to Start 360° Continuous Orbit Animation'}
        >
          <RotateCw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin text-white' : 'text-amber-400'}`} />
          <span>{isAutoRotating ? 'Auto Orbiting' : '360° Auto Rotate'}</span>
        </button>

        {/* 📸 Download 3D Viewport Snapshot Button */}
        <button 
          onClick={handleCaptureSnapshot}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition shadow-md ${
            snapshotTaken 
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/60' 
              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95'
          }`}
          title="Download High-Resolution PNG Snapshot of Current 3D View"
        >
          {snapshotTaken ? (
            <Check className="w-3.5 h-3.5 text-white animate-bounce" />
          ) : (
            <Camera className="w-3.5 h-3.5 text-blue-400" />
          )}
          <span>{snapshotTaken ? 'Saved!' : 'Snapshot'}</span>
        </button>

        {/* 📥 Download 3D Surface Mesh (As Viewed) */}
        <button
          onClick={() => setIsExport3DOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-bold transition shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white ring-1 ring-blue-400/40 active:scale-95"
          title="Download 3D TIN Surface Mesh files (.OBJ, .GLB, .STL, .DXF, .PLY) matching current view settings"
        >
          <Download className="w-3.5 h-3.5 text-blue-200" />
          <span>Download 3D TIN</span>
        </button>

        <div className="h-4 w-px bg-slate-800" />

        <button 
          onClick={handleZoomIn}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition" 
          title="Zoom In"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button 
          onClick={handleZoomOut}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition" 
          title="Zoom Out"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button 
          onClick={handleFitExtents}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition" 
          title="Fit to Terrain Extents"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <polyline points="21 15 21 21 15 21"/>
            <polyline points="3 9 3 3 9 3"/>
          </svg>
        </button>
      </div>

      {/* Floating 3D Elevation Legend (RL) Card - Bottom Left */}
      {summary?.bounds && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-2xl backdrop-blur-md select-none flex flex-col space-y-1.5 min-w-[135px]">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Elevation (RL)</span>
            <span className="text-[9px] text-blue-400 font-mono">Meter</span>
          </div>
          <div className="flex items-center space-x-2.5">
            {/* Vertical Color Ramp */}
            <div 
              className="w-3.5 h-24 rounded-full shadow-inner"
              style={{
                background: colorMap === 'viridis'
                  ? 'linear-gradient(to top, #440154 0%, #3b528b 25%, #21918c 50%, #5ec962 75%, #fde725 100%)'
                  : colorMap === 'terrain'
                  ? 'linear-gradient(to top, #15803d 0%, #84cc16 30%, #d97706 60%, #78350f 85%, #f8fafc 100%)'
                  : colorMap === 'grayscale'
                  ? 'linear-gradient(to top, #111827 0%, #4b5563 50%, #f9fafb 100%)'
                  : 'linear-gradient(to top, #2563eb 0%, #10b981 25%, #eab308 50%, #f97316 75%, #ef4444 100%)'
              }}
            />
            {/* Elevation Labels */}
            <div className="flex flex-col justify-between h-24 text-[10px] font-mono text-slate-300">
              <span className="flex items-center space-x-1">
                <span className="text-red-400 font-bold">Max:</span>
                <span>{formatNumber(summary.bounds.max_z, 2)}m</span>
              </span>
              <span>{formatNumber(summary.bounds.min_z + (summary.bounds.max_z - summary.bounds.min_z) * 0.75, 1)}m</span>
              <span>{formatNumber(summary.bounds.min_z + (summary.bounds.max_z - summary.bounds.min_z) * 0.50, 1)}m</span>
              <span>{formatNumber(summary.bounds.min_z + (summary.bounds.max_z - summary.bounds.min_z) * 0.25, 1)}m</span>
              <span className="flex items-center space-x-1">
                <span className="text-blue-400 font-bold">Min:</span>
                <span>{formatNumber(summary.bounds.min_z, 2)}m</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3D As-Viewed Export Modal */}
      <Export3DModal
        isOpen={isExport3DOpen}
        onClose={() => setIsExport3DOpen(false)}
        tinData={tinData}
        projectName={projectName}
        verticalExaggeration={verticalExaggeration}
        surfaceStyle={surfaceStyle}
        colorMap={colorMap}
        meshDensity={meshDensity}
        showSkirt={showSkirt}
        onCaptureSnapshot={handleCaptureSnapshot}
      />

      {!summary && !tinData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-6 text-center select-none z-10">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-200 mb-1">
            GRIHAYAN 3D SURFACE ANALYZER
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-5">
            Professional Land Survey GIS & Interactive 3D Terrain Visualization.
            Upload an Excel, CSV, or TXT survey file to begin.
          </p>
        </div>
      )}
    </div>
  );
};
