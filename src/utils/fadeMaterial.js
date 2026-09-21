const replaceFragmentShader = (fragmentShader) =>
  fragmentShader.replace(
    `vec4 diffuseColor = vec4( diffuse, opacity );`,
    `
float fadeNear = 80.0;
float fadeDist = 350.0;
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
