# Daily Priorities

Scroll from the whole pyramid to its study foundation, gym middle, and guitar tip while one model stays in view. Saved daily activity lights each layer. The ordered forms and tier controls work independently of the canvas.

| View | Camera position | Target | Lens | Focus |
| --- | --- | --- | --- | --- |
| Whole pyramid | `[6.6, 4.6, 8.8]` | `[0, 1.5, 0]` | 35° | Read the full silhouette and all three seams |
| Study | `[4.2, 2.45, 7.5]` | `[0, .78, 0]` | 36° | Broad emerald foundation |
| Gym | `[-5.5, 3.55, 5.7]` | `[0, 1.65, 0]` | 35° | Blue middle tier from the other side |
| Guitar | `[-3.6, 5.65, 5.3]` | `[0, 2.4, 0]` | 34° | Amber tip from above |

Narrow compositions pull back relative to the look target and use a wider lens. The sightline stays above the plinth. ScrollTrigger measures the ordered HTML anchors and feeds one reversible, damped camera rig. A paused view holds its framing. Reduced motion jumps to composed endpoints.

The scene contains a graphite plinth and inset rings, three faceted mineral shells with metallic edge inlays, and a neutral key, hemisphere fill, and cool rim. Study uses `#b9ee87`, Gym `#80caff`, and Guitar `#f4b56e`. Saved activity raises the corresponding tier's emission. Blank and explicit no-activity days have separate text states. A drawn CSS pyramid carries the same states before the scene loads and when 3D is unavailable.

HTML buttons jump to the tier forms for pointer, touch, and keyboard users. Forms edit the same dated SQLite check-in as the original pages. The scene is decorative and has no exclusive controls. Each tier links to its full check-in for details. The date selector and all edits remain available with a static view.

Geometry and colors are generated locally. The geometry bundle loads on this route only and reuses the project's existing Three.js and GSAP. Budget: 40 draw calls, 10,000 triangles, one shadow map at 1024 square, DPR capped at 1.35 narrow and 1.65 wide. Render on demand and sleep when paused and settled, offscreen, or hidden. Dispose all owned resources and triggers when leaving the route.

## Verification

Chrome 157 on Windows rendered the overview and each tier at 1440×900, 768×1024, and 390×844. The camera reached each authored view in both scroll directions on the same canvas. All tier endpoints used 19 draw calls and 1,440 triangles. The optional pyramid route, scene, and shared libraries add about 236 kB of gzip-compressed assets on a cold build.

The browser checks used a synthetic in-memory profile. They verified date navigation and reload, persistence into the full Training check-in, preservation of unrelated data, a saved-only completion count, render idling, pause and resume, reduced motion, and fallback after context loss. Separate hardware GPU timing and physical mobile testing were outside this run.
