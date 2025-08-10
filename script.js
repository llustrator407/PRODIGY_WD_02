const timeDisplay = document.getElementById('time-display');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const lapBtn = document.getElementById('lap-btn');
const lapsContainer = document.getElementById('laps-container');

let timer = null, startTime = 0, elapsedTime = 0, isRunning = false, lapCounter = 1;

function formatTime(t) {
    const d = new Date(t);
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(d.getUTCMilliseconds()).padStart(3, '0').slice(0, 2);
    return `${hours}:${minutes}:${seconds}<span class="milliseconds">.${milliseconds}</span>`;
}

function updateDisplay() {
    elapsedTime = Date.now() - startTime;
    timeDisplay.innerHTML = formatTime(elapsedTime);
}

function start() {
    if (!isRunning) {
        startTime = Date.now() - elapsedTime;
        timer = setInterval(updateDisplay, 10);
        isRunning = true;
        startBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
        lapBtn.disabled = false;
    }
}

function pause() {
    if (isRunning) {
        clearInterval(timer);
        isRunning = false;
        startBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
    }
}

function reset() {
    clearInterval(timer);
    isRunning = false;
    elapsedTime = 0;
    lapCounter = 1;
    timeDisplay.innerHTML = formatTime(0);
    lapsContainer.innerHTML = '';
    startBtn.classList.remove('hidden');
    pauseBtn.classList.add('hidden');
    lapBtn.disabled = true;
}

function lap() {
    if (isRunning) {
        const currentLapTime = elapsedTime;
        const lapElement = document.createElement('div');
        lapElement.className = 'lap-item';

        const lapNumber = document.createElement('span');
        lapNumber.className = 'lap-number';
        lapNumber.textContent = `Lap ${lapCounter}`;

        const lapTimeValue = document.createElement('span');
        lapTimeValue.className = 'lap-time-value';
        lapTimeValue.textContent = formatTime(currentLapTime).replace(/<[^>]*>/g, ""); // Remove html tags for lap display

        lapElement.appendChild(lapNumber);
        lapElement.appendChild(lapTimeValue);

        lapsContainer.prepend(lapElement);
        lapCounter++;
    }
}

startBtn.addEventListener('click', start);
pauseBtn.addEventListener('click', pause);
resetBtn.addEventListener('click', reset);
lapBtn.addEventListener('click', lap);


// --- ADVANCED THREE.JS BLACK HOLE ---
let scene, camera, renderer, composer, distortionPass;
const clock = new THREE.Clock();
const horizontalRings = [];
const verticalRings = [];

// --- Shaders ---
const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform float uTime;
    uniform float uSeed; // Added seed uniform for randomization
    varying vec2 vUv;

    float random (vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise (vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        vec2 u = f*f*(3.0-2.0*f);
        return mix( mix( random( i + vec2(0.0,0.0) ), 
                         random( i + vec2(1.0,0.0) ), u.x),
                    mix( random( i + vec2(0.0,1.0) ), 
                         random( i + vec2(1.0,1.0) ), u.x), u.y);
    }

    float fbm (vec2 st) {
        float value = 0.0;
        float amplitude = .5;
        for (int i = 0; i < 6; i++) {
            value += amplitude * noise(st);
            st *= 2.;
            amplitude *= .5;
        }
        return value;
    }

    void main() {
        float radius = vUv.x;
        float angle = vUv.y * 2.0 * 3.14159;
        float alpha = smoothstep(0.0, 0.1, radius) * (1.0 - smoothstep(0.9, 1.0, radius));
        
        // Use the seed to offset the noise pattern
        vec2 uv = vec2(angle + uSeed, radius * 2.0 + uSeed); 
        
        vec2 q = vec2( fbm( uv + uTime * 0.1 ),
                       fbm( uv + vec2(2.0) ) );
        vec2 r = vec2( fbm( uv + q * 1.5 + uTime * 0.15 ),
                       fbm( uv + q * 1.5 + vec2(3.2) ) );
        float swirl = fbm(uv + r);
        vec3 color1 = vec3(1.0, 0.85, 0.7);
        vec3 color2 = vec3(1.0, 0.5, 0.1);
        vec3 diskColor = mix(color1, color2, swirl);
        gl_FragColor = vec4(diskColor, alpha);
    }
`;

// --- Enhanced Gravitational Lensing Shader ---
const DistortionShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'uStrength': { value: 0.05 },
        'uTime': { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uStrength;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
            vec2 center = vec2(0.5, 0.5);
            vec2 uv = vUv;
            float dist = distance(uv, center);
            
            float shimmer = sin(dist * 10.0 - uTime * 0.5) * 0.1 + 0.9;
            
            float strength = smoothstep(0.6, 0.0, dist) * uStrength * shimmer;
            
            vec2 direction = normalize(uv - center);
            
            uv += direction * strength;
            
            vec4 color = texture2D(tDiffuse, uv);
            gl_FragColor = color;
        }
    `
};


