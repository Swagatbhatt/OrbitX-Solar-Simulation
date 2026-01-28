import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as TWEEN from '@tweenjs/tween.js'; 

const CONFIG = {
    sunSize: 5,
    baseSpeed: 0.08,  
    slowSpeed: 0.015,
    trailLength: 400, 
};

let currentSpeed = CONFIG.baseSpeed;

// --- UPDATED PATH FOR FLAT UPLOAD ---
// Since images are next to index.html, we use './'
const ROOT_PATH = './'; 

const ASSETS = {
    sun:          ROOT_PATH + 'sun.jpg',
    mercury:      ROOT_PATH + 'mercury.jpg',
    venus:        ROOT_PATH + 'venus.jpg',
    earth:        ROOT_PATH + 'earth.jpg',
    earth_clouds: ROOT_PATH + 'earth_clouds.jpg',
    moon:         ROOT_PATH + 'earth_moon.jpg', 
    mars:         ROOT_PATH + 'mars.jpg',
    jupiter:      ROOT_PATH + 'jupiter.jpg',
    saturn:       ROOT_PATH + 'saturn.jpg',
    uranus:       ROOT_PATH + 'uranus.jpg',
    neptune:      ROOT_PATH + 'neptune.jpg'
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.001); 

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 50, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.15; 
bloomPass.strength = 1.2;
bloomPass.radius = 0.5;
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); 
scene.add(ambientLight);
const sunLight = new THREE.PointLight(0xffffff, 2.5, 800);
scene.add(sunLight);

const texLoader = new THREE.TextureLoader();
const loadTex = (path) => texLoader.load(path);

const starCount = 8000;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount * 3);
for(let i=0; i<starCount; i++) {
    starPos[i*3] = (Math.random() - 0.5) * 2000;
    starPos[i*3+1] = (Math.random() - 0.5) * 2000;
    starPos[i*3+2] = (Math.random() - 0.5) * 2000;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({color: 0xffffff, size: 0.8, transparent: true, opacity: 0.8});
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

const solarSystem = new THREE.Group();
scene.add(solarSystem);

const sunGeo = new THREE.SphereGeometry(CONFIG.sunSize, 64, 64);
const sunMat = new THREE.MeshBasicMaterial({ map: loadTex(ASSETS.sun), color: 0xffffee });
const sun = new THREE.Mesh(sunGeo, sunMat);

const sunData = {
    name: "THE SUN",
    desc: "The star at the center of our Solar System.",
    stats: {
        dist: "0 km", orbit: "230M Years", tilt: "7.25°", diameter: "1,392,700 km",
        mass: "1.989 × 10^30 kg", rotation: "27 Earth Days", gravity: "274 m/s²",
        temp: "5,500°C", moons: "0", comp: "H (73%), He (25%)"
    },
    type: 'hitbox', isSun: true, size: CONFIG.sunSize
};

const sunHitBox = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.sunSize * 1.5, 32, 32), new THREE.MeshBasicMaterial({ visible: false }));
sunHitBox.userData = sunData;
sun.add(sunHitBox);
solarSystem.add(sun);
sun.add(sunLight);

const planets = [];
class Planet {
    constructor(name, texPath, size, dist, speed, desc, stats, extras = {}) {
        this.name = name;
        this.size = size;
        this.baseOrbitSpeed = speed;
        this.pivot = new THREE.Object3D();
        solarSystem.add(this.pivot);

        const material = new THREE.MeshStandardMaterial({ map: loadTex(texPath), roughness: 0.6 });
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 64, 64), material);
        this.mesh.position.x = dist;
        this.pivot.add(this.mesh);

        const hitBox = new THREE.Mesh(new THREE.SphereGeometry(size * 3.5, 32, 32), new THREE.MeshBasicMaterial({ visible: false }));
        hitBox.position.x = dist;
        hitBox.userData = { parentPlanet: this, name: name, desc: desc, stats: stats, type: 'hitbox', size: size };
        this.pivot.add(hitBox);

        const div = document.createElement('div');
        div.className = 'planet-label';
        div.textContent = name;
        this.label = new CSS2DObject(div);
        this.label.position.set(0, size + 2, 0); 
        this.mesh.add(this.label);

        this.trailGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(CONFIG.trailLength * 3);
        this.trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
        this.trailLine = new THREE.Line(this.trailGeo, this.trailMat);
        scene.add(this.trailLine);
        this.trailPoints = [];

        if (extras.hasMoon) {
            this.moonPivot = new THREE.Object3D();
            this.mesh.add(this.moonPivot);
            const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(size * 0.27, 32, 32), new THREE.MeshStandardMaterial({ map: loadTex(ASSETS.moon) }));
            moonMesh.position.x = 3; 
            this.moonPivot.add(moonMesh);
        }
        if (extras.hasClouds) {
            const cloudMat = new THREE.MeshStandardMaterial({ 
                map: loadTex(ASSETS.earth_clouds), 
                transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
            });
            this.cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(size * 1.03, 64, 64), cloudMat);
            this.mesh.add(this.cloudMesh);
        }
    }

    update(timeScale) {
        this.pivot.rotation.y += this.baseOrbitSpeed * timeScale;
        this.mesh.rotation.y += 0.01;
        if (this.moonPivot) this.moonPivot.rotation.y += 0.02;
        if (this.cloudMesh) this.cloudMesh.rotation.y += 0.012; 

        const worldPos = new THREE.Vector3();
        this.mesh.getWorldPosition(worldPos);
        this.trailPoints.push(worldPos.x, worldPos.y, worldPos.z);
        if (this.trailPoints.length > CONFIG.trailLength * 3) this.trailPoints.splice(0, 3);
        const positions = this.trailLine.geometry.attributes.position.array;
        for (let i = 0; i < this.trailPoints.length; i++) positions[i] = this.trailPoints[i];
        this.trailLine.geometry.setDrawRange(0, this.trailPoints.length / 3);
        this.trailLine.geometry.attributes.position.needsUpdate = true;
    }
}

