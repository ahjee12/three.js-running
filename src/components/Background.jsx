import { shaderMaterial, Sphere } from "@react-three/drei";
import { extend, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

const applyCssSky = (colorA, colorB) => {
  const root = document.documentElement;
  root.style.setProperty("--sky-top", colorA);
  root.style.setProperty("--sky-bottom", colorB);
};

const SkyNoiseMaterial = shaderMaterial(
  {
    uColorA: new THREE.Color("#047CCC"),
    uColorB: new THREE.Color("#FFFFFF"),
    uColorNoise: new THREE.Color("#E8F8FF"),
    uTime: 0,
    uStart: 0.2,
    uEnd: -0.5,
  },
  /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorNoise;
    uniform float uTime;
    uniform float uStart;
    uniform float uEnd;
    varying vec3 vPos;

    vec4 permute(vec4 x) {
      return mod(((x * 34.0) + 1.0) * x, 289.0);
    }

    vec2 fade(vec2 t) {
      return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }

    float cnoise(vec2 P) {
      vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
      vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
      Pi = mod(Pi, 289.0);
      vec4 ix = Pi.xzxz;
      vec4 iy = Pi.yyww;
      vec4 fx = Pf.xzxz;
      vec4 fy = Pf.yyww;
      vec4 i = permute(permute(ix) + iy);
      vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0;
      vec4 gy = abs(gx) - 0.5;
      vec4 tx = floor(gx + 0.5);
      gx = gx - tx;
      vec2 g00 = vec2(gx.x, gy.x);
      vec2 g10 = vec2(gx.y, gy.y);
      vec2 g01 = vec2(gx.z, gy.z);
      vec2 g11 = vec2(gx.w, gy.w);
      vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
      g00 *= norm.x;
      g01 *= norm.y;
      g10 *= norm.z;
      g11 *= norm.w;
      float n00 = dot(g00, vec2(fx.x, fy.x));
      float n10 = dot(g10, vec2(fx.y, fy.y));
      float n01 = dot(g01, vec2(fx.z, fy.z));
      float n11 = dot(g11, vec2(fx.w, fy.w));
      vec2 fade_xy = fade(Pf.xy);
      vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
      float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
      return 2.3 * n_xy;
    }

    void main() {
      float grad = smoothstep(uStart, uEnd, vPos.y);
      vec3 vertical = mix(uColorA, uColorB, grad);

      float speed = 0.05;
      vec2 p = vec2(vPos.z, vPos.y) * 1.25 + vec2(0.0, 1.6);
      float noise = cnoise(p + uTime * speed);
      noise += cnoise(p + vec2(3.7, 1.2) - uTime * speed);
      noise = clamp(noise, 0.0, 1.0);

      float yFactor = 0.5 - vPos.y * 1.5;
      float bottom = smoothstep(0.25, 0.62, yFactor);
      float noiseWeight = clamp(noise * bottom, 0.0, 1.0);
      vec3 color = mix(vertical, uColorNoise, noiseWeight);

      gl_FragColor = vec4(color, 1.0);
    }
  `
);

extend({ SkyNoiseMaterial });

let skyNoiseTime = 0;

export const Background = ({ backgroundColors }) => {
  const materialRef = useRef();

  const setMaterial = (material) => {
    materialRef.current = material;
    if (material) {
      material.uniforms.uTime.value = skyNoiseTime;
    }
  };

  useLayoutEffect(() => {
    applyCssSky(
      backgroundColors.current.colorA,
      backgroundColors.current.colorB
    );
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = skyNoiseTime;
    }
  }, [backgroundColors]);

  useFrame((_, delta) => {
    const colorA = backgroundColors.current.colorA;
    const colorB = backgroundColors.current.colorB;
    const colorNoise = backgroundColors.current.colorNoise;
    applyCssSky(colorA, colorB);
    const mat = materialRef.current;
    if (!mat) {
      return;
    }
    mat.uniforms.uColorA.value.set(colorA);
    mat.uniforms.uColorB.value.set(colorB);
    mat.uniforms.uColorNoise.value.set(colorNoise || "#E8F8FF");
    mat.uniforms.uTime.value += delta;
    skyNoiseTime = mat.uniforms.uTime.value;
  });

  return (
    <Sphere scale={[500, 500, 500]} rotation-y={Math.PI / 2}>
      <skyNoiseMaterial ref={setMaterial} side={THREE.BackSide} />
    </Sphere>
  );
};
