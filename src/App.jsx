import { ScrollControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { Experience } from "./components/Experience";
import { Overlay } from "./components/Overlay";
import { usePlay } from "./contexts/Play";

const SCROLL_PAGES = 20;
const SCROLL_DAMPING = 0.5;

function App() {
  const { resetId } = usePlay();
  const [sceneReady, setSceneReady] = useState(false);

  return (
    <>
      <Canvas dpr={[1, 1.1]} onCreated={() => setSceneReady(true)}>
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
