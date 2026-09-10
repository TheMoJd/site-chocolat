/* =====================================================================
   Les Chocolats de Yannick Alléno — main.js
   Cible laptop 1280–1920 px. Pas de build : ES modules chargés depuis un CDN.

   Sommaire
   01. Imports et utilitaires
   02. Smooth scroll (Lenis) synchronisé avec GSAP ScrollTrigger
   03. Pré-loader
   04. Header : état au scroll, méga-menu, panier
   05. Hero WebGL : scène, tablette procédurale, particules, shader de fonte
   06. Hero : timeline au scroll (texte + 3D)
   07. La collection : tuiles avec tilt 3D
   08. Collection du moment : défilement horizontal + ajout au panier
   09. Les deux chefs : diptyque draggable et pilotable au clavier
   10. Terroirs : points et fiches au survol
   11. Formulaires
   12. Apparitions au scroll (fallback quand scroll-timeline n'existe pas)
   13. Fiche produit : galerie, loupe, quantité, jauges
   ===================================================================== */

/* ---------------------------------------------------------------------
   01. Imports et utilitaires
   --------------------------------------------------------------------- */
import { gsap } from "https://esm.sh/gsap@3.12.5";
import { ScrollTrigger } from "https://esm.sh/gsap@3.12.5/ScrollTrigger";
import Lenis from "https://esm.sh/lenis@1.1.18";
import SplitType from "https://esm.sh/split-type@0.3.4";

gsap.registerPlugin(ScrollTrigger);

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const easeOut = (t) => 1 - Math.pow(1 - t, 2.4);
const smooth = (t) => t * t * (3 - 2 * t);

/* ---------------------------------------------------------------------
   02. Smooth scroll
   --------------------------------------------------------------------- */
const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------------------------------------------------------------------
   03. Pré-loader : un point cuivre, 800 ms maximum
   --------------------------------------------------------------------- */
let markHeroReady = () => {};
const heroReady = new Promise((r) => (markHeroReady = r));
Promise.race([heroReady, new Promise((r) => setTimeout(r, 800))]).then(() => {
  $("#preloader")?.classList.add("is-done");
});

/* ---------------------------------------------------------------------
   04. Header
   --------------------------------------------------------------------- */
const header = $("#header");
lenis.on("scroll", ({ scroll }) => header.classList.toggle("is-scrolled", scroll > 60));

// Méga-menu : la photo de droite suit la gamme survolée
const megaImg = $("#mega-img");
const megaCaption = $("#mega-caption");
$$(".mega a[data-img]").forEach((a) => {
  a.addEventListener("mouseenter", () => {
    if (megaImg.getAttribute("src") === a.dataset.img) return;
    gsap.fromTo(megaImg, { opacity: 0.35 }, { opacity: 1, duration: 0.6, ease: "power2.out" });
    megaImg.src = a.dataset.img;
    megaCaption.textContent = a.dataset.label;
  });
});

