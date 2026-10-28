import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Airbase,
  Aircraft,
  AirspaceZone,
  Crew,
  Mission,
  MissionAssignment,
  ThreatMarker,
  OperationalAlert,
} from '../types/ops';
import { DataMode, LiveAircraft, CivilConflict } from '../types/liveTraffic';
import {
  Plus,
  Minus,
  RotateCcw,
  Compass,
  Eye,
  Camera,
  Navigation2,
  ShieldAlert,
  Sliders,
  Maximize2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TacticalMap3DProps {
  bases: Airbase[];
  missions: Mission[];
  zones: AirspaceZone[];
  threats: ThreatMarker[];
  assignments: MissionAssignment[];
  aircraftList: Aircraft[];
  crews?: Crew[];
  alerts?: (string | OperationalAlert)[];
  selectedMissionId: string | null;
  onSelectMission: (id: string) => void;
  selectedAircraftId: string | null;
  onSelectAircraft: (id: string | null) => void;
  onOpenTelemetryDrawer: () => void;
  simProgress: number; // 0.0 to 1.0
  simTimeDisplay: string;
  filteredAircraft: Aircraft[];
  getSimulatedAircraftState: (ac: Aircraft) => {
    x: number;
    y: number;
    heading: number;
    status: string;
    statusLabel: string;
    altitudeFt: number;
    speedKts: number;
    mach: number;
    fuelPercent: number;
    missionProgress: number;
    eta: string;
  };
  // Live traffic additions
  dataMode?: DataMode;
  liveAircraft?: LiveAircraft[];
  selectedLiveAircraftId?: string | null;
  onSelectLiveAircraft?: (id: string | null) => void;
  civilConflicts?: CivilConflict[];
}

// Module-level reusable math objects for Zero-GC render loops (Three.js skill directive)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _screenPos = new THREE.Vector3();
const _box3 = new THREE.Box3();
const _center = new THREE.Vector3();

// Center coordinate mapping (matches 2D coordinate system)
const TACTICAL_CENTER_X = 330;
const TACTICAL_CENTER_Y = 275;
const MAP_SCALE = 1.0;

// Helper to create sharp procedural 2D canvas textures (Three.js skill directive: SRGBColorSpace)
function createTextTexture(text: string, color = '#E8ECF1', bgColor = 'rgba(22, 28, 36, 0.9)', borderColor = '#2A3340', fontSize = 24): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.font = `bold ${fontSize}px sans-serif`;
  const textMetrics = ctx.measureText(text);
  const paddingX = 18;
  const paddingY = 10;
  canvas.width = Math.ceil(textMetrics.width + paddingX * 2);
  canvas.height = fontSize + paddingY * 2;

  // Background box with border
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

  // Text
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export const TacticalMap3D: React.FC<TacticalMap3DProps> = ({
  bases,
  missions,
  zones,
  threats,
  assignments,
  aircraftList: _aircraftList,
  selectedMissionId,
  onSelectMission,
  selectedAircraftId,
  onSelectAircraft,
  onOpenTelemetryDrawer,
  simProgress,
  simTimeDisplay: _simTimeDisplay,
  filteredAircraft,
  getSimulatedAircraftState,
  dataMode = 'SIMULATED',
  liveAircraft = [],
  selectedLiveAircraftId = null,
  onSelectLiveAircraft,
  civilConflicts = [],
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Camera & Tracking states
  const [isFollowingSelected, setIsFollowingSelected] = useState<boolean>(false);
  const [labelFilter, setLabelFilter] = useState<'SELECTED' | 'ALERTS' | 'ALL'>('SELECTED');
  const [cameraAzimuth, setCameraAzimuth] = useState<number>(0);
  const [hoveredAircraftId, setHoveredAircraftId] = useState<string | null>(null);

  // Vertical Exaggeration (2x - 3x default, slider adjustable)
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(2.5);
  const [isControlsExpanded, setIsControlsExpanded] = useState<boolean>(true);

  // Altitude scaling function based on verticalExaggeration
  const BASE_MAX_ALT_UNITS = 30;
  const to3D = useCallback((x: number, y: number, altitudeFt = 0) => {
    const altUnits = (Math.max(0, altitudeFt) / 35000) * (BASE_MAX_ALT_UNITS * (verticalExaggeration / 2.5));
    return new THREE.Vector3(
      (x - TACTICAL_CENTER_X) * MAP_SCALE,
      altUnits,
      (y - TACTICAL_CENTER_Y) * MAP_SCALE
    );
  }, [verticalExaggeration]);

  // Screen projected label coordinates (Military, Civil, and Conflicts)
  const [screenLabels, setScreenLabels] = useState<
    Array<{
      id: string;
      callsign: string;
      altitudeFt: number;
      status: string;
      color: string;
      screenX: number;
      screenY: number;
      visible: boolean;
      isSelected: boolean;
      hasAlert: boolean;
      isLive: boolean;
      isConflict?: boolean;
    }>
  >([]);

  // Threat birth times for expansion animation
  const threatBirthTimes = useRef<Record<string, number>>({});
  useEffect(() => {
    const now = performance.now();
    threats.forEach((th) => {
      if (!threatBirthTimes.current[th.id]) {
        threatBirthTimes.current[th.id] = now;
      }
    });
  }, [threats]);

  // Trail buffer storage: Map<aircraftId, THREE.Vector3[]>
  const trailsRef = useRef<Map<string, THREE.Vector3[]>>(new Map());

  // Three.js instances ref
  const threeRefs = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    controls: OrbitControls | null;
    isSoftwareGl: boolean;
    aircraftMeshes: Map<string, THREE.Group>;
    aircraftStems: Map<string, THREE.Line>;
    aircraftShadows: Map<string, THREE.Mesh>;
    trailLines: Map<string, THREE.Line>;
    threatDomes: Map<string, { mesh: THREE.Mesh; wireframe: THREE.LineSegments; ring: THREE.Mesh; pulseRing: THREE.Mesh; labelSprite: THREE.Sprite }>;
    routeLines: Map<string, { line: THREE.Line; waypoints: THREE.Mesh[] }>;
    conflictTubes: Map<string, { tube: THREE.Mesh; linkLine: THREE.Line }>;
    altitudeRings: THREE.Group | null;
    sectorLabels: THREE.Group | null;
    liveAircraftMeshes: Map<string, THREE.Group>;
    liveAircraftStems: Map<string, THREE.Line>;
    liveAircraftShadows: Map<string, THREE.Mesh>;
    liveTrailLines: Map<string, THREE.Line>;
    animId: number | null;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    isSoftwareGl: false,
    aircraftMeshes: new Map(),
    aircraftStems: new Map(),
    aircraftShadows: new Map(),
    trailLines: new Map(),
    threatDomes: new Map(),
    routeLines: new Map(),
    conflictTubes: new Map(),
    altitudeRings: null,
    sectorLabels: null,
    liveAircraftMeshes: new Map(),
    liveAircraftStems: new Map(),
    liveAircraftShadows: new Map(),
    liveTrailLines: new Map(),
    animId: null,
  });

  // Status & Priority color resolver
  const getStatusColor = (status: string, priority?: string) => {
    if (priority === 'P1') return '#E5554F';
    if (priority === 'P2') return '#E0A33A';
    switch (status) {
      case 'ON_MISSION':
      case 'EN_ROUTE':
        return '#4C8DF6';
      case 'RETURNING':
        return '#A855F7';
      case 'AOG':
      case 'MAINTENANCE':
        return '#E5554F';
      case 'AVAILABLE':
      default:
        return '#3FB27F';
    }
  };

  // Helper to build a procedural military fighter jet model (Composite 4-part delta wing jet)
  const createJetGeometry = () => {
    const jetGroup = new THREE.Group();

    // 1. Fuselage: Sleek tapered nose and fuselage body
    const bodyGeom = new THREE.ConeGeometry(1.5, 7.5, 8);
    bodyGeom.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4c8df6,
      roughness: 0.35,
      metalness: 0.75,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.z = 0.6;
    jetGroup.add(body);

    // 2. Cockpit Canopy glass
    const canopyGeom = new THREE.ConeGeometry(0.7, 3.2, 6);
    canopyGeom.rotateX(Math.PI / 2);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.9,
    });
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.set(0, 0.7, 0.8);
    canopy.scale.set(0.85, 0.9, 1);
    jetGroup.add(canopy);

    // 3. Delta Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 1.6);
    wingShape.lineTo(4.8, -2.0);
    wingShape.lineTo(2.0, -2.0);
    wingShape.lineTo(0, -1.3);
    wingShape.lineTo(-2.0, -2.0);
    wingShape.lineTo(-4.8, -2.0);
    wingShape.closePath();

    const wingGeom = new THREE.ShapeGeometry(wingShape);
    wingGeom.rotateX(-Math.PI / 2);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.4,
      metalness: 0.65,
      side: THREE.DoubleSide,
    });
    const wings = new THREE.Mesh(wingGeom, wingMat);
    wings.position.y = 0.1;
    jetGroup.add(wings);

    // 4. Twin Canted Vertical Stabilizers
    const finShape = new THREE.Shape();
    finShape.moveTo(0, -0.6);
    finShape.lineTo(0, 1.8);
    finShape.lineTo(1.4, -0.6);
    finShape.closePath();
    const finGeom = new THREE.ShapeGeometry(finShape);
    finGeom.rotateY(Math.PI / 2);

    const finLeft = new THREE.Mesh(finGeom, wingMat);
    finLeft.position.set(0.65, 0.4, -1.5);
    finLeft.rotation.z = -0.15; // Canted fin
    jetGroup.add(finLeft);

    const finRight = new THREE.Mesh(finGeom, wingMat);
    finRight.position.set(-0.65, 0.4, -1.5);
    finRight.rotation.z = 0.15;
    jetGroup.add(finRight);

    // 5. Engine exhaust glow
    const nozzleGeom = new THREE.CylinderGeometry(0.5, 0.6, 0.8, 8);
    nozzleGeom.rotateX(Math.PI / 2);
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
    const nozzle = new THREE.Mesh(nozzleGeom, nozzleMat);
    nozzle.position.set(0, 0, -2.8);
    jetGroup.add(nozzle);

    // Hitbox sphere for raycasting clicks
    const hitGeom = new THREE.SphereGeometry(6.5, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitGeom, hitMat);
    hitbox.name = 'hitbox';
    jetGroup.add(hitbox);

    return jetGroup;
  };

  // Helper to build a procedural civil commercial airliner model
  const createAirlinerGeometry = () => {
    const airlinerGroup = new THREE.Group();

    // Fuselage cylinder
    const bodyGeom = new THREE.CylinderGeometry(1.2, 0.9, 8.5, 10);
    bodyGeom.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd8e2ed, // Silver-white metallic
      roughness: 0.25,
      metalness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    airlinerGroup.add(body);

    // Swept airliner wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 1.2);
    wingShape.lineTo(6.8, -2.4);
    wingShape.lineTo(5.8, -3.0);
    wingShape.lineTo(0, -0.9);
    wingShape.lineTo(-5.8, -3.0);
    wingShape.lineTo(-6.8, -2.4);
    wingShape.closePath();

    const wingGeom = new THREE.ShapeGeometry(wingShape);
    wingGeom.rotateX(-Math.PI / 2);
    const wing = new THREE.Mesh(wingGeom, bodyMat);
    wing.position.y = -0.1;
    airlinerGroup.add(wing);

    // Dual underwing jet engines
    const engineGeom = new THREE.CylinderGeometry(0.4, 0.45, 1.8, 8);
    engineGeom.rotateX(Math.PI / 2);
    const engineL = new THREE.Mesh(engineGeom, bodyMat);
    engineL.position.set(2.4, -0.6, -0.4);
    const engineR = new THREE.Mesh(engineGeom, bodyMat);
    engineR.position.set(-2.4, -0.6, -0.4);
    airlinerGroup.add(engineL);
    airlinerGroup.add(engineR);

    // Tail fin
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, -1.8);
    tailShape.lineTo(0, 2.0);
    tailShape.lineTo(1.5, -1.8);
    tailShape.closePath();
    const tailGeom = new THREE.ShapeGeometry(tailShape);
    tailGeom.rotateY(Math.PI / 2);
    const tail = new THREE.Mesh(tailGeom, bodyMat);
    tail.position.set(0, 0.7, -3.0);
    airlinerGroup.add(tail);

    // Hitbox sphere
    const hitGeom = new THREE.SphereGeometry(7, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox = new THREE.Mesh(hitGeom, hitMat);
    hitbox.name = 'hitbox_live';
    airlinerGroup.add(hitbox);

    return airlinerGroup;
  };

  // Main Three.js Scene Initialization and Lifecycle
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Software-WebGL Probe (Three.js skill directive)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();
    threeRefs.current.isSoftwareGl = isSoftwareGl;

    // 2. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0F1419');
    scene.fog = new THREE.FogExp2('#0F1419', 0.0009);

    // 3. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3500);
    camera.position.set(0, 230, 360);

    // 4. Renderer with modern color management
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 5. Studio Environment Reflection (RoomEnvironment per Three.js skill)
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // Graceful fallback if RoomEnvironment is unsupported
    }

    // 6. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; // Keep camera above ground
    controls.minDistance = 30;
    controls.maxDistance = 1400;
    controls.target.set(0, 25, 0);

    // 7. Lighting Rig (Warm key light, cool hemisphere fill, blue tactical rim light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x8ab4f8, 0x161c24, 0.85);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(220, 480, 160);
    scene.add(dirLight);

    const blueRimLight = new THREE.DirectionalLight(0x4c8df6, 0.9);
    blueRimLight.position.set(-220, 120, -220);
    scene.add(blueRimLight);

    // 8. Ground Plane & Dark Tactical Grid
    const groundGeom = new THREE.PlaneGeometry(1400, 1400);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c1117,
      roughness: 0.95,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.1;
    scene.add(groundMesh);

    // Grid lines
    const grid = new THREE.GridHelper(900, 45, 0x2a3340, 0x18202b);
    grid.position.y = 0.05;
    scene.add(grid);

    // 9. Airspace Sector Boundaries & Sector Labels on Ground
    const sectorLabelsGroup = new THREE.Group();
    zones.forEach((z) => {
      if (z.polygonCoords.length < 3) return;
      const pts = z.polygonCoords.map((p) => new THREE.Vector3((p.x - TACTICAL_CENTER_X) * MAP_SCALE, 0.2, (p.y - TACTICAL_CENTER_Y) * MAP_SCALE));
      pts.push(pts[0]);
      const zoneGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const isContested = z.corridorStatus === 'Contested';
      const zoneMat = new THREE.LineBasicMaterial({
        color: isContested ? 0xe5554f : 0x4c8df6,
        transparent: true,
        opacity: isContested ? 0.5 : 0.25,
      });
      const zoneLine = new THREE.Line(zoneGeom, zoneMat);
      scene.add(zoneLine);

      // Centroid for sector label lying flat on the ground
      let sumX = 0;
      let sumY = 0;
      z.polygonCoords.forEach((p) => {
        sumX += p.x;
        sumY += p.y;
      });
      const avgX = sumX / z.polygonCoords.length;
      const avgY = sumY / z.polygonCoords.length;

      const sectorTexture = createTextTexture(z.name, isContested ? '#E5554F' : '#8B98A9', 'rgba(15, 20, 25, 0.85)', isContested ? '#E5554F' : '#2A3340', 20);
      const labelMat = new THREE.MeshBasicMaterial({
        map: sectorTexture,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(36, 11), labelMat);
      labelMesh.rotation.x = -Math.PI / 2;
      labelMesh.position.set((avgX - TACTICAL_CENTER_X) * MAP_SCALE, 0.22, (avgY - TACTICAL_CENTER_Y) * MAP_SCALE);
      sectorLabelsGroup.add(labelMesh);
    });
    scene.add(sectorLabelsGroup);
    threeRefs.current.sectorLabels = sectorLabelsGroup;

    // 10. Airbases on Ground with Labels
    bases.forEach((b) => {
      const pos = new THREE.Vector3((b.coordinates.x - TACTICAL_CENTER_X) * MAP_SCALE, 0, (b.coordinates.y - TACTICAL_CENTER_Y) * MAP_SCALE);
      const baseGroup = new THREE.Group();
      baseGroup.position.copy(pos);

      // Runway pad ring
      const padGeom = new THREE.RingGeometry(2.5, 8.5, 6);
      const padMat = new THREE.MeshBasicMaterial({
        color: 0x4c8df6,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const pad = new THREE.Mesh(padGeom, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.15;
      baseGroup.add(pad);

      // Center dot
      const centerGeom = new THREE.CircleGeometry(2.5, 16);
      const centerMat = new THREE.MeshBasicMaterial({ color: 0x4c8df6 });
      const center = new THREE.Mesh(centerGeom, centerMat);
      center.rotation.x = -Math.PI / 2;
      center.position.y = 0.18;
      baseGroup.add(center);

      // Airbase Name Label lying on ground
      const baseTexture = createTextTexture(`AFB ${b.code}`, '#E8ECF1', 'rgba(22, 28, 36, 0.9)', '#4C8DF6', 22);
      const baseLabelMat = new THREE.MeshBasicMaterial({
        map: baseTexture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const baseLabel = new THREE.Mesh(new THREE.PlaneGeometry(24, 7.5), baseLabelMat);
      baseLabel.rotation.x = -Math.PI / 2;
      baseLabel.position.set(0, 0.22, 12);
      baseGroup.add(baseLabel);

      scene.add(baseGroup);
    });

    // 11. Mission Target Waypoint Flags
    missions.forEach((m) => {
      const pos = new THREE.Vector3((m.targetLocation.coords.x - TACTICAL_CENTER_X) * MAP_SCALE, 0, (m.targetLocation.coords.y - TACTICAL_CENTER_Y) * MAP_SCALE);
      const targetGroup = new THREE.Group();
      targetGroup.position.copy(pos);

      const color = m.priority === 'P1' ? 0xe5554f : m.priority === 'P2' ? 0xe0a33a : 0x4c8df6;
      const ringGeom = new THREE.RingGeometry(3, 5.0, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.2;
      targetGroup.add(ring);

      scene.add(targetGroup);
    });

    // Save Three instances
    threeRefs.current.renderer = renderer;
    threeRefs.current.scene = scene;
    threeRefs.current.camera = camera;
    threeRefs.current.controls = controls;

    // Resize Observer for dynamic container resizing
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    ro.observe(container);

    // Raycasting for Aircraft Clicks & Hovers
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hitboxes: THREE.Object3D[] = [];
      threeRefs.current.aircraftMeshes.forEach((mesh) => {
        const hb = mesh.getObjectByName('hitbox');
        if (hb) hitboxes.push(hb);
      });
      threeRefs.current.liveAircraftMeshes.forEach((mesh) => {
        const hb = mesh.getObjectByName('hitbox_live');
        if (hb) hitboxes.push(hb);
      });

      const intersects = raycaster.intersectObjects(hitboxes);
      if (intersects.length > 0) {
        container.style.cursor = 'pointer';
        const parent = intersects[0].object.parent;
        if (parent && parent.name) {
          setHoveredAircraftId(parent.name);
        }
      } else {
        container.style.cursor = 'grab';
        setHoveredAircraftId(null);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hitboxes: THREE.Object3D[] = [];
      threeRefs.current.aircraftMeshes.forEach((mesh) => {
        const hb = mesh.getObjectByName('hitbox');
        if (hb) hitboxes.push(hb);
      });
      threeRefs.current.liveAircraftMeshes.forEach((mesh) => {
        const hb = mesh.getObjectByName('hitbox_live');
        if (hb) hitboxes.push(hb);
      });

      const intersects = raycaster.intersectObjects(hitboxes);
      if (intersects.length > 0) {
        const parent = intersects[0].object.parent;
        if (parent && parent.name) {
          if (parent.name.startsWith('live_')) {
            const icao = parent.name.replace('live_', '');
            if (onSelectLiveAircraft) onSelectLiveAircraft(icao);
            onOpenTelemetryDrawer();
          } else {
            onSelectAircraft(parent.name);
            if (onSelectLiveAircraft) onSelectLiveAircraft(null);
            onOpenTelemetryDrawer();
            const asgn = assignments.find((a) => a.aircraftId === parent.name);
            if (asgn?.missionId) {
              onSelectMission(asgn.missionId);
            }
          }
        }
      } else {
        // Clicking on empty space deselects aircraft (User request: clicking empty space deselects)
        onSelectAircraft(null);
        if (onSelectLiveAircraft) onSelectLiveAircraft(null);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Tab visibility handling: pause render loop when tab hidden to save battery/GPU
    let isTabVisible = true;
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Animation Loop with zero allocation inside tick
    const animate = () => {
      threeRefs.current.animId = requestAnimationFrame(animate);
      if (!isTabVisible) return;

      controls.update();

      // Compute camera azimuth for compass HUD (Zero-GC using _camDir)
      camera.getWorldDirection(_camDir);
      const angle = Math.atan2(_camDir.x, _camDir.z) * (180 / Math.PI);
      setCameraAzimuth(Math.round((angle + 360) % 360));

      renderer.render(scene, camera);
    };
    animate();

    // Comprehensive Disposal
    return () => {
      if (threeRefs.current.animId) {
        cancelAnimationFrame(threeRefs.current.animId);
      }
      ro.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments || obj instanceof THREE.Sprite) {
          if (obj.geometry) obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if ('map' in m && m.map) m.map.dispose();
              m.dispose();
            });
          } else if (obj.material) {
            if ('map' in obj.material && obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      threeRefs.current.renderer = null;
      threeRefs.current.scene = null;
      threeRefs.current.camera = null;
      threeRefs.current.controls = null;
      threeRefs.current.aircraftMeshes.clear();
      threeRefs.current.aircraftStems.clear();
      threeRefs.current.aircraftShadows.clear();
      threeRefs.current.trailLines.clear();
      threeRefs.current.threatDomes.clear();
      threeRefs.current.routeLines.clear();
      threeRefs.current.conflictTubes.clear();
      threeRefs.current.liveAircraftMeshes.clear();
      threeRefs.current.liveAircraftStems.clear();
      threeRefs.current.liveAircraftShadows.clear();
      threeRefs.current.liveTrailLines.clear();
    };
  }, []);

  // -------------------------------------------------------------
  // 3D ALTITUDE RINGS (FL100, FL200, FL300, FL400)
  // -------------------------------------------------------------
  useEffect(() => {
    const { scene } = threeRefs.current;
    if (!scene) return;

    if (threeRefs.current.altitudeRings) {
      scene.remove(threeRefs.current.altitudeRings);
      threeRefs.current.altitudeRings.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) (child.material as THREE.Material).dispose();
        }
      });
      threeRefs.current.altitudeRings = null;
    }

    const altitudeLevels = [
      { fl: 'FL100', ft: 10000, label: 'FL100 (10,000 ft)' },
      { fl: 'FL200', ft: 20000, label: 'FL200 (20,000 ft)' },
      { fl: 'FL300', ft: 30000, label: 'FL300 (30,000 ft)' },
      { fl: 'FL400', ft: 40000, label: 'FL400 (40,000 ft)' },
    ];

    const ringsGroup = new THREE.Group();
    altitudeLevels.forEach((lvl) => {
      const yPos = (lvl.ft / 35000) * (BASE_MAX_ALT_UNITS * (verticalExaggeration / 2.5));
      
      // Altitude reference ring outline
      const ringGeom = new THREE.RingGeometry(240, 241, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: lvl.fl === 'FL300' ? 0x4c8df6 : 0x2a3340,
        transparent: true,
        opacity: lvl.fl === 'FL300' ? 0.35 : 0.2,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = yPos;
      ringsGroup.add(ringMesh);

      // Label sprite attached at the perimeter
      const labelTexture = createTextTexture(lvl.fl, lvl.fl === 'FL300' ? '#4C8DF6' : '#657183', 'rgba(15, 20, 25, 0.75)', '#2A3340', 20);
      const spriteMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0.8 });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(245, yPos, 0);
      sprite.scale.set(16, 7.5, 1);
      ringsGroup.add(sprite);
    });

    scene.add(ringsGroup);
    threeRefs.current.altitudeRings = ringsGroup;
  }, [verticalExaggeration]);

  // -------------------------------------------------------------
  // PLANNED 3D ROUTES & WAYPOINT DIAMONDS
  // -------------------------------------------------------------
  useEffect(() => {
    const { scene, routeLines } = threeRefs.current;
    if (!scene) return;

    missions.forEach((m) => {
      const asgn = assignments.find((a) => a.missionId === m.id);
      if (!asgn || !asgn.aircraftId) return;
      const ac = filteredAircraft.find((a) => a.id === asgn.aircraftId);
      if (!ac) return;

      const base = bases.find((b) => b.id === ac.baseId) || bases[0];
      const isSelected = selectedMissionId === m.id || selectedAircraftId === ac.id;
      const cruiseAlt = m.priority === 'P1' ? 32000 : 26000;

      // Ingress and Egress points with altitude curve
      const pStart = to3D(base.coordinates.x, base.coordinates.y, 0);
      const pIngress = to3D(
        base.coordinates.x + (m.targetLocation.coords.x - base.coordinates.x) * 0.45 - 15,
        base.coordinates.y + (m.targetLocation.coords.y - base.coordinates.y) * 0.45 - 15,
        cruiseAlt * 0.9
      );
      const pTarget = to3D(m.targetLocation.coords.x, m.targetLocation.coords.y, cruiseAlt);
      const pEgress = to3D(
        base.coordinates.x + (m.targetLocation.coords.x - base.coordinates.x) * 0.65 + 15,
        base.coordinates.y + (m.targetLocation.coords.y - base.coordinates.y) * 0.65 + 15,
        cruiseAlt * 0.75
      );
      const pEnd = to3D(base.coordinates.x, base.coordinates.y, 0);

      const curve = new THREE.CatmullRomCurve3([pStart, pIngress, pTarget, pEgress, pEnd]);
      const points = curve.getPoints(40);

      let routeEntry = routeLines.get(m.id);
      if (!routeEntry) {
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineDashedMaterial({
          color: isSelected ? 0x4c8df6 : 0x2a4365,
          dashSize: 4,
          gapSize: 2,
          transparent: true,
          opacity: isSelected ? 0.9 : 0.4,
        });
        const line = new THREE.Line(geom, mat);
        line.computeLineDistances();
        scene.add(line);

        // Waypoint diamonds
        const waypoints: THREE.Mesh[] = [];
        [pIngress, pTarget, pEgress].forEach((wpPos) => {
          const diamondGeom = new THREE.OctahedronGeometry(1.6);
          const diamondMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x4c8df6 : 0x64748b,
            roughness: 0.3,
            metalness: 0.8,
          });
          const diamond = new THREE.Mesh(diamondGeom, diamondMat);
          diamond.position.copy(wpPos);
          scene.add(diamond);
          waypoints.push(diamond);
        });

        routeEntry = { line, waypoints };
        routeLines.set(m.id, routeEntry);
      } else {
        routeEntry.line.geometry.setFromPoints(points);
        routeEntry.line.computeLineDistances();
        (routeEntry.line.material as THREE.LineDashedMaterial).color.setHex(isSelected ? 0x4c8df6 : 0x2a4365);
        (routeEntry.line.material as THREE.LineDashedMaterial).opacity = isSelected ? 0.95 : 0.35;
        routeEntry.waypoints[0]?.position.copy(pIngress);
        routeEntry.waypoints[1]?.position.copy(pTarget);
        routeEntry.waypoints[2]?.position.copy(pEgress);
      }
    });

    // Prune removed missions
    routeLines.forEach((entry, mId) => {
      if (!missions.some((m) => m.id === mId)) {
        scene.remove(entry.line);
        entry.line.geometry.dispose();
        entry.waypoints.forEach((wp) => {
          scene.remove(wp);
          wp.geometry.dispose();
        });
        routeLines.delete(mId);
      }
    });
  }, [missions, assignments, filteredAircraft, selectedMissionId, selectedAircraftId, to3D]);

  // -------------------------------------------------------------
  // CIVIL CONFLICTS 3D CORRIDORS & CONNECTING LINES
  // -------------------------------------------------------------
  useEffect(() => {
    const { scene, conflictTubes } = threeRefs.current;
    if (!scene) return;

    civilConflicts.forEach((conf) => {
      const civPos = to3D(conf.civilX, conf.civilY, 28000);
      const milAircraft = filteredAircraft.find((a) => a.id === conf.militaryAircraftId);
      const milSim = milAircraft ? getSimulatedAircraftState(milAircraft) : null;
      const milPos = milSim ? to3D(milSim.x, milSim.y, milSim.altitudeFt) : new THREE.Vector3(civPos.x + 15, civPos.y - 10, civPos.z - 15);

      let entry = conflictTubes.get(conf.id);
      if (!entry) {
        // Tube flight corridor
        const curve = new THREE.LineCurve3(milPos, civPos);
        const tubeGeom = new THREE.TubeGeometry(curve, 16, 4.0, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: 0xe0a33a,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const tube = new THREE.Mesh(tubeGeom, tubeMat);
        scene.add(tube);

        // Dashed connecting alert line
        const lineGeom = new THREE.BufferGeometry().setFromPoints([milPos, civPos]);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0xe0a33a,
          dashSize: 3,
          gapSize: 2,
          transparent: true,
          opacity: 0.85,
        });
        const linkLine = new THREE.Line(lineGeom, lineMat);
        linkLine.computeLineDistances();
        scene.add(linkLine);

        entry = { tube, linkLine };
        conflictTubes.set(conf.id, entry);
      } else {
        const curve = new THREE.LineCurve3(milPos, civPos);
        entry.tube.geometry.dispose();
        entry.tube.geometry = new THREE.TubeGeometry(curve, 16, 4.0, 8, false);
        entry.linkLine.geometry.setFromPoints([milPos, civPos]);
        entry.linkLine.computeLineDistances();
      }
    });

    conflictTubes.forEach((entry, cId) => {
      if (!civilConflicts.some((c) => c.id === cId)) {
        scene.remove(entry.tube);
        scene.remove(entry.linkLine);
        entry.tube.geometry.dispose();
        entry.linkLine.geometry.dispose();
        conflictTubes.delete(cId);
      }
    });
  }, [civilConflicts, filteredAircraft, getSimulatedAircraftState, to3D]);

  // -------------------------------------------------------------
  // THREAT DOMES (SAM RADAR & EW JAMMING) UPDATE
  // -------------------------------------------------------------
  useEffect(() => {
    const { scene, threatDomes } = threeRefs.current;
    if (!scene) return;

    const activeAircraftPositions: THREE.Vector3[] = filteredAircraft.map((ac) => {
      const sim = getSimulatedAircraftState(ac);
      return to3D(sim.x, sim.y, sim.altitudeFt);
    });

    threats.forEach((th) => {
      const radius = th.rangeKm * 0.9;
      const center = to3D(th.coords.x, th.coords.y, 0);

      const isBreached = activeAircraftPositions.some((pos) => {
        const d = pos.distanceTo(center);
        return d <= radius;
      });

      let domeEntry = threatDomes.get(th.id);
      if (!domeEntry) {
        // Translucent Dome
        const domeGeom = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
          color: 0xe5554f,
          transparent: true,
          opacity: 0.15,
          roughness: 0.2,
          metalness: 0.1,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(domeGeom, domeMat);
        mesh.position.copy(center);

        // Wireframe Edge Rim
        const wireGeom = new THREE.WireframeGeometry(domeGeom);
        const wireMat = new THREE.LineBasicMaterial({
          color: 0xe5554f,
          transparent: true,
          opacity: 0.35,
        });
        const wireframe = new THREE.LineSegments(wireGeom, wireMat);
        wireframe.position.copy(center);

        // Ground perimeter ring
        const ringGeom = new THREE.RingGeometry(radius - 0.8, radius + 0.8, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe5554f,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(center.x, 0.15, center.z);

        // Animated pulse ring
        const pulseRingGeom = new THREE.RingGeometry(0.5, radius * 0.65, 32);
        const pulseRingMat = new THREE.MeshBasicMaterial({
          color: 0xe5554f,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
        });
        const pulseRing = new THREE.Mesh(pulseRingGeom, pulseRingMat);
        pulseRing.rotation.x = -Math.PI / 2;
        pulseRing.position.set(center.x, 0.18, center.z);

        // 3D Threat Label Sprite
        const threatText = `${th.type.toUpperCase()} (${th.rangeKm}km)`;
        const labelTexture = createTextTexture(threatText, '#E5554F', 'rgba(22, 28, 36, 0.95)', '#E5554F', 22);
        const labelMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: 0.95 });
        const labelSprite = new THREE.Sprite(labelMat);
        labelSprite.position.set(center.x, radius * 0.75 + 10, center.z);
        labelSprite.scale.set(38, 12, 1);

        scene.add(mesh);
        scene.add(wireframe);
        scene.add(ring);
        scene.add(pulseRing);
        scene.add(labelSprite);

        domeEntry = { mesh, wireframe, ring, pulseRing, labelSprite };
        threatDomes.set(th.id, domeEntry);
      }

      // Emergence expansion animation
      const birthTime = threatBirthTimes.current[th.id] || performance.now();
      const ageMs = performance.now() - birthTime;
      const emergenceScale = Math.min(1.0, ageMs / 1200);
      domeEntry.mesh.scale.set(emergenceScale, emergenceScale, emergenceScale);
      domeEntry.wireframe.scale.set(emergenceScale, emergenceScale, emergenceScale);

      const mat = domeEntry.mesh.material as THREE.MeshStandardMaterial;
      if (isBreached) {
        mat.opacity = 0.35;
        mat.color.setHex(0xff3333);
        (domeEntry.ring.material as THREE.MeshBasicMaterial).opacity = 0.95;
      } else {
        mat.opacity = 0.15;
        mat.color.setHex(0xe5554f);
        (domeEntry.ring.material as THREE.MeshBasicMaterial).opacity = 0.65;
      }
    });

    threatDomes.forEach((entry, thId) => {
      if (!threats.some((t) => t.id === thId)) {
        scene.remove(entry.mesh);
        scene.remove(entry.wireframe);
        scene.remove(entry.ring);
        scene.remove(entry.pulseRing);
        scene.remove(entry.labelSprite);
        entry.mesh.geometry.dispose();
        entry.wireframe.geometry.dispose();
        entry.ring.geometry.dispose();
        entry.labelSprite.geometry.dispose();
        threatDomes.delete(thId);
      }
    });
  }, [threats, filteredAircraft, simProgress, to3D]);

  // -------------------------------------------------------------
  // AIRCRAFT MOVEMENT, ALTITUDE STEMS, TRAILS & LABELS
  // -------------------------------------------------------------
  useEffect(() => {
    const {
      scene,
      camera,
      controls,
      aircraftMeshes,
      aircraftStems,
      aircraftShadows,
      trailLines,
      liveAircraftMeshes,
      liveAircraftStems,
      liveAircraftShadows,
      liveTrailLines,
    } = threeRefs.current;
    if (!scene || !camera) return;

    const labelCoords: typeof screenLabels = [];
    const container = mountRef.current;
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 500;

    // 1. Render Military Fleet (SIMULATED or HYBRID mode)
    if (dataMode === 'SIMULATED' || dataMode === 'HYBRID') {
      filteredAircraft.forEach((ac) => {
        const sim = getSimulatedAircraftState(ac);
        const asgn = assignments.find((a) => a.aircraftId === ac.id);
        const mission = asgn ? missions.find((m) => m.id === asgn.missionId) : null;
        const pos3D = to3D(sim.x, sim.y, sim.altitudeFt);
        const groundPos = new THREE.Vector3(pos3D.x, 0.1, pos3D.z);
        const isSelected = selectedAircraftId === ac.id;
        const statusColorHex = getStatusColor(sim.status, mission?.priority);
        const colorNum = new THREE.Color(statusColorHex).getHex();

        // Mesh
        let jetGroup = aircraftMeshes.get(ac.id);
        if (!jetGroup) {
          jetGroup = createJetGeometry();
          jetGroup.name = ac.id;
          scene.add(jetGroup);
          aircraftMeshes.set(ac.id, jetGroup);
        }
        jetGroup.position.copy(pos3D);
        jetGroup.rotation.set(0, (-sim.heading * Math.PI) / 180, 0);

        const scale = isSelected ? 1.35 : 1.0;
        jetGroup.scale.set(scale, scale, scale);

        jetGroup.traverse((child) => {
          if (child instanceof THREE.Mesh && child.name !== 'hitbox') {
            (child.material as THREE.MeshStandardMaterial).color.setHex(colorNum);
          }
        });

        // Stem
        let stem = aircraftStems.get(ac.id);
        if (!stem) {
          const stemGeom = new THREE.BufferGeometry().setFromPoints([groundPos, pos3D]);
          const stemMat = new THREE.LineBasicMaterial({
            color: colorNum,
            transparent: true,
            opacity: 0.45,
          });
          stem = new THREE.Line(stemGeom, stemMat);
          scene.add(stem);
          aircraftStems.set(ac.id, stem);
        } else {
          stem.geometry.setFromPoints([groundPos, pos3D]);
          (stem.material as THREE.LineBasicMaterial).color.setHex(colorNum);
          (stem.material as THREE.LineBasicMaterial).opacity = isSelected ? 0.85 : 0.35;
        }

        // Shadow Disc on ground
        let shadow = aircraftShadows.get(ac.id);
        if (!shadow) {
          const shadowGeom = new THREE.CircleGeometry(2.5, 16);
          const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x161c24,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
          });
          shadow = new THREE.Mesh(shadowGeom, shadowMat);
          shadow.rotation.x = -Math.PI / 2;
          scene.add(shadow);
          aircraftShadows.set(ac.id, shadow);
        }
        shadow.position.copy(groundPos);
        shadow.scale.set(isSelected ? 1.4 : 1.0, isSelected ? 1.4 : 1.0, 1.0);

        // Trail
        let trailPts = trailsRef.current.get(ac.id);
        if (!trailPts) {
          trailPts = [];
          trailsRef.current.set(ac.id, trailPts);
        }
        if (trailPts.length === 0 || trailPts[trailPts.length - 1].distanceTo(pos3D) > 2.0) {
          trailPts.push(pos3D.clone());
          if (trailPts.length > 60) trailPts.shift();
        }

        let trailLine = trailLines.get(ac.id);
        if (!trailLine) {
          const trailGeom = new THREE.BufferGeometry().setFromPoints(trailPts);
          const trailMat = new THREE.LineBasicMaterial({
            color: colorNum,
            transparent: true,
            opacity: isSelected ? 0.95 : 0.45,
          });
          trailLine = new THREE.Line(trailGeom, trailMat);
          scene.add(trailLine);
          trailLines.set(ac.id, trailLine);
        } else {
          trailLine.geometry.setFromPoints(trailPts);
          (trailLine.material as THREE.LineBasicMaterial).color.setHex(colorNum);
          (trailLine.material as THREE.LineBasicMaterial).opacity = isSelected ? 0.95 : 0.4;
        }

        // Screen Label (Zero-GC using _screenPos)
        _screenPos.copy(pos3D);
        _screenPos.project(camera);
        const isVisibleInFront = _screenPos.z < 1.0;
        const screenX = ((_screenPos.x + 1) * width) / 2;
        const screenY = ((-_screenPos.y + 1) * height) / 2;

        labelCoords.push({
          id: ac.id,
          callsign: ac.callsign,
          altitudeFt: sim.altitudeFt,
          status: sim.status,
          color: statusColorHex,
          screenX,
          screenY,
          visible: isVisibleInFront,
          isSelected,
          hasAlert: ac.status !== 'Serviceable',
          isLive: false,
        });

        if (isSelected && isFollowingSelected && controls) {
          controls.target.lerp(new THREE.Vector3(pos3D.x, pos3D.y * 0.5, pos3D.z), 0.08);
        }
      });
    } else {
      // Hide military aircraft if in pure LIVE mode
      aircraftMeshes.forEach((mesh) => scene.remove(mesh));
      aircraftStems.forEach((stem) => scene.remove(stem));
      aircraftShadows.forEach((shadow) => scene.remove(shadow));
      trailLines.forEach((trail) => scene.remove(trail));
    }

    // 2. Render Live Civil Traffic (LIVE or HYBRID mode)
    if (dataMode === 'LIVE' || dataMode === 'HYBRID') {
      liveAircraft.forEach((civ) => {
        const pos3D = to3D(civ.x, civ.y, civ.altitudeFt);
        const groundPos = new THREE.Vector3(pos3D.x, 0.1, pos3D.z);
        const isSelected = selectedLiveAircraftId === civ.icao24;
        const isConflict = civilConflicts.some((c) => c.civilIcao24 === civ.icao24);
        const liveColorHex = civ.isEmergency ? '#E5554F' : isConflict ? '#E0A33A' : '#CBD5E1';
        const colorNum = new THREE.Color(liveColorHex).getHex();

        // Mesh
        let airlinerGroup = liveAircraftMeshes.get(civ.icao24);
        if (!airlinerGroup) {
          airlinerGroup = createAirlinerGeometry();
          airlinerGroup.name = `live_${civ.icao24}`;
          scene.add(airlinerGroup);
          liveAircraftMeshes.set(civ.icao24, airlinerGroup);
        }
        airlinerGroup.position.copy(pos3D);
        airlinerGroup.rotation.set(0, (-civ.heading * Math.PI) / 180, 0);

        const scale = isSelected ? 1.35 : 1.0;
        airlinerGroup.scale.set(scale, scale, scale);

        // Altitude Stem
        let stem = liveAircraftStems.get(civ.icao24);
        if (!stem) {
          const stemGeom = new THREE.BufferGeometry().setFromPoints([groundPos, pos3D]);
          const stemMat = new THREE.LineBasicMaterial({
            color: colorNum,
            transparent: true,
            opacity: 0.35,
          });
          stem = new THREE.Line(stemGeom, stemMat);
          scene.add(stem);
          liveAircraftStems.set(civ.icao24, stem);
        } else {
          stem.geometry.setFromPoints([groundPos, pos3D]);
          (stem.material as THREE.LineBasicMaterial).color.setHex(colorNum);
          (stem.material as THREE.LineBasicMaterial).opacity = isSelected ? 0.75 : 0.25;
        }

        // Shadow Disc
        let shadow = liveAircraftShadows.get(civ.icao24);
        if (!shadow) {
          const shadowGeom = new THREE.CircleGeometry(2.2, 16);
          const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x1e293b,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
          });
          shadow = new THREE.Mesh(shadowGeom, shadowMat);
          shadow.rotation.x = -Math.PI / 2;
          scene.add(shadow);
          liveAircraftShadows.set(civ.icao24, shadow);
        }
        shadow.position.copy(groundPos);

        // Live Trail
        let trailPts = trailsRef.current.get(`live_${civ.icao24}`);
        if (!trailPts) {
          trailPts = [];
          trailsRef.current.set(`live_${civ.icao24}`, trailPts);
        }
        if (trailPts.length === 0 || trailPts[trailPts.length - 1].distanceTo(pos3D) > 2.0) {
          trailPts.push(pos3D.clone());
          if (trailPts.length > 50) trailPts.shift();
        }

        let trailLine = liveTrailLines.get(civ.icao24);
        if (!trailLine) {
          const trailGeom = new THREE.BufferGeometry().setFromPoints(trailPts);
          const trailMat = new THREE.LineBasicMaterial({
            color: colorNum,
            transparent: true,
            opacity: isSelected ? 0.8 : 0.25,
          });
          trailLine = new THREE.Line(trailGeom, trailMat);
          scene.add(trailLine);
          liveTrailLines.set(civ.icao24, trailLine);
        } else {
          trailLine.geometry.setFromPoints(trailPts);
          (trailLine.material as THREE.LineBasicMaterial).color.setHex(colorNum);
          (trailLine.material as THREE.LineBasicMaterial).opacity = isSelected ? 0.8 : 0.25;
        }

        // Screen Label (Zero-GC using _screenPos)
        _screenPos.copy(pos3D);
        _screenPos.project(camera);
        const isVisibleInFront = _screenPos.z < 1.0;
        const screenX = ((_screenPos.x + 1) * width) / 2;
        const screenY = ((-_screenPos.y + 1) * height) / 2;

        labelCoords.push({
          id: civ.icao24,
          callsign: civ.callsign,
          altitudeFt: civ.altitudeFt,
          status: civ.isEmergency ? 'EMERGENCY' : isConflict ? 'CONFLICT' : 'CIVIL_TRAFFIC',
          color: liveColorHex,
          screenX,
          screenY,
          visible: isVisibleInFront,
          isSelected,
          hasAlert: civ.isEmergency || isConflict,
          isLive: true,
          isConflict,
        });

        if (isSelected && isFollowingSelected && controls) {
          controls.target.lerp(new THREE.Vector3(pos3D.x, pos3D.y * 0.5, pos3D.z), 0.08);
        }
      });
    } else {
      liveAircraftMeshes.forEach((mesh) => scene.remove(mesh));
      liveAircraftStems.forEach((stem) => scene.remove(stem));
      liveAircraftShadows.forEach((shadow) => scene.remove(shadow));
      liveTrailLines.forEach((trail) => scene.remove(trail));
    }

    setScreenLabels(labelCoords);

    // Prune removed military meshes
    aircraftMeshes.forEach((mesh, id) => {
      if (!filteredAircraft.some((a) => a.id === id) || dataMode === 'LIVE') {
        scene.remove(mesh);
        mesh.traverse((c) => {
          if (c instanceof THREE.Mesh) c.geometry.dispose();
        });
        aircraftMeshes.delete(id);

        const stem = aircraftStems.get(id);
        if (stem) {
          scene.remove(stem);
          stem.geometry.dispose();
          aircraftStems.delete(id);
        }

        const shadow = aircraftShadows.get(id);
        if (shadow) {
          scene.remove(shadow);
          shadow.geometry.dispose();
          aircraftShadows.delete(id);
        }

        const trail = trailLines.get(id);
        if (trail) {
          scene.remove(trail);
          trail.geometry.dispose();
          trailLines.delete(id);
        }
      }
    });

    // Prune removed live meshes
    liveAircraftMeshes.forEach((mesh, icao) => {
      if (!liveAircraft.some((a) => a.icao24 === icao) || dataMode === 'SIMULATED') {
        scene.remove(mesh);
        mesh.traverse((c) => {
          if (c instanceof THREE.Mesh) c.geometry.dispose();
        });
        liveAircraftMeshes.delete(icao);

        const stem = liveAircraftStems.get(icao);
        if (stem) {
          scene.remove(stem);
          stem.geometry.dispose();
          liveAircraftStems.delete(icao);
        }

        const shadow = liveAircraftShadows.get(icao);
        if (shadow) {
          scene.remove(shadow);
          shadow.geometry.dispose();
          liveAircraftShadows.delete(icao);
        }

        const trail = liveTrailLines.get(icao);
        if (trail) {
          scene.remove(trail);
          trail.geometry.dispose();
          liveTrailLines.delete(icao);
        }
      }
    });
  }, [simProgress, filteredAircraft, selectedAircraftId, isFollowingSelected, dataMode, liveAircraft, selectedLiveAircraftId, civilConflicts, to3D, assignments, missions]);

  // Camera Presets
  const handleResetView = () => {
    const { camera, controls } = threeRefs.current;
    if (!camera || !controls) return;
    setIsFollowingSelected(false);
    controls.target.set(0, 25, 0);
    camera.position.set(0, 230, 360);
  };

  const handleTopDownView = () => {
    const { camera, controls } = threeRefs.current;
    if (!camera || !controls) return;
    setIsFollowingSelected(false);
    controls.target.set(0, 0, 0);
    camera.position.set(0, 480, 0.1);
  };

  const handleSideView = () => {
    const { camera, controls } = threeRefs.current;
    if (!camera || !controls) return;
    setIsFollowingSelected(false);
    controls.target.set(0, 35, 0);
    camera.position.set(0, 70, 420);
  };

  // Fit to fleet camera transition (User request: Fit to Fleet button)
  const handleFitToFleet = () => {
    const { camera, controls } = threeRefs.current;
    if (!camera || !controls) return;
    setIsFollowingSelected(false);

    _box3.makeEmpty();
    if (dataMode !== 'LIVE') {
      filteredAircraft.forEach((ac) => {
        const sim = getSimulatedAircraftState(ac);
        _box3.expandByPoint(to3D(sim.x, sim.y, sim.altitudeFt));
      });
    }
    if (dataMode !== 'SIMULATED') {
      liveAircraft.forEach((civ) => {
        _box3.expandByPoint(to3D(civ.x, civ.y, civ.altitudeFt));
      });
    }

    if (!_box3.isEmpty()) {
      _box3.getCenter(_center);
      controls.target.copy(_center);
      camera.position.set(_center.x, _center.y + 220, _center.z + 320);
    } else {
      handleResetView();
    }
  };

  const handleZoom = (delta: number) => {
    const { camera } = threeRefs.current;
    if (!camera) return;
    const factor = delta > 0 ? 0.8 : 1.25;
    camera.position.multiplyScalar(factor);
  };

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0F1419] select-none font-sans">
      {/* 1. 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full relative cursor-grab active:cursor-grabbing" />

      {/* 2. Tactical HUD Overlay: Altitude Stratification Widget (Top Left) */}
      <div className="absolute top-3 left-3 pointer-events-none flex items-center space-x-2 text-[10px] font-mono text-[#8B98A9] z-10 bg-[#161C24]/95 border border-[#2A3340] px-2.5 py-1.5 rounded-lg shadow-lg">
        <div className="flex flex-col items-start space-y-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-0.5 bg-[#4C8DF6]" />
            <span className="font-semibold text-[#E8ECF1]">FL350+</span>
            <span className="text-[#657183]">(High Cruise)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-0.5 bg-[#A855F7]" />
            <span className="font-semibold text-[#E8ECF1]">FL250</span>
            <span className="text-[#657183]">(Mid Corridor)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-0.5 bg-[#3FB27F]" />
            <span className="font-semibold text-[#3FB27F]">GND - FL100</span>
            <span className="text-[#657183]">(Terminal / Bases)</span>
          </div>
        </div>
      </div>

      {/* 3. Tactical HUD Overlay: Compass & Heading Widget (Top Right) */}
      <div className="absolute top-3 right-3 pointer-events-none flex items-center space-x-2 bg-[#161C24]/95 border border-[#2A3340] rounded-lg px-2.5 py-1 text-xs text-[#E8ECF1] shadow-lg z-10 font-mono">
        <Compass
          className="w-3.5 h-3.5 text-[#4C8DF6] transition-transform duration-75"
          style={{ transform: `rotate(${-cameraAzimuth}deg)` }}
        />
        <span>{String(cameraAzimuth).padStart(3, '0')}° AZ</span>
        <span className="text-[#657183]">•</span>
        <span className="text-[10px] text-[#9AA5B4]">
          {dataMode === 'LIVE' ? 'LIVE ADS-B 3D' : dataMode === 'HYBRID' ? 'HYBRID TACTICAL 3D' : '3D AIRSPACE'}
        </span>
      </div>

      {/* 4. Projected Camera-Facing HTML Aircraft Labels (Selective Decluttering) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {screenLabels.map((lbl) => {
          if (!lbl.visible) return null;
          const shouldShow =
            labelFilter === 'ALL' ||
            (labelFilter === 'ALERTS' && (lbl.hasAlert || lbl.isSelected)) ||
            (labelFilter === 'SELECTED' && (lbl.isSelected || hoveredAircraftId === lbl.id || hoveredAircraftId === `live_${lbl.id}`));

          if (!shouldShow) return null;

          return (
            <div
              key={lbl.id}
              style={{
                transform: `translate(${lbl.screenX + 10}px, ${lbl.screenY - 24}px)`,
                transition: 'transform 80ms ease-out',
              }}
              className="absolute left-0 top-0 pointer-events-auto"
            >
              <button
                onClick={() => {
                  if (lbl.isLive) {
                    if (onSelectLiveAircraft) onSelectLiveAircraft(lbl.id);
                  } else {
                    onSelectAircraft(lbl.id);
                  }
                  onOpenTelemetryDrawer();
                }}
                className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono border shadow-md cursor-pointer transition ${
                  lbl.isSelected
                    ? 'bg-[#161C24] text-[#E8ECF1] border-[#4C8DF6] ring-1 ring-[#4C8DF6]'
                    : lbl.isConflict
                    ? 'bg-[#161C24]/95 text-[#E0A33A] border-[#E0A33A]'
                    : lbl.isLive
                    ? 'bg-[#161C24]/95 text-[#CBD5E1] border-[#475569] hover:text-[#FFFFFF]'
                    : 'bg-[#161C24]/95 text-[#9AA5B4] border-[#2A3340] hover:text-[#E8ECF1]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: lbl.color }}
                />
                <span className="font-bold text-[#E8ECF1]">{lbl.callsign || lbl.id}</span>
                <span className="text-[10px] text-[#657183]">·</span>
                <span className="text-[10px] font-semibold text-[#8B98A9]">
                  {lbl.altitudeFt > 0 ? `FL${Math.round(lbl.altitudeFt / 100)}` : 'GND'}
                </span>
                <span
                  className={`text-[9px] font-bold px-1 rounded ${
                    lbl.isConflict
                      ? 'bg-[#E0A33A]/20 text-[#E0A33A]'
                      : lbl.isLive
                      ? 'bg-[#475569]/40 text-[#CBD5E1]'
                      : 'bg-[#4C8DF6]/20 text-[#4C8DF6]'
                  }`}
                >
                  {lbl.isConflict ? 'CONFLICT' : lbl.isLive ? 'LIVE' : 'SIM'}
                </span>
                {lbl.hasAlert && !lbl.isConflict && <ShieldAlert className="w-3 h-3 text-[#E5554F]" />}
                {lbl.isConflict && <AlertTriangle className="w-3 h-3 text-[#E0A33A]" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* 5. UNIFIED BOTTOM CONTROL DOCK (Three.js Skill Directive: Zero Viewport Occlusion) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        {/* Toggle Collapse Bar */}
        <button
          onClick={() => setIsControlsExpanded(!isControlsExpanded)}
          className="bg-[#161C24]/95 border border-[#2A3340] border-b-0 rounded-t-md px-3 py-0.5 text-[10px] text-[#9AA5B4] hover:text-[#E8ECF1] transition flex items-center space-x-1 cursor-pointer font-mono"
        >
          {isControlsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          <span>{isControlsExpanded ? 'HIDE 3D DOCK' : '3D CONTROLS'}</span>
        </button>

        {isControlsExpanded && (
          <div className="bg-[#161C24]/95 border border-[#2A3340] rounded-lg shadow-2xl px-3 py-1.5 flex items-center space-x-3 text-xs text-[#E8ECF1] font-mono">
            {/* Vertical Exaggeration Slider (User Request) */}
            <div className="flex items-center space-x-2 pr-3 border-r border-[#2A3340]">
              <span className="text-[10px] text-[#8B98A9] uppercase font-semibold">Vertical Scale:</span>
              <input
                type="range"
                min="1.0"
                max="4.0"
                step="0.25"
                value={verticalExaggeration}
                onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
                className="w-20 accent-[#4C8DF6] cursor-pointer"
                title={`Vertical exaggeration: ${verticalExaggeration}x`}
              />
              <span className="text-[11px] font-bold text-[#4C8DF6] min-w-[28px]">
                {verticalExaggeration.toFixed(1)}x
              </span>
            </div>

            {/* Labels Decluttering: Selected / Alerts / All (User Request) */}
            <div className="flex items-center space-x-1.5 pr-3 border-r border-[#2A3340]">
              <span className="text-[10px] text-[#8B98A9] uppercase font-semibold">Labels:</span>
              <div className="flex items-center bg-[#0F1419] p-0.5 rounded border border-[#2A3340]">
                {(['SELECTED', 'ALERTS', 'ALL'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setLabelFilter(mode)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      labelFilter === mode
                        ? 'bg-[#4C8DF6] text-white shadow-xs'
                        : 'text-[#657183] hover:text-[#9AA5B4]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera Presets & Follow (User Request: bottom-right control cluster) */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleZoom(1)}
                className="p-1 hover:bg-[#1D2530] text-[#9AA5B4] hover:text-[#E8ECF1] rounded transition cursor-pointer"
                title="Zoom In (+)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleZoom(-1)}
                className="p-1 hover:bg-[#1D2530] text-[#9AA5B4] hover:text-[#E8ECF1] rounded transition cursor-pointer"
                title="Zoom Out (-)"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3.5 bg-[#2A3340] mx-0.5" />
              <button
                onClick={handleResetView}
                className="p-1 hover:bg-[#1D2530] text-[#9AA5B4] hover:text-[#E8ECF1] rounded transition cursor-pointer"
                title="Isometric Tactical View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleTopDownView}
                className="p-1 hover:bg-[#1D2530] text-[#9AA5B4] hover:text-[#E8ECF1] rounded transition cursor-pointer"
                title="Top-Down Plan View"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSideView}
                className="p-1 hover:bg-[#1D2530] text-[#9AA5B4] hover:text-[#E8ECF1] rounded transition cursor-pointer"
                title="Side Altitude View"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleFitToFleet}
                className="p-1 hover:bg-[#1D2530] text-[#9AA5B4] hover:text-[#E8ECF1] rounded transition cursor-pointer"
                title="Fit View to Active Fleet"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3.5 bg-[#2A3340] mx-0.5" />
              <button
                onClick={() => setIsFollowingSelected(!isFollowingSelected)}
                className={`p-1 rounded transition cursor-pointer flex items-center space-x-1 text-[10px] ${
                  isFollowingSelected
                    ? 'bg-[#4C8DF6] text-white shadow-xs'
                    : 'text-[#9AA5B4] hover:bg-[#1D2530] hover:text-[#E8ECF1]'
                }`}
                title={isFollowingSelected ? 'Tracking Selected Asset' : 'Follow Selected Asset'}
              >
                <Navigation2 className="w-3 h-3" />
                <span className="hidden sm:inline">Follow</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
