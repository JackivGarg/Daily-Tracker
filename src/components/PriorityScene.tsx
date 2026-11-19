import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

const anchorIds = ["priorities-top", "priority-study", "priority-gym", "priority-guitar"];
const views = [
  { position: [6.6, 4.6, 8.8], target: [0, 1.5, 0], fov: 35 },
  { position: [4.2, 2.45, 7.5], target: [0, .78, 0], fov: 36 },
  { position: [-5.5, 3.55, 5.7], target: [0, 1.65, 0], fov: 35 },
  { position: [-3.6, 5.65, 5.3], target: [0, 2.4, 0], fov: 34 },
];

const layers = [
  { y: .6, bottom: 2, top: 1.49, height: .73, color: "#b9ee87", stone: "#344a35" },
  { y: 1.45, bottom: 1.42, top: .87, height: .73, color: "#80caff", stone: "#2c4258" },
  { y: 2.31, bottom: .81, top: .025, height: .84, color: "#f4b56e", stone: "#60472d" },
];

type Props = {
  lit: readonly boolean[];
  paused: boolean;
  onReady: (ready: boolean) => void;
  onChapter: (chapter: number) => void;
};

export default function PriorityScene({ lit, paused, onReady, onChapter }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const input = useRef({ lit, paused, onReady, onChapter });
  const requestFrame = useRef<() => void>(() => {});
  useEffect(() => {
    input.current = { lit, paused, onReady, onChapter };
    requestFrame.current();
  }, [lit, paused, onReady, onChapter]);

  useEffect(() => {
    const mounted = host.current;
    if (!mounted) return;
    const el = mounted;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onReady(false);
      return;
    }
    const { domElement: canvas } = renderer;
    el.append(canvas);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 45);
    const key = new THREE.DirectionalLight("#fff0d8", 3.4);
    key.position.set(-4, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, far: 22 });
    key.shadow.normalBias = .018;
    key.shadow.radius = 3;
    const rim = new THREE.DirectionalLight("#9fcfff", 2.3);
    rim.position.set(5, 4, -5);
    scene.add(key, rim, new THREE.HemisphereLight("#dcffe7", "#363e48", 2.1));

    const owned = new Set<{ dispose: () => void }>();
    const world = new THREE.Group();
    scene.add(world);
    function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, y: number) {
      owned.add(geometry);
      owned.add(material);
      const model = new THREE.Mesh(geometry, material);
      model.position.y = y;
      world.add(model);
      return model;
    }

    const plinth = mesh(
      new THREE.CylinderGeometry(2.91, 3.05, .22, 72),
      new THREE.MeshStandardMaterial({ color: "#1d2926", roughness: .6, metalness: .3 }),
      .17,
    );
    plinth.receiveShadow = true;
    const foot = mesh(
      new THREE.CylinderGeometry(2.84, 2.9, .11, 72),
      new THREE.MeshStandardMaterial({ color: "#101918", roughness: .45, metalness: .4 }),
      .035,
    );
    foot.receiveShadow = true;
    for (const [radius, width, color, y] of [
      [2.77, .024, "#718575", .282],
      [2.63, .008, "#4b675c", .283],
      [3.28, .015, "#314c42", -.03],
      [3.44, .006, "#2a413a", -.03],
    ] as const) {
      const ring = mesh(
        new THREE.RingGeometry(radius - width, radius, 96),
        new THREE.MeshBasicMaterial({ color }),
        y,
      );
      ring.rotation.x = -Math.PI / 2;
    }
    const marks: number[] = [];
    for (let i = 0; i < 48; i++) {
      const angle = i * Math.PI / 24;
      for (const r of [3.32, i % 6 === 0 ? 3.41 : 3.36]) {
        marks.push(Math.cos(angle) * r, -.025, Math.sin(angle) * r);
      }
    }
    const ticks = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(marks, 3));
    const tickMaterial = new THREE.LineBasicMaterial({ color: "#39524a" });
    world.add(new THREE.LineSegments(ticks, tickMaterial));
    owned.add(ticks);
    owned.add(tickMaterial);

    const tiers = layers.map(({ y, bottom, top, height, color, stone }) => {
      const profile = (high: number, low: number, h: number) =>
        new THREE.CylinderGeometry(high * Math.SQRT2, low * Math.SQRT2, h, 4).rotateY(Math.PI / 4);
      const shell = new THREE.MeshStandardMaterial({
        color: stone, emissive: color, emissiveIntensity: .04, roughness: .39, metalness: .23,
      });
      const body = mesh(profile(top, bottom, height), shell, y + height / 2);
      body.castShadow = true;
      body.receiveShadow = true;
      const edge = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: .14, roughness: .4, metalness: .48,
      });
      mesh(profile(bottom + .012, bottom + .047, .042), edge, y + .018);
      const edgeLines = new THREE.EdgesGeometry(body.geometry, 20);
      const wire = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .42 });
      const seam = new THREE.LineSegments(edgeLines, wire);
      body.add(seam);
      owned.add(edgeLines);
      owned.add(wire);

      // Fine milled lines in each face reinforce the slope of the shell.
      const cuts = [];
      for (const fraction of [.2, .30, .4, .67, .77]) {
        const depth = THREE.MathUtils.lerp(bottom, top, fraction) + .006;
        const a = depth * .77;
        for (let side = 0; side < 4; side++) {
          const angle = side * Math.PI / 2;
          for (const x of [-a, a]) {
            cuts.push(x * Math.cos(angle) + depth * Math.sin(angle), y + height * fraction,
              depth * Math.cos(angle) - x * Math.sin(angle));
          }
        }
      }
      const groove = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(cuts, 3));
      const grooveMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .22 });
      world.add(new THREE.LineSegments(groove, grooveMaterial));
      owned.add(groove);
      owned.add(grooveMaterial);
      return { shell, edge, wire, grooveMaterial };
    });

    const anchors = anchorIds.map((id) => document.getElementById(id));
    const getHeight = () => el.clientHeight;
    let stops = [0, 1, 2, 3];
    let progress = 0, smooth = 0, active = 0;
    let raf = 0, previousTime = 0, frameCount = 0;
    let shown = false, visible = true, failed = false;
    const colorProgress = tiers.map((_, i) => Number(input.current.lit[i]));
    const position = new THREE.Vector3();
    const target = new THREE.Vector3();
    const next = new THREE.Vector3();

    function wake() {
      if (!raf && !failed && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    requestFrame.current = wake;
    function measure() {
      const max = ScrollTrigger.maxScroll(window);
      stops = anchors.map((anchor, index) => index === 0 || !anchor ? 0 : Math.min(max,
        anchor.getBoundingClientRect().top + window.scrollY - Number.parseFloat(getComputedStyle(anchor).scrollMarginTop)));
      update();
    }
    function update() {
      const y = window.scrollY;
      const endpoint = stops.findIndex((stop) => Math.abs(y - stop) <= 1.5);
      const segment = y >= stops[2] ? 2 : y >= stops[1] ? 1 : 0;
      progress = endpoint >= 0 ? endpoint : segment + THREE.MathUtils.clamp((y - stops[segment]) / Math.max(1, stops[segment + 1] - stops[segment]), 0, 1);
      const chapter = Math.round(progress);
      if (chapter !== active) {
        active = chapter;
        input.current.onChapter(chapter);
      }
      if (!input.current.paused) wake();
    }
    function frame(time: number) {
      raf = 0;
      if (failed || !visible || document.hidden || !el.clientWidth || !getHeight()) return;
      const dt = previousTime ? Math.min(.035, Math.max(0, (time - previousTime) / 1000)) : 1 / 60;
      previousTime = time;
      const snap = motion.matches || !shown;
      const { paused: frozen, lit: current } = input.current;
      if (!frozen || !shown) {
        smooth = snap ? active : THREE.MathUtils.damp(smooth, progress, 10, dt);
        if (!snap && Math.abs(smooth - progress) < .002) smooth = progress;
      }
      const index = Math.min(2, Math.floor(smooth));
      const mix = smooth - index;
      const a = views[index];
      const b = views[index + 1];
      position.fromArray(a.position).lerp(next.fromArray(b.position), mix);
      target.fromArray(a.target).lerp(next.fromArray(b.target), mix);
      const pullback = camera.aspect < 1.15 ? 1.13 : 1;
      camera.position.copy(target).lerp(position, pullback);
      camera.lookAt(target);
      camera.fov = THREE.MathUtils.lerp(a.fov, b.fov, mix) + (pullback > 1 ? 5 : 0);
      camera.updateProjectionMatrix();
      let animating = !snap && !frozen && smooth !== progress;
      tiers.forEach(({ shell, edge, wire, grooveMaterial }, i) => {
        const destination = Number(current[i]);
        let tint = snap || frozen ? destination : THREE.MathUtils.damp(colorProgress[i], destination, 9, dt);
        if (Math.abs(tint - destination) < .005) tint = destination;
        colorProgress[i] = tint;
        animating ||= tint !== destination;
        const focus = Math.max(0, 1 - Math.abs(smooth - i - 1));
        shell.emissiveIntensity = .025 + .25 * tint + .045 * focus;
        edge.emissiveIntensity = .12 + .9 * tint + .26 * focus;
        wire.opacity = .32 + .48 * tint + .15 * focus;
        grooveMaterial.opacity = .16 + .19 * tint;
      });
      renderer.render(scene, camera);
      el.dataset.progress = smooth.toFixed(3);
      el.dataset.frames = String(++frameCount);
      el.dataset.calls = String(renderer.info.render.calls);
      el.dataset.triangles = String(renderer.info.render.triangles);
      if (!shown) {
        shown = true;
        setReady(true);
        input.current.onReady(true);
      }
      if (animating) wake();
      else previousTime = 0;
    }
    function resize() {
      if (failed) return;
      const h = getHeight();
      if (!el.clientWidth || !h) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, el.clientWidth < 500 ? 1.35 : 1.65));
      renderer.setSize(el.clientWidth, h, false);
      camera.aspect = el.clientWidth / h;
      measure();
      wake();
    }
    function loseContext(event: Event) {
      event.preventDefault();
      failed = true;
      cancelAnimationFrame(raf);
      setReady(false);
      input.current.onReady(false);
    }
    const trigger = ScrollTrigger.create({
      trigger: anchors[0] ?? el,
      endTrigger: anchors[3] ?? el,
      start: 0,
      end: "max",
      onUpdate: update,
      onRefresh: measure,
    });
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(el);
    const layout = el.closest(".priority-layout");
    if (layout) sizeObserver.observe(layout);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
      else previousTime = 0;
    });
    intersection.observe(el);
    document.fonts.ready.then(() => { if (!failed) trigger.refresh(); });
    canvas.addEventListener("webglcontextlost", loseContext);
    document.addEventListener("visibilitychange", wake);
    motion.addEventListener("change", wake);
    resize();

    return () => {
      failed = true;
      trigger.kill();
      requestFrame.current = () => {};
      sizeObserver.disconnect();
      intersection.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", wake);
      motion.removeEventListener("change", wake);
      canvas.removeEventListener("webglcontextlost", loseContext);
      owned.forEach((item) => item.dispose());
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [onReady]);

  return <div className="priority-canvas" ref={host} data-ready={ready} aria-hidden="true" />;
}