// Panier : compteur + micro-animation « pastille qui vole »
let cartCount = 0;
const cartBtn = $("#cart");
const cartCountEl = $("#cart-count");
function addToCart(fromImg, qty = 1) {
  const r = fromImg.getBoundingClientRect();
  const c = cartBtn.getBoundingClientRect();
  const dot = document.createElement("div");
  dot.className = "fly";
  dot.style.backgroundImage = `url("${fromImg.currentSrc || fromImg.src}")`;
  dot.style.left = r.left + r.width / 2 + "px";
  dot.style.top = r.top + r.height / 2 + "px";
  document.body.append(dot);
  gsap.timeline({
    onComplete() {
      dot.remove();
      cartCount += qty;
      cartCountEl.textContent = cartCount || '';
      cartBtn.setAttribute("aria-label", `Panier, ${cartCount} article${cartCount > 1 ? "s" : ""}`);
      gsap.fromTo(cartCountEl, { scale: 1.8 }, { scale: 1, duration: 0.6, ease: "back.out(3)" });
    },
  })
    .fromTo(dot, { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" })
    .to(dot, { left: c.left + c.width / 2, top: c.top + c.height / 2, duration: 0.85, ease: "power3.inOut" })
    .to(dot, { scale: 0.15, opacity: 0, duration: 0.25 }, "-=0.18");
}
$$("[data-add]").forEach((b) =>
  b.addEventListener("click", () => addToCart(b.closest("[data-product]").querySelector("img")))
);

/* ---------------------------------------------------------------------
   05. Hero WebGL
   Tablette 4x6 en géométrie procédurale, MeshPhysicalMaterial, HDRI studio
   procédural (PMREM), 4000 particules de cacao, shader de fonte injecté
   dans le matériau via onBeforeCompile.
   --------------------------------------------------------------------- */
const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// Déformation de fonte : uMelt 0 → 1 affaisse les sommets, étale la matière, ramollit les arêtes
const MELT_VERTEX = /* glsl */ `
vec3 transformed = vec3(position);
if (uMelt > 0.0) {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float n  = snoise(vec3(wp.xz * 0.6, uTime * 0.25));
  float n2 = snoise(vec3(wp.xz * 2.8 + 7.0, uTime * 0.4));
  float h  = clamp(position.y / 0.3 + 0.5, 0.0, 1.0);
  float m  = smoothstep(0.0, 1.0, uMelt);
  transformed.xz *= 1.0 + m * (0.5 + 0.3 * n) * (0.35 + 0.65 * h);
  transformed.y   = mix(transformed.y, -0.15 + h * 0.07, m);
  transformed.y  += m * (n * 0.11 + n2 * 0.03) * h;
}`;

const PARTICLE_VERT = /* glsl */ `
attribute vec3 aDir; attribute float aSeed;
uniform float uProgress; uniform float uTime; uniform float uPR;
varying float vA; varying float vS;
void main(){
  float s = aSeed; vS = s;
  float delay = fract(s * 3.31) * 0.35;
  float t = max(uProgress - delay, 0.0);
  float speed = 2.5 + 5.0 * fract(s * 7.13);
  vec3 p = aDir * t * speed;
  p.y += t * t * (1.5 + 2.5 * fract(s * 5.7));
  p.x += sin(uTime * 0.9 + s * 40.0) * 0.3 * t;
  p.z += cos(uTime * 0.7 + s * 30.0) * 0.3 * t;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = mix(2.0, 6.0, fract(s * 11.3)) * uPR;
  vA = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.55, 1.15, t)) * (0.35 + 0.65 * fract(s * 9.1));
}`;
const PARTICLE_FRAG = /* glsl */ `
uniform sampler2D uTex; varying float vA; varying float vS;
void main(){
  float a = texture2D(uTex, gl_PointCoord).a * vA;
  if (a < 0.002) discard;
  vec3 col = mix(vec3(0.10, 0.05, 0.03), vec3(0.42, 0.24, 0.11), fract(vS * 4.7));
  gl_FragColor = vec4(col, a * 0.6);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}
function showHeroFallback() {
  const fb = $("#hero-fallback"), cv = $("#hero-canvas");
  if (fb) fb.style.display = "block";
  if (cv) cv.style.display = "none";
  markHeroReady();
}

const heroState = $("#hero-canvas") ? initHeroText() : null;

async function initHero() {
  const canvas = $("#hero-canvas");
  if (!canvas) return;
  if (!hasWebGL()) return showHeroFallback();

  let THREE, RoundedBoxGeometry;
  try {
    THREE = await import("three");
    ({ RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js"));
  } catch {
    return showHeroFallback();
  }

  /* Renderer + caméra */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 80);

  /* HDRI studio sombre, généré : une pièce noire avec un panneau chaud en haut à gauche et un panneau cuivre à contre-jour */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x080605, side: THREE.BackSide })));
  const panel = (w, h, hex, k, pos) => {
    const mat = new THREE.MeshBasicMaterial({ color: hex });
    mat.color.multiplyScalar(k);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  panel(7, 4, 0xffe3c4, 6, [-6, 8, 3]);   // key chaude
  panel(6, 2, 0xb87333, 4, [5, 2.5, -8]);  // rim cuivre
  panel(10, 2, 0x6b4a33, 1.4, [0, -1, 9]); // fill discret
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  envScene.clear();

  /* Éclairage direct */
  const key = new THREE.DirectionalLight(0xffdcc0, 3.2);
  key.position.set(-6, 9, 4);
  const rim = new THREE.SpotLight(0xb87333, 16, 40, 0.75, 0.7, 1.1);
  rim.position.set(5, 3, -7);
  scene.add(key, rim, rim.target, new THREE.AmbientLight(0x3b2418, 0.7));

  /* Matériau chocolat, avec le shader de fonte injecté */
  const uniforms = { uMelt: { value: 0 }, uTime: { value: 0 } };
  const choco = new THREE.MeshPhysicalMaterial({
    color: 0x1a0f0a, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.28,
    emissive: 0x3a1a0c, emissiveIntensity: 0.32, envMapIntensity: 0.9,
    sheen: 0.25, sheenColor: 0x5a2e14,
  });
  choco.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nuniform float uMelt;\nuniform float uTime;\n${SNOISE}`)
      .replace("#include <begin_vertex>", MELT_VERTEX);
  };

  /* Tablette : 4 rangées x 6 colonnes de pavés adoucis */
  const COLS = 6, ROWS = 4, SIZE = 0.92, GAP = 0.08, PUDDLE_Y = -1.1;
  const geo = new RoundedBoxGeometry(SIZE, 0.3, SIZE, 3, 0.06);
  const tablet = new THREE.Group();
  scene.add(tablet);
  const pieces = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = new THREE.Mesh(geo, choco);
      const x = (c - (COLS - 1) / 2) * (SIZE + GAP);
      const z = (r - (ROWS - 1) / 2) * (SIZE + GAP);
      m.position.set(x, 0, z);
      tablet.add(m);
      // Trajectoire de fracture : courbe de Bézier cubique propre à chaque carré
      const dir = new THREE.Vector3(x, 0, z).normalize();
      const p0 = m.position.clone();
      const p3 = new THREE.Vector3(dir.x * rnd(6.5, 10.5), rnd(-1.5, 3.5), dir.z * rnd(3, 6) + rnd(-2, 2));
      const p1 = p0.clone().addScaledVector(dir, rnd(0.8, 2)).add(new THREE.Vector3(0, rnd(0.8, 2.8), 0));
      const p2 = p3.clone().add(new THREE.Vector3(rnd(-1.5, 1.5), rnd(-1, 2), rnd(-1.5, 1.5)));
      const ang = rnd(0, Math.PI * 2), rad = Math.sqrt(Math.random()) * 2.6;
      pieces.push({
        m, p0,
        curve: new THREE.CubicBezierCurve3(p0, p1, p2, p3),
        axis: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(),
        spin: rnd(2.5, 5.5) * (Math.random() < 0.5 ? -1 : 1),
        melt: new THREE.Vector3(Math.cos(ang) * rad, PUDDLE_Y + 0.05, Math.sin(ang) * rad * 0.6 + 0.6),
      });
    }
  }

  /* Nappe : grande plaque qui monte et fond, fond de la section suivante */
  const nappe = new THREE.Mesh(new RoundedBoxGeometry(20, 0.4, 6.5, 2, 0.18), choco);
  nappe.position.set(0, -7, 2);
  nappe.visible = false;
  scene.add(nappe);

  /* Particules de cacao */
  const N = 4000;
  const pPos = new Float32Array(N * 3), pDir = new Float32Array(N * 3), pSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const th = rnd(0, Math.PI * 2), up = rnd(-0.15, 0.7), hr = Math.sqrt(1 - up * up);
    pDir.set([Math.cos(th) * hr, up, Math.sin(th) * hr * 0.7], i * 3);
    pSeed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("aDir", new THREE.BufferAttribute(pDir, 3));
  pGeo.setAttribute("aSeed", new THREE.BufferAttribute(pSeed, 1));
  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = spriteCanvas.height = 64;
  const sc = spriteCanvas.getContext("2d");
  const grad = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  sc.fillStyle = grad;
  sc.fillRect(0, 0, 64, 64);
  const sprite = new THREE.CanvasTexture(spriteCanvas);
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uTex: { value: sprite } },
    vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  particles.visible = false;
  scene.add(particles);

  /* Souris : parallaxe 8° max */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
  });

  /* Caméra : positions clés par phase (arrivée → fracture → fusion) */
  const camKeys = {
    pos: [new THREE.Vector3(0, 6.4, 8.8), new THREE.Vector3(0, 5.6, 8.1), new THREE.Vector3(0, 4.6, 8.6), new THREE.Vector3(0, 2.6, 8.4)],
    tgt: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0, -0.4, 0.6)],
  };
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), tmp = new THREE.Vector3();
  const pick = (arr, a, f, m, out) => {
    if (m > 0) out.lerpVectors(arr[2], arr[3], smooth(m));
    else if (f > 0) out.lerpVectors(arr[1], arr[2], smooth(f));
    else out.lerpVectors(arr[0], arr[1], smooth(a));
  };

  /* Boucle de rendu, pilotée par le progrès de scroll */
  const timer = new THREE.Timer();
  let spinY = 0.45;
  function render() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    const p = heroState.progress;
    const a = clamp(p / 0.33, 0, 1);
    const f = clamp((p - 0.33) / 0.33, 0, 1);
    const m = clamp((p - 0.66) / 0.34, 0, 1);
    const fe = easeOut(f), me = smooth(m);

    spinY += dt * 0.1 * (1 - me);
    mouse.x = lerp(mouse.x, mouse.tx, 0.05);
    mouse.y = lerp(mouse.y, mouse.ty, 0.05);
    tablet.rotation.set(mouse.y * 0.14 * (1 - me), spinY, -mouse.x * 0.14 * (1 - me));
    tablet.position.y = Math.sin(t * 0.8) * 0.08 * (1 - fe);

    uniforms.uMelt.value = me;
    uniforms.uTime.value = t;
    choco.clearcoat = 0.6 + 0.4 * me;
    choco.roughness = 0.35 - 0.25 * me;
    choco.clearcoatRoughness = 0.28 - 0.12 * me;

    for (const pc of pieces) {
      if (f <= 0) {
        pc.m.position.copy(pc.p0);
        pc.m.quaternion.identity();
        continue;
      }
      pc.curve.getPoint(fe, tmp);
      if (me > 0) tmp.lerp(pc.melt, me);
      pc.m.position.copy(tmp);
      pc.m.quaternion.setFromAxisAngle(pc.axis, pc.spin * fe * (1 - me));
    }

    const nm = clamp((m - 0.25) / 0.75, 0, 1);
    nappe.visible = nm > 0;
    nappe.position.y = lerp(-7, PUDDLE_Y + 0.05, easeOut(nm));
    nappe.scale.y = lerp(0.4, 1, nm);

    const pt = f + m * 0.6;
    particles.visible = f > 0 && pt < 1.6;
    pMat.uniforms.uProgress.value = pt;
    pMat.uniforms.uTime.value = t;

    pick(camKeys.pos, a, f, m, camPos);
    pick(camKeys.tgt, a, f, m, camTgt);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    renderer.render(scene, camera);
  }

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  // Compile les shaders et rend une première image avant de lever le pré-loader
  await renderer.compileAsync(scene, camera);
  render();
  markHeroReady();
  gsap.ticker.add(() => {
    if (heroState.canvasVisible) render();
  });
}