planets.push(new Planet("Mercury", ASSETS.mercury, 0.8, 10, 0.04, 
    "The smallest planet in the Solar System.", 
    { dist: "57.9 M km", orbit: "88 Days", tilt: "0.03°", diameter: "4,879 km", mass: "3.28 × 10^23 kg", rotation: "59 Days", gravity: "3.7 m/s²", temp: "167°C", moons: "0", comp: "Iron, Silicate" }
));
planets.push(new Planet("Venus", ASSETS.venus, 1.2, 16, 0.02, 
    "Runaway greenhouse effect.", 
    { dist: "108.2 M km", orbit: "225 Days", tilt: "177.3°", diameter: "12,104 km", mass: "4.87 × 10^24 kg", rotation: "243 Days", gravity: "8.87 m/s²", temp: "464°C", moons: "0", comp: "CO2, N2" }
));
planets.push(new Planet("Earth", ASSETS.earth, 1.3, 24, 0.015, 
    "The only world known to harbor life.", 
    { dist: "149.6 M km", orbit: "365 Days", tilt: "23.5°", diameter: "12,742 km", mass: "5.97 × 10^24 kg", rotation: "24 Hours", gravity: "9.8 m/s²", temp: "15°C", moons: "1", comp: "N2, O2" }, 
    { hasMoon: true, hasClouds: true }
));
planets.push(new Planet("Mars", ASSETS.mars, 1.0, 32, 0.012, 
    "The Red Planet.", 
    { dist: "227.9 M km", orbit: "687 Days", tilt: "25.2°", diameter: "6,779 km", mass: "6.39 × 10^23 kg", rotation: "24.6 Hrs", gravity: "3.71 m/s²", temp: "-65°C", moons: "2", comp: "CO2, Ar" }
));
planets.push(new Planet("Jupiter", ASSETS.jupiter, 3.5, 50, 0.004, 
    "Massive Gas Giant.", 
    { dist: "778.5 M km", orbit: "12 Years", tilt: "3.1°", diameter: "139,820 km", mass: "1.90 × 10^27 kg", rotation: "9.9 Hrs", gravity: "24.79 m/s²", temp: "-110°C", moons: "95", comp: "H, He" }
));
planets.push(new Planet("Saturn", ASSETS.saturn, 3.0, 70, 0.003, 
    "The Jewel of the System.", 
    { dist: "1.4 B km", orbit: "29 Years", tilt: "26.7°", diameter: "116,460 km", mass: "5.68 × 10^26 kg", rotation: "10.7 Hrs", gravity: "10.44 m/s²", temp: "-140°C", moons: "146", comp: "H, He" }
));
planets.push(new Planet("Uranus", ASSETS.uranus, 1.8, 90, 0.002, 
    "The Ice Giant.", 
    { dist: "2.8 B km", orbit: "84 Years", tilt: "97.8°", diameter: "50,724 km", mass: "8.68 × 10^25 kg", rotation: "17.2 Hrs", gravity: "8.69 m/s²", temp: "-195°C", moons: "27", comp: "Ices, H, He" }
));
planets.push(new Planet("Neptune", ASSETS.neptune, 1.7, 110, 0.001, 
    "Supersonic winds.", 
    { dist: "4.5 B km", orbit: "165 Years", tilt: "28.3°", diameter: "49,244 km", mass: "1.02 × 10^26 kg", rotation: "16.1 Hrs", gravity: "11.15 m/s²", temp: "-200°C", moons: "14", comp: "Ices, H, He" }
));

const welcomeScreen = document.getElementById('welcome-screen');
const startBtn = document.getElementById('start-btn');
const helpBtn = document.getElementById('help-btn');
const sidePanel = document.getElementById('side-panel');
const closePanelBtn = document.getElementById('close-panel');
const tooltip = document.getElementById('tooltip');

startBtn.addEventListener('click', () => {
    welcomeScreen.style.opacity = '0';
    setTimeout(() => { welcomeScreen.style.display = 'none'; }, 500);
});

