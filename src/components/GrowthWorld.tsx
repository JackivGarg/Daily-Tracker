import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type * as Three from "three";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Leaf,
  Pause,
  Play,
  RotateCcw,
  Sprout,
  Wind,
} from "lucide-react";
import { computeGrowth, growthTimeline } from "../lib/growth.js";
import { dateKey } from "../lib/metrics.js";
import "./growth-world.css";

type EntryLike = {
  date: string;
  status?: "green" | "red" | null;
  workoutDone?: boolean | null;
  guitarDone?: boolean | null;
  sportsDone?: boolean | null;
  travelDone?: boolean | null;
  updatedAt?: string;
  studyMinutes?: number | null;
};
type GrowthState = ReturnType<typeof computeGrowth>;
type SceneSettings = {
  state: GrowthState;
  paused: boolean;
  breeze: boolean;
  staticMode: boolean;
};
type SceneHandle = { update: () => void; dispose: () => void };
const chapters = [
  {
    id: "show-up",
    short: "The roots",
    title: "Good days take root.",
    position: [5, 3.8, 7],
    height: 0.36,
    fov: 36,
  },
  {
    id: "strength",
    short: "The structure",
    title: "Give your effort a place to grow.",
    position: [3.6, 2.8, 4.7],
    height: 0.5,
    fov: 36,
  },
  {
    id: "focus",
    short: "The canopy",
    title: "Make room for a fuller life.",
    position: [-4.5, 3.6, -4.7],
    height: 0.74,
    fov: 37,
  },
  {
    id: "whole-garden",
    short: "The whole tree",
    title: "A record of becoming.",
    position: [6, 6.5, 8],
    height: 0.4,
    fov: 35,
  },
];
const prettyDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
function treeScale(points: number) {
  return points <= 0
    ? 0
    : Math.min(1, 0.12 + Math.pow(Math.min(points, 45) / 45, 0.65) * 0.88);
}

