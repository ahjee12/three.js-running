import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const RIPPLE_HALF_WIDTH = 0.7;
const RIPPLE_LIFT = 0.12;
const RIPPLE_STEPS = 1000;

const rippleVertexPrefix = /* glsl */ `
attribute float aCross;
attribute float aAlong;
attribute float aPathT;
varying float vCross;
varying float vAlong;
varying float vPathT;
`;

const rippleFragmentPrefix = /* glsl */ `
varying float vCross;
varying float vAlong;
varying float vPathT;
uniform float uTime;
uniform float uCurrentT;
uniform float uFadeAheadNear;
uniform float uFadeAheadFar;

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
`;

const rippleDiffuse = /* glsl */ `
float ahead = vPathT - uCurrentT;
float fadeOpacity = ahead < 0.0
  ? 1.0
  : (1.0 - smoothstep(uFadeAheadNear, uFadeAheadFar, ahead));
vec4 diffuseColor = vec4(diffuse, fadeOpacity * opacity);
`;

const rippleOutput = /* glsl */ `
#include <output_fragment>
vec2 p = vec2(vCross, vAlong) * 1.85;
float t = uTime;
float s = sin(t * 1.05);
float c = cos(t * 0.72);
float w1 = cnoise(p * 0.7 + vec2(s, c));
float w2 = cnoise(p * 0.7 + vec2(-c, s) + vec2(4.2, 1.7));
float meander = cnoise(vec2(vCross * 1.6, vAlong * 0.22 - t * 0.35));
vec2 q = p + vec2(w1, w2) * 0.75 + vec2(meander * 0.55, -t * 1.35);
float n = cnoise(q);
float m = cnoise(q * 1.45 + vec2(-w1, w2) * 0.4 + vec2(c * 0.5, s * 0.35));
float lavender = smoothstep(0.02, 0.38, n);
float white = smoothstep(0.28, 0.55, n) * smoothstep(0.05, 0.4, m);
float speck = smoothstep(0.45, 0.7, m) * (1.0 - white);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.894, 0.835, 0.902), clamp(lavender, 0.0, 1.0));
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), clamp(white, 0.0, 1.0));
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), clamp(speck * 0.85, 0.0, 1.0));
`;

const createRippleGeometry = (curve) => {
  const steps = RIPPLE_STEPS;
  const frames = curve.computeFrenetFrames(steps, false);
  const points = curve.getSpacedPoints(steps);
  const count = (steps + 1) * 2;
  const positions = new Float32Array(count * 3);
  const cross = new Float32Array(count);
  const along = new Float32Array(count);
  const pathT = new Float32Array(count);
  const indices = new Uint32Array(steps * 6);

  const samples = 256;
  const rawPoints = [];
  for (let s = 0; s < samples; s++) {
    rawPoints.push(curve.getPoint(s / (samples - 1)));
  }

  const left = new THREE.Vector3();
  const right = new THREE.Vector3();
  let distance = 0;

  for (let i = 0; i <= steps; i++) {
    const point = points[i];
    if (i > 0) {
      distance += point.distanceTo(points[i - 1]);
    }

    const binormal = frames.binormals[i];
    left.copy(point).addScaledVector(binormal, -RIPPLE_HALF_WIDTH);
    right.copy(point).addScaledVector(binormal, RIPPLE_HALF_WIDTH);
    left.y += RIPPLE_LIFT;
    right.y += RIPPLE_LIFT;

    let best = 0;
    let bestDistance = Infinity;
    for (let s = 0; s < samples; s++) {
      const d = point.distanceToSquared(rawPoints[s]);
      if (d < bestDistance) {
        bestDistance = d;
        best = s;
      }
    }
    const t = best / (samples - 1);
    const vertex = i * 2;

    positions.set([left.x, left.y, left.z, right.x, right.y, right.z], vertex * 3);
    cross[vertex] = -RIPPLE_HALF_WIDTH;
    cross[vertex + 1] = RIPPLE_HALF_WIDTH;
    along[vertex] = distance;
    along[vertex + 1] = distance;
    pathT[vertex] = t;
    pathT[vertex + 1] = t;

    if (i < steps) {
      const a = vertex;
      const b = vertex + 1;
      const c = vertex + 2;
      const d = vertex + 3;
      indices.set([a, c, b, b, c, d], i * 6);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aCross", new THREE.BufferAttribute(cross, 1));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setAttribute("aPathT", new THREE.BufferAttribute(pathT, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};

export const Ripple = ({ curve, fadeUniforms, pathMaterialRef }) => {
  const materialRef = useRef();
  const timeUniform = useMemo(() => ({ value: 0 }), []);
  const geometry = useMemo(() => createRippleGeometry(curve), [curve]);

  const onBeforeCompile = useMemo(() => {
    return (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.uniforms.uCurrentT = fadeUniforms.uCurrentT;
      shader.uniforms.uFadeAheadNear = fadeUniforms.uFadeAheadNear;
      shader.uniforms.uFadeAheadFar = fadeUniforms.uFadeAheadFar;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${rippleVertexPrefix}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vCross = aCross;
vAlong = aAlong;
vPathT = aPathT;`
        );
      const fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${rippleFragmentPrefix}`)
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );", rippleDiffuse)
        .replace("#include <output_fragment>", rippleOutput);
      shader.fragmentShader = fragmentShader;
    };
  }, [fadeUniforms, timeUniform]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame((_, delta) => {
    timeUniform.value += delta;
    const material = materialRef.current;
    const pathMaterial = pathMaterialRef.current;
    if (!material || !pathMaterial) {
      return;
    }
    material.color.copy(pathMaterial.color);
    material.emissive.copy(pathMaterial.emissive);
    material.emissiveIntensity = pathMaterial.emissiveIntensity;
    material.opacity = pathMaterial.opacity;
  });

  return (
    <mesh geometry={geometry} renderOrder={-1}>
      <meshStandardMaterial
        ref={materialRef}
        color={"white"}
        transparent
        depthWrite
        envMapIntensity={0}
        toneMapped={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        customProgramCacheKey={() => "ripple-path-match-3"}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
};
