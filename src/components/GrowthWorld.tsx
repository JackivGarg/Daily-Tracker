import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type * as Three from 'three';
import { ArrowDown, ArrowUpRight, Leaf, MoveDown } from 'lucide-react';
import './growth-world.css';

type EntryLike = {
  date: string;
  status?: string | null;
  studyMinutes?: number | null;
  guitarDone?: boolean | null;
  workoutDone?: boolean | null;
};

const chapters = [
  { id: 'show-up', title: 'Everything starts with showing up.', short: 'Show up', position: [5, 3.3, 7], target: [0, 1.1, 0], mobile: [6, 4, 9], fov: 35 },
  { id: 'strength', title: 'Build a little stronger.', short: 'Build strength', position: [-4.8, 4.5, 6.8], target: [0, 1.9, 0], mobile: [-6, 5.3, 9], fov: 35 },
  { id: 'focus', title: 'Make room for what matters.', short: 'Find focus', position: [-5.6, 4.8, -4.6], target: [0, 2.1, 0], mobile: [-7, 5.5, -6], fov: 36 },
  { id: 'whole-garden', title: 'Small things. A bigger picture.', short: 'See your growth', position: [6, 7.5, 8], target: [0, 1.3, 0], mobile: [7.5, 8.5, 10], fov: 34 },
];