async function mountTree(
  host: HTMLDivElement,
  preview: boolean,
  root: HTMLElement | null,
  settings: RefObject<SceneSettings>,
  onChapter: (i: number) => void,
  cancelled: () => boolean,
): Promise<SceneHandle> {
  const T = await import("three");
  if (cancelled()) return { update: () => {}, dispose: () => {} };
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  let renderer: Three.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch {
    host.dataset.worldReady = "fallback";
    return { update: () => {}, dispose: () => {} };
  }
  host.appendChild(canvas);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.5),
  );
  renderer.shadowMap.enabled = !preview;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.Fog("#111b16", 16, 36);
  const camera = new T.PerspectiveCamera(36, 1, 0.1, 60);
  const geo = new Set<Three.BufferGeometry>(),
    mats = new Set<Three.Material>();
  const geometry = <G extends Three.BufferGeometry>(g: G) => {
    geo.add(g);
    return g;
  };
  const material = (color: string, roughness = 0.8, metalness = 0) => {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    mats.add(m);
    return m;
  };
  const stone = material("#26362c", 0.86, 0.16),
    ceramic = material("#31483a", 0.42, 0.2),
    soilMat = material("#17251b", 1),
    bark = material("#685038", 0.86),
    barkRidge = material("#8d7250", 0.92),
    seedMat = material("#a59158", 0.72, 0.1);
  const rimMat = material("#b8d980", 0.4, 0.3);
  rimMat.emissive.set("#72a547");
  rimMat.emissiveIntensity = 0.24;
  const leafMats = [
    material("#5b994f", 0.64),
    material("#81b65a", 0.63),
    material("#b5d77b", 0.58),
  ];
  leafMats.forEach((m) => (m.side = T.DoubleSide));
  const world = new T.Group();
  scene.add(world);
  function mesh(
    g: Three.BufferGeometry,
    m: Three.Material,
    parent: Three.Object3D = world,
  ) {
    const obj = new T.Mesh(g, m);
    obj.castShadow = !preview;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  function lathe(
    profile: number[][],
    mat: Three.Material,
    parent: Three.Object3D = world,
  ) {
    return mesh(
      geometry(
        new T.LatheGeometry(
          profile.map(([x, y]) => new T.Vector2(x, y)),
          preview ? 48 : 64,
        ),
      ),
      mat,
      parent,
    );
  }
  lathe(
    [
      [0, -0.45],
      [2.4, -0.45],
      [2.52, -0.4],
      [2.56, -0.33],
      [2.55, -0.23],
      [2.47, -0.18],
      [0, -0.18],
    ],
    stone,
  );
  const ring = mesh(geometry(new T.TorusGeometry(2.5, 0.012, 6, 96)), rimMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.24;
  const planter = new T.Group();
  world.add(planter);
  lathe(
    [
      [0, -0.17],
      [0.65, -0.17],
      [0.72, -0.12],
      [0.83, 0.1],
      [1.02, 0.6],
      [1.02, 0.7],
      [0.97, 0.74],
      [0.91, 0.74],
      [0.9, 0.64],
      [0.76, 0.1],
      [0, 0.1],
    ],
    ceramic,
    planter,
  );
  const soil = mesh(
    geometry(new T.CylinderGeometry(0.91, 0.89, 0.06, 48)),
    soilMat,
    planter,
  );
  soil.position.y = 0.63;
  const lip = mesh(
    geometry(new T.TorusGeometry(0.976, 0.018, 8, 72)),
    rimMat,
    planter,
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.72;
  const seed = mesh(
    geometry(new T.SphereGeometry(0.14, 24, 16)),
    seedMat,
    planter,
  );
  seed.position.set(0, 0.7, 0);
  seed.scale.set(1.2, 0.65, 0.8);
  seed.rotation.y = -0.4;
  const seedSeam = mesh(
    geometry(new T.TorusGeometry(0.13, 0.006, 5, 40)),
    bark,
    seed,
  );
  seedSeam.rotation.x = Math.PI / 2;
  const growth = new T.Group();
  growth.position.y = 0.66;
  world.add(growth);
  function branchGeometry(points: Three.Vector3[], radius: number) {
    const curve = new T.CatmullRomCurve3(points);
    const segments = preview ? 12 : 18,
      sides = 8;
    const frames = curve.computeFrenetFrames(segments, false);
    const positions: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const center = curve.getPoint(i / segments);
      const r = radius * (1 - (0.88 * i) / segments);
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        const p = center
          .clone()
          .addScaledVector(frames.normals[i], Math.cos(a) * r)
          .addScaledVector(frames.binormals[i], Math.sin(a) * r);
        positions.push(p.x, p.y, p.z);
        if (i < segments && j < sides) {
          const k = i * (sides + 1) + j;
          indices.push(
            k,
            k + sides + 1,
            k + 1,
            k + sides + 1,
            k + sides + 2,
            k + 1,
          );
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return geometry(g);
  }
  function tube(
    points: Three.Vector3[],
    radius: number,
    parent: Three.Object3D,
    mat = bark,
  ) {
    return mesh(branchGeometry(points, radius), mat, parent);
  }
  const trunk = new T.Group();
  growth.add(trunk);
  tube(
    [
      new T.Vector3(0, 0, 0),
      new T.Vector3(-0.06, 0.8, 0.05),
      new T.Vector3(0.08, 1.8, 0),
      new T.Vector3(-0.02, 2.8, 0.04),
      new T.Vector3(0.08, 3.8, 0),
    ],
    0.145,
    trunk,
  );
  // Causal vertical ridges, rather than random noise, make the tapered bark readable.
  for (let j = 0; j < 5; j++) {
    const a = (j * Math.PI * 2) / 5;
    const dx = Math.cos(a),
      dz = Math.sin(a);
    tube(
      [
        new T.Vector3(dx * 0.13, 0.03, dz * 0.13),
        new T.Vector3(dx * 0.08, 1.0, dz * 0.08),
        new T.Vector3(0.06 + dx * 0.04, 2.0, dz * 0.04),
        new T.Vector3(dx * 0.018, 2.8, 0.04 + dz * 0.018),
      ],
      0.006,
      trunk,
      barkRidge,
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const rootPath = [
      new T.Vector3(0, 0.18, 0),
      new T.Vector3(Math.cos(a) * 0.25, 0.035, Math.sin(a) * 0.25),
      new T.Vector3(Math.cos(a) * 0.6, -0.005, Math.sin(a) * 0.6),
    ];
    tube(rootPath, 0.07, growth);
  }
  function leafGeometry() {
    const rows = 10,
      cols = 4,
      vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      for (let j = 0; j <= cols; j++) {
        const s = (j / cols) * 2 - 1;
        const spread = Math.pow(Math.sin(Math.PI * t), 0.72) * 0.15;
        vertices.push(
          s * spread,
          t * 0.64,
          Math.sin(t * Math.PI) * 0.07 +
            Math.abs(s) * spread * 0.2 -
            t * t * 0.045,
        );
        if (i < rows && j < cols) {
          const k = i * (cols + 1) + j;
          indices.push(
            k,
            k + cols + 1,
            k + 1,
            k + cols + 1,
            k + cols + 2,
            k + 1,
          );
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return geometry(g);
  }
  const leafGeo = leafGeometry();
  const canopyMat = material("#ffffff", .64);
  canopyMat.side = T.DoubleSide;
  const branchGroups: Three.Group[] = [];
  const leafGroups: {
    mesh: Three.InstancedMesh;
    points: {
      p: Three.Vector3;
      q: Three.Quaternion;
      scale: number;
      color: number;
    }[];
  }[] = [];
  const leafDummy = new T.Object3D();
  function canopy(
    parent: Three.Group,
    center: Three.Vector3,
    index: number,
    size = 1,
  ) {
    const placements: {
      p: Three.Vector3;
      q: Three.Quaternion;
      scale: number;
      color: number;
    }[] = [];
    // Four authored radial whorls create layered leaf sprays, never a random cloud.
    const count = preview ? 24 : 36;
    for (let n = 0; n < count; n++) {
      const a =
        ((n % 9) / 9) * Math.PI * 2 +
        (Math.floor(n / 9) % 2) * 0.37 +
        index * 0.81;
      const band = Math.floor(n / 9);
      const radius = (0.23 + band * 0.13) * size;
      const p = center
        .clone()
        .add(
          new T.Vector3(
            Math.cos(a) * radius,
            Math.sin(a * 2 + index) * 0.09 + (band - 1.5) * 0.14 * size,
            Math.sin(a) * radius,
          ),
        );
      const direction = new T.Vector3(
        Math.cos(a) * 0.85,
        0.55 - band * 0.1,
        Math.sin(a) * 0.85,
      ).normalize();
      const q = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        direction,
      );
      placements.push({
        p,
        q,
        scale: (0.64 + (n % 4) * 0.12) * size,
        color: n % 3,
      });
    }
    const m = new T.InstancedMesh(leafGeo, canopyMat, count);
    m.castShadow = !preview;
    m.receiveShadow = true;
    m.frustumCulled = false;
    parent.add(m);
    leafGroups.push({ mesh: m, points: placements });
  }
  // The top crown belongs to earned height; lateral branch groups are earned by training.
  const crown = new T.Group();
  growth.add(crown);
  canopy(crown, new T.Vector3(0.08, 3.48, 0), 0, 0.8);
  const sprout = new T.Group();
  growth.add(sprout);
  tube(
    [new T.Vector3(), new T.Vector3(-0.06, 1.5, 0), new T.Vector3(0.08, 3.8, 0)],
    0.026,
    sprout,
    leafMats[1],
  );
  for (let n = 0; n < 2; n++) {
    const l = mesh(leafGeo, leafMats[1 + n], sprout);
    l.position.set(0.06, 3.35, 0);
    l.rotation.z = n === 0 ? 1.1 : -1.1;
    l.scale.setScalar(1.8);
  }
  for (let n = 0; n < 12; n++) {
    const group = new T.Group();
    growth.add(group);
    branchGroups.push(group);
    const angle = n * 2.39996;
    const height = 1.1 + (n % 4) * 0.57 + (n >= 8 ? 0.2 : 0);
    const length = (1.45 - (height - 1.1) * 0.25) * (n % 2 === 0 ? 1 : 0.88);
    const end = new T.Vector3(
      Math.cos(angle) * length,
      height + 0.48,
      Math.sin(angle) * length,
    );
    tube(
      [
        new T.Vector3(0, height, 0),
        new T.Vector3(
          Math.cos(angle) * length * 0.38,
          height + 0.2,
          Math.sin(angle) * length * 0.38,
        ),
        end,
      ],
      0.055 - (height - 1.1) * 0.012,
      group,
    );
    const fork = end
      .clone()
      .add(
        new T.Vector3(Math.sin(angle) * 0.34, 0.25, -Math.cos(angle) * 0.34),
      );
    tube(
      [
        end
          .clone()
          .multiplyScalar(0.86)
          .add(new T.Vector3(0, height * 0.14, 0)),
        end,
        fork,
      ],
      0.019,
      group,
    );
    canopy(group, end, n + 1, 1);
    canopy(group, fork, n + 4, 0.62);
  }
  const pebbleGeo = geometry(new T.SphereGeometry(1, 16, 10)),
    pebbleMat = material("#79856d", 0.9);
  [
    [-1.6, 0.8, 0.17],
    [-1.84, 0.57, 0.1],
    [1.57, -0.8, 0.14],
    [1.8, -0.98, 0.08],
  ].forEach(([x, z, s], i) => {
    const p = mesh(pebbleGeo, pebbleMat);
    p.scale.set(s * 1.3, s * 0.5, s);
    p.position.set(x, -0.16 + s * 0.2, z);
    p.rotation.y = i * 1.4;
  });
  const floor = mesh(
    geometry(new T.PlaneGeometry(100, 100)),
    material("#111b16", 1),
    scene,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.47;
  floor.castShadow = false;
  scene.add(new T.HemisphereLight("#d9edcb", "#17291c", 2.4));
  const key = new T.DirectionalLight("#efffdc", 3.6);
  key.position.set(5, 8, 4);
  key.castShadow = !preview;
  key.shadow.mapSize.setScalar(innerWidth < 700 ? 512 : 1024);
  Object.assign(key.shadow.camera, {
    left: -5,
    right: 5,
    top: 7,
    bottom: -3,
    near: 0.1,
    far: 22,
  });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const rim = new T.DirectionalLight("#7dc49a", 1.6);
  rim.position.set(-5, 4, -5);
  scene.add(rim);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0,
    last: number | null = null,
    disposed = false,
    lost = false,
    visible = true,
    exact = preview ? 3 : 0,
    smooth = exact,
    active = -1,
    frames = 0,
    sample = 0,
    samples = 0;
  let smoothSize = treeScale(settings.current.state.points),
    smoothLife = settings.current.state.vitality / 100,
    previousSignature = "";
  const sections = root
    ? [...root.querySelectorAll<HTMLElement>(".growth-chapter")]
    : [];
  let tops: number[] = [];
  let trigger: { kill: () => void; refresh: () => void } | undefined;
  const target = new T.Vector3(),
    position = new T.Vector3(),
    other = new T.Vector3();
  function measure() {
    tops = sections.map(
      (s) => s.getBoundingClientRect().top + scrollY - innerHeight * 0.4,
    );
  }
  function updateScroll() {
    if (!preview && tops.length) {
      let i = 0;
      while (i < 3 && scrollY >= tops[i + 1]) i++;
      exact = clamp(
        i +
          (scrollY - tops[i]) /
            Math.max(1, (tops[i + 1] ?? tops[i] + innerHeight) - tops[i]),
        0,
        3,
      );
      const current = Math.round(exact);
      if (current !== active) {
        active = current;
        onChapter(current);
      }
      host.dataset.worldProgress = exact.toFixed(3);
    }
    wake();
  }
  function updateLeaves(life: number, points: number) {
    const dry = new T.Color("#9b7544");
    ["#5b994f", "#81b65a", "#b5d77b"].forEach((color, i) =>
      leafMats[i].color
        .copy(dry)
        .lerp(new T.Color(color), clamp((life - 0.15) / 0.85, 0, 1)),
    );
    leafGroups.forEach(({ mesh, points: placements }) => {
      placements.forEach((p, i) => {
        const available =
          i < Math.max(3, Math.round(placements.length * (0.18 + life * 0.82)));
        leafDummy.position.copy(p.p);
        leafDummy.quaternion.copy(p.q);
        leafDummy.rotateX((1 - life) * 0.9);
        const size =
          (available ? 1 : 0.035) * p.scale * (points < 6 ? 0.65 : 1);
        leafDummy.scale.set(size * (0.7 + life * 0.3), size, size);
        leafDummy.updateMatrix();
        mesh.setMatrixAt(i, leafDummy.matrix);
        mesh.setColorAt(i, leafMats[p.color].color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate = true;
    });
  }
  function frame(time: number) {
    raf = 0;
    if (disposed || lost || !visible || document.hidden) {
      last = null;
      return;
    }
    const interval = last === null ? 0 : Math.max(0, time - last);
    const dt = Math.min(interval / 1000, 1 / 30);
    last = time;
    const config = settings.current;
    const snap = config.paused || motion.matches;
    const desiredSize = treeScale(config.state.points),
      desiredLife = config.state.vitality / 100;
    smooth = snap
      ? Math.round(exact)
      : T.MathUtils.damp(smooth, exact, 6, dt || 1 / 60);
    smoothSize = snap
      ? desiredSize
      : T.MathUtils.damp(smoothSize, desiredSize, 6, dt || 1 / 60);
    smoothLife = snap
      ? desiredLife
      : T.MathUtils.damp(smoothLife, desiredLife, 6, dt || 1 / 60);
    smooth = clamp(smooth, 0, 3);
    const i = clamp(Math.floor(smooth), 0, 2),
      fraction = clamp(smooth - i, 0, 1),
      a = chapters[i],
      b = chapters[i + 1];
    const mobile = host.clientWidth < 600;
    position.fromArray(a.position).lerp(other.fromArray(b.position), fraction);
    const actualHeight = 0.66 + 3.8 * desiredSize;
    const aim = actualHeight * (a.height + (b.height - a.height) * fraction);
    target.set(0, Math.max(0.72, aim), 0);
    if (desiredSize < 0.25) {
      position.multiplyScalar(0.64);
      position.y = Math.max(2.1, position.y);
      target.y = 0.86 + desiredSize * 0.8;
    } else if (mobile) position.multiplyScalar(1.12);
    if (preview) {
      position.set(5, 4, 7).multiplyScalar(desiredSize < 0.3 ? 0.67 : 1);
      target.set(0, 0.72 + desiredSize * 1.55, 0);
    }
    camera.position.copy(position);
    camera.lookAt(target);
    camera.fov = a.fov + (b.fov - a.fov) * fraction + (mobile ? 6 : 0);
    camera.updateProjectionMatrix();
    growth.visible = smoothSize > 0.001;
    growth.scale.setScalar(Math.max(0.001, smoothSize));
    trunk.visible = config.state.points >= 6;
    seed.visible = desiredSize < 0.3;
    seed.scale.setScalar(desiredSize === 0 ? 1 : 0.7);
    crown.visible = config.state.points >= 6;
    sprout.visible = config.state.points > 0 && config.state.points < 6;
    sprout.scale.setScalar(1);
    branchGroups.forEach((group, n) => {
      group.visible = config.state.points > 0 && n < config.state.branches;
    });
    const signature = `${Math.round(smoothLife * 100)}:${config.state.points}`;
    if (signature !== previousSignature) {
      updateLeaves(smoothLife, config.state.points);
      previousSignature = signature;
    }
    if (config.breeze && !snap) {
      growth.rotation.z = Math.sin(time * 0.0006) * 0.008;
      growth.rotation.y = Math.sin(time * 0.0003) * 0.01;
    } else {
      growth.rotation.set(0, 0, 0);
    }
    renderer.render(scene, camera);
    host.dataset.worldDrawCalls = String(renderer.info.render.calls);
    host.dataset.worldTriangles = String(renderer.info.render.triangles);
    host.dataset.worldFrames = String(++frames);
    host.dataset.growthPoints = String(config.state.points);
    host.dataset.growthVitality = String(config.state.vitality);
    host.dataset.growthStage = config.state.stage;
    if (interval > 0 && interval < 200) {
      sample += interval;
      samples++;
      host.dataset.worldFrameMs = (sample / samples).toFixed(1);
    }
    const unsettled =
      Math.abs(smooth - (snap ? Math.round(exact) : exact)) > 0.0005 ||
      Math.abs(smoothSize - desiredSize) > 0.0005 ||
      Math.abs(smoothLife - desiredLife) > 0.001;
    if (unsettled || (config.breeze && !snap)) wake();
    else last = null;
  }
  function wake() {
    if (!raf && !disposed && !lost && visible && !document.hidden)
      raf = requestAnimationFrame(frame);
  }
  function resize() {
    renderer.setSize(
      Math.max(1, host.clientWidth),
      Math.max(1, host.clientHeight),
      false,
    );
    camera.aspect =
      Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
    measure();
    updateScroll();
  }
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = null;
    } else wake();
  }
  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
    last = null;
    host.dataset.worldReady = "fallback";
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersection = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
        last = null;
      }
    },
    { rootMargin: "100px" },
  );
  intersection.observe(host);
  canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", visibility);
  motion.addEventListener("change", wake);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pageshow", updateScroll);
  window.addEventListener("hashchange", updateScroll);
  resize();
  if (!preview && root) {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]);
    if (!cancelled()) {
      gsap.registerPlugin(ScrollTrigger);
      trigger = ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        onUpdate: updateScroll,
        onRefresh: () => {
          measure();
          updateScroll();
        },
      });
      await document.fonts.ready;
      trigger.refresh();
    }
  }
  if (!lost && !cancelled()) host.dataset.worldReady = "true";
  wake();
  return {
    update: wake,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      trigger?.kill();
      resizeObserver.disconnect();
      intersection.disconnect();
      canvas.removeEventListener("webglcontextlost", contextLost);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", wake);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pageshow", updateScroll);
      window.removeEventListener("hashchange", updateScroll);
      geo.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      key.shadow.map?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

function GardenScene({
  state,
  preview = false,
  root,
  onChapter,
  paused = false,
  breeze = false,
  staticMode = false,
}: {
  state: GrowthState;
  preview?: boolean;
  root?: RefObject<HTMLElement | null>;
  onChapter?: (i: number) => void;
  paused?: boolean;
  breeze?: boolean;
  staticMode?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<SceneHandle | null>(null);
  const settings = useRef<SceneSettings>({ state, paused, breeze, staticMode });
  settings.current = { state, paused, breeze, staticMode };
  useEffect(() => {
    const element = host.current;
    if (!element || staticMode) return;
    let cancelled = false;
    let mounted: SceneHandle | undefined;
    mountTree(
      element,
      preview,
      root?.current ?? null,
      settings,
      onChapter ?? (() => {}),
      () => cancelled,
    )
      .then((handle) => {
        if (cancelled) handle.dispose();
        else {
          mounted = handle;
          controller.current = handle;
        }
      })
      .catch(() => {
        if (!cancelled) element.dataset.worldReady = "fallback";
      });
    return () => {
      cancelled = true;
      mounted?.dispose();
      controller.current = null;
    };
  }, [preview, root, onChapter, staticMode]);
  useEffect(() => {
    controller.current?.update();
  }, [state, paused, breeze]);
  return (
    <div
      ref={host}
      className={`garden-render ${preview ? "garden-render-preview" : ""}`}
      data-world-ready={staticMode ? "static" : "loading"}
      data-growth-points={state.points}
      data-growth-vitality={state.vitality}
      data-growth-stage={state.stage}
      aria-hidden="true"
    >
      <div className="garden-fallback">
        <Sprout size={preview ? 30 : 60} strokeWidth={1} />
        <strong>{state.stage}</strong>
        <span>
          {state.points} growth points · {state.branches} earned branches
        </span>
        <small>Foliage vitality: {state.vitality}%</small>
        <p className="garden-loading-copy">Preparing your living record…</p>
        <p className="garden-static-copy">
          A still view of your saved progress. Your story and controls remain
          available below.
        </p>
      </div>
    </div>
  );
}

export function GardenPreview({
  entries = [],
  today = dateKey(),
  startDate = "2026-11-01",
}: {
  entries?: EntryLike[];
  today?: string;
  startDate?: string;
}) {
  const state = useMemo(
    () => computeGrowth(entries, today, startDate),
    [entries, today, startDate],
  );
  return <GardenScene state={state} preview paused />;
}

export default function GrowthWorld({
  entries,
  onCheckIn,
  today = dateKey(),
  startDate = "2026-11-01",
}: {
  entries: EntryLike[];
  onCheckIn: () => void;
  today?: string;
  startDate?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0),
    [paused, setPaused] = useState(false),
    [breeze, setBreeze] = useState(false),
    [staticMode, setStatic] = useState(false),
    [demo, setDemo] = useState(false),
    [selectedDate, setSelectedDate] = useState<string | null>(null);
  const onChapter = useCallback((index: number) => setActive(index), []);
  const live = useMemo(
    () => computeGrowth(entries, today, startDate),
    [entries, today, startDate],
  );
  const timeline = useMemo(
    () => growthTimeline(entries, today, startDate),
    [entries, today, startDate],
  );
  const historyIndex = selectedDate
    ? Math.max(
        0,
        timeline.findIndex((point) => point.date === selectedDate),
      )
    : Math.max(0, timeline.length - 1);
  const historyState = selectedDate
    ? computeGrowth(entries, selectedDate, startDate)
    : live;
  const state: GrowthState = demo
    ? {
        ...live,
        points: 60,
        branches: 12,
        branchProgress: 1,
        vitality: 100,
        stage: "Full-grown tree",
        stageIndex: 4,
        stageProgress: 1,
        greenStreak: 62,
        greenDays: 62,
        redDays: 0,
        workoutDays: 36,
        workoutStreak: 1,
        joyDays: 62,
        dryDays: 0,
        recordedDays: 62,
        nextStageAt: null,
        daysToUnlock: 0,
        latestStatus: "green",
        growthActive: true,
        hasRecords: true,
      }
    : historyState;
  const status = state.growthActive
    ? "Growing"
    : state.points > 0
      ? "Growth resting"
      : "Taking root";
  const leafStatus =
    state.vitality >= 75
      ? "Lush"
      : state.vitality >= 40
        ? "Balanced"
        : "Drying";
  const nextAction = state.growthActive
    ? "Keep your green streak going. Your next green day earns another growth point."
    : `Build ${state.daysToUnlock} more consecutive green ${state.daysToUnlock === 1 ? "day" : "days"} to ${state.points ? "resume" : "unlock"} height growth.`;
  return (
    <section
      className="growth-world"
      ref={root}
      aria-label="Your living growth world"
    >
      <header className="growth-heading">
        <div>
          <h1>
            Your days.
            <br />
            <span>A living record.</span>
          </h1>
          <p>
            A tree shaped by your check-ins. Every root, branch and leaf has a
            reason.
          </p>
        </div>
        <button className="garden-check-in" onClick={onCheckIn}>
          Today's check-in
          <ArrowUpRight size={17} />
        </button>
      </header>
      <div
        className={`growth-summary ${demo ? "is-demo" : ""}`}
        aria-label="Growth overview"
      >
        <div className="growth-stage-name">
          <Sprout size={23} />
          <div>
            <strong>{state.stage}</strong>
            <span>
              {demo
                ? "Mature preview · illustrative"
                : selectedDate
                  ? `History · ${prettyDate(selectedDate)}`
                  : `Your tree · ${prettyDate(today)}`}
            </span>
          </div>
          <span
            className={`growth-status ${state.growthActive ? "is-growing" : ""}`}
          >
            {status}
          </span>
        </div>
        <dl>
          <div>
            <dt>Growth points</dt>
            <dd>
              {state.points}
              <small>
                {state.nextStageAt
                  ? ` / ${state.nextStageAt} next stage`
                  : " · mature"}
              </small>
            </dd>
          </div>
          <div>
            <dt>Green streak</dt>
            <dd>
              {state.greenStreak}
              <small>days</small>
            </dd>
          </div>
          <div>
            <dt>Earned branches</dt>
            <dd>
              {state.branches}
              <small>from gym</small>
            </dd>
          </div>
          <div>
            <dt>Foliage vitality</dt>
            <dd>
              {state.vitality}
              <small>% · {leafStatus}</small>
            </dd>
          </div>
        </dl>
      </div>
      {demo ? (
        <div className="growth-mode-banner">
          <Eye size={16} />
          <p>
            Previewing a mature tree. These example values are not your
            check-ins and will not be saved.
          </p>
          <button onClick={() => setDemo(false)}>
            Return to my tree
            <RotateCcw size={14} />
          </button>
        </div>
      ) : selectedDate ? (
        <div className="growth-mode-banner">
          <RotateCcw size={16} />
          <p>
            Viewing your saved history on {prettyDate(selectedDate)}. This is
            read-only.
          </p>
          <button onClick={() => setSelectedDate(null)}>
            Back to today
            <ArrowUpRight size={14} />
          </button>
        </div>
      ) : (
        <div className="growth-next-action">
          <Leaf size={16} />
          <span>{nextAction}</span>
          <span>Earned growth is always yours.</span>
        </div>
      )}
      <div className="growth-layout">
        <div className="garden-sticky">
          <div className="garden-stage">
            <GardenScene
              state={state}
              root={root}
              onChapter={onChapter}
              paused={paused}
              breeze={breeze}
              staticMode={staticMode}
            />
            <div className="garden-stage-caption">
              <span>
                <i />
                {demo ? "Mature tree preview" : state.stage}
              </span>
              <span>
                {state.growthActive ? "Height growing" : "Height retained"}
              </span>
            </div>
            <div className="garden-annotation">
              <span className="garden-annotation-dot" />
              <span>
                {active === 0
                  ? "Height follows green streaks"
                  : active === 1
                    ? "Branches follow gym check-ins"
                    : active === 2
                      ? "Foliage follows guitar, sports or travel"
                      : "Your check-ins, made visible"}
              </span>
            </div>
            <div className="garden-stage-bottom">
              <span>{chapters[active].short}</span>
              <div className="garden-dots">
                {chapters.map((chapter, i) => (
                  <a
                    key={chapter.id}
                    href={`#${chapter.id}`}
                    aria-label={chapter.short}
                    aria-current={active === i ? "step" : undefined}
                  >
                    <span />
                  </a>
                ))}
              </div>
              <ArrowDown size={15} />
            </div>
          </div>
          <div
            className="garden-view-controls"
            aria-label="World view controls"
          >
            <button aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {paused ? <Play size={14} /> : <Pause size={14} />}{" "}
              {paused ? "Resume motion" : "Pause motion"}
            </button>
            <button
              aria-pressed={breeze}
              onClick={() => setBreeze(!breeze)}
              disabled={paused || staticMode}
            >
              <Wind size={14} />
              {breeze ? "Breeze on" : "Breeze off"}
            </button>
            <button
              aria-pressed={staticMode}
              onClick={() => setStatic(!staticMode)}
            >
              <Eye size={14} />
              {staticMode ? "Show 3D" : "Static view"}
            </button>
          </div>
          <div className="garden-timeline">
            <div>
              <label htmlFor="garden-history">Your tree through time</label>
              <span>{selectedDate ? prettyDate(selectedDate) : "Today"}</span>
            </div>
            <input
              id="garden-history"
              aria-label="View saved growth history"
              type="range"
              min={0}
              max={Math.max(0, timeline.length - 1)}
              value={historyIndex}
              disabled={timeline.length < 2 || demo}
              onChange={(event) => {
                setDemo(false);
                setSelectedDate(
                  timeline[Number(event.target.value)]?.date ?? null,
                );
              }}
            />
            <div className="garden-history-actions">
              <button
                aria-label="Previous saved day"
                disabled={timeline.length < 2 || historyIndex <= 0 || demo}
                onClick={() => setSelectedDate(timeline[historyIndex - 1].date)}
              >
                <ChevronLeft size={13} />
                Earlier
              </button>
              <span>
                {timeline.length < 2
                  ? "More check-ins will build your timeline."
                  : "Only your recorded history. No predicted progress."}
              </span>
              <button
                aria-label="Next saved day"
                disabled={
                  timeline.length < 2 ||
                  historyIndex >= timeline.length - 1 ||
                  demo
                }
                onClick={() => setSelectedDate(timeline[historyIndex + 1].date)}
              >
                Later
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
          <p className="garden-disclaimer">
            Scroll changes your perspective. Check-ins change your tree.
          </p>
        </div>
        <div className="growth-chapters">
          <section className="growth-chapter" id="show-up">
            <div className="growth-chapter-content">
              <h2>{chapters[0].title}</h2>
              <p>
                Green days build your roots. Three in a row unlock height, then
                each further green day adds one permanent growth point.
              </p>
              <div className="growth-rule-visual">
                <span className={state.greenStreak >= 1 ? "complete" : ""}>
                  {state.greenStreak >= 1 ? <Check size={14} /> : 1}
                </span>
                <i />
                <span className={state.greenStreak >= 2 ? "complete" : ""}>
                  {state.greenStreak >= 2 ? <Check size={14} /> : 2}
                </span>
                <i />
                <span className={state.greenStreak >= 3 ? "complete" : ""}>
                  {state.greenStreak >= 3 ? <Check size={14} /> : 3}
                </span>
                <strong>+1 growth point</strong>
              </div>
              <p className="growth-explanation">
                {state.latestStatus === "red"
                  ? "A red day has paused new height. Your earned size remains. Start a new three-green-day streak when you are ready."
                  : nextAction}
              </p>
              <div className="growth-milestones">
                {[
                  { name: "Seed", at: 0 },
                  { name: "Sprout", at: 1 },
                  { name: "Sapling", at: 6 },
                  { name: "Young tree", at: 20 },
                  { name: "Full-grown", at: 45 },
                ].map((stage) => (
                  <div
                    key={stage.name}
                    className={state.points >= stage.at ? "reached" : ""}
                  >
                    <span />
                    <strong>{stage.name}</strong>
                    <small>{stage.at} points</small>
                  </div>
                ))}
              </div>
              <a className="garden-next" href="#strength">
                Follow the branches
                <ArrowDown size={15} />
              </a>
            </div>
          </section>
          <section className="growth-chapter" id="strength">
            <div className="growth-chapter-content">
              <h2>{chapters[1].title}</h2>
              <p>
                Your training builds the tree's structure. Every three gym
                check-ins earn another lateral branch. Branches stay, even when
                your green streak breaks.
              </p>
              <div className="growth-proof">
                <strong>{state.workoutDays}</strong>
                <span>
                  workout check-ins
                  <small>
                    {state.branches} earned branches ·{" "}
                    {state.branches >= 12
                      ? "visible branch maximum reached"
                      : `${Math.round(state.branchProgress * 3)} of 3 toward the next`}
                  </small>
                </span>
              </div>
              <p className="growth-explanation">
                {state.points === 0
                  ? "Your branches are earned and will appear once your first green streak unlocks a sprout. "
                  : ""}
                A rest day does not remove a branch. Your workout routine and
                your personal day color are separate.
              </p>
              <div className="growth-rule-line">
                <span>3 workout check-ins</span>
                <ArrowUpRight size={15} />
                <strong>1 new branch</strong>
              </div>
              <a className="garden-next" href="#focus">
                Step into the canopy
                <ArrowDown size={15} />
              </a>
            </div>
          </section>
          <section className="growth-chapter" id="focus">
            <div className="growth-chapter-content">
              <h2>{chapters[2].title}</h2>
              <p>
                A little guitar. A game outside. A change of place. Any one of
                guitar, sports or travel replenishes your foliage.
              </p>
              <div className="growth-vitality">
                <div>
                  <strong>{state.vitality}%</strong>
                  <span>{leafStatus} foliage</span>
                </div>
                <div className="growth-vitality-track">
                  <span style={{ width: `${state.vitality}%` }} />
                </div>
              </div>
              <div className="growth-rule-line">
                <span>Any one activity in a day</span>
                <strong>+28 vitality</strong>
              </div>
              <p className="growth-explanation">
                Three logged days with guitar, sports and travel all marked No
                have a grace period. After that, each dry day removes 12
                vitality: leaves become sparser, curl and turn amber. Missing
                check-ins stay unknown.
              </p>
              <p className="growth-gentle-note">
                New activity restores green. Earned height never shrinks.
              </p>
              <a className="garden-next" href="#whole-garden">
                See the whole story
                <ArrowDown size={15} />
              </a>
            </div>
          </section>
          <section className="growth-chapter" id="whole-garden">
            <div className="growth-chapter-content">
              <h2>{chapters[3].title}</h2>
              <p>
                Seed to full-grown tree, one honest day at a time. You can
                pause, begin again, and keep everything you have already built.
              </p>
              <ul className="garden-next-steps">
                <li>
                  <Leaf size={16} />
                  <span>
                    <strong>For height</strong>
                    {nextAction}
                  </span>
                </li>
                <li>
                  <Sprout size={16} />
                  <span>
                    <strong>For branches</strong>
                    {state.branches >= 12
                      ? "All twelve visible branches earned. Further workouts remain part of your history."
                      : `Record ${3 - Math.round(state.branchProgress * 3)} more gym check-ins for the next branch.`}
                  </span>
                </li>
                <li>
                  <Wind size={16} />
                  <span>
                    <strong>For foliage</strong>Guitar, sports or travel: choose
                    something that feels like living.
                  </span>
                </li>
              </ul>
              <button className="garden-check-in" onClick={onCheckIn}>
                Make today's check-in
                <ArrowUpRight size={17} />
              </button>
              <button
                className="garden-demo-button"
                onClick={() => {
                  setDemo(!demo);
                  setSelectedDate(null);
                }}
              >
                <Eye size={15} />
                {demo ? "Return to my tree" : "Preview a full-grown tree"}
              </button>
              <p className="garden-closing">
                {demo
                  ? "Mature preview uses example values only."
                  : "Your tree is a reflection of your routine, not a judgment of you."}
              </p>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