/* ---------------------------------------------------------------------
   06. Hero : timeline au scroll
   Section épinglée sur 300vh. Le progrès pilote la 3D ; le texte se
   dissout lettre par lettre puis laisse place à la ligne des deux chefs.
   --------------------------------------------------------------------- */
function initHeroText() {
  const hero = $("#hero"), title = $("#hero-title"), tagline = $("#hero-tagline"), cue = $("#hero-cue"), canvas = $("#hero-canvas");
  const state = { progress: 0, canvasVisible: true };
  const split = new SplitType(title, { types: "chars", tagName: "span" });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero, start: "top top", end: "+=300%", pin: true, scrub: 0.7, anticipatePin: 1, refreshPriority: 1,
      onUpdate: (self) => (state.progress = self.progress),
    },
  });
  tl.to({}, { duration: 1 }, 0)
    .to(cue, { opacity: 0, duration: 0.06 }, 0)
    .to(title, { y: -40, duration: 0.33, ease: "none" }, 0)
    .to(split.chars, { opacity: 0, y: -60, rotateX: -70, filter: "blur(10px)", duration: 0.13, ease: "power2.in", stagger: { each: 0.011, from: "random" } }, 0.34)
    .fromTo(tagline, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.53)
    .to(tagline, { opacity: 0, y: -30, duration: 0.08, ease: "power2.in" }, 0.9);

  // Le canvas s'efface quand « La collection » recouvre la nappe
  gsap.to(canvas, {
    opacity: 0, ease: "none",
    scrollTrigger: {
      trigger: "#collection-body", start: "top 70%", end: "top 5%", scrub: true,
      onUpdate: (self) => (state.canvasVisible = self.progress < 1),
      onLeaveBack: () => (state.canvasVisible = true),
    },
  });
  return state;
}