async function mountGarden(
  host: HTMLDivElement,
  preview: boolean,
  journeyRoot: HTMLElement | null,
  onChapter: (index: number) => void,
  isCancelled: () => boolean,
): Promise<() => void> {
  const T = await import('three');
  if (isCancelled()) return () => undefined;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let renderer: Three.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    host.dataset.worldReady = 'fallback';
    return () => undefined;
  }
  host.append(canvas);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = !preview;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.Fog('#111b16', 14, 32);
  const camera = new T.PerspectiveCamera(35, 1, .1, 60);
  const geometries = new Set<Three.BufferGeometry>();
  const materials = new Set<Three.Material>();
  const geometry = <G extends Three.BufferGeometry>(g: G): G => { geometries.add(g); return g; };
  const material = (color: string, roughness = .7, metalness = 0, emissive?: string) => {
    const mat = new T.MeshStandardMaterial({ color, roughness, metalness, side: T.DoubleSide, ...(emissive ? { emissive, emissiveIntensity: .38 } : {}) });
    materials.add(mat);
    return mat;
  };
  const palette = {
    stone: material('#26362c', .86, .16),
    edge: material('#3e5140', .53, .45),
    ceramic: material('#31483a', .48, .32),
    soil: material('#17251b', 1),
    stem: material('#6d8c4f', .7),
    leaf: [material('#91bd65', .56), material('#5d9650', .62), material('#b3d789', .57)],
    vein: material('#bedb8c', .68),
    pebble: material('#748169', .86),
    luminous: material('#bde992', .4, .15, '#a6e36c'),
  };
  const world = new T.Group();
  world.name = 'growth-garden';
  scene.add(world);
  const mesh = (g: Three.BufferGeometry, m: Three.Material, parent: Three.Object3D = world) => {
    const object = new T.Mesh(g, m);
    object.castShadow = !preview;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const lathe = (profile: number[][], mat: Three.Material, parent = world) => mesh(geometry(new T.LatheGeometry(profile.map(([x, y]) => new T.Vector2(x, y)), preview ? 48 : 64)), mat, parent);
  const platform = lathe([[0, -.51], [2.7, -.51], [2.8, -.48], [2.86, -.4], [2.86, -.29], [2.81, -.23], [2.7, -.21], [0, -.21]], palette.stone);
  platform.name = 'limestone-platform';
  const platformRing = mesh(geometry(new T.TorusGeometry(2.79, .012, 6, 96)), palette.luminous);
  platformRing.rotation.x = Math.PI / 2;
  platformRing.position.y = -.24;
  const planter = new T.Group();
  planter.position.set(-.2, 0, 0);
  world.add(planter);
  lathe([[0, -.2], [.66, -.2], [.7, -.16], [.71, -.1], [.72, -.07], [.78, .03], [1.03, .66], [1.04, .73], [1.01, .77], [.96, .77], [.92, .69], [.7, .02], [0, .02]], palette.ceramic, planter);
  const rim = mesh(geometry(new T.TorusGeometry(.994, .023, 10, 72)), palette.edge, planter);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = .75;
  const soil = mesh(geometry(new T.CylinderGeometry(.94, .92, .08, 48)), palette.soil, planter);
  soil.position.y = .66;
  const seed = mesh(geometry(new T.SphereGeometry(.12, 24, 16)), palette.luminous, planter);
  seed.scale.set(1.4, .65, .8);
  seed.rotation.y = .5;
  seed.position.set(.09, .73, .07);
  const growth = new T.Group();
  growth.name = 'plant-growth';
  growth.position.set(0, .69, 0);
  planter.add(growth);

  function tube(points: Three.Vector3[], radius: number, parent: Three.Object3D, mat = palette.stem) {
    const path = new T.CatmullRomCurve3(points);
    return mesh(geometry(new T.TubeGeometry(path, preview ? 16 : 28, radius, 7, false)), mat, parent);
  }
  tube([new T.Vector3(0, 0, 0), new T.Vector3(-.08, .65, .02), new T.Vector3(.1, 1.5, -.06), new T.Vector3(.03, 2.4, .03), new T.Vector3(.14, 3.15, 0)], .038, growth);

  function leafGeometry(length: number, width: number) {
    const rows = preview ? 16 : 24;
    const columns = 8;
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const spread = Math.pow(Math.sin(Math.PI * t), .78) * width;
      for (let j = 0; j <= columns; j++) {
        const s = j / columns * 2 - 1;
        vertices.push(s * spread, t * length, Math.sin(t * Math.PI) * length * .18 + Math.pow(Math.abs(s), 1.8) * spread * .24 - t * t * length * .16);
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
      const a = i * (columns + 1) + j;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return geometry(g);
  }
  const leaves: { group: Three.Group; baseRotation: number; phase: number }[] = [];
  const leafSpec = [
    [.45, -1.05, .5, 1.14, .4, 0], [.65, .9, .6, 1.08, .38, 1],
    [1.0, -.95, -.48, 1.4, .46, 2], [1.28, 1.07, -.36, 1.5, .48, 0],
    [1.6, -.75, .76, 1.42, .48, 1], [1.9, .9, .54, 1.36, .45, 2],
    [2.17, -.82, -.38, 1.23, .4, 0], [2.43, .62, -.46, 1.12, .38, 1],
    [2.7, -.4, .43, .88, .32, 2], [2.95, .22, -.12, .72, .26, 2],
  ];
  leafSpec.forEach(([height, dx, dz, length, width, color], index) => {
    const anchor = new T.Vector3(.025, height, 0);
    const base = new T.Vector3(dx * .28, height + .08, dz * .28);
    tube([anchor, new T.Vector3(dx * .13, height + .1, dz * .13), base], .017, growth);
    const group = new T.Group();
    group.position.copy(base);
    const direction = new T.Vector3(dx, .55 + index * .035, dz).normalize();
    group.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction);
    mesh(leafGeometry(length, width), palette.leaf[color], group);
    tube([new T.Vector3(0, 0, .003), new T.Vector3(0, length * .35, length * .096), new T.Vector3(0, length * .7, length * .068), new T.Vector3(0, length * .96, -length * .115)], .008, group, palette.vein);
    growth.add(group);
    leaves.push({ group, baseRotation: group.rotation.z, phase: index * 1.7 });
  });

  const companion = new T.Group();
  companion.position.set(1.63, -.17, .92);
  companion.rotation.y = -.6;
  world.add(companion);
  lathe([[0, 0], [.32, 0], [.38, .04], [.48, .42], [.47, .46], [.42, .46], [.37, .15], [0, .15]], palette.edge, companion);
  const smallSoil = mesh(geometry(new T.CylinderGeometry(.42, .4, .035, 32)), palette.soil, companion);
  smallSoil.position.y = .42;
  for (let i = 0; i < 7; i++) {
    const group = new T.Group();
    const angle = i * Math.PI * 2 / 7;
    group.position.y = .43;
    group.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(Math.sin(angle) * .7, .65 + i * .025, Math.cos(angle) * .7).normalize());
    mesh(leafGeometry(.68 + (i % 2) * .1, .18), palette.leaf[i % 3], group);
    companion.add(group);
  }
  const pebbleGeometry = geometry(new T.SphereGeometry(1, 16, 10));
  [[-1.6, .9, .24], [-1.85, .64, .13], [1.36, -1.1, .17], [1.6, -1.19, .1], [-1.2, -1.43, .11]].forEach(([x, z, scale], i) => {
    const pebble = mesh(pebbleGeometry, palette.pebble);
    pebble.scale.set(scale * 1.3, scale * .55, scale);
    pebble.position.set(x, -.2 + scale * .36, z);
    pebble.rotation.y = i * 1.4;
  });
  const ground = mesh(geometry(new T.PlaneGeometry(200, 200)), material('#111b16', .96), scene);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.53;
  ground.castShadow = false;
  scene.add(new T.HemisphereLight('#d9f2ca', '#1b3223', 2.35));
  const key = new T.DirectionalLight('#edffd6', 4.2);
  key.position.set(5, 8, 4);
  key.castShadow = !preview;
  key.shadow.mapSize.setScalar(innerWidth < 700 ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 7, bottom: -5, near: .1, far: 25 });
  key.shadow.bias = -.0003;
  key.shadow.normalBias = .025;
  scene.add(key);
  const rimLight = new T.DirectionalLight('#83cfa4', 1.3);
  rimLight.position.set(-5, 4, -5);
  scene.add(rimLight);

  let exact = preview ? 3 : 0;
  let smooth = exact;
  let activeIndex = -1;
  let visible = true;
  let lost = false;
  let disposed = false;
  let raf = 0;
  let last = performance.now();
  let sampleFrames = 0;
  let sampleTotal = 0;
  let slowFrames = 0;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0 };
  const target = new T.Vector3();
  const position = new T.Vector3();
  const nextPosition = new T.Vector3();
  const nextTarget = new T.Vector3();
  const sectionNodes = journeyRoot ? [...journeyRoot.querySelectorAll<HTMLElement>('.growth-chapter')] : [];
  let sectionTops: number[] = [];
  let mobile = host.clientWidth < 600;
  let scrollTrigger: { kill: () => void; refresh: () => void } | undefined;
  const measure = () => {
    sectionTops = sectionNodes.map(node => node.getBoundingClientRect().top + window.scrollY - window.innerHeight * .4);
  };
  const updateExact = () => {
    if (preview || !sectionTops.length) return;
    const y = window.scrollY;
    let index = 0;
    while (index < sectionTops.length - 1 && y >= sectionTops[index + 1]) index++;
    const span = (sectionTops[index + 1] ?? sectionTops[index] + window.innerHeight) - sectionTops[index];
    exact = T.MathUtils.clamp(index + (y - sectionTops[index]) / Math.max(1, span), 0, 3);
    const nextActive = Math.min(3, Math.round(exact));
    if (nextActive !== activeIndex) { activeIndex = nextActive; onChapter(nextActive); }
    host.dataset.worldProgress = exact.toFixed(3);
    requestFrame();
  };
  function render(time: number) {
    raf = 0;
    if (disposed || lost || !visible || document.hidden) return;
    const elapsed = Math.min((time - last) / 1000, 1 / 30);
    const frameTime = time - last;
    last = time;
    smooth = motion.matches ? Math.round(exact) : T.MathUtils.damp(smooth, exact, 5.2, elapsed);
    const i = Math.min(2, Math.floor(smooth));
    const fraction = Math.min(1, smooth - i);
    const a = chapters[i];
    const b = chapters[i + 1];
    const sourceA = mobile ? a.mobile : a.position;
    const sourceB = mobile ? b.mobile : b.position;
    position.fromArray(sourceA).lerp(nextPosition.fromArray(sourceB), fraction);
    target.fromArray(a.target).lerp(nextTarget.fromArray(b.target), fraction);
    if (preview) {
      position.set(6.3, 5.2, 8.3);
      target.set(0, 1.25, 0);
    }
    camera.position.copy(position);
    if (!motion.matches) { camera.position.x += pointer.x * .16; camera.position.y += pointer.y * .1; }
    camera.fov = preview ? 35 : T.MathUtils.lerp(a.fov, b.fov, fraction) + (mobile ? 4 : 0);
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    const growthProgress = preview ? 1 : .26 + Math.min(1, smooth / 2.15) * .74;
    growth.scale.set(.64 + growthProgress * .36, growthProgress, .64 + growthProgress * .36);
    key.intensity = 3.6 + smooth * .2;
    if (!motion.matches) for (const leaf of leaves) leaf.group.rotation.z = leaf.baseRotation + Math.sin(time * .00065 + leaf.phase) * .015;
    renderer.render(scene, camera);
    if (++sampleFrames % 40 === 0) {
      host.dataset.worldDrawCalls = String(renderer.info.render.calls);
      host.dataset.worldTriangles = String(renderer.info.render.triangles);
      host.dataset.worldFrameMs = (sampleTotal / 40).toFixed(1);
      sampleTotal = 0;
    }
    sampleTotal += frameTime;
    if (frameTime > 30 && frameTime < 300) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 100 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); resize(); slowFrames = 0; }
    if (!motion.matches) requestFrame();
  }
  function requestFrame() {
    if (!raf && !disposed && visible && !document.hidden && !lost) { last = performance.now(); raf = requestAnimationFrame(render); }
  }
  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    mobile = width < 600;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    measure();
    updateExact();
    requestFrame();
  }
  function onVisibility() { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else requestFrame(); }
  function onPointer(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || motion.matches) return;
    const rect = host.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width - .5;
    pointer.y = (event.clientY - rect.top) / rect.height - .5;
  }
  function onPointerLeave() { pointer.x = 0; pointer.y = 0; }
  function onContextLoss(event: Event) { event.preventDefault(); lost = true; cancelAnimationFrame(raf); raf = 0; host.dataset.worldReady = 'fallback'; }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) requestFrame(); else { cancelAnimationFrame(raf); raf = 0; } }, { rootMargin: '100px' });
  intersectionObserver.observe(host);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.5));
  canvas.addEventListener('webglcontextlost', onContextLoss);
  host.addEventListener('pointermove', onPointer);
  host.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibility);
  motion.addEventListener('change', requestFrame);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pageshow', updateExact);
  window.addEventListener('hashchange', updateExact);
  resize();
  if (!preview && journeyRoot) {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    if (!isCancelled()) {
      gsap.registerPlugin(ScrollTrigger);
      scrollTrigger = ScrollTrigger.create({ trigger: journeyRoot, start: 'top top', end: 'bottom bottom', onUpdate: updateExact, onRefresh: () => { measure(); updateExact(); } });
      await document.fonts.ready;
      scrollTrigger.refresh();
    }
  }
  host.dataset.worldReady = 'true';
  requestFrame();
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    scrollTrigger?.kill();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    canvas.removeEventListener('webglcontextlost', onContextLoss);
    host.removeEventListener('pointermove', onPointer);
    host.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    motion.removeEventListener('change', requestFrame);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pageshow', updateExact);
    window.removeEventListener('hashchange', updateExact);
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    key.shadow.map?.dispose();
    renderer.dispose();
    canvas.remove();
  };
}

