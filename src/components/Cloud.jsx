import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { fadeOnBeforeCompile } from "../utils/fadeMaterial";

const CLOUD_1 = "/models/cloud/cloud1.glb";
const CLOUD_2 = "/models/cloud/cloud2.glb";

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

export function Cloud({
  sceneOpacity,
  path = CLOUD_1,
  ...props
}) {
  const { nodes } = useGLTF(path);
  const materialRef = useRef();

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = sceneOpacity.current;
    }
  });

  return (
    <mesh geometry={cloudGeometry(nodes, path)} {...props}>
      <meshStandardMaterial
        ref={materialRef}
        envMapIntensity={0}
        transparent
        opacity={0}
        onBeforeCompile={fadeOnBeforeCompile}
      />
    </mesh>
  );
}

useGLTF.preload(CLOUD_1);
useGLTF.preload(CLOUD_2);
