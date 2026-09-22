import { PerspectiveCamera, useScroll } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Euler, Vector3 } from "three";
import { usePlay } from "../contexts/Play";
import { addPathTAttribute, createPathAlongFade } from "../utils/fadeMaterial";
import { AI_VIDEO_1_DESCRIPTION, AI_VIDEO_1_URL } from "../utils/aiVideo";
import { Avatar, AVATAR_LAYER } from "./Avatar";
import { Background } from "./Background";
import { Cloud } from "./Cloud";
import { Speed } from "./Speed";
import { TextSection } from "./TextSection";

const LINE_NB_POINTS = 1000;
const CURVE_DISTANCE = 250;
const CLOUD2_X_OFFSETS = [-20, 20, 30, -40, -35, 35, -25, -17];
const CLOUD2_ROTATIONS = [
  new Euler(-Math.PI / 5, 0, 0),
  new Euler(Math.PI / 7, 0, 0),
  new Euler(Math.PI / 5, 0, 0),
  new Euler(Math.PI / 4, 0, 0),
  new Euler(Math.PI / 3, 0, 0),
  new Euler(-Math.PI / 6, 0, 0),
  new Euler(-Math.PI / 4, 0, 0),
  new Euler(Math.PI / 6, 0, 0),
];
const CLOUD1_X_SPREAD = 10;
const CLOUD2_SCALE = 4;
const CURVE_AHEAD_CAMERA = 0.008;
const CURVE_AHEAD_AIRPLANE = 0.02;
const AIRPLANE_MAX_ANGLE = 8;
const BANK_ANGLE_SCALE = 0.8;
const FRICTION_DISTANCE = 42;
// 텍스트 근처 감속의 하한값임. 너무 낮으면 비행기가 스크롤 위치보다
// 몇 초 뒤처졌다가, 휠을 놓은 뒤 텍스트를 지나쳐 버림.
const MIN_FRICTION = 0.6;
const SCROLL_FOLLOW_LAMBDA = 2.5;
const CAMERA_FOV_LANDSCAPE = 30;
const CAMERA_FOV_PORTRAIT = 80;
const CAMERA_Z_LANDSCAPE = 5;
const CAMERA_Z_PORTRAIT = 2;
const AVATAR_REST_Y = -1.45;
const AVATAR_INTRO_Y = -2;
const AVATAR_FAR_Z = -1.6;
const AVATAR_RECEDE_LAMBDA = 1.8;

const cameraZForSize = (width, height) =>
  width > height ? CAMERA_Z_LANDSCAPE : CAMERA_Z_PORTRAIT;
const SCENE_FADE_RANGE = 0.08;
const SCENE_FADE_LAMBDA = 2.2;
const SCENE_FADE_IN_SECONDS = 3;
const PATH_START_OPACITY = 0.4;
const PATH_END_OPACITY = 0.8;
const PATH_SKY_STRENGTH = 0.3;
const PATH_FADE_AHEAD_NEAR = 0.1;
const PATH_FADE_AHEAD_FAR = 0.4;

const applyPathSkyColor = (mat, colorA, colorB, skyA, skyB, tint, white) => {
  skyA.set(colorA);
  skyB.set(colorB);
  tint.copy(skyA).lerp(skyB, 0.55);
  mat.color.copy(white).lerp(tint, PATH_SKY_STRENGTH);
  mat.emissive.copy(tint);
  mat.emissiveIntensity = PATH_SKY_STRENGTH;
};

const readPlayScroll = (scroll, play) => {
  if (!play || !scroll) {
    return 0;
  }
  const offset = scroll.offset;
  if (!Number.isFinite(offset)) {
    return 0;
  }
  return THREE.MathUtils.clamp(offset, 0, 1);
};

const getBankAngle = (path, t) => {
  if (t <= 0) {
    return 0;
  }

  const curPoint = path.getPoint(t);
  const lookAtPoint = path.getPoint(Math.min(t + CURVE_AHEAD_CAMERA, 1));
  const tangent = path.getTangent(Math.min(t + CURVE_AHEAD_AIRPLANE, 1));
  const targetLookAt = new THREE.Vector3()
    .subVectors(curPoint, lookAtPoint)
    .normalize();

  const dummy = new THREE.Object3D();
  dummy.position.copy(curPoint);
  dummy.lookAt(curPoint.clone().add(targetLookAt));
  tangent.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dummy.rotation.y);

  let angle = Math.atan2(-tangent.z, tangent.x);
  angle = -Math.PI / 2 + angle;

  let angleDegrees = ((angle * 180) / Math.PI) * BANK_ANGLE_SCALE;
  angleDegrees = THREE.MathUtils.clamp(
    angleDegrees,
    -AIRPLANE_MAX_ANGLE,
    AIRPLANE_MAX_ANGLE
  );

  return (angleDegrees * Math.PI) / 180;
};