helpBtn.addEventListener('click', () => {
    welcomeScreen.style.display = 'flex';
    setTimeout(() => { welcomeScreen.style.opacity = '1'; }, 10);
});

closePanelBtn.addEventListener('click', () => {
    sidePanel.classList.remove('open');
    focusedPlanet = null; 
});

let focusedPlanet = null;
let isHovering = false;
let hoveredObject = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (e) => {
    if (e.target.closest('#ui-layer') || e.target.closest('#side-panel') || e.target.closest('#welcome-screen')) return;

    if(isHovering && hoveredObject) {
        const data = hoveredObject.userData;
        if (!data.isSun) {
            focusedPlanet = data.parentPlanet;
        } else {
            focusedPlanet = null;
            new TWEEN.Tween(controls.target).to({ x: 0, y: 0, z: solarSystem.position.z }, 1000).start();
            new TWEEN.Tween(camera.position).to({ x: 0, y: 20, z: solarSystem.position.z + 40 }, 1000).start();
        }

        document.getElementById('sp-name').innerText = data.name;
        document.getElementById('sp-desc').innerText = data.desc;
        document.getElementById('sp-distance').innerText = data.stats.dist;
        document.getElementById('sp-orbit').innerText = data.stats.orbit;
        document.getElementById('sp-tilt').innerText = data.stats.tilt;
        document.getElementById('sp-diameter').innerText = data.stats.diameter;
        document.getElementById('sp-mass').innerText = data.stats.mass;
        document.getElementById('sp-rotation').innerText = data.stats.rotation;
        document.getElementById('sp-gravity').innerText = data.stats.gravity;
        document.getElementById('sp-temp').innerText = data.stats.temp;
        document.getElementById('sp-moons').innerText = data.stats.moons;
        document.getElementById('sp-comp').innerText = data.stats.comp;
        sidePanel.classList.add('open');
    } else {
        sidePanel.classList.remove('open');
        focusedPlanet = null;
    }
});

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(solarSystem.children, true);
    const hit = intersects.find(i => i.object.userData.type === 'hitbox');

    document.querySelectorAll('.planet-label').forEach(l => l.classList.remove('visible'));

    if (hit) {
        isHovering = true;
        hoveredObject = hit.object;
        document.body.style.cursor = 'pointer';
        const data = hoveredObject.userData;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
        document.getElementById('t-name').innerText = data.name;
        document.getElementById('t-desc').innerText = data.desc.substring(0, 50) + "..."; 

        if (!data.isSun) data.parentPlanet.label.element.classList.add('visible');
    } else {
        isHovering = false;
        hoveredObject = null;
        document.body.style.cursor = 'default';
        tooltip.style.display = 'none';
    }
});

document.getElementById('reset-btn').addEventListener('click', () => {
    focusedPlanet = null;
    sidePanel.classList.remove('open');
    const currentZ = solarSystem.position.z;
    new TWEEN.Tween(camera.position)
        .to({ x: 0, y: 50, z: currentZ + 120 }, 1500) 
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
    new TWEEN.Tween(controls.target)
        .to({ x: 0, y: 0, z: currentZ }, 1500) 
        .easing(TWEEN.Easing.Cubic.Out)
        .start();
});

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    
    // IMPORTANT: Only slow down when hovering, NOT when panel is open.
    const targetSpeed = (isHovering) ? CONFIG.slowSpeed : CONFIG.baseSpeed;
    
    currentSpeed += (targetSpeed - currentSpeed) * 0.1;
    const timeScale = currentSpeed / CONFIG.baseSpeed;
    solarSystem.position.z += currentSpeed;

    if(!focusedPlanet) {
        camera.position.z += currentSpeed;
        controls.target.z += currentSpeed;
    } else {
        const planetWorldPos = new THREE.Vector3();
        focusedPlanet.mesh.getWorldPosition(planetWorldPos);
        const targetPos = controls.target.clone().lerp(planetWorldPos, 0.1);
        controls.target.copy(targetPos);
        
        // Dynamic Offset based on planet size
        const distMult = focusedPlanet.size * 5; 
        const camOffset = new THREE.Vector3(distMult, distMult * 0.5, distMult); 
        
        const desiredCamPos = planetWorldPos.clone().add(camOffset);
        camera.position.lerp(desiredCamPos, 0.1);
    }

    const positions = starField.geometry.attributes.position.array;
    const range = 2000;
    for(let i=0; i<starCount; i++) {
        let x = positions[i*3];
        if (x < camera.position.x - range/2) positions[i*3] += range;
        if (x > camera.position.x + range/2) positions[i*3] -= range;
        let y = positions[i*3+1];
        if (y < camera.position.y - range/2) positions[i*3+1] += range;
        if (y > camera.position.y + range/2) positions[i*3+1] -= range;
        let z = positions[i*3+2];
        if (z < camera.position.z - range/2) positions[i*3+2] += range;
        if (z > camera.position.z + range/2) positions[i*3+2] -= range;
    }
    starField.geometry.attributes.position.needsUpdate = true;
    planets.forEach(p => p.update(timeScale));
    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
