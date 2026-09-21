import { Instance, Instances, useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, DoubleSide, MathUtils } from "three";
import { usePlay } from "../contexts/Play";

const INSTANCES = 240;
const MAX_OPACITY = 0.1;
const SCROLL_THRESHOLD = 0.0005;
const START_OFFSET = 0.02;
const START_Z = -50;

const SpeedShape = () => {
  const ref = useRef();
  let randomPosition = {
    x: 0,
    y: 0,
    z: 0,
  };
  let randomSpeed = 0;

  const resetRandom = () => {
    randomPosition = {
      x: MathUtils.randFloatSpread(8),
      y: MathUtils.randFloatSpread(5),
      z: MathUtils.randFloatSpread(8),
    };
    randomSpeed = MathUtils.randFloat(16, 20);
  };
  resetRandom();

  useFrame((_state, delta) => {
    if (ref.current) {
      ref.current.position.z += randomSpeed * delta;
      if (ref.current.position.z > 5) {
        resetRandom();
        ref.current.position.z = randomPosition.z;
      }
    }
  });

  return (
    <Instance
      ref={ref}
      color="white"
      position={[randomPosition.x, randomPosition.y, randomPosition.z]}
      rotation-y={Math.PI / 2}
    />
  );
};

export const Speed = () => {
  const group = useRef();
  const speedMaterial = useRef();
  const scroll = useScroll();
  const lastScroll = useRef(0);
  const armed = useRef(false);
  const { play, end } = usePlay();

  useFrame((_state, delta) => {
    if (!speedMaterial.current) {
      return;
    }

    const offset = scroll.offset;
    const raw = scroll.scroll?.current ?? 0;
    const cameraZ = group.current?.parent?.position.z ?? 0;
    const atStart =
      offset < START_OFFSET || raw < START_OFFSET || cameraZ > START_Z;

    if (!play || end || atStart) {
      armed.current = false;
      lastScroll.current = offset;
      speedMaterial.current.opacity = 0;
      if (group.current) {
        group.current.visible = false;
      }
      return;
    }

    if (group.current) {
      group.current.visible = true;
    }

    if (!armed.current) {
      armed.current = true;
      lastScroll.current = offset;
      speedMaterial.current.opacity = 0;
      return;
    }

    if (Math.abs(offset - lastScroll.current) > SCROLL_THRESHOLD) {
      speedMaterial.current.opacity = MAX_OPACITY;
    }
    lastScroll.current = offset;
    if (speedMaterial.current.opacity > 0) {
      speedMaterial.current.opacity -= delta * 0.2;
    }
  });

  return (
    <group ref={group} visible={false}>
      <Instances>
        <planeGeometry args={[1, 0.004]} />
        <meshBasicMaterial
          ref={speedMaterial}
          side={DoubleSide}
          blending={AdditiveBlending}
          opacity={0}
          transparent
        />
        {Array(INSTANCES)
          .fill()
          .map((_, key) => (
            <SpeedShape key={key} />
          ))}
      </Instances>
    </group>
  );
};
