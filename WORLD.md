# The growth garden

Travel from a seed at soil level, up through the same growing stems, into an unfolding canopy, and finally out to a complete miniature garden. The scene is an illustrative reminder of steady practice; numeric progress always comes from the user's real entries.

Native document scroll owns a reversible camera and growth state. The four chapter links reproduce the same authored views, while daily logging remains a normal DOM action outside the canvas.

## Art direction and constants

One unit represents 10 cm. A sculptural indoor garden sits on a graphite mineral plinth in a dark botanical observatory. The user explicitly requested a dark high-tech direction. Soft rounded metal ceramics, continuous curved branches, double-curved leaves, and restrained authored clusters establish silhouette before detail. One precise luminous perimeter traces the platform. No downloaded textures, randomized scatter, particles, bloom, or glass.

| Role | Value |
| --- | --- |
| Ground | `#111b16` |
| Mineral plinth | `#26362c`, roughness .86, metalness .16 |
| Ceramic metal | `#31483a`, roughness .48, metalness .32 |
| Soil | `#17251b`, roughness 1 |
| Stem | `#6d8c4f`, roughness .7 |
| Canopy | `#91bd65`, `#5d9650`, `#b3d789`, roughness .56–.62 |
| Veins | `#bedb8c`, roughness .68 |
| Emissive perimeter | `#bde992`, emissive `#a6e36c`, intensity .38 |
| Text | `#edf4e8`, muted `#9ba997`, accent `#c0ee82` |
| Camera | FOV 33–40°, near .1, far 60, no roll or depth of field |
| Motion | exponential damping 5.2; dt max 1/30; leaf sway .015 rad, .65 rad/s |

## Chapter and camera ledger

The topology is a layered reveal of one place. All geometry remains resident and all transforms derive from one scroll state. No chapter swaps or teleports.

| Chapter | Meaning and landmark | Camera position | Camera target | FOV | Mobile position / target / FOV |
| --- | --- | --- | --- | --- | --- |
| show-up | Soil, seed, and the first two leaves | `[5,3.3,7]` | `[0,.9,0]` | 35 | `[6,4,9]` / `[0,1,0]` / 39 |
| strength | Rise to see continuous branching stems | `[-4.8,4.5,6.8]` | `[0,1.7,0]` | 35 | `[-6,5.3,9]` / `[0,1.5,0]` / 39 |
| focus | A side view reveals broad folded leaves | `[-5.6,4.8,-4.6]` | `[0,2,0]` | 36 | `[-7,5.5,-6]` / `[0,1.8,0]` / 40 |
| whole-garden | Pull back to an overhead composition | `[6,7.5,8]` | `[0,1.2,0]` | 34 | `[7.5,8.5,10]` / `[0,1.3,0]` / 40 |

Each chapter has equal scroll weight. Exact state determines chapter labels and navigation; damped state determines camera, plant scale, and light intensity. Under reduced motion, the scene renders only the nearest composed endpoint and ambient sway is disabled.

## Material, asset, and lighting ledger

All local geometry is generated in JavaScript: lathed ceramic planter, mineral disk, soil bed, quadratic/cubic tubes for branches and veins, authored parametric leaf surfaces, and smooth pebbles. No texture maps means no color-space ambiguity or external asset failure. Renderer output is sRGB, ACES tone mapping, exposure 1.12.

One warm directional key at `[5,8,4]`, intensity 3.6–4.2; hemisphere fill 2.35; a cool green directional rim at `[-5,4,-5]`, intensity 1.3 separates leaf planes. One 1024 shadow map on desktop, 512 on mobile; bounded shadow frustum ±6, bias -.0003. Fog uses the dark ground only at distant depth. No postprocessing or shadow-casting practical lights.

## Layers and lifecycle

```text
semantic DOM: title, chapter links, four real-data chapters, check-in action
sticky garden stage
  WebGL renderer (one)
    scene
      environment: matte ground + lights
      graphite mineral plinth + luminous perimeter
      planter: foot + lathed bowl + rim + soil + seed
      plant-growth group: shared stems + curved leaves + veins
      companion succulent
      authored stones
  CSS loading/failure composition and status text
  real-data caption and scroll progress
```

Three.js is dynamically imported after the garden or its dashboard preview mounts. The same scene factory serves both, with lower geometry detail and no shadows on the compact preview. Each route has one renderer, and the Journey renderer persists across every chapter. Procedural geometry is fully available before the first frame. The loading state remains composed and readable. WebGL creation failure/context loss retains every semantic chapter and real count. ResizeObserver updates aspect and camera waypoints; hidden tabs and offscreen stages stop RAF. Unmount kills only this world's ScrollTrigger and disposes all owned resources/listeners/observers/RAF.

## Interaction matrix

| Action | Availability | Feedback | Keyboard and fallback |
| --- | --- | --- | --- |
| Select chapter | All chapters | Native scroll to section, current link updated from exact state | Real anchor, visible focus, aria-current |
| Log today | Closing chapter | Calls parent check-in action | Real button, always available without WebGL |
| Read garden counts | All chapters | Real entries, workouts, study minutes, guitar days | Semantic text, canvas aria-hidden |

No essential canvas hotspots or pointer camera controls. Touch scroll remains native.

## Budget and evidence

Targets: DPR ≤1.5 desktop /1.25 mobile, <70 draw calls, <100k triangles, one shadowed light, <1 MB lazy compressed 3D JavaScript, no texture downloads, steady frame time ≤25 ms on integrated graphics. First quality reduction lowers DPR to 1 after sustained frame delays. `data-world-ready`, `data-world-progress`, `data-world-frame-ms`, `data-world-draw-calls`, and `data-world-triangles` expose runtime evidence on the stage.

Browser verification belongs to the integrated app: inspect all four chapter endpoints at 1440×900, 768×1024, and 390×844; forward/reverse/anchor/reload/resize; reduced-motion, WebGL failure, and hidden-tab return. Actual hardware GPU time and real mobile thermal behavior remain unverified until measured. No performance target is represented as an observed result.

### Integrated browser verification, 1 November 2026

The QA agent's fresh headless Chrome run passed all ten exercised checks with zero console or page errors. All four chapters and reverse native scroll rendered correctly on desktop, tablet, and mobile. Saved desktop/mobile stage captures show geometry. The reduced-motion focus view and deliberately triggered WebGL context-loss fallback both retained the story, and the closing check-in action worked.

Observed renderer totals were 51–52 draw calls and 22,874–23,162 triangles. The stage's active-RAF interval average was 6.9–7.0 ms in this headless environment; this measures browser frame scheduling, not GPU execution time or real-device performance. No real mobile thermal, battery, or integrated-GPU measurements are claimed. Evidence is in the task's `outputs/Momentum-world-*.png` captures and `outputs/Momentum-QA-report.json`.
