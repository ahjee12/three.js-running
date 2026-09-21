import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { fadeOnBeforeCompileFlat } from "../utils/fadeMaterial";

const hasKorean = (text) =>
  /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(text ?? "");

// 셰이더가 거리에 따라 텍스트를 흐리게 해도 레이캐스트는 남으므로,
// 글자가 읽히는 거리보다 먼 클릭은 무시함.
const MAX_LINK_DISTANCE = 120;

export const TextSection = ({ title, subtitle, link, sceneOpacity, ...props }) => {
  const [hovered, setHovered] = useState(false);
  const titleMat = useRef();
  const subtitleMat = useRef();

  useFrame(() => {
    const opacity = sceneOpacity?.current ?? 0;
    if (titleMat.current) {
      titleMat.current.opacity = opacity;
    }
    if (subtitleMat.current) {
      subtitleMat.current.opacity = opacity;
    }
  });

  const titleFont = hasKorean(title)
    ? "./fonts/renaissance-Korean.ttf"
    : "./fonts/DMSerifDisplay-Regular.ttf";
  const subtitleFont = hasKorean(subtitle)
    ? "./fonts/renaissance-Korean.ttf"
    : "./fonts/Inter-Regular.ttf";

  useEffect(() => {
    if (!hovered) {
      return;
    }
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  const linkProps = link
    ? {
        onClick: (event) => {
          if (event.distance > MAX_LINK_DISTANCE) {
            return;
          }
          event.stopPropagation();
          window.open(link, "_blank", "noopener,noreferrer");
        },
        onPointerOver: (event) => setHovered(event.distance <= MAX_LINK_DISTANCE),
        onPointerOut: () => setHovered(false),
      }
    : {};

  return (
    <group {...props}>
      {!!title && (
        <Text
          color="white"
          anchorX={"left"}
          anchorY="bottom"
          fontSize={0.52}
          maxWidth={2.5}
          lineHeight={1}
          font={titleFont}
          {...linkProps}
        >
          {title}
          <meshStandardMaterial
            ref={titleMat}
            color={"white"}
            transparent
            opacity={0}
            onBeforeCompile={fadeOnBeforeCompileFlat}
          />
        </Text>
      )}

      <Text
        color="white"
        anchorX={"left"}
        anchorY="top"
        fontSize={0.2}
        maxWidth={2.5}
        font={subtitleFont}
      >
        {subtitle}
        <meshStandardMaterial
          ref={subtitleMat}
          color={"white"}
          transparent
          opacity={0}
          onBeforeCompile={fadeOnBeforeCompileFlat}
        />
      </Text>
    </group>
  );
};