/* ---------------------------------------------------------------------
   07. La collection : tilt 3D des tuiles
   --------------------------------------------------------------------- */
$$(".tile").forEach((tile) => {
  tile.addEventListener("pointermove", (e) => {
    const r = tile.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(tile, { rotateY: x * 7, rotateX: -y * 7, transformPerspective: 1000, duration: 0.6, ease: "power2.out" });
  });
  tile.addEventListener("pointerleave", () => gsap.to(tile, { rotateX: 0, rotateY: 0, duration: 0.9, ease: "power3.out" }));
});

/* ---------------------------------------------------------------------
   08. Collection du moment : le scroll vertical fait défiler les cartes
   --------------------------------------------------------------------- */
const moment = $("#moment"), track = $("#moment-track");
if (moment && track) {
  const dist = () => Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
  gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: { trigger: moment, start: "top top", end: () => "+=" + Math.max(dist(), 400), pin: true, scrub: 0.8, invalidateOnRefresh: true },
  });
}

/* ---------------------------------------------------------------------
   09. Les deux chefs : diptyque, curseur draggable et clavier
   --------------------------------------------------------------------- */
const dip = $("#diptych");
if (dip) {
  const handle = $(".diptych__handle", dip);
  let pos = 50, dragging = false;
  const set = (v) => {
    pos = clamp(v, 4, 96);
    dip.style.setProperty("--pos", pos + "%");
    handle.setAttribute("aria-valuenow", Math.round(pos));
  };
  const fromEvent = (e) => set(((e.clientX - dip.getBoundingClientRect().left) / dip.clientWidth) * 100);
  handle.addEventListener("pointerdown", (e) => { dragging = true; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
  handle.addEventListener("pointermove", (e) => dragging && fromEvent(e));
  handle.addEventListener("pointerup", () => (dragging = false));
  handle.addEventListener("pointercancel", () => (dragging = false));
  dip.addEventListener("click", (e) => { if (e.target === handle) return; gsap.to({ v: pos }, { v: ((e.clientX - dip.getBoundingClientRect().left) / dip.clientWidth) * 100, duration: 0.8, ease: "power3.out", onUpdate() { set(this.targets()[0].v); } }); });
  handle.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 10 : 2;
    const map = { ArrowLeft: pos - step, ArrowDown: pos - step, ArrowRight: pos + step, ArrowUp: pos + step, Home: 4, End: 96 };
    if (e.key in map) { e.preventDefault(); set(map[e.key]); }
  });
}

