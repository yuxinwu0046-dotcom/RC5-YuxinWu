// UCL, Bartlett, RC5
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

function isInScene(obj, scene) {
  let o = obj;
  while (o) {
    if (o === scene) return true;
    o = o.parent;
  }
  return false;
}

function isObject3D(o) {
  return !!o && (o.isObject3D === true);
}

export function createControls({ camera, renderer, scene, ui, onSelect }) {

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;

  const transform = new TransformControls(camera, renderer.domElement);

  const helper = (typeof transform.getHelper === "function") ? transform.getHelper() : null;
  const toAdd = isObject3D(helper) ? helper : (isObject3D(transform) ? transform : null);

  if (toAdd) scene.add(toAdd);

  transform.addEventListener("dragging-changed", (e) => {
    orbit.enabled = !e.value;
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const pickables = [];

  let currentMode = "translate";

  function setMode(mode) {
    currentMode = mode;
    transform.setMode(mode);

    ui?.btnMove?.classList.toggle("active", mode === "translate");
    ui?.btnRotate?.classList.toggle("active", mode === "rotate");
    ui?.btnScale?.classList.toggle("active", mode === "scale");
  }

  ui?.btnMove && (ui.btnMove.onclick = () => setMode("translate"));
  ui?.btnRotate && (ui.btnRotate.onclick = () => setMode("rotate"));
  ui?.btnScale && (ui.btnScale.onclick = () => setMode("scale"));

  setMode("translate");

  function detach() {
    transform.detach();
    if (typeof onSelect === "function") onSelect(null);
    ui?.selectedName && (ui.selectedName.innerText = "None");
  }

  function clearPickables() {
    pickables.length = 0;
  }

  window.addEventListener("click", (event) => {
    if (event.target.closest(".panel")) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pickables, true);

    if (hits.length) {
      let obj = hits[0].object;
      while (obj.parent && !pickables.includes(obj)) obj = obj.parent;

      if (obj && isInScene(obj, scene)) {
        transform.attach(obj);
        if (typeof onSelect === "function") onSelect(obj);
        transform.setMode(currentMode);
        ui?.selectedName && (ui.selectedName.innerText = obj.name || "Selected");
      } else {
        detach();
      }
    } else {
      detach();
    }
  });

  return {
    orbit,
    transform,
    detach,
    clearPickables,
    addPickable(object) {
      if (!object) return;
      pickables.push(object);
    },
    update() {
      orbit.update();
    },
  };
}