function GardenScene({ preview = false, journeyRoot, onChapter }: { preview?: boolean; journeyRoot?: RefObject<HTMLElement | null>; onChapter?: (index: number) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    mountGarden(host, preview, journeyRoot?.current ?? null, onChapter ?? (() => undefined), () => cancelled)
      .then(dispose => { if (cancelled) dispose(); else cleanup = dispose; })
      .catch(() => { if (!cancelled) host.dataset.worldReady = 'fallback'; });
    return () => { cancelled = true; cleanup?.(); };
  }, [preview, journeyRoot, onChapter]);
  return <div ref={hostRef} className={`garden-render ${preview ? 'garden-render-preview' : ''}`} data-world-ready="loading" aria-hidden="true">
    <div className="garden-fallback"><Leaf size={preview ? 32 : 58} strokeWidth={1} /><span>{preview ? 'A little growth, every day.' : 'Your growth starts with one small action.'}</span><small className="garden-fallback-loading">Growing your garden…</small><small className="garden-fallback-error">Your progress is still here. Continue through your story below.</small></div>
  </div>;
}

export function GardenPreview() {
  return <GardenScene preview />;
}

export default function GrowthWorld({ entries, onCheckIn }: { entries: EntryLike[]; onCheckIn: () => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const changeChapter = useCallback((index: number) => setActive(index), []);
  const counts = useMemo(() => ({
    days: entries.length,
    green: entries.filter(e => e.status === 'green').length,
    workouts: entries.filter(e => e.workoutDone).length,
    study: entries.reduce((sum, e) => sum + (e.studyMinutes ?? 0), 0),
    guitar: entries.filter(e => e.guitarDone).length,
  }), [entries]);
  return <section ref={rootRef} className="growth-world" aria-label="Your growth garden">
    <header className="growth-heading"><div><h1>A little growth,<br /><span>every single day.</span></h1><p>Your routines are taking root. Step back and see the bigger picture.</p></div><a href="#show-up" className="garden-explore">Explore your garden <ArrowDown size={17} /></a></header>
    <div className="growth-layout">
      <div className="garden-sticky">
        <div className="garden-stage"><GardenScene journeyRoot={rootRef} onChapter={changeChapter} />
          <div className="garden-stage-caption"><span><i /> Personal growth garden</span><span>Interactive 3D</span></div>
          <div className="garden-stage-bottom"><span>{chapters[active].short}</span><div className="garden-dots">{chapters.map((chapter, i) => <a key={chapter.id} href={`#${chapter.id}`} aria-label={chapter.short} aria-current={active === i ? 'step' : undefined}><span /></a>)}</div><MoveDown size={16} /></div>
        </div>
        <p className="garden-disclaimer">An illustrative garden. Every number below comes from your own check-ins.</p>
      </div>
      <div className="growth-chapters">
        <section className="growth-chapter" id="show-up"><div className="growth-chapter-content"><h2>{chapters[0].title}</h2><p>No perfect routine required. Making a record is a small promise to yourself—and a place to begin again.</p><div className="growth-proof"><strong>{counts.days}</strong><span>{counts.days === 1 ? 'day recorded' : 'days recorded'}<small>{counts.green} marked green, by your definition</small></span></div><a href="#strength" className="garden-next">Keep growing <ArrowDown size={16} /></a></div></section>
        <section className="growth-chapter" id="strength"><div className="growth-chapter-content"><h2>{chapters[1].title}</h2><p>A workout, a meal, a moment of recovery. Give your effort a little credit and your body a little patience.</p><div className="growth-proof"><strong>{counts.workouts}</strong><span>workouts logged<small>Strength is built one session at a time</small></span></div><a href="#focus" className="garden-next">Make space for focus <ArrowDown size={16} /></a></div></section>
        <section className="growth-chapter" id="focus"><div className="growth-chapter-content"><h2>{chapters[2].title}</h2><p>A page understood. A chord that finally clicks. These quiet efforts deserve a place in your story, too.</p><div className="growth-focus-pair"><div><strong>{counts.study >= 60 ? (counts.study / 60).toFixed(1) : counts.study}</strong><span>{counts.study >= 60 ? 'hours studying' : 'minutes studying'}</span></div><div><strong>{counts.guitar}</strong><span>days with guitar</span></div></div><a href="#whole-garden" className="garden-next">See the whole garden <ArrowDown size={16} /></a></div></section>
        <section className="growth-chapter" id="whole-garden"><div className="growth-chapter-content"><h2>{chapters[3].title}</h2><p>Your history will have bright days and difficult ones. Both belong here. Keep the record honest, and keep making room to grow.</p><button type="button" className="garden-check-in" onClick={onCheckIn}>Make today's check-in <ArrowUpRight size={18} /></button><p className="garden-closing">Start where you are. Grow from there.</p></div></section>
      </div>
    </div>
  </section>;
}
