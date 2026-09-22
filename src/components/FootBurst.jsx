import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, DynamicDrawUsage, MixOperation, Object3D, Vector3 } from "three";
import { getStudioEnvMap } from "../utils/studioEnv";

const BURST_COUNT = 8;
const PARTICLES = 14;
const COUNT = BURST_COUNT * PARTICLES;
const LIFE_MIN = 0.45;
const LIFE_MAX = 1.5;
const STEP_COOLDOWN = 0.22;
const LIFT = 0.0008;
const AIR_HEIGHT = 0.045;
const MIN_DROP = 0.035;

const dummy = new Object3D();
const worldPos = new Vector3();
const localPos = new Vector3();
const fadeColor = new Color();
const whiteColor = new Color("#ffffff");
const skyColor = new Color("#7ec8ff");

const FOOTS = [
  { key: "leftFoot", name: "Left", dir: -1 },
  { key: "rightFoot", name: "Right", dir: 1 },
];

const emptyFootState = () => ({
  leftFoot: false,
  rightFoot: false,
});

const findFoot = (scene, side) => {
  let found = null;
  scene.traverse((obj) => {
    if (found || !obj.name) {
      return;
    }
    if (obj.name.includes(`${side}Foot`) && !obj.name.includes("Toe")) {
      found = obj;
    }
  });
  return found;
};

export function FootBurst({ scene, active, parent }) {
  const meshRef = useRef();
  const feet = useRef({ leftFoot: null, rightFoot: null });
  const lastY = useRef({ leftFoot: 0, rightFoot: 0 });
  const lastDy = useRef({ leftFoot: 0, rightFoot: 0 });
  const peakY = useRef({ leftFoot: 0, rightFoot: 0 });
  const plantY = useRef({ leftFoot: 0, rightFoot: 0 });
  const inAir = useRef(emptyFootState());
  const ready = useRef(emptyFootState());
  const cooldown = useRef({ leftFoot: 0, rightFoot: 0 });
  const nextBurst = useRef(0);

  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        alive: false,
        age: 0,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        side: 1,
        size: 0.04,
        life: 1,
        hue: 0,
      })),
    []
  );

  useLayoutEffect(() => {
    feet.current = {
      leftFoot: findFoot(scene, "Left"),
      rightFoot: findFoot(scene, "Right"),
    };
    ready.current = emptyFootState();
    inAir.current = emptyFootState();
    lastDy.current = { leftFoot: 0, rightFoot: 0 };
  }, [scene]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    mesh.renderOrder = 32;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    dummy.scale.setScalar(0);
    dummy.position.set(0, -40, 0);
    dummy.updateMatrix();
    for (let i = 0; i < COUNT; i += 1) {
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, i % 2 === 0 ? whiteColor : skyColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, []);

  const spawn = (x, y, z, side) => {
    const start = nextBurst.current * PARTICLES;
    nextBurst.current = (nextBurst.current + 1) % BURST_COUNT;
    for (let i = 0; i < PARTICLES; i += 1) {
      const p = particles[start + i];
      const spread = (i / Math.max(PARTICLES - 1, 1) - 0.5) * 0.7;
      p.alive = true;
      p.age = 0;
      p.hue = i % 2;
      p.side = side;
      p.life = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN);
      p.x = x;
      p.y = y + 0.008;
      p.z = z;
      p.vx = side * (0.22 + Math.random() * 0.32) + spread * 0.06;
      p.vy = 0.03 + Math.random() * 0.07;
      p.vz = (Math.random() - 0.5) * 0.18;
      p.size = 0.012 + Math.random() * 0.01;
    }
  };

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const root = parent.current;
    if (!mesh || !root) {
      return;
    }

    const mat = mesh.material;
    const envMap = getStudioEnvMap();
    if (mat && envMap && mat.envMap !== envMap) {
      mat.envMap = envMap;
      mat.needsUpdate = true;
    }

    if (active) {
      for (const { key, dir } of FOOTS) {
        const foot = feet.current[key];
        if (!foot) {
          continue;
        }
        cooldown.current[key] = Math.max(0, cooldown.current[key] - delta);
        foot.updateWorldMatrix(true, false);
        foot.getWorldPosition(worldPos);
        localPos.copy(worldPos);
        root.worldToLocal(localPos);
        const y = localPos.y;
        if (!ready.current[key]) {
          lastY.current[key] = y;
          lastDy.current[key] = 0;
          peakY.current[key] = y;
          plantY.current[key] = y;
          inAir.current[key] = false;
          ready.current[key] = true;
          continue;
        }
        const dy = y - lastY.current[key];
        const prevDy = lastDy.current[key];
        lastY.current[key] = y;
        lastDy.current[key] = dy;

        if (!inAir.current[key]) {
          if (y > plantY.current[key] + AIR_HEIGHT && dy > LIFT) {
            inAir.current[key] = true;
            peakY.current[key] = y;
          }
          continue;
        }

        if (y > peakY.current[key]) {
          peakY.current[key] = y;
        }

        const dropped = peakY.current[key] - y;
        const landed = prevDy < -LIFT && dy > LIFT && dropped > MIN_DROP;
        if (!landed || cooldown.current[key] > 0) {
          continue;
        }
        spawn(localPos.x, localPos.y, localPos.z, dir);
        cooldown.current[key] = STEP_COOLDOWN;
        inAir.current[key] = false;
        plantY.current[key] = y;
        peakY.current[key] = y;
      }
    } else {
      ready.current = emptyFootState();
      inAir.current = emptyFootState();
      lastDy.current = { leftFoot: 0, rightFoot: 0 };
      cooldown.current = { leftFoot: 0, rightFoot: 0 };
    }

    for (let i = 0; i < COUNT; i += 1) {
      const p = particles[i];
      if (!p.alive) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -40, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      p.age += delta;
      if (p.age >= p.life) {
        p.alive = false;
        dummy.scale.setScalar(0);
        dummy.position.set(0, -40, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const t = Math.min(p.age / p.life, 1);
      const fade = (1 - t) * (1 - t) * (1 - t);
      p.vx += p.side * 0.16 * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.vy -= 0.28 * delta;
      p.vx *= 0.985;
      p.vz *= 0.985;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.size * fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      fadeColor.copy(p.hue === 0 ? whiteColor : skyColor).multiplyScalar(fade);
      mesh.setColorAt(i, fadeColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
      renderOrder={20}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        combine={MixOperation}
        reflectivity={0.85}
      />
    </instancedMesh>
  );
}
