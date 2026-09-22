import { useAnimations, useGLTF, useScroll } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { MathUtils, Vector3 } from "three";
import { usePlay } from "../contexts/Play";
import { getStudioEnvMap } from "../utils/studioEnv";
import { FootBurst } from "./FootBurst";

export const AVATAR_LAYER = 1;

const bindAvatarLight = (light) => {
  if (light) {
    light.layers.set(AVATAR_LAYER);
  }
};

const applyStudioEnv = (scene, envMap) => {
  scene.traverse((obj) => {
    obj.layers.set(AVATAR_LAYER);
    if (!obj.isMesh) {
      return;
    }
    obj.frustumCulled = false;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) {
        continue;
      }
      mat.envMap = envMap;
      mat.envMapIntensity = 0.5;
      const name = mat.name ?? "";
      if (/earring/i.test(name)) {
        mat.metalness = 0.4;
        mat.roughnessMap = null;
        mat.roughness = 0.1;
        mat.vertexColors = false;
      } else if (/skin/i.test(name)) {
        mat.roughness = 0.5;
      }
      mat.needsUpdate = true;
    }
  });
};

function AvatarLights() {
  const keyRef = useRef();
  const fillRef = useRef();
  const ambientRef = useRef();
  const targetRef = useRef();

  useLayoutEffect(() => {
    const target = targetRef.current;
    const key = keyRef.current;
    const fill = fillRef.current;
    if (!target || !key || !fill) {
      return;
    }
    key.target = target;
    fill.target = target;
    bindAvatarLight(ambientRef.current);
    bindAvatarLight(key);
    bindAvatarLight(fill);
  }, []);

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.3} />
      <directionalLight
        ref={keyRef}
        position={[1.2, 2.4, 2.2]}
        intensity={0.45}
      />
      <directionalLight
        ref={fillRef}
        position={[-1.8, 0.8, 1.4]}
        intensity={0.1}
      />
      <object3D ref={targetRef} position={[0, 1.2, 0]} />
    </>
  );
}

const CLOTH_ENV_INTENSITY = 5;
const CLOTH_COLOR_SCALE = 1.75;

const applyClothEnv = (scene, envMap, intensity, colorScale) => {
  scene.traverse((obj) => {
    obj.layers.set(AVATAR_LAYER);
    if (!obj.isMesh) {
      return;
    }
    obj.frustumCulled = false;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) {
        continue;
      }
      mat.envMap = envMap;
      mat.envMapIntensity = intensity;
      if (mat.color) {
        if (!mat.userData.clothBaseColor) {
          mat.userData.clothBaseColor = mat.color.clone();
        }
        mat.color
          .copy(mat.userData.clothBaseColor)
          .multiplyScalar(colorScale);
      }
      mat.needsUpdate = true;
    }
  });
};

const AVATAR_CLIPS = {
  idle: "idle",
  running: "running",
  idleCloth: "clothIShapeAni",
  runningCloth: "clothRShapeAni",
};

const normalizeClipName = (name = "") =>
  name.toLowerCase().replace(/shpae/g, "shape");

const getClipAction = (actions, preferred) => {
  if (!actions || !preferred) {
    return null;
  }
  if (actions[preferred]) {
    return actions[preferred];
  }
  const want = normalizeClipName(preferred);
  const key = Object.keys(actions).find(
    (name) => normalizeClipName(name) === want
  );
  return key ? actions[key] : null;
};

function AvatarCloth({ path, active, clip }) {
  const { scene, animations } = useGLTF(path);
  const { actions } = useAnimations(animations, scene);

  useLayoutEffect(() => {
    applyClothEnv(
      scene,
      getStudioEnvMap(),
      CLOTH_ENV_INTENSITY,
      CLOTH_COLOR_SCALE
    );
    scene.visible = active;
  }, [scene, active]);

  useEffect(() => {
    const action =
      getClipAction(actions, clip) ?? actions[animations[0]?.name];
    scene.visible = active;
    if (!action || !active) {
      action?.stop();
      return;
    }
    for (const other of Object.values(actions)) {
      if (other && other !== action) {
        other.stop();
      }
    }
    action.enabled = true;
    action.reset();
    action.time = 0;
    action.timeScale = 1;
    action.setEffectiveWeight(1);
    action.play();
    return () => {
      action.stop();
      scene.visible = false;
    };
  }, [active, actions, animations, scene, clip]);

  return <primitive object={scene} />;
}

const LOCO_CLIPS = new Set([AVATAR_CLIPS.idle, AVATAR_CLIPS.running]);
const IDLE_HOLD = 0.22;
const SCROLL_TARGET = 0.000001;
const SCROLL_DELTA = 0.00005;
const START_OFFSET = 0.003;
const BACK_OFFSET = 0.00002;
const FACE_LAMBDA = 8;
const returnPos = new Vector3();

