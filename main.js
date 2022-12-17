import './assets/style.scss';
import * as THREE from 'three';
import { SphereGeometry } from 'three';

const SUNCOLOR = 0xfffccb; // 0xfbb57e 
const SUNPOSITION = [0, 30, -40]
const SUNINTENSITY = 1.7
const SUNDISTANCE = 0
const SUNDECAY = 2

const SKYCOLOR = 0x60321f; // 0xfdffd0 
const SKYPOSITION = [0, 0, -200]
const SKYSIZE = [1000, 450, 5]

const BRIDGEPOSITION = [0, -10, 0]
const BRIDGECOLOR = 0x3c1c12; // 0x3c1c12 0xe5924f
const BRIDGESIZE = [50, 5, 80]
const bridgeTexture = new THREE.TextureLoader().load("./assets/concrete_texture.jpg")

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
camera.position.set(0, 0, 40);
// camera.lookAt(...SUNPOSITION);

const sunLight = new THREE.PointLight(SUNCOLOR, SUNINTENSITY, SUNDISTANCE, SUNDECAY);
sunLight.position.set(...SUNPOSITION);

const ambientLight = new THREE.AmbientLight(SUNCOLOR);

let geometry = new THREE.BoxGeometry(...BRIDGESIZE);
let material = new THREE.MeshPhongMaterial({ map: bridgeTexture, color: BRIDGECOLOR });
const bridge = new THREE.Mesh(geometry, material);
bridge.position.set(...BRIDGEPOSITION)

geometry = new THREE.BoxGeometry(10, 10, 10)
material = new THREE.MeshPhongMaterial({ map: bridgeTexture, color: BRIDGECOLOR });
const test = new THREE.Mesh(geometry, material)
test.position.set(0, 0, 0)

geometry = new THREE.BoxGeometry(...SKYSIZE)
material = new THREE.MeshPhongMaterial({ color: SKYCOLOR });
const sky = new THREE.Mesh(geometry, material);
sky.position.set(...SKYPOSITION)

scene.add(sunLight, ambientLight, bridge, sky, test)

renderer.render(scene, camera);