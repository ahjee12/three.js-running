import { BufferAttribute, Vector3 } from "three";

const replaceFragmentShader = (fragmentShader, fadeNear = 80, fadeDist = 350) =>
  fragmentShader.replace(
    `vec4 diffuseColor = vec4( diffuse, opacity );`,
    `
float fadeNear = ${fadeNear.toFixed(1)};
float fadeDist = ${fadeDist.toFixed(1)};
float dist = length(vViewPosition);

float fadeOpacity = 1.0 - smoothstep(fadeNear, fadeDist, dist);
vec4 diffuseColor = vec4( diffuse, fadeOpacity * opacity );`
  );

export const fadeOnBeforeCompile = (shader) => {
  shader.fragmentShader = replaceFragmentShader(shader.fragmentShader);
};

export const fadeOnBeforeCompileFlat = (shader) => {
  shader.fragmentShader = replaceFragmentShader(shader.fragmentShader).replace(
    `#include <output_fragment>`,
    `gl_FragColor = diffuseColor;`
  );
};

export const addPathTAttribute = (geometry, curve, samples = 256) => {
  const pos = geometry.attributes.position;
  const pathT = new Float32Array(pos.count);
  const pts = [];
  for (let i = 0; i < samples; i++) {
    pts.push(curve.getPoint(i / (samples - 1)));
  }
  const vertex = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    vertex.fromBufferAttribute(pos, i);
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < samples; s++) {
      const d = vertex.distanceToSquared(pts[s]);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    pathT[i] = best / (samples - 1);
  }
  geometry.setAttribute("pathT", new BufferAttribute(pathT, 1));
  return geometry;
};

export const createPathAlongFade = (uniforms) => (shader) => {
  shader.uniforms.uCurrentT = uniforms.uCurrentT;
  shader.uniforms.uFadeAheadNear = uniforms.uFadeAheadNear;
  shader.uniforms.uFadeAheadFar = uniforms.uFadeAheadFar;
  shader.vertexShader = shader.vertexShader.replace(
    `#include <common>`,
    `#include <common>
attribute float pathT;
varying float vPathT;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    `#include <begin_vertex>`,
    `#include <begin_vertex>
vPathT = pathT;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <common>`,
    `#include <common>
varying float vPathT;
uniform float uCurrentT;
uniform float uFadeAheadNear;
uniform float uFadeAheadFar;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    `vec4 diffuseColor = vec4( diffuse, opacity );`,
    `
float ahead = vPathT - uCurrentT;
float fadeOpacity = ahead < 0.0
  ? 1.0
  : (1.0 - smoothstep(uFadeAheadNear, uFadeAheadFar, ahead));
vec4 diffuseColor = vec4( diffuse, fadeOpacity * opacity );`
  );
};