/* ---------------------------------------------------------------------
   10. Terroirs : les points s'allument au scroll, fiche au survol
   --------------------------------------------------------------------- */
const terroirs = $$(".terroir"), tCard = $("#terroir-card"), map = $("#map");
if (terroirs.length) {
  ScrollTrigger.create({
    trigger: "#terroirs", start: "top 55%", once: true,
    onEnter: () => terroirs.forEach((t, i) => setTimeout(() => t.classList.add("is-lit"), 220 * i)),
  });
  const cardImg = $("img", tCard), cardSrc = $("source", tCard);
  const show = (t) => {
    $(".terroir-card__name", tCard).textContent = t.dataset.name;
    $(".terroir-card__text", tCard).textContent = t.dataset.text;
    cardImg.src = t.dataset.img; cardSrc.srcset = t.dataset.img; cardImg.alt = t.dataset.name;
    const r = $(".dot", t).getBoundingClientRect(), pr = map.getBoundingClientRect();
    const right = r.left - pr.left > pr.width * 0.55;
    tCard.style.left = (right ? r.left - pr.left - 250 : r.left - pr.left + 22) + "px";
    tCard.style.top = clamp(r.top - pr.top - 40, 0, pr.height - 420) + "px";
    tCard.classList.add("is-on");
    t.classList.add("is-lit");
    $$(".terroirs__list button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.for === t.id.replace("t-", "")));
  };
  const hide = () => { tCard.classList.remove("is-on"); $$(".terroirs__list button").forEach((b) => b.removeAttribute("aria-pressed")); };
  terroirs.forEach((t) => {
    t.addEventListener("mouseenter", () => show(t));
    t.addEventListener("focus", () => show(t));
    t.addEventListener("mouseleave", hide);
    t.addEventListener("blur", hide);
  });
  $$(".terroirs__list button").forEach((b) => {
    const target = $("#t-" + b.dataset.for);
    b.addEventListener("mouseenter", () => show(target));
    b.addEventListener("focus", () => show(target));
    b.addEventListener("mouseleave", hide);
    b.addEventListener("blur", hide);
  });
}

/* ---------------------------------------------------------------------
   11. Formulaires : confirmation en place (aucun envoi réel pour l'instant)
   --------------------------------------------------------------------- */
$$("form[data-async]").forEach((f) =>
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!f.checkValidity()) return f.reportValidity();
    $$("input, textarea, button", f).forEach((el) => (el.disabled = true));
    const done = $(".form__done", f);
    if (done) { done.hidden = false; gsap.from(done, { opacity: 0, y: 8, duration: 0.6 }); }
  })
);

