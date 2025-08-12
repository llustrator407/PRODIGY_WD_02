// --- DOM ELEMENTS ---
const timeDisplay = document.getElementById('time-display');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const lapBtn = document.getElementById('lap-btn');
const lapsContainer = document.getElementById('laps-container'); 
const audioUnlockOverlay = document.getElementById('audio-unlock-overlay');

// --- AUDIO ELEMENTS ---
const pauseSound = new Audio('stop.mp3'); // stop.mp3
const resumeSound = new Audio('resume.mp3'); // resume.mp3
const resetSound = new Audio('Reset.mp3'); // Reset.mp3
pauseSound.preload = 'auto';
resumeSound.preload = 'auto';
resetSound.preload = 'auto';

let timer = null;
let startTime = 0;
let elapsedTime = 0;
let isRunning = false;
let lapCounter = 1;

// --- REWIND ANIMATION STATE ---
let isRewinding = false;
let rewindTimeLeft = 0;
const REWIND_DURATION = 5.0; // 5 seconds
const REWIND_SPEED_MULTIPLIER = 2.5;

// --- STOPWATCH CORE FUNCTIONS ---

function formatTime(t) {
    const d = new Date(t);
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(d.getUTCMilliseconds()).padStart(3, '0').slice(0, 2);
    return `${hours}:${minutes}:${seconds}<span class="milliseconds">.${milliseconds}</span>`;
}

function updateDisplay() {
    timeDisplay.innerHTML = formatTime(elapsedTime + (Date.now() - startTime));
}

function start() {
    if (!isRunning && !isRewinding) {
        resumeSound.currentTime = 0;
        resumeSound.play().catch(e => console.error("Error playing resume sound:", e));
        
        // Set the start time, offsetting by any previously elapsed time
        startTime = Date.now() - elapsedTime;
        timer = setInterval(updateDisplay, 10);
        isRunning = true;
        startBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
        pauseBtn.disabled = false;
        lapBtn.disabled = false;
        document.body.classList.remove('time-stopped');
    }
}

function pause() {
    if (isRunning) {
        pauseSound.currentTime = 0;
        pauseSound.play().catch(e => console.error("Error playing pause sound:", e));
        clearInterval(timer);
        // Store the total elapsed time up to this point
        elapsedTime = Date.now() - startTime;
        isRunning = false;
        startBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
        document.body.classList.add('time-stopped');
    }
}

function reset() {
    resetSound.currentTime = 0;
    resetSound.play().catch(e => console.error("Error playing reset sound:", e));

    clearInterval(timer);
    isRunning = false;
    isRewinding = true;
    rewindTimeLeft = REWIND_DURATION;

    timeDisplay.innerHTML = formatTime(0);
    document.body.classList.remove('time-stopped');
    startBtn.disabled = true;
    pauseBtn.disabled = true;
    lapBtn.disabled = true;
    resetBtn.disabled = true;
    pauseBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
}

function performFinalReset() {
    isRewinding = false;
    elapsedTime = 0;
    startTime = 0;
    lapCounter = 1;
    lapsContainer.innerHTML = ''; // Clear the lap box
    
    startBtn.disabled = false;
    resetBtn.disabled = false;
    lapBtn.disabled = true;

    document.body.classList.add('time-stopped');

    horizontalRings.forEach(ring => ring.mesh.material.uniforms.uTime.value = Math.random() * 10);
    verticalRings.forEach(ring => ring.mesh.material.uniforms.uTime.value = Math.random() * 10);
    distortionPass.uniforms.uTime.value = 0;
}

function lap() {
     if (isRunning) {
        const currentLapTime = elapsedTime + (Date.now() - startTime);
        
        const lapElement = document.createElement('div');
        lapElement.className = 'lap-item';

        const lapNumberSpan = document.createElement('span');
        lapNumberSpan.className = 'lap-number';
        lapNumberSpan.textContent = `Lap ${lapCounter}`;

        const lapTimeSpan = document.createElement('span');
        lapTimeSpan.className = 'lap-time-value';
        // Use the formatTime function but remove the HTML tags for plain text
        lapTimeSpan.textContent = formatTime(currentLapTime).replace(/<[^>]*>/g, "");

        lapElement.appendChild(lapNumberSpan);
        lapElement.appendChild(lapTimeSpan);

        // Prepend to show the latest lap at the top
        lapsContainer.prepend(lapElement);
        lapCounter++;
    }
}

// --- EVENT LISTENERS ---
startBtn.addEventListener('click', start);
pauseBtn.addEventListener('click', pause);
resetBtn.addEventListener('click', reset);
lapBtn.addEventListener('click', lap);

// --- Audio Unlock Logic ---
audioUnlockOverlay.addEventListener('click', () => {
    pauseSound.play().catch(() => {});
    pauseSound.pause();
    resumeSound.play().catch(() => {});
    resumeSound.pause();
    resetSound.play().catch(() => {});
    resetSound.pause();

    audioUnlockOverlay.style.display = 'none';
}, { once: true });


// --- ADVANCED THREE.JS BLACK HOLE ---
let scene, camera, renderer, composer, distortionPass, invertPass;
const clock = new THREE.Clock();
const horizontalRings = [];
const verticalRings = [];

