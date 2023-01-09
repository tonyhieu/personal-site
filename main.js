import './public/assets/style.scss';
import * as THREE from 'three';
import { SphereGeometry } from 'three';

const SUNCOLOR = 0xfffccb; // 0xfbb57e 
const SUNPOSITION = [0, 10, -40]
const SUNINTENSITY = 1.7
const SUNDISTANCE = 0
const SUNDECAY = 2

const SKYCOLOR = 0x60321f; // 0xfdffd0 
const SKYPOSITION = [0, 0, -200]
const SKYSIZE = [1000, 450, 5]

const BRIDGEPOSITION = [0, -45, 20]
const BRIDGECOLOR = 0x7c4c39; // 0x3c1c12 0xe5924f #7c4c39
const BRIDGEDIMENSIONS = [40, 40, 40, 64, 1] // radiusTop, radiusBottom, height, radial segments, height segments

const bridgeTexture = new THREE.TextureLoader().load("./assets/cobblestone_texture.jpg")
bridgeTexture.wrapS = THREE.RepeatWrapping;
bridgeTexture.wrapT = THREE.RepeatWrapping;
bridgeTexture.repeat.set( 40, 5 );

const bridgeBumpMap = new THREE.TextureLoader().load("./assets/cobblestone_bumps.PNG")
bridgeBumpMap.wrapS = THREE.RepeatWrapping;
bridgeBumpMap.wrapT = THREE.RepeatWrapping;
bridgeBumpMap.repeat.set( 40, 5 );
const bridgeBumpScale = 0.05

const RAILINGDIMENSIONS = [39, 43, 30] // inner radius, outer radius, theta segments
const RAILINGOFFSET = BRIDGEDIMENSIONS[2] / 2

const railingTexture = new THREE.TextureLoader().load("./assets/fence-transparent-ring.png")
// railingTexture.wrapS = THREE.RepeatWrapping;
// railingTexture.wrapT = THREE.RepeatWrapping;
// railingTexture.repeat.set( 15, 5 );

const scene = new THREE.Scene();
const backgroundColor = new THREE.Color(SKYCOLOR)
scene.background = backgroundColor;

const fov = 75;
const aspect = window.innerWidth / window.innerHeight; 
const near = 0.1;
const far = 1000;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(0, 0, 40); // 0, 0, 40

const sunLight = new THREE.PointLight(SUNCOLOR, SUNINTENSITY, SUNDISTANCE, SUNDECAY);
sunLight.position.set(...SUNPOSITION);

const ambientLight = new THREE.AmbientLight(SUNCOLOR);

let geometry = new THREE.CylinderGeometry(...BRIDGEDIMENSIONS);
let material = new THREE.MeshPhongMaterial({ map: bridgeTexture, color: BRIDGECOLOR, bumpMap: bridgeBumpMap, bumpScale: bridgeBumpScale, shininess: 1 });
const bridge = new THREE.Mesh(geometry, material);
bridge.position.set(...BRIDGEPOSITION)
bridge.rotation.set(0, 0, Math.PI / 2)

geometry = new THREE.RingGeometry(...RAILINGDIMENSIONS);
material = new THREE.MeshBasicMaterial({ color: BRIDGECOLOR, map: railingTexture });

const leftRailing = new THREE.Mesh(geometry, material);
leftRailing.position.set(BRIDGEPOSITION[0] - RAILINGOFFSET, BRIDGEPOSITION[1], BRIDGEPOSITION[2]) // BRIDGEPOSITION[0] - RAILINGOFFSET, BRIDGEPOSITION[1], BRIDGEPOSITION[2]
leftRailing.rotation.set(0, Math.PI / 2, 0)

const rightRailing = new THREE.Mesh(geometry, material);
rightRailing.position.set(BRIDGEPOSITION[0] + RAILINGOFFSET, BRIDGEPOSITION[1], BRIDGEPOSITION[2]) // BRIDGEPOSITION[0] - RAILINGOFFSET, BRIDGEPOSITION[1], BRIDGEPOSITION[2]
rightRailing.rotation.set(0, -Math.PI / 2, 0)


geometry = new THREE.BoxGeometry(...SKYSIZE)
material = new THREE.MeshPhongMaterial({ color: SKYCOLOR });
const sky = new THREE.Mesh(geometry, material);
sky.position.set(...SKYPOSITION)

scene.add(sunLight, ambientLight, bridge, sky, leftRailing)
scene.add(rightRailing)

function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const pixelRatio = window.devicePixelRatio;
    const width  = canvas.clientWidth  * pixelRatio | 0;
    const height = canvas.clientHeight * pixelRatio | 0;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
}

function animate() {
    bridge.rotation.x += 0.0003
    leftRailing.rotation.x += 0.0003
    rightRailing.rotation.x += 0.0003

    renderer.render(scene, camera)
    requestAnimationFrame(animate);
}

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

window.addEventListener( 'resize', onWindowResize, false );

animate();