class BankedCatmullRomCurve3 extends THREE.CatmullRomCurve3 {
  computeFrenetFrames(segments, closed) {
    const frames = super.computeFrenetFrames(segments, closed);
    const q = new THREE.Quaternion();

    for (let i = 0; i <= segments; i++) {
      const bank = getBankAngle(this, i / segments);
      if (bank === 0) {
        continue;
      }
      // 아바타와 같이 커브 안쪽으로 기울임
      q.setFromAxisAngle(frames.tangents[i], -bank);
      frames.normals[i].applyQuaternion(q);
      frames.binormals[i].applyQuaternion(q);
    }

    return frames;
  }
}

export const Experience = () => {
  const curvePoints = useMemo(
    () => [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -CURVE_DISTANCE),
      new THREE.Vector3(100, 0, -2 * CURVE_DISTANCE),
      new THREE.Vector3(-100, 0, -3 * CURVE_DISTANCE),
      new THREE.Vector3(100, 0, -4 * CURVE_DISTANCE),
      new THREE.Vector3(0, 0, -5 * CURVE_DISTANCE),
      new THREE.Vector3(0, 0, -6 * CURVE_DISTANCE),
      new THREE.Vector3(0, 0, -7 * CURVE_DISTANCE),
    ],
    []
  );

  const sceneOpacity = useRef(0);
  const lineMaterialRef = useRef();
  const pathOpacity = useRef(0);
  const pathSkyA = useRef(new THREE.Color());
  const pathSkyB = useRef(new THREE.Color());
  const pathTint = useRef(new THREE.Color());
  const pathWhite = useRef(new THREE.Color("#ffffff"));
  const backgroundColors = useRef({
    colorA: "#3535cc",
    colorB: "#ABD6FF",
  });

  const curve = useMemo(() => {
    return new BankedCatmullRomCurve3(curvePoints, false, "catmullrom", 0.5);
  }, []);

  const pathFadeUniforms = useMemo(
    () => ({
      uCurrentT: { value: 0 },
      uFadeAheadNear: { value: PATH_FADE_AHEAD_NEAR },
      uFadeAheadFar: { value: PATH_FADE_AHEAD_FAR },
    }),
    []
  );

  const fadeOnBeforeCompilePath = useMemo(
    () => createPathAlongFade(pathFadeUniforms),
    [pathFadeUniforms]
  );

  const textSections = useMemo(() => {
    return [
      {
        cameraRailDist: -1,
        position: new Vector3(
          curvePoints[1].x - 3,
          curvePoints[1].y,
          curvePoints[1].z
        ),
        title: "AI 영상 1 보러가기",
        link: AI_VIDEO_1_URL,
        subtitle: AI_VIDEO_1_DESCRIPTION,
      },
      {
        cameraRailDist: 1.5,
        position: new Vector3(
          curvePoints[2].x + 2,
          curvePoints[2].y,
          curvePoints[2].z
        ),
        title: "Beginning",
        subtitle: `시간은 빛나는 뭉게 구름이다`,
      },
      {
        cameraRailDist: -1,
        position: new Vector3(
          curvePoints[3].x - 3,
          curvePoints[3].y,
          curvePoints[3].z
        ),
        title: "Middle",
        subtitle: `시간이 지나면 모든 것이 희미해지고 가치만 남는다`,
      },
      {
        cameraRailDist: 1.5,
        position: new Vector3(
          curvePoints[4].x + 3.5,
          curvePoints[4].y,
          curvePoints[4].z - 12
        ),
        title: "Last",
        subtitle: `보이는 것은 영원하지 않다`,
      },
    ];
  }, []);

  const clouds = useMemo(
    () => [
      // 시작
      {
        scale: new Vector3(0.7, 0.7, 0.7),
        position: new Vector3(-3.5, -3.2, -7),
      },
      {
        scale: new Vector3(0.7, 0.7, 0.7),
        position: new Vector3(3.5, -4, -10),
      },
      {
        scale: new Vector3(4, 4, 4),
        position: new Vector3(-18, -20, -68),
        rotation: new Euler(-Math.PI / 5, Math.PI / 6, 0),
      },
      {
        scale: new Vector3(2.5, 2.5, 2.5),
        position: new Vector3(10, -20, -52),
      },
      // 첫 번째 지점
      {
        scale: new Vector3(4, 4, 4),
        position: new Vector3(
          curvePoints[1].x + 10,
          curvePoints[1].y - 4,
          curvePoints[1].z + 64
        ),
      },
      {
        scale: new Vector3(3, 3, 3),
        position: new Vector3(
          curvePoints[1].x - 20,
          curvePoints[1].y + 4,
          curvePoints[1].z + 28
        ),
        rotation: new Euler(0, Math.PI / 7, 0),
      },
      {
        rotation: new Euler(0, Math.PI / 7, Math.PI / 5),
        scale: new Vector3(4, 4, 4),
        position: new Vector3(
          curvePoints[1].x - 13,
          curvePoints[1].y + 4,
          curvePoints[1].z - 62
        ),
      },
      {
        rotation: new Euler(Math.PI / 2, Math.PI / 2, Math.PI / 3),
        scale: new Vector3(4, 4, 4),
        position: new Vector3(
          curvePoints[1].x + 54,
          curvePoints[1].y + 2,
          curvePoints[1].z - 82
        ),
      },
      {
        scale: new Vector3(4, 4, 4),
        position: new Vector3(
          curvePoints[1].x + 8,
          curvePoints[1].y - 14,
          curvePoints[1].z - 22
        ),
      },
      // 두 번째 지점
      {
        scale: new Vector3(3, 3, 3),
        position: new Vector3(
          curvePoints[2].x + 6,
          curvePoints[2].y - 7,
          curvePoints[2].z + 50
        ),
      },
      {
        scale: new Vector3(2, 2, 2),
        position: new Vector3(
          curvePoints[2].x - 2,
          curvePoints[2].y + 4,
          curvePoints[2].z - 26
        ),
      },
      {
        scale: new Vector3(4, 4, 4),
        position: new Vector3(
          curvePoints[2].x + 12,
          curvePoints[2].y + 1,
          curvePoints[2].z - 86
        ),
        rotation: new Euler(Math.PI / 4, 0, Math.PI / 3),
      },
      // 세 번째 지점
      {
        scale: new Vector3(3, 3, 3),
        position: new Vector3(
          curvePoints[3].x + 3,
          curvePoints[3].y - 10,
          curvePoints[3].z + 50
        ),
      },
      {
        scale: new Vector3(3, 3, 3),
        position: new Vector3(
          curvePoints[3].x - 10,
          curvePoints[3].y,
          curvePoints[3].z + 30
        ),
        rotation: new Euler(Math.PI / 4, 0, Math.PI / 5),
      },
      {
        scale: new Vector3(4, 4, 4),
        position: new Vector3(
          curvePoints[3].x - 20,
          curvePoints[3].y - 5,
          curvePoints[3].z - 8
        ),
        rotation: new Euler(Math.PI, 0, Math.PI / 5),
      },
      {
        scale: new Vector3(4, 4, 4),
        position: new Vector3(
          curvePoints[3].x + 0,
          curvePoints[3].y - 5,
          curvePoints[3].z - 98
        ),
        rotation: new Euler(0, Math.PI / 3, 0),
      },
      // 네 번째 지점
      {
        scale: new Vector3(2, 2, 2),
        position: new Vector3(
          curvePoints[4].x + 3,
          curvePoints[4].y - 10,
          curvePoints[4].z + 2
        ),
      },
      {
        scale: new Vector3(3, 3, 3),
        position: new Vector3(
          curvePoints[4].x + 24,
          curvePoints[4].y - 6,
          curvePoints[4].z - 42
        ),
        rotation: new Euler(Math.PI / 4, 0, Math.PI / 5),
      },
      {
        scale: new Vector3(3, 3, 3),
        position: new Vector3(
          curvePoints[4].x - 4,
          curvePoints[4].y + 9,
          curvePoints[4].z - 62
        ),
        rotation: new Euler(Math.PI / 3, 0, Math.PI / 3),
      },
      // 마지막
      {
        scale: new Vector3(3, 3, 3),
        position: new Vector3(
          curvePoints[7].x + 12,
          curvePoints[7].y - 5,
          curvePoints[7].z + 60
        ),
        rotation: new Euler(-Math.PI / 4, -Math.PI / 6, 0),
      },
      {
        scale: new Vector3(3, 3, 3),
        position: new Vector3(
          curvePoints[7].x - 12,
          curvePoints[7].y + 5,
          curvePoints[7].z + 120
        ),
        rotation: new Euler(Math.PI / 4, Math.PI / 6, 0),
      },
      ...curvePoints.map((point, index) => ({
        path: "/models/cloud/cloud2.glb",
        scale: new Vector3(CLOUD2_SCALE, CLOUD2_SCALE, CLOUD2_SCALE),
        position: new Vector3(
          point.x + CLOUD2_X_OFFSETS[index],
          point.y + 8,
          point.z - 120
        ),
        rotation: CLOUD2_ROTATIONS[index],
      })),
    ],
    []
  );

  const shape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.7);
    shape.lineTo(0, 0.7);
    shape.closePath();

    return shape;
  }, [curve]);

  const pathGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      steps: LINE_NB_POINTS,
      bevelEnabled: false,
      extrudePath: curve,
    });
    addPathTAttribute(geometry, curve);
    return geometry;
  }, [shape, curve]);

  const cameraGroup = useRef();
  const cameraRail = useRef();
  const camera = useRef();
  const scroll = useScroll();
  const lastScroll = useRef(0);

  const { play, setHasScroll, hasScroll, end, setEnd } = usePlay();
  const { size } = useThree();

  useFrame((_state, delta) => {
    if (!camera.current) {
      return;
    }

    const isLandscape = size.width > size.height;
    const targetFov = isLandscape ? CAMERA_FOV_LANDSCAPE : CAMERA_FOV_PORTRAIT;
    const targetZ = cameraZForSize(size.width, size.height);

    if (camera.current) {
      if (camera.current.fov !== targetFov) {
        camera.current.fov = targetFov;
        camera.current.updateProjectionMatrix();
      }
      camera.current.position.z = targetZ;
      camera.current.layers.enable(AVATAR_LAYER);
    }

    if (!play) {
      if (scroll?.el) {
        scroll.el.scrollTop = 0;
      }
      if (scroll?.scroll) {
        scroll.scroll.current = 0;
      }
      if (scroll) {
        scroll.offset = 0;
        scroll.delta = 0;
      }
      lastScroll.current = 0;
      pathFadeUniforms.uCurrentT.value = 0;
      pathFadeUniforms.uFadeAheadNear.value = PATH_FADE_AHEAD_NEAR;
    }

    const scrollOffset = readPlayScroll(scroll, play);

    if (play && lastScroll.current <= 0 && scrollOffset > 0) {
      setHasScroll(true);
    }

    if (play && !end && sceneOpacity.current < 1) {
      sceneOpacity.current = Math.min(
        1,
        sceneOpacity.current + delta / SCENE_FADE_IN_SECONDS
      );
    }

    if (end && sceneOpacity.current > 0) {
      sceneOpacity.current = THREE.MathUtils.lerp(
        sceneOpacity.current,
        0,
        delta
      );
    }

    const pathOpacityTarget = end
      ? 0
      : play
        ? THREE.MathUtils.lerp(
            PATH_START_OPACITY,
            PATH_END_OPACITY,
            THREE.MathUtils.clamp(scrollOffset, 0, 1)
          ) * sceneOpacity.current
        : 0;
    pathOpacity.current = THREE.MathUtils.damp(
      pathOpacity.current,
      pathOpacityTarget,
      SCENE_FADE_LAMBDA,
      delta
    );

    if (lineMaterialRef.current) {
      applyPathSkyColor(
        lineMaterialRef.current,
        backgroundColors.current.colorA,
        backgroundColors.current.colorB,
        pathSkyA.current,
        pathSkyB.current,
        pathTint.current,
        pathWhite.current
      );
      lineMaterialRef.current.opacity = pathOpacity.current;
    }

    if (end) {
      return;
    }

    if (!play) {
      return;
    }

    const avatarTargetZ = scrollOffset > 0 ? AVATAR_FAR_Z : 0;

    if (airplane.current && (hasScroll || scrollOffset > 0)) {
      airplane.current.position.z = THREE.MathUtils.damp(
        airplane.current.position.z,
        avatarTargetZ,
        AVATAR_RECEDE_LAMBDA,
        delta
      );
    }

    let friction = 1;
    let resetCameraRail = true;
    // 가까운 텍스트 구간을 바라봄
    textSections.forEach((textSection) => {
      const distance = textSection.position.distanceTo(
        cameraGroup.current.position
      );

      if (distance < FRICTION_DISTANCE) {
        friction = Math.max(distance / FRICTION_DISTANCE, MIN_FRICTION);
        const targetCameraRailPosition = new Vector3(
          (1 - distance / FRICTION_DISTANCE) * textSection.cameraRailDist,
          0,
          0
        );
        cameraRail.current.position.lerp(targetCameraRailPosition, delta);
        resetCameraRail = false;
      }
    });
    if (resetCameraRail) {
      const targetCameraRailPosition = new Vector3(0, 0, 0);
      cameraRail.current.position.lerp(targetCameraRailPosition, delta);
    }

    // 보간된 스크롤 오프셋 계산
    let lerpedScrollOffset = THREE.MathUtils.damp(
      lastScroll.current,
      scrollOffset,
      SCROLL_FOLLOW_LAMBDA * friction,
      delta
    );
    // 0 미만·1 초과 값 보정
    lerpedScrollOffset = Math.min(lerpedScrollOffset, 1);
    lerpedScrollOffset = Math.max(lerpedScrollOffset, 0);

    lastScroll.current = lerpedScrollOffset;
    pathFadeUniforms.uCurrentT.value = lerpedScrollOffset;
    pathFadeUniforms.uFadeAheadNear.value = PATH_FADE_AHEAD_NEAR;
    if (tl.current) {
      tl.current.seek(lerpedScrollOffset * tl.current.duration());
    }

    if (lineMaterialRef.current) {
      applyPathSkyColor(
        lineMaterialRef.current,
        backgroundColors.current.colorA,
        backgroundColors.current.colorB,
        pathSkyA.current,
        pathSkyB.current,
        pathTint.current,
        pathWhite.current
      );
    }

    const curPoint = curve.getPoint(lerpedScrollOffset);

    // 커브 포인트를 따라감
    cameraGroup.current.position.lerp(curPoint, Math.min(delta * 24, 1));

    // 그룹이 커브 앞쪽을 바라보게 함

    const lookAtPoint = curve.getPoint(
      Math.min(lerpedScrollOffset + CURVE_AHEAD_CAMERA, 1)
    );

    const currentLookAt = cameraGroup.current.getWorldDirection(
      new THREE.Vector3()
    );
    const targetLookAt = new THREE.Vector3()
      .subVectors(curPoint, lookAtPoint)
      .normalize();

    const lookAt = currentLookAt.lerp(targetLookAt, Math.min(delta * 24, 1));
    cameraGroup.current.lookAt(
      cameraGroup.current.position.clone().add(lookAt)
    );

    // 아바타 회전. 길 생성 시 넣은 뱅크 각도와 같음
    let angle = getBankAngle(curve, lerpedScrollOffset);
    if (scrollOffset <= 0) {
      angle = 0;
    }

    if (airplane.current) {
      const targetAirplaneQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          airplane.current.rotation.x,
          airplane.current.rotation.y,
          angle
        )
      );
      airplane.current.quaternion.slerp(targetAirplaneQuaternion, delta * 2);
    }

    if (
      play &&
      hasScroll &&
      scrollOffset > 0.88 &&
      lastScroll.current > 0.88 &&
      cameraGroup.current.position.z <
        curvePoints[curvePoints.length - 1].z + 100
    ) {
      setEnd(true);
      planeOutTl.current.play();
    }
  });

  const airplane = useRef();

  const tl = useRef();

  const planeInTl = useRef();
  const planeOutTl = useRef();

  useLayoutEffect(() => {
    tl.current = gsap.timeline();

    tl.current.to(backgroundColors.current, {
      duration: 1,
      colorA: "#6f35cc",
      colorB: "#ffad30",
    });
    tl.current.to(backgroundColors.current, {
      duration: 1,
      colorA: "#424242",
      colorB: "#ffcc00",
    });
    tl.current.to(backgroundColors.current, {
      duration: 1,
      colorA: "#81318b",
      colorB: "#55ab8f",
    });

    tl.current.pause();

    planeOutTl.current = gsap.timeline();
    planeOutTl.current.pause();
    planeOutTl.current.to(
      airplane.current.position,
      {
        duration: 10,
        z: -250,
        y: 10,
      },
      0
    );
    planeOutTl.current.to(
      cameraRail.current.position,
      {
        duration: 8,
        y: 12,
      },
      0
    );
    planeOutTl.current.to(airplane.current.position, {
      duration: 1,
      z: -1000,
    });

    return () => {
      tl.current?.kill();
      planeInTl.current?.kill();
      planeOutTl.current?.kill();
    };
  }, []);

  useLayoutEffect(() => {
    lastScroll.current = 0;
    sceneOpacity.current = 0;
    pathOpacity.current = 0;
    setHasScroll(false);
    backgroundColors.current.colorA = "#3535cc";
    backgroundColors.current.colorB = "#ABD6FF";

    if (cameraGroup.current) {
      cameraGroup.current.position.set(0, 0, 0);
    }
    if (cameraRail.current) {
      cameraRail.current.position.set(0, 0, 0);
    }
    if (airplane.current) {
      airplane.current.rotation.set(0, 0, 0);
      airplane.current.quaternion.identity();
      airplane.current.position.set(0, AVATAR_REST_Y, 0);
    }
    if (scroll?.el) {
      scroll.el.scrollTop = 0;
    }
    if (scroll?.scroll) {
      scroll.scroll.current = 0;
    }
    if (scroll) {
      scroll.offset = 0;
      scroll.delta = 0;
    }

    planeOutTl.current?.pause(0);
    tl.current?.pause(0);
    planeInTl.current?.kill();
    planeInTl.current = gsap.timeline({ paused: true });

    if (airplane.current) {
      planeInTl.current.from(airplane.current.position, {
        duration: 3,
        z: cameraZForSize(size.width, size.height),
        y: AVATAR_INTRO_Y,
      });
    }

    if (play) {
      planeInTl.current.play();
    }
  }, [play]);

  return (
      <>
        <directionalLight position={[0, 3, 1]} intensity={0.3} />
        <group ref={cameraGroup}>
          <Speed />
          <Background backgroundColors={backgroundColors} />
          <group ref={cameraRail}>
            <PerspectiveCamera
              ref={camera}
              position={[0, 0, 5]}
              fov={30}
              makeDefault
            />
          </group>
          <group ref={airplane} position-y={AVATAR_REST_Y}>
            <Suspense fallback={null}>
              <Avatar
                rotation-y={Math.PI}
                scale={1}
                position-y={0.1}
              />
            </Suspense>
          </group>
        </group>
        {/* 텍스트 */}
        <Suspense fallback={null}>
          {textSections.map((textSection, index) => (
            <TextSection
              {...textSection}
              sceneOpacity={sceneOpacity}
              key={index}
            />
          ))}
        </Suspense>

        {/* 경로 선 */}
        <group position-y={-2}>
          <mesh geometry={pathGeometry}>
            <meshStandardMaterial
              color={"white"}
              ref={lineMaterialRef}
              transparent
              depthWrite
              envMapIntensity={0}
              toneMapped={false}
              customProgramCacheKey={() => "path-curve-ratio"}
              onBeforeCompile={fadeOnBeforeCompilePath}
            />
          </mesh>
        </group>

        {/* 구름 */}
        <Suspense fallback={null}>
          {clouds.map((cloud, index) => {
            if (cloud.path?.includes("cloud2")) {
              return (
                <Cloud sceneOpacity={sceneOpacity} {...cloud} key={index} />
              );
            }
            const position = cloud.position.clone();
            if (position.x > 0) {
              position.x += CLOUD1_X_SPREAD;
            } else if (position.x < 0) {
              position.x -= CLOUD1_X_SPREAD;
            }
            return (
              <Cloud
                sceneOpacity={sceneOpacity}
                {...cloud}
                position={position}
                key={index}
              />
            );
          })}
        </Suspense>
      </>
  );
};
