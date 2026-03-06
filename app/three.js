// UCL, Bartlett, RC5
import * as THREE from "three";
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

import { createControls } from "./controls.js";
import { createWarpClient } from "../warp/warpClient.js";

import { initParamsUi } from "../sender/paramsUi.js";
import { initChatUi } from "../sender/chatUi.js";

if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
}

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(500, 500, 500);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 15, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.bias = -0.0001;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

// Ground receiving shadows (nice grounding)
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.8 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

// Grid
const grid = new THREE.GridHelper(50000, 50, 0x888888, 0xdddddd);
grid.position.y = -0.01;
scene.add(grid);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Postprocessing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));



// Outline
const outlinePass = new OutlinePass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    scene,
    camera
);
outlinePass.edgeStrength = 4;
outlinePass.edgeThickness = 3;
outlinePass.edgeGlow = 0;
outlinePass.pulsePeriod = 0;
outlinePass.visibleEdgeColor.set(0x00aaff);
outlinePass.hiddenEdgeColor.set(0x00aaff);
composer.addPass(outlinePass);
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms["resolution"].value.set(
    1 / (window.innerWidth * (renderer.getPixelRatio ? renderer.getPixelRatio() : 1)),
    1 / (window.innerHeight * (renderer.getPixelRatio ? renderer.getPixelRatio() : 1))
);
composer.addPass(fxaaPass);


// Better shadow
const gtaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
gtaoPass.enabled = true;

if (gtaoPass.params) {
    gtaoPass.params.intensity = 1.5;
    gtaoPass.params.radius = 0.35;
    gtaoPass.params.thickness = 1.0;
    gtaoPass.params.distanceFallOff = 1.0;
}
composer.addPass(gtaoPass);
composer.addPass(new OutputPass());



// Environment map
const loader = new HDRLoader();
const envMap = await loader.loadAsync('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr');
envMap.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envMap;

//Controls
const controls = createControls({
    camera,
    renderer,
    scene,
    ui: {
        btnMove: document.getElementById("btnMove"),
        btnRotate: document.getElementById("btnRotate"),
        btnScale: document.getElementById("btnScale"),
        selectedName: document.getElementById("selectedName"),
    },
    onSelect: (obj) => {
        outlinePass.selectedObjects = obj ? [obj] : [];
    },
});


//UIs
const URL_MAIN = "wss://relay.curvf.com/ws";
const URL_BACKUP = "wss://warp-relay.qinzehaozln.workers.dev/ws";

const statusText = document.getElementById("statusText");
const connectionDot = document.getElementById("connectionDot");

const loadingSpinner = document.getElementById("loadingSpinner");

function setLoadingProgress(p) {
    if (!loadingSpinner) return;
    const pct = Math.round(Math.max(0, Math.min(1, Number(p) || 0)) * 100);
    loadingSpinner.style.setProperty("--p", String(pct));
    loadingSpinner.setAttribute("data-pct", String(pct));
}


function setLoadingVisible(v) {
    if (!loadingSpinner) return;
    loadingSpinner.style.opacity = v ? "1" : "0.45";
}



function setDotState(state) {
    if (!connectionDot) return;
    connectionDot.classList.remove("connected", "connecting");
    if (state === "connected") connectionDot.classList.add("connected");
    else if (state === "connecting") connectionDot.classList.add("connecting");
}

let warpGroup = new THREE.Group();
warpGroup.name = "Warp Group";
scene.add(warpGroup);

// Material
const sharedMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0.1,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
    color: 0xbc916d
});

function clearWarpGeometries() {
    controls.detach?.();
    controls.clearPickables?.();

    for (let i = warpGroup.children.length - 1; i >= 0; i--) {
        const child = warpGroup.children[i];
        warpGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
    }
}