function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('bg-canvas'),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // --- Post-processing Chain ---
    const renderPass = new THREE.RenderPass(scene, camera);
    
    distortionPass = new THREE.ShaderPass(DistortionShader);

    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 1.0;
    bloomPass.radius = 0.4;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(distortionPass);
    composer.addPass(bloomPass);

    // --- Starfield ---
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // --- Black Hole Sphere ---
    const blackHoleGeometry = new THREE.SphereGeometry(2.4, 32, 32);
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    blackHole.position.z = 0.1;
    scene.add(blackHole);
    
    // --- Define base material with a seed uniform ---
    const baseMaterial = new THREE.ShaderMaterial({
        uniforms: { 
            uTime: { value: 0.0 },
            uSeed: { value: 0.0 }
        },
        vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: true
    });

    // --- Create Horizontal Disk ---
    let numberOfRings = 5;
    let baseRadius = 2.6;
    let currentRadius = baseRadius;
    for(let i = 0; i < numberOfRings; i++) {
        const ringMaterial = baseMaterial.clone();
        ringMaterial.uniforms.uTime.value = Math.random() * 100;
        ringMaterial.uniforms.uSeed.value = Math.random() * 10.0;

        const gap = Math.random() * 0.04 + 0.01; 
        const innerRadius = currentRadius + gap;
        const thickness = Math.random() * 0.4 + 0.15;
        const outerRadius = innerRadius + thickness;
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        
        ring.rotation.x = -Math.PI / 2.2 - (5 * (Math.PI / 180));
        ring.rotation.y = 5 * (Math.PI / 180); // Rotated 5 degrees to the left

        horizontalRings.push({ mesh: ring, speed: 0.18 - (i * 0.02) });
        scene.add(ring);
        currentRadius = outerRadius;
    }

    // --- Create Vertical Disk ---
    numberOfRings = 8;
    baseRadius = 2.5;
    currentRadius = baseRadius;
    for(let i = 0; i < numberOfRings; i++) {
        const ringMaterial = baseMaterial.clone();
        ringMaterial.uniforms.uTime.value = Math.random() * 100;
        ringMaterial.uniforms.uSeed.value = Math.random() * 10.0;

        const gap = Math.random() * 0.05 + 0.02; 
        const innerRadius = currentRadius + gap;
        const thickness = Math.random() * 0.3 + 0.1;
        const outerRadius = innerRadius + thickness;
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        
        ring.rotation.x = -5 * (Math.PI / 180); 
        ring.rotation.y = 10 * (Math.PI / 180);

        verticalRings.push({ mesh: ring, speed: 0.15 - (i * 0.025) });
        scene.add(ring);
        currentRadius = outerRadius;
    }

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    
    // Animate each ring's material independently
    horizontalRings.forEach(ring => {
        ring.mesh.rotation.z -= delta * ring.speed;
        ring.mesh.material.uniforms.uTime.value += delta;
    });
    
    // Animate vertical rings
    verticalRings.forEach(ring => {
        ring.mesh.rotation.z -= delta * ring.speed;
        ring.mesh.material.uniforms.uTime.value += delta;
    });
    
    // Update time for distortion shader
    distortionPass.uniforms.uTime.value = elapsedTime;

    composer.render();
}

init();
animate();