/* ---------------------------------------------------------------------
   12. Apparitions au scroll : fallback si scroll-timeline est absent
   --------------------------------------------------------------------- */
if (!CSS.supports("animation-timeline: view()")) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
  }), { threshold: 0.15 });
  $$(".reveal").forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------------------
   13. Fiche produit
   --------------------------------------------------------------------- */
const gallery = $("#gallery");
if (gallery) {
  const main = $("#gallery-main"), pic = $("picture", main), img = $("img", pic), src = $("source", pic);
  const video = $("#gallery-video"), zoom = $("#loupe-zoom"), badge = $("#loupe-badge");
  zoom.style.backgroundImage = `url("${img.src}")`;
  $$(".thumb", gallery).forEach((th) =>
    th.addEventListener("click", () => {
      $$(".thumb", gallery).forEach((t) => t.setAttribute("aria-selected", String(t === th)));
      if (th.dataset.video) {
        main.dataset.mode = "video"; pic.hidden = true; video.hidden = false; badge.hidden = false; video.play?.().catch(() => {});
      } else {
        main.dataset.mode = "image"; video.hidden = true; pic.hidden = false; badge.hidden = true; video.pause?.();
        img.src = th.dataset.full; src.srcset = th.dataset.full; img.alt = th.dataset.alt;
        zoom.style.backgroundImage = `url("${th.dataset.full}")`;
      }
    })
  );
  main.addEventListener("mousemove", (e) => {
    const r = main.getBoundingClientRect();
    zoom.style.backgroundPosition = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  });

  const qty = $("#qty");
  $("#qty-minus").addEventListener("click", () => (qty.value = Math.max(1, +qty.value - 1)));
  $("#qty-plus").addEventListener("click", () => (qty.value = Math.min(24, +qty.value + 1)));
  $("#add-main").addEventListener("click", () => addToCart(img, +qty.value || 1));

  const io = new IntersectionObserver((entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add("is-in")), { threshold: 0.5 });
  $$(".gauge").forEach((g) => io.observe(g));
}

/* Lancement */
ScrollTrigger.refresh();
initHero().then(() => ScrollTrigger.refresh());
