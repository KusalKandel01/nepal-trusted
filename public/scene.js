/**
 * scene.js — Delivery-network 3D hero.
 * Renders a stylized low-poly map of Nepal with a glowing hub-and-spoke
 * delivery network (Kathmandu -> Chitwan, Gaindakot, and other cities).
 *
 * Loading strategy: Three.js r128 is loaded from cdnjs as a classic
 * (non-module) script and used as a global `THREE`. This is deliberate —
 * some sandboxed preview environments only whitelist cdnjs.cloudflare.com
 * for external scripts, so a jsdelivr/unpkg ES-module import can be
 * silently blocked there. cdnjs also doesn't ship the OrbitControls addon
 * for r128, so mouse/touch orbiting is implemented by hand below instead
 * of depending on THREE.OrbitControls.
 *
 * Design goals (unchanged):
 *  - Never block or break the page. Every failure path falls back to the
 *    static CSS gradient hero that's already in the markup.
 *  - Respect prefers-reduced-motion and data-saver users.
 *  - Pause rendering when the tab is hidden.
 */

const THREE_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.THREE) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function initHeroScene({ canvasId = "scene-canvas", noteId = "engineNote" } = {}) {
  const canvas = document.getElementById(canvasId);
  const engineNote = document.getElementById(noteId);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = navigator.connection && navigator.connection.saveData;

  function supportsWebGL() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  if (!canvas) return;

  if (prefersReducedMotion || saveData || !supportsWebGL()) {
    if (engineNote) engineNote.textContent = "Static view (motion reduced or 3D unsupported)";
    return;
  }

  try {
    await loadScript(THREE_CDN_URL);
  } catch (err) {
    console.warn("3D engine failed to load; showing static hero.", err);
    if (engineNote) engineNote.textContent = "Static view (3D engine unavailable)";
    return;
  }

  const THREE = window.THREE;
  if (!THREE) {
    console.warn("THREE global not found after script load.");
    if (engineNote) engineNote.textContent = "Static view (3D engine unavailable)";
    return;
  }

  try {
    let width = window.innerWidth,
      height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x101a2e, 0.028);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);

    scene.add(new THREE.AmbientLight(0x384766, 1.1));
    const moon = new THREE.DirectionalLight(0x8fa3d1, 0.6);
    moon.position.set(-6, 12, 4);
    scene.add(moon);
    const hubGlow = new THREE.PointLight(0xe2a63b, 3.2, 26, 2);
    hubGlow.position.set(0, 2.4, -2);
    scene.add(hubGlow);

    // Terrain
    const groundGeo = new THREE.PlaneGeometry(46, 30, 56, 40);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    const colors = [];
    const cNavy = new THREE.Color(0x1a2540);
    const cJade = new THREE.Color(0x2f4a3d);
    const cMarigold = new THREE.Color(0x8a6a35);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      const h = Math.sin(x * 0.18) * Math.cos(z * 0.15) * 1.4 + Math.sin(x * 0.5 + z * 0.3) * 0.5 + Math.cos(z * 0.08) * 1.1;
      pos.setY(i, h);
      const t = THREE.MathUtils.clamp((h + 2) / 4, 0, 1);
      const col = cNavy.clone().lerp(t > 0.55 ? cMarigold : cJade, Math.min(t * 1.3, 1));
      colors.push(col.r, col.g, col.b);
    }
    groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0.05 })
    );
    ground.position.y = -1.2;
    scene.add(ground);

    // City nodes — stylized relative layout, not geographically precise
    const CITIES = {
      kathmandu: { pos: new THREE.Vector3(0, 0.4, -2), hub: true, label: "labelKtm" },
      chitwan: { pos: new THREE.Vector3(-3, 0.1, 6.2), label: "labelChitwan" },
      gaindakot: { pos: new THREE.Vector3(-5.2, 0.1, 7), label: "labelGaindakot" },
      pokhara: { pos: new THREE.Vector3(-9, 0.2, -3.6) },
      butwal: { pos: new THREE.Vector3(-11, 0.1, 8) },
      birgunj: { pos: new THREE.Vector3(0.4, 0.1, 9) },
      janakpur: { pos: new THREE.Vector3(7, 0.1, 8.6) },
      biratnagar: { pos: new THREE.Vector3(13, 0.1, 7.6) },
    };

    const markerGroup = new THREE.Group();
    Object.values(CITIES).forEach((c) => {
      const size = c.hub ? 0.34 : 0.16;
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        new THREE.MeshStandardMaterial({
          color: c.hub ? 0xffe3ac : 0xe2a63b,
          emissive: c.hub ? 0xe2a63b : 0xb8862e,
          emissiveIntensity: c.hub ? 1.4 : 0.7,
          roughness: 0.4,
        })
      );
      mesh.position.copy(c.pos);
      markerGroup.add(mesh);
      c.mesh = mesh;
    });
    scene.add(markerGroup);

    // Delivery lanes + traveling shipment dots
    const hub = CITIES.kathmandu.pos;
    const lanes = [];
    const dotGeo = new THREE.SphereGeometry(0.09, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffd88a });

    Object.entries(CITIES).forEach(([key, c]) => {
      if (key === "kathmandu") return;
      const mid = hub.clone().lerp(c.pos, 0.5);
      mid.y += 2.6 + Math.random() * 0.6;
      const curve = new THREE.QuadraticBezierCurve3(hub.clone(), mid, c.pos.clone());
      const points = curve.getPoints(40);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xe2a63b, transparent: true, opacity: 0.28 });
      scene.add(new THREE.Line(lineGeo, lineMat));

      const dot = new THREE.Mesh(dotGeo, dotMat);
      scene.add(dot);
      lanes.push({ curve, dot, offset: Math.random(), speed: 0.06 + Math.random() * 0.03 });
    });

    // Ambient marigold particles
    const PARTICLE_COUNT = width < 640 ? 60 : 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 40;
      particlePos[i * 3 + 1] = Math.random() * 10 - 1;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({ color: 0xe2a63b, size: 0.07, transparent: true, opacity: 0.55 })
    );
    scene.add(particles);

    // ---- Hand-rolled orbit control (drag to look, wheel to zoom, auto-rotates when idle) ----
    // Replaces THREE.OrbitControls, which isn't bundled in cdnjs's r128 build.
    const target = new THREE.Vector3(-1, 0, 2);
    let radius = 20,
      targetRadius = 20;
    let theta = 0.35,
      targetTheta = 0.35; // azimuth
    let phi = 1.0,
      targetPhi = 1.0; // polar, clamped away from poles
    let dragging = false,
      lastX = 0,
      lastY = 0,
      idleSince = 0;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // ---- Scroll-linked drift ----
    // As the page scrolls, the camera pulls back and tilts slightly more
    // overhead and the focal point drifts south toward the Terai cities —
    // a subtle "flying over the network" feel that ties the 3D background
    // to page position, since it now spans the entire site, not just the hero.
    let scrollProgress = 0;
    function updateScrollProgress() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    }
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    updateScrollProgress();

    function pointerDown(e) {
      dragging = true;
      idleSince = performance.now();
      lastX = e.clientX;
      lastY = e.clientY;
      if (canvas.setPointerCapture && e.pointerId !== undefined) {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    }
    function pointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX,
        dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      targetTheta -= dx * 0.006;
      targetPhi = clamp(targetPhi - dy * 0.006, 0.35, 1.45);
      idleSince = performance.now();
    }
    function pointerUp() {
      dragging = false;
      idleSince = performance.now();
    }
    function wheelZoom(e) {
      e.preventDefault();
      targetRadius = clamp(targetRadius + e.deltaY * 0.015, 12, 28);
    }
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("wheel", wheelZoom, { passive: false });
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", () => (canvas.style.cursor = "grabbing"));
    window.addEventListener("pointerup", () => (canvas.style.cursor = "grab"));

    // Screen-space labels
    const labelEls = {
      kathmandu: document.getElementById("labelKtm"),
      chitwan: document.getElementById("labelChitwan"),
      gaindakot: document.getElementById("labelGaindakot"),
    };
    const tmpVec = new THREE.Vector3();
    function updateLabels() {
      ["kathmandu", "chitwan", "gaindakot"].forEach((key) => {
        const c = CITIES[key],
          el = labelEls[key];
        if (!c || !el) return;
        tmpVec.copy(c.pos).setY(c.pos.y + 0.6);
        tmpVec.project(camera);
        const inFront = tmpVec.z < 1;
        const x = (tmpVec.x * 0.5 + 0.5) * width;
        const y = (-tmpVec.y * 0.5 + 0.5) * height;
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -140%)`;
        el.style.opacity = inFront ? "1" : "0";
      });
    }

    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    window.addEventListener("resize", onResize);

    let running = true;
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      if (!running) return;
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();

      lanes.forEach((l) => {
        l.offset = (l.offset + dt * l.speed) % 1;
        l.curve.getPointAt(l.offset, l.dot.position);
      });
      hubGlow.intensity = 2.8 + Math.sin(t * 1.6) * 0.5;

      const pArr = particleGeo.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pArr[i * 3 + 1] += dt * 0.25;
        if (pArr[i * 3 + 1] > 9) pArr[i * 3 + 1] = -1;
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Auto-rotate only after a beat of no user interaction
      if (!dragging && performance.now() - idleSince > 900) {
        targetTheta += dt * 0.12;
      }
      const scrollPhiGoal = clamp(targetPhi - scrollProgress * 0.3, 0.35, 1.45);
      const scrollRadiusGoal = targetRadius + scrollProgress * 7;
      const scrollTargetZ = 2 + scrollProgress * 4.5;

      theta += (targetTheta - theta) * 0.08;
      phi += (scrollPhiGoal - phi) * 0.05;
      radius += (scrollRadiusGoal - radius) * 0.05;
      target.z += (scrollTargetZ - target.z) * 0.05;
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.sin(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(target);

      updateLabels();
      renderer.render(scene, camera);
    }
    animate();
    canvas.classList.add("ready");
    if (engineNote) engineNote.textContent = "";
  } catch (err) {
    console.error("3D scene failed to initialize:", err);
    if (engineNote) engineNote.textContent = "Static view (3D scene error)";
  }
}
