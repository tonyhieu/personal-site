import './assets/style.scss';
import * as THREE from 'three';

// Recreates the bridge scene from Kagerou Project's "Yuukei Yesterday":
// an arched road receding to a setting sun, flanked by white railings.

const CAMERA_POSITION = [0, 0, 40];
const FOV = 75;

const ROAD_WIDTH = 48;
const ROAD_NEAR_Z = 55; // extends behind the camera so the bottom of the frame stays road
const ROAD_FAR_Z = -330;
const TILE_SIZE = 4; // world units per texture tile; longer period hides repetition
const SCROLL_SPEED = 1.1; // world units per second, toward the camera

const RAIL_X = 23; // fence offset from center, just inside the road edge
const RAIL_HEIGHTS = [1.15, 2.05]; // rail heights above the road surface
const POST_SPACING = 8;
const POST_HEIGHT = 2.7;
const POST_TOP_Z = 48; // posts slide toward the camera and wrap around behind it

// warm sunset palette; stops span the band actually visible on screen (world y -300..300)
// warm sunset palette; stops span the band actually visible on screen (world y -307..307)
const SKY_STOPS = [
    [307, '#a81508'],
    [240, '#c21e0c'],
    [170, '#d92c10'],
    [100, '#ee4a14'],
    [55, '#fb7d20'],
    [22, '#ffa038'],
    [8, '#ffc971'],
    [2, '#ffe2a0'],
    [-50, '#ee9a52'],
    [-400, '#a8663e'],
];
const FOG_COLOR = '#f58b3a';
const SUN_WORLD_Y = 32;
const SKY_PLANE = [2600, 1300, -360, 200]; // width, height, z, center y

// crest of the bridge sits just above the horizon; ends dip away and are hidden
function roadHeight(z) {
    const crest = 9 * Math.exp(-Math.pow((z + 110) / 85, 2));
    const nearDip = -3.5 * Math.exp(-Math.pow((z - 30) / 70, 2));
    const farFall = z < -110 ? -0.3 * -(z + 110) : 0;
    return crest + nearDip + farFall;
}

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
// no tone mapping: the anime reference uses flat, saturated cel colors

const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG_COLOR);
scene.fog = new THREE.Fog(FOG_COLOR, 180, 560);

const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(...CAMERA_POSITION);

// procedural cement: warm sunlit concrete with grain, soft mottling, and faint expansion seams
function makeRoadTextures() {
    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d');
    ctx.fillStyle = '#e6e0d6'; // pale warm gray: desaturated so lighting supplies the warmth
    ctx.fillRect(0, 0, size, size);

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = size;
    const bctx = bumpCanvas.getContext('2d');
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, size, size);

    let rng = 12345;
    function rand() {
        rng = (rng * 16807) % 2147483647;
        return rng / 2147483647;
    }

    // large soft mottling; drawn on a 3x3 wrap so tiling stays seamless
    for (let i = 0; i < 55; i++) {
        const x = rand() * size, y = rand() * size, r = 70 + rand() * 170;
        const dark = rand() > 0.5;
        for (const dx of [0, -size, size]) {
            for (const dy of [0, -size, size]) {
                const g = ctx.createRadialGradient(x + dx, y + dy, 2, x + dx, y + dy, r);
                g.addColorStop(0, dark ? 'rgba(128, 120, 110, 0.04)' : 'rgba(255, 253, 248, 0.05)');
                g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = g;
                ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
                const b = bctx.createRadialGradient(x + dx, y + dy, 2, x + dx, y + dy, r);
                b.addColorStop(0, dark ? 'rgba(70, 70, 70, 0.18)' : 'rgba(150, 150, 150, 0.15)');
                b.addColorStop(1, 'rgba(0, 0, 0, 0)');
                bctx.fillStyle = b;
                bctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
            }
        }
    }

    // fine grain
    for (let i = 0; i < 2200; i++) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255, 253, 245, 0.05)' : 'rgba(80, 72, 64, 0.05)';
        ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
    }

    const map = new THREE.CanvasTexture(colorCanvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.encoding = THREE.sRGBEncoding;
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    return { map, bumpMap };
}