// --- SHADERS ---
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

const DistortionShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'uStrength': { value: 0.0000001 },
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
            
            float falloff = smoothstep(0.8, 0.15, dist);

            float strength = pow(falloff, 2.0) * uStrength;
            
            vec2 direction = normalize(center - uv);
            vec2 swirlDirection = vec2(-direction.y, direction.x);
            
            uv += direction * strength + swirlDirection * strength * 0.35;
            
            vec4 color = texture2D(tDiffuse, uv);
            gl_FragColor = color;
        }
    `
};

const InvertShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'uIntensity': { value: 1.0 } // Start with inverted colors
    },
    vertexShader: ` varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); } `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
            vec4 texColor = texture2D(tDiffuse, vUv);
            gl_FragColor = vec4(mix(texColor.rgb, vec3(1.0 - texColor.r, 1.0 - texColor.g, 1.0 - texColor.b), uIntensity), texColor.a);
        }
    `
};

// --- THREE.JS SETUP AND ANIMATION LOOP ---
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

    const renderPass = new THREE.RenderPass(scene, camera);
    distortionPass = new THREE.ShaderPass(DistortionShader);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 1.0;
    bloomPass.radius = 0.4;
    invertPass = new THREE.ShaderPass(InvertShader);

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(distortionPass);
    composer.addPass(bloomPass);
    composer.addPass(invertPass); 

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

    const blackHoleGeometry = new THREE.SphereGeometry(2.4, 32, 32);
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    blackHole.position.z = 0.1;
    scene.add(blackHole);
    
    const baseMaterial = new THREE.ShaderMaterial({
        uniforms: { 
            uTime: { value: 0.0 },
            uSeed: { value: 0.0 }
        },
        vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: true
    });

    let numberOfRingsH = 5, baseRadiusH = 2.6;
    for(let i = 0; i < numberOfRingsH; i++) {
        const ringMaterial = baseMaterial.clone();
        ringMaterial.uniforms.uTime.value = Math.random() * 100;
        ringMaterial.uniforms.uSeed.value = Math.random() * 10.0;
        const innerRadius = baseRadiusH + (Math.random() * 0.04 + 0.01);
        const outerRadius = innerRadius + (0*0.4 + 0.35);
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        
        ring.rotation.z = Math.random() * Math.PI * 2;
        
        ring.rotation.x = -Math.PI / 2.2 - (6 * (Math.PI / 180));
        ring.rotation.y = 10 * (Math.PI / 180);
        horizontalRings.push({ mesh: ring, speed: 0.28 - (i * 0.02) });
        scene.add(ring);
        baseRadiusH = outerRadius;
    }

    let numberOfRingsV = 8, baseRadiusV = 2.5;
    for(let i = 0; i < numberOfRingsV; i++) {
        const ringMaterial = baseMaterial.clone();
        ringMaterial.uniforms.uTime.value = Math.random() * 100;
        ringMaterial.uniforms.uSeed.value = Math.random() * 10.0;
        const innerRadius = baseRadiusV + (Math.random() * 0.05 + 0.02);
        const outerRadius = innerRadius + (Math.random() * 0.3 + 0.1);
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 128);
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);

        ring.rotation.z = Math.random() * Math.PI * 2;
        
        ring.rotation.x = -10 * (Math.PI / 180);
        ring.rotation.y = 10 * (Math.PI / 180);
        verticalRings.push({ mesh: ring, speed: 0.25 - (i * 0.025) });
        scene.add(ring);
        baseRadiusV = outerRadius;
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
    
    if (isRunning) {
        // Correctly update the animation time while running
        horizontalRings.forEach(ring => {
            ring.mesh.rotation.z -= delta * ring.speed;
            ring.mesh.material.uniforms.uTime.value += delta;
        });
        verticalRings.forEach(ring => {
            ring.mesh.rotation.z -= delta * ring.speed;
            ring.mesh.material.uniforms.uTime.value += delta;
        });
        distortionPass.uniforms.uTime.value += delta;
    } 
    else if (isRewinding) {
        if (rewindTimeLeft > 0) {
            rewindTimeLeft -= delta;
            const rewindDelta = delta * REWIND_SPEED_MULTIPLIER;
            
            horizontalRings.forEach(ring => {
                ring.mesh.rotation.z += rewindDelta * ring.speed;
                ring.mesh.material.uniforms.uTime.value -= rewindDelta;
            });
            verticalRings.forEach(ring => {
                ring.mesh.rotation.z += rewindDelta * ring.speed;
                ring.mesh.material.uniforms.uTime.value -= rewindDelta;
            });
            distortionPass.uniforms.uTime.value -= rewindDelta;
        } else {
            performFinalReset();
        }
    }

    const targetIntensity = (!isRunning && !isRewinding) ? 1.0 : 0.0;
    const currentIntensity = invertPass.uniforms.uIntensity.value;
    invertPass.uniforms.uIntensity.value += (targetIntensity - currentIntensity) * 0.1;

    composer.render();
}

// --- INITIALIZE AND START THE APP ---
init();
animate();

// --- Loading Animation Trigger ---
window.onload = () => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('loader-hidden');
    }
};