export function Avatar({
  rotation,
  "rotation-y": rotationY = 0,
  ...props
}) {
  const stillTime = useRef(1);
  const lastTarget = useRef(null);
  const startBoost = useRef(false);
  const lastWorldZ = useRef(null);
  const locoRef = useRef("idle");
  const lastOffset = useRef(null);
  const yaw = useRef(null);
  const facingBack = useRef(false);
  const outer = useRef();
  const inner = useRef();
  const [loco, setLoco] = useState("idle");
  const { play, end } = usePlay();
  const scroll = useScroll();
  const { scene, animations } = useGLTF("/models/human/myChar.glb");
  const { actions } = useAnimations(animations, scene);
  const { scene: world } = useThree();

  useLayoutEffect(() => {
    world.environment = getStudioEnvMap();
    applyStudioEnv(scene, world.environment);
  }, [scene, world]);

  useFrame((_, delta) => {
    if (!actions.idle || !actions.running) {
      return;
    }

    const rawOffset = scroll?.offset ?? 0;
    const offset = Number.isFinite(rawOffset)
      ? MathUtils.clamp(rawOffset, 0, 1)
      : 0;
    const rawTarget = scroll?.scroll?.current ?? 0;
    const target = Number.isFinite(rawTarget)
      ? MathUtils.clamp(rawTarget, 0, 1)
      : 0;
    const prevTarget = lastTarget.current;
    lastTarget.current = target;
    const atStart = offset < START_OFFSET;
    const jumped =
      prevTarget != null && Math.abs(target - prevTarget) > SCROLL_TARGET;
    if (atStart && jumped) {
      startBoost.current = true;
    }
    if (!atStart) {
      startBoost.current = false;
    }

    let goingToStart = false;
    let worldZ = 0;
    if (outer.current) {
      outer.current.getWorldPosition(returnPos);
      worldZ = returnPos.z;
      const prevZ = lastWorldZ.current;
      lastWorldZ.current = worldZ;
      goingToStart =
        prevZ != null && worldZ - prevZ > 0.0008 && worldZ < -0.04;
    }
    const arrivedHome = atStart && !goingToStart && worldZ > -0.08;
    if (arrivedHome) {
      startBoost.current = false;
    }

    const moving =
      play &&
      !end &&
      !arrivedHome &&
      (goingToStart ||
        (atStart
          ? jumped || startBoost.current
          : (scroll?.delta ?? 0) > SCROLL_DELTA));
    if (moving) {
      stillTime.current = 0;
    } else {
      stillTime.current += delta;
    }

    const keepRunning =
      moving || (!arrivedHome && stillTime.current < IDLE_HOLD);
    const next = play && !end && keepRunning ? "running" : "idle";
    if (next !== locoRef.current) {
      locoRef.current = next;
      setLoco(next);
    }

    if (yaw.current == null) {
      yaw.current = rotationY;
    }
    const prevOffset = lastOffset.current;
    lastOffset.current = offset;
    const goingBack =
      play &&
      !end &&
      !arrivedHome &&
      (goingToStart ||
        (prevOffset != null && offset < prevOffset - BACK_OFFSET));
    const goingForward =
      play &&
      !end &&
      !arrivedHome &&
      prevOffset != null &&
      offset > prevOffset + BACK_OFFSET;
    if (arrivedHome || !play) {
      facingBack.current = false;
    } else if (goingBack) {
      facingBack.current = true;
    } else if (goingForward) {
      facingBack.current = false;
    }
    const targetYaw = facingBack.current ? rotationY + Math.PI : rotationY;
    yaw.current = MathUtils.damp(yaw.current, targetYaw, FACE_LAMBDA, delta);
    if (inner.current) {
      inner.current.rotation.y = yaw.current;
    }
  });

  useEffect(() => {
    const extras = Object.keys(actions).filter((name) => !LOCO_CLIPS.has(name));
    for (const name of extras) {
      const action = actions[name];
      if (!action) {
        continue;
      }
      action.enabled = true;
      action.reset();
      action.time = 0;
      action.setEffectiveWeight(1);
      action.play();
    }
    return () => {
      for (const name of extras) {
        actions[name]?.stop();
      }
    };
  }, [actions]);

  useEffect(() => {
    const action = getClipAction(actions, AVATAR_CLIPS[loco]) ?? actions[loco];
    if (!action) {
      return;
    }
    action.enabled = true;
    action.reset();
    action.time = 0;
    action.setEffectiveWeight(1);
    action.play();
    return () => {
      action.stop();
    };
  }, [loco, actions]);

  return (
    <group ref={outer} {...props} dispose={null}>
      <AvatarLights />
      <group ref={inner} rotation={rotation} rotation-y={rotationY}>
        <primitive object={scene} />
        <AvatarCloth
          path="/models/human/cloth-I.glb"
          active={loco === "idle"}
          clip={AVATAR_CLIPS.idleCloth}
        />
        <AvatarCloth
          path="/models/human/cloth-R.glb"
          active={loco === "running"}
          clip={AVATAR_CLIPS.runningCloth}
        />
      </group>
      <FootBurst scene={scene} active={loco === "running"} parent={outer} />
    </group>
  );
}

useGLTF.preload("/models/human/myChar.glb");
useGLTF.preload("/models/human/cloth-I.glb");
useGLTF.preload("/models/human/cloth-R.glb");
