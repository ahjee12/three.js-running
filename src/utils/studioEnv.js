import { PMREMGenerator, WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

let studioEnvTarget = null;
let studioRenderer = null;

export const getStudioEnvMap = () => {
  if (studioEnvTarget) {
    return studioEnvTarget.texture;
  }

  const canvas = document.createElement("canvas");
  studioRenderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
  });
  studioRenderer.setSize(256, 256);

  const pmrem = new PMREMGenerator(studioRenderer);
  studioEnvTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();

  return studioEnvTarget.texture;
};