function setWarpGeometries(geometries) {
    clearWarpGeometries();

    for (let i = 0; i < geometries.length; i++) {
        const mesh = new THREE.Mesh(geometries[i], sharedMaterial);
        mesh.name = `Warp Mesh ${i}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        warpGroup.add(mesh);
        controls.addPickable?.(mesh);
    }
}

//sending parameters
let warpClientInstance = null;
let paramsUiHandle = null;

const initialRoom =
    new URLSearchParams(window.location.search).get("room") || "warp_test_local_001";

let currentRoom = initialRoom;

//init params sender
paramsUiHandle = initParamsUi({
    warp: {
        sendParams: () => false,
    },
    throttle: 50,
    sendAll: true,
    mappings: [
        { sliderId: "sChair1XLocation", valueId: "vChair1XLocation", key: "Chair1XLocation" },
        { sliderId: "sChair1YLocation", valueId: "vChair1YLocation", key: "Chair1YLocation" },
        { sliderId: "sChair2XLocation", valueId: "vChair2XLocation", key: "Chair2XLocation" },
        { sliderId: "sChair2YLocation", valueId: "vChair2YLocation", key: "Chair2YLocation" },
        { sliderId: "sChair3XLocation", valueId: "vChair3XLocation", key: "Chair3XLocation" },
        { sliderId: "sChair3YLocation", valueId: "vChair3YLocation", key: "Chair3YLocation" },
        { sliderId: "sChair4XLocation", valueId: "vChair4XLocation", key: "Chair4XLocation" },
        { sliderId: "sChair4YLocation", valueId: "vChair4YLocation", key: "Chair4YLocation" },
        { sliderId: "sDeskLocation", valueId: "vDeskLocation", key: "DeskLocation" },
    ],
});

//init chat sender
initChatUi({
    warp: {
        sendParams: (p) => warpClientInstance ? warpClientInstance.sendParams(p) : false,
    },
    getBaseParams: () => paramsUiHandle.currentParams,
});

function initWarp(roomKey) {
    clearWarpGeometries();
    setLoadingVisible(true);
    setLoadingProgress(0, "Connecting…");

    if (warpClientInstance) {
        try { warpClientInstance.close(); } catch { }
        warpClientInstance = null;
    }

    currentRoom = roomKey;

    warpClientInstance = createWarpClient({
        relayBase: URL_MAIN,
        room: roomKey,

        onStatus: (state, info) => {
            if (statusText) statusText.innerText = `${state}`;
            setDotState(state);

            if (state === "connected") {
                setLoadingVisible(true);
                setLoadingProgress(0, "Waiting for mesh…");

                if (paramsUiHandle) {
                    setTimeout(() => {
                        paramsUiHandle.pushAll();
                    }, 0);
                }
            }

            if (state === "disconnected" || state === "error" || state === "bad_binary" || state === "bad_json") {
                setLoadingVisible(false);
            }
        },

        onProgress: (p, meta) => {
            if (meta?.state === "idle") {
                setLoadingVisible(false);
                return;
            }
            setLoadingVisible(true);

            if (meta?.state === "begin") {
                setLoadingProgress(0, "Loading 0%");
            } else if (meta?.state === "downloading") {
                setLoadingProgress(p, `Loading ${Math.round(p * 100)}%`);
            } else if (meta?.state === "parsing") {
                setLoadingProgress(0.95, "Parsing…");
            } else if (meta?.state === "decompressing") {
                setLoadingProgress(0.96, "Unzipping…");
            } else if (meta?.state === "done") {
                setLoadingProgress(1, "Done");
                setTimeout(() => setLoadingVisible(false), 200);
            }
        },

        onMesh: (payload) => {
            const geometries = payload?.geometries || [];
            setWarpGeometries(geometries);
        },
    });

    paramsUiHandle = initParamsUi({
        warp: {
            sendParams: (p) => warpClientInstance ? warpClientInstance.sendParams(p) : false,
        },
        throttle: 50,
        sendAll: true,
        mappings: [
        { sliderId: "sChair1XLocation", valueId: "vChair1XLocation", key: "Chair1XLocation" },
        { sliderId: "sChair1YLocation", valueId: "vChair1YLocation", key: "Chair1YLocation" },
        { sliderId: "sChair2XLocation", valueId: "vChair2XLocation", key: "Chair2XLocation" },
        { sliderId: "sChair2YLocation", valueId: "vChair2YLocation", key: "Chair2YLocation" },
        { sliderId: "sChair3XLocation", valueId: "vChair3XLocation", key: "Chair3XLocation" },
        { sliderId: "sChair3YLocation", valueId: "vChair3YLocation", key: "Chair3YLocation" },
        { sliderId: "sChair4XLocation", valueId: "vChair4XLocation", key: "Chair4XLocation" },
        { sliderId: "sChair4YLocation", valueId: "vChair4YLocation", key: "Chair4YLocation" },
        { sliderId: "sDeskLocation", valueId: "vDeskLocation", key: "DeskLocation" },
        ],
    });
}

// Initial startup
initWarp(initialRoom);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
}
animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    outlinePass.setSize(window.innerWidth, window.innerHeight);

    fxaaPass.material.uniforms["resolution"].value.set(
        1 / (window.innerWidth * (renderer.getPixelRatio ? renderer.getPixelRatio() : 1)),
        1 / (window.innerHeight * (renderer.getPixelRatio ? renderer.getPixelRatio() : 1))
    );

    if (gtaoPass && gtaoPass.setSize) gtaoPass.setSize(window.innerWidth, window.innerHeight);
});
