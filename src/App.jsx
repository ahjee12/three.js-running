import { ScrollControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { Experience } from "./components/Experience";
import { Overlay } from "./components/Overlay";
import { usePlay } from "./contexts/Play";

const SCROLL_PAGES = 20;
const SCROLL_DAMPING = 0.5;

const deviceKind = () => {
  const ua = navigator.userAgent;
  if (
    /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in document)
  ) {
    return "tablet";
  }
  if (
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      ua
    )
  ) {
    return "mobile";
  }
  return "desktop";
};

const canvasDpr = () =>
  deviceKind() === "desktop"
    ? 1
    : Math.min(window.devicePixelRatio || 1, 2);

function App() {
  const { resetId } = usePlay();
  const [sceneReady, setSceneReady] = useState(false);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    const sync = () => setDpr(canvasDpr());
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return (
    <>
      <Canvas dpr={dpr} onCreated={() => setSceneReady(true)}>
        <color attach="background" args={["#ececec"]} />
        <ScrollControls
          key={resetId}
          pages={SCROLL_PAGES}
          damping={SCROLL_DAMPING}
          style={{
            top: "10px",
            left: "0px",
            bottom: "10px",
            right: "10px",
            width: "auto",
            height: "auto",
            animation: "fadeIn 2.4s ease-in-out 1.2s forwards",
            opacity: 0,
          }}
        >
          <Experience />
        </ScrollControls>
      </Canvas>
      <Overlay sceneReady={sceneReady} />
    </>
  );
}

export default App;
