import { ScrollControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Experience } from "./components/Experience";
import { Overlay } from "./components/Overlay";
import { usePlay } from "./contexts/Play";

const SCROLL_PAGES = 20;
const SCROLL_DAMPING = 0.5;
const SCROLLBAR_WIDTH = 2;
const SCROLLBAR_WIDTH_NEAR = 6;
const THUMB_NEAR_PAD = 3;
const SCROLLBAR_GROW_MS = 240;

const findScroller = (stage) =>
  [...stage.querySelectorAll("div")].find((node) => {
    const overflow = getComputedStyle(node).overflowY;
    return overflow === "auto" || overflow === "scroll";
  });

function App() {
  const { resetId, play, end } = usePlay();
  const [sceneReady, setSceneReady] = useState(false);
  const stageRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const scroller = findScroller(stage);
    if (!scroller) {
      return;
    }
    const visible = play && !end;
    scroller.style.opacity = visible ? "1" : "0";
    scroller.style.pointerEvents = visible ? "auto" : "none";
    scroller.style.scrollbarWidth = visible ? "auto" : "none";
    scroller.style.setProperty(
      "--scrollbar-size",
      visible ? `${SCROLLBAR_WIDTH}px` : "0px"
    );
  }, [play, end, resetId, sceneReady]);

  const scrollCursorRef = useRef(null);
  const scrollGripRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    const cursor = scrollCursorRef.current;
    const grip = scrollGripRef.current;
    if (!stage || !cursor || !grip) {
      return;
    }

    const hide = () => {
      cursor.classList.remove("scroll-cursor--on");
    };

    const place = (event) => {
      cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      cursor.classList.add("scroll-cursor--on");
    };

    let barSize = end || !play ? 0 : SCROLLBAR_WIDTH;
    let barTarget = barSize;
    let barFrame = 0;

    const thumbBox = (scroller) => {
      const rect = scroller.getBoundingClientRect();
      const barWidth = Math.max(barSize, 0);
      const scrollRange = Math.max(scroller.scrollHeight - scroller.clientHeight, 0);
      const track = rect.height;
      const ratio =
        scroller.scrollHeight > 0 ? scroller.clientHeight / scroller.scrollHeight : 1;
      const thumbHeight = Math.min(track, Math.max(ratio * track, 1));
      const travel = Math.max(track - thumbHeight, 0);
      const thumbTop =
        rect.top + (scrollRange > 0 ? (scroller.scrollTop / scrollRange) * travel : 0);
      return { rect, barWidth, scrollRange, thumbHeight, travel, thumbTop };
    };

    const placeGrip = () => {
      const scroller = findScroller(stage);
      if (!play || end || !scroller) {
        grip.style.display = "none";
        return null;
      }
      const box = thumbBox(scroller);
      if (box.barWidth <= 0) {
        grip.style.display = "none";
        return null;
      }
      grip.style.display = "block";
      grip.style.left = `${box.rect.right - box.barWidth}px`;
      grip.style.top = `${box.thumbTop}px`;
      grip.style.width = `${box.barWidth}px`;
      grip.style.height = `${box.thumbHeight}px`;
      return scroller;
    };

    const thumbHit = (event, scroller) => {
      const box = thumbBox(scroller);
      if (box.barWidth <= 0) {
        return false;
      }
      return (
        event.clientX >= box.rect.right - box.barWidth &&
        event.clientX <= box.rect.right &&
        event.clientY >= box.thumbTop &&
        event.clientY <= box.thumbTop + box.thumbHeight
      );
    };

    const nearThumb = (event, scroller) => {
      const box = thumbBox(scroller);
      if (box.barWidth <= 0) {
        return false;
      }
      return (
        event.clientX >= box.rect.right - box.barWidth - THUMB_NEAR_PAD &&
        event.clientX <= box.rect.right + THUMB_NEAR_PAD &&
        event.clientY >= box.thumbTop - THUMB_NEAR_PAD &&
        event.clientY <= box.thumbTop + box.thumbHeight + THUMB_NEAR_PAD
      );
    };

    const applyBarSize = (scroller, wide) => {
      const target = end || !play ? 0 : wide ? SCROLLBAR_WIDTH_NEAR : SCROLLBAR_WIDTH;
      if (target === barTarget) {
        return;
      }
      barTarget = target;
      if (barFrame) {
        cancelAnimationFrame(barFrame);
      }
      const from = barSize;
      const started = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - started) / SCROLLBAR_GROW_MS);
        const eased = t * t * (3 - 2 * t);
        barSize = from + (target - from) * eased;
        scroller.style.setProperty("--scrollbar-size", `${barSize}px`);
        placeGrip();
        if (t < 1) {
          barFrame = requestAnimationFrame(tick);
          return;
        }
        barSize = target;
        barFrame = 0;
        scroller.style.setProperty("--scrollbar-size", `${barSize}px`);
        placeGrip();
      };
      barFrame = requestAnimationFrame(tick);
    };

    let holding = false;
    let drag = null;

    const onDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      const scroller = findScroller(stage);
      if (!play || end || !scroller || !thumbHit(event, scroller)) {
        return;
      }
      event.preventDefault();
      const box = thumbBox(scroller);
      holding = true;
      drag = {
        y: event.clientY,
        scroll: scroller.scrollTop,
        range: box.scrollRange,
        travel: Math.max(box.travel, 1),
      };
      try {
        grip.setPointerCapture(event.pointerId);
      } catch {
        // 합성 이벤트나 이미 잡힌 포인터는 캡처를 거절한다.
      }
      place(event);
    };

    const onMove = (event) => {
      const scroller = findScroller(stage);
      if (!play || end || !scroller) {
        holding = false;
        drag = null;
        hide();
        if (scroller) {
          applyBarSize(scroller, false);
          placeGrip();
        }
        return;
      }
      applyBarSize(scroller, holding || nearThumb(event, scroller));
      placeGrip();
      if (holding) {
        event.preventDefault();
        place(event);
        if (drag) {
          scroller.scrollTop =
            drag.scroll + ((event.clientY - drag.y) / drag.travel) * drag.range;
          placeGrip();
        }
        return;
      }
      if (thumbHit(event, scroller)) {
        place(event);
        return;
      }
      hide();
    };

    const onUp = (event) => {
      if (!holding) {
        return;
      }
      holding = false;
      drag = null;
      const scroller = findScroller(stage);
      if (!play || !scroller || !thumbHit(event, scroller)) {
        hide();
      }
    };

    const release = () => {
      holding = false;
      drag = null;
      hide();
    };

    const onLeave = () => {
      if (holding) {
        return;
      }
      hide();
    };

    const onDragStart = (event) => {
      event.preventDefault();
    };

    const scroller = placeGrip();
    const onScrollerScroll = () => {
      if (!holding) {
        placeGrip();
      }
    };
    scroller?.addEventListener("scroll", onScrollerScroll, { passive: true });
    grip.addEventListener("dragstart", onDragStart);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", release);
    window.addEventListener("resize", placeGrip);
    return () => {
      scroller?.removeEventListener("scroll", onScrollerScroll);
      grip.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", release);
      window.removeEventListener("resize", placeGrip);
      if (barFrame) {
        cancelAnimationFrame(barFrame);
      }
      release();
    };
  }, [play, end, resetId, sceneReady]);

  return (
    <>
      <div ref={stageRef} className="stage">
        <Canvas onCreated={() => setSceneReady(true)}>
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
              opacity: 0,
              transition: "opacity 1.4s ease",
              pointerEvents: "none",
            }}
          >
            <Experience />
          </ScrollControls>
        </Canvas>
      </div>
      <Overlay sceneReady={sceneReady} />
      <div ref={scrollGripRef} className="scroll-grip" draggable={false} />
      <div ref={scrollCursorRef} className="scroll-cursor" />
    </>
  );
}

export default App;
