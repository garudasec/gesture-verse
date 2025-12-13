// --- CONFIGURATION ---
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const PARTICLE_COUNT = isMobile ? 3500 : 12000;
const PARTICLE_SIZE = 0.15;
const LERP_SPEED = 0.08;

let scene, camera, renderer, particles, geometry, materials;
let positionsOriginal, positionsTarget;

// State
let currentShapeIndex = 0;
let isPinching = false;
let handCentroid = { x: 0, y: 0 };
let lastGestureTime = 0;
const GESTURE_COOLDOWN = 1500;

const shapes = ['Sphere', 'Heart', 'Saturn', 'Flower', 'Firework'];

// --- THREE.JS INIT ---
function initThree() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.03);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 25;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    geometry = new THREE.BufferGeometry();
    positionsOriginal = new Float32Array(PARTICLE_COUNT * 3);
    positionsTarget = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    calculateShape('Sphere', positionsTarget);
    positionsOriginal.set(positionsTarget);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positionsOriginal, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const sprite = new THREE.TextureLoader().load(
        'https://threejs.org/examples/textures/sprites/disc.png'
    );

    materials = new THREE.PointsMaterial({
        size: PARTICLE_SIZE,
        map: sprite,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
    });

    particles = new THREE.Points(geometry, materials);
    scene.add(particles);

    window.addEventListener('resize', onWindowResize);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- SHAPES ---
function calculateShape(type, array) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        let x, y, z;

        if (type === 'Sphere') {
            const r = 10;
            const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
            const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
            x = r * Math.cos(theta) * Math.sin(phi);
            y = r * Math.sin(theta) * Math.sin(phi);
            z = r * Math.cos(phi);
        } else if (type === 'Heart') {
            const t = Math.PI * 2 * Math.random();
            const u = Math.PI * Math.random();
            const scale = 0.6;
            x = 16 * Math.pow(Math.sin(t), 3);
            y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            z = 10 * Math.cos(u) * Math.sin(t);
            x *= scale; y *= scale; z *= scale;
        } else if (type === 'Saturn') {
            if (Math.random() > 0.3) {
                const rad = 6;
                const phi = Math.acos(-1 + 2 * Math.random());
                const theta = Math.random() * Math.PI * 2;
                x = rad * Math.cos(theta) * Math.sin(phi);
                y = rad * Math.sin(theta) * Math.sin(phi);
                z = rad * Math.cos(phi);
            } else {
                const angle = Math.random() * Math.PI * 2;
                const dist = 9 + Math.random() * 5;
                x = Math.cos(angle) * dist;
                z = Math.sin(angle) * dist;
                y = (Math.random() - 0.5) * 0.5;
            }
        } else if (type === 'Flower') {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = 10 * Math.sin(4 * theta) * Math.sin(phi) + 2;
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.cos(phi);
            z = r * Math.sin(phi) * Math.sin(theta);
        } else {
            const r = Math.pow(Math.random(), 0.3) * 15;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta);
            z = r * Math.cos(phi);
        }

        array[i3] = x;
        array[i3 + 1] = y;
        array[i3 + 2] = z;
    }
}

function switchShape() {
    currentShapeIndex = (currentShapeIndex + 1) % shapes.length;
    document.getElementById('shape-name').innerText = shapes[currentShapeIndex];
    calculateShape(shapes[currentShapeIndex], positionsTarget);
}

// --- MEDIAPIPE ---
const videoElement = document.getElementById('video-input');

function onResults(results) {
    document.getElementById('loading').style.display = 'none';

    if (results.multiHandLandmarks?.length) {
        document.getElementById('status-text').innerText = "Hand Detected";
        document.getElementById('status-text').style.color = "#00ff00";

        const lm = results.multiHandLandmarks[0];
        handCentroid.x = lm[9].x;
        handCentroid.y = lm[9].y;

        const d = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        isPinching = d < 0.05;

        if (lm[8].y < lm[6].y && lm[12].y < lm[10].y &&
            lm[16].y > lm[14].y && lm[20].y > lm[18].y) {
            const now = Date.now();
            if (now - lastGestureTime > GESTURE_COOLDOWN) {
                switchShape();
                lastGestureTime = now;
            }
        }
    }
}

const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

new Camera(videoElement, {
    onFrame: async () => await hands.send({ image: videoElement }),
    width: 640,
    height: 480
}).start();

// --- ANIMATION ---
function animate() {
    requestAnimationFrame(animate);

    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array;

    particles.rotation.y += 0.005 + (handCentroid.x - 0.5) * 0.1;
    particles.rotation.x = (handCentroid.y - 0.5) * 1.5;

    const color = new THREE.Color().setHSL(Math.abs(handCentroid.x), 1, 0.6);

    const scale = isPinching ? 0.2 : 1;
    particles.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] += (positionsTarget[i3] - positions[i3]) * LERP_SPEED;
        positions[i3 + 1] += (positionsTarget[i3 + 1] - positions[i3 + 1]) * LERP_SPEED;
        positions[i3 + 2] += (positionsTarget[i3 + 2] - positions[i3 + 2]) * LERP_SPEED;

        colors[i3] += (color.r - colors[i3]) * 0.05;
        colors[i3 + 1] += (color.g - colors[i3 + 1]) * 0.05;
        colors[i3 + 2] += (color.b - colors[i3 + 2]) * 0.05;
    }

    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;

    renderer.render(scene, camera);
}

// START
initThree();
