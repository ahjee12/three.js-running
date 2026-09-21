import { Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Gradient, LayerMaterial } from "lamina";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

const applyCssSky = (colorA, colorB) => {
  const root = document.documentElement;
  root.style.setProperty("--sky-top", colorA);
  root.style.setProperty("--sky-bottom", colorB);
};

export const Background = ({ backgroundColors }) => {
  const start = 0.2;
  const end = -0.5;
  const gradientRef = useRef();

  useLayoutEffect(() => {
    applyCssSky(
      backgroundColors.current.colorA,
      backgroundColors.current.colorB
    );
  }, [backgroundColors]);

  useFrame(() => {
    const colorA = backgroundColors.current.colorA;
    const colorB = backgroundColors.current.colorB;
    applyCssSky(colorA, colorB);
    if (!gradientRef.current) {
      return;
    }
    gradientRef.current.colorA = new THREE.Color(colorA);
    gradientRef.current.colorB = new THREE.Color(colorB);
  });

  return (
    <Sphere scale={[500, 500, 500]} rotation-y={Math.PI / 2}>
      <LayerMaterial color={"#ffffff"} side={THREE.BackSide}>
        <Gradient ref={gradientRef} axes={"y"} start={start} end={end} />
      </LayerMaterial>
    </Sphere>
  );
};