// painted sunset sky: gradient, sun disc with glow, soft clouds
function makeSkyTexture() {
    const w = 2048, h = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const skyBottom = SKY_PLANE[3] - SKY_PLANE[1] / 2;
    const toPx = (worldY) => h * (1 - (worldY - skyBottom) / SKY_PLANE[1]); // plane world y to canvas row

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (const [worldY, color] of SKY_STOPS) grad.addColorStop(Math.min(Math.max(toPx(worldY) / h, 0), 1), color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const sunX = w / 2, sunY = toPx(SUN_WORLD_Y);

    // soft cloud banks; horizontally stretched so they read as anime streak clouds
    function cloud(cx, cy, blobs, body, under, alpha) {
        for (const [bx, by, br] of blobs) {
            const rx = br * 1.7, ry = br * 0.55;
            const g = ctx.createRadialGradient(cx + bx, cy + by, rx * 0.05, cx + bx, cy + by, rx);
            g.addColorStop(0, under.replace('A', String(alpha * 0.7)));
            g.addColorStop(1, under.replace('A', '0'));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(cx + bx, cy + by + br * 0.25, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const [bx, by, br] of blobs) {
            const rx = br * 1.7, ry = br * 0.55;
            const g = ctx.createRadialGradient(cx + bx, cy + by, rx * 0.05, cx + bx, cy + by, rx);
            g.addColorStop(0, body.replace('A', String(alpha)));
            g.addColorStop(1, body.replace('A', '0'));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(cx + bx, cy + by - br * 0.15, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            // tighter inner pass so the bank has a defined bright core
            const g2 = ctx.createRadialGradient(cx + bx, cy + by, rx * 0.03, cx + bx, cy + by, rx * 0.55);
            g2.addColorStop(0, body.replace('A', String(Math.min(alpha * 1.2, 1))));
            g2.addColorStop(1, body.replace('A', '0'));
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.ellipse(cx + bx, cy + by - br * 0.2, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    const darkBody = 'rgba(122, 30, 24, A)';
    // keep clouds inside the on-screen band, and leave the area around the sun clear
    cloud(w * 0.24, toPx(320), [[0, 0, 190], [130, 32, 140]], darkBody, darkBody, 0.5);
    cloud(w * 0.78, toPx(305), [[0, 0, 175], [-115, 30, 135]], darkBody, darkBody, 0.45);
    cloud(w * 0.52, toPx(345), [[0, 0, 150], [110, 16, 120]], darkBody, darkBody, 0.4);

    // sun glow and disc paint over the clouds so it reads through them
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 430);
    glow.addColorStop(0, 'rgba(255, 195, 105, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 175, 88, 0.55)');
    glow.addColorStop(1, 'rgba(255, 155, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const core = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 30);
    core.addColorStop(0, '#fffbe0');
    core.addColorStop(0.55, '#ffefad');
    core.addColorStop(1, 'rgba(255, 233, 168, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
}

const { map: roadMap, bumpMap: roadBumpMap } = makeRoadTextures();
roadMap.repeat.set(ROAD_WIDTH / TILE_SIZE, (ROAD_NEAR_Z - ROAD_FAR_Z) / TILE_SIZE);
roadBumpMap.repeat.copy(roadMap.repeat);
roadMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

const skyTexture = makeSkyTexture();
const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(SKY_PLANE[0], SKY_PLANE[1]),
    new THREE.MeshBasicMaterial({ map: skyTexture, fog: false })
);
sky.position.set(0, SKY_PLANE[3], SKY_PLANE[2]);

// road: flat plane displaced along the arch profile, receding along -Z
const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_NEAR_Z - ROAD_FAR_Z, 1, 160);
roadGeometry.rotateX(-Math.PI / 2);
roadGeometry.translate(0, 0, (ROAD_NEAR_Z + ROAD_FAR_Z) / 2);
const positions = roadGeometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
    positions.setY(i, roadHeight(positions.getZ(i)));
}
positions.needsUpdate = true;
roadGeometry.computeVertexNormals();

const roadMaterial = new THREE.MeshPhongMaterial({
    map: roadMap,
    bumpMap: roadBumpMap,
    bumpScale: 0.025,
    shininess: 12,
    specular: 0x5a3a24,
});
const road = new THREE.Mesh(roadGeometry, roadMaterial);

// additive sun-pool overlay hugging the road: orange glow where the sun meets the crest
function makeRoadGlow() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(256, 190); // v ≈ 0.63 maps to just past the crest (z ≈ -114), where the sun meets the road
    ctx.scale(1, 1.55); // stretch toward the camera like light bleeding down the road
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 280);
    g.addColorStop(0, 'rgba(255, 210, 135, 0.9)');
    g.addColorStop(0.4, 'rgba(255, 165, 80, 0.5)');
    g.addColorStop(1, 'rgba(255, 160, 80, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-256, -205, 512, 512);
    ctx.restore();
    // force alpha to zero at the canvas edges so the glow never hard-cuts at the plane boundary
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, 0, 0, 512);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fade.addColorStop(0.2, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(0.85, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 512, 512);
    const fadeX = ctx.createLinearGradient(0, 0, 512, 0);
    fadeX.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fadeX.addColorStop(0.25, 'rgba(0, 0, 0, 1)');
    fadeX.addColorStop(0.75, 'rgba(0, 0, 0, 1)');
    fadeX.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fadeX;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = 'source-over';
    return new THREE.CanvasTexture(canvas);
}

const roadGlowGeometry = new THREE.PlaneGeometry(64, 150, 1, 96);
roadGlowGeometry.rotateX(-Math.PI / 2);
roadGlowGeometry.translate(0, 0, -95); // spans z = -170..-20
const glowPositions = roadGlowGeometry.attributes.position;
for (let i = 0; i < glowPositions.count; i++) {
    glowPositions.setY(i, roadHeight(glowPositions.getZ(i)) + 0.12);
}
glowPositions.needsUpdate = true;
roadGlowGeometry.computeVertexNormals();

const roadGlow = new THREE.Mesh(roadGlowGeometry, new THREE.MeshBasicMaterial({
    map: makeRoadGlow(),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    fog: false,
}));

// white railings: continuous curved rails plus posts that slide toward the camera
const railMaterial = new THREE.MeshPhongMaterial({ color: 0xfff4e2, shininess: 30, specular: 0x664422, fog: false });

function makeRail(x, height) {
    const points = [];
    for (let z = ROAD_NEAR_Z; z >= ROAD_FAR_Z; z -= 30) {
        points.push(new THREE.Vector3(x, roadHeight(z) + height, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 128, 0.14, 6), railMaterial);
}

const posts = [];
const postGeometry = new THREE.BoxGeometry(0.34, POST_HEIGHT, 0.34);
for (let z = -104; z <= POST_TOP_Z; z += POST_SPACING) {
    for (const side of [-1, 1]) {
        const post = new THREE.Mesh(postGeometry, railMaterial);
        post.userData.side = side;
        post.userData.z = z;
        posts.push(post);
    }
}

const sunLight = new THREE.DirectionalLight(0xffc07a, 0.85);
sunLight.position.set(0, 150, -300);
const ambientLight = new THREE.AmbientLight(0xffdcc0, 0.37); // warm dark-brown shadows

scene.add(sky, road, roadGlow, sunLight, ambientLight);
scene.add(sunLight.target);
for (const railX of [-RAIL_X, RAIL_X]) {
    for (const h of RAIL_HEIGHTS) scene.add(makeRail(railX, h));
}
for (const post of posts) scene.add(post);

function placePost(post) {
    const z = post.userData.z;
    post.position.set(post.userData.side * RAIL_X, roadHeight(z) + POST_HEIGHT / 2 - 0.05, z);
}

const clock = new THREE.Clock();

function animate() {
    const dt = clock.getDelta();
    const tilesPerSecond = SCROLL_SPEED / TILE_SIZE;

    roadMap.offset.y += tilesPerSecond * dt;
    roadBumpMap.offset.y = roadMap.offset.y;

    for (const post of posts) {
        post.userData.z += SCROLL_SPEED * dt;
        if (post.userData.z > POST_TOP_Z + POST_SPACING) post.userData.z -= POST_SPACING * posts.length / 2;
        placePost(post);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize, false);
animate();