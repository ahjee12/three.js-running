import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { Color } from "three";
import { fadeOnBeforeCompile } from "../utils/fadeMaterial";

const CLOUD_1 = "/models/cloud/cloud1.glb";
const CLOUD_2 = "/models/cloud/cloud2.glb";
const CLOUD_SKY_TINT = 0.18;
const cloudWhite = new Color("#ffffff");

const cloudGeometry = (nodes, path = "") => {
  if (path.includes("cloud2")) {
    return nodes.cloud2?.geometry;
  }
  if (path.includes("cloud1")) {
    return nodes.cloud1?.geometry;
  }
  return (
    nodes.cloud1?.geometry ||
    nodes.Mball001?.geometry ||
    Object.values(nodes).find((node) => node.isMesh)?.geometry
  );
};

const bindCloudMaterial = (mat) => {
  if (!mat) {
    return;
  }
  mat.envMapIntensity = 0;
  mat.metalness = 0;
  mat.roughness = 1;
  mat.depthWrite = true;
};

export function Cloud({
  sceneOpacity,
  backgroundColors,
  path = CLOUD_1,
  ...props
}) {
  const { nodes } = useGLTF(path);
  const materialRef = useRef();
  const skyA = useRef(new Color());
  const skyB = useRef(new Color());

  useLayoutEffect(() => {
    bindCloudMaterial(materialRef.current);
  }, []);

  useFrame(() => {
    const mat = materialRef.current;
    if (!mat) {
      return;
    }
    bindCloudMaterial(mat);
    mat.transparent = true;
    mat.opacity = sceneOpacity.current;
    const colors = backgroundColors?.current;
    if (!colors) {
      return;
    }
    skyA.current.set(colors.colorA);
    skyB.current.set(colors.colorB);
    skyA.current.lerp(skyB.current, 0.65);
    mat.color.copy(cloudWhite).lerp(skyA.current, CLOUD_SKY_TINT);
  });

  return (
    <mesh geometry={cloudGeometry(nodes, path)} {...props}>
      <meshStandardMaterial
        ref={materialRef}
        color="#ffffff"
        metalness={0}
        roughness={1}
        envMapIntensity={0}
        transparent
        opacity={0}
        customProgramCacheKey={() => "cloud-view-fade-80"}
        onBeforeCompile={fadeOnBeforeCompile}
      />
    </mesh>
  );
}

useGLTF.preload(CLOUD_1);
useGLTF.preload(CLOUD_2);
