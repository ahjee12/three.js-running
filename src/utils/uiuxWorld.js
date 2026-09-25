// 인트로 툴팁과 장면 속 텍스트가 항상 같은 영상을 설명하고 가리키도록 공유함.
export const UIUX_WORLD_URL =
  "https://ahjee12.github.io/port99/portfolio2/index.html";

export const UIUX_WORLD_INFO = {
  tools: "작업 툴: vscode, infinite designer, scss, javascript, jquery",
  // story: "내용: cluely 회사 빌런 링롱이 인터뷰 보는 모습을 가정한 2차 창작물",
  // referenceLabel: "래퍼런스:",
  // referenceUrl: "https://www.instagram.com/cluely/",
  // referenceNote: "(간혹 외국 감성의 과격한 표현과 행위들이 나옴 주의)",
};

// 장면 속 텍스트는 일반 문자열 하나만 그리므로 참고 링크를 넣을 수 없음.
export const UIUX_WORLD_DESCRIPTION = [
  UIUX_WORLD_INFO.tools,
  // UIUX_WORLD_INFO.story,
  // `${UIUX_WORLD_INFO.referenceLabel} ${UIUX_WORLD_INFO.referenceUrl}`,
  // UIUX_WORLD_INFO.referenceNote,
].join("\n");
