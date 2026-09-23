import { usePlay } from "../contexts/Play";
import { AI_VIDEO_1_INFO, AI_VIDEO_1_URL } from "../utils/aiVideo";

export const Overlay = ({ sceneReady = false }) => {
  const { play, end, setPlay, hasScroll, resetId, resetToIntro } = usePlay();

  return (
    <div
      className={`overlay ${play && !end ? "overlay--disable" : ""}
    ${hasScroll ? "overlay--scrolled" : ""}`}
    >
      <div
        className={`loader ${sceneReady ? "loader--disappear" : ""}`}
      />
      <div
        key={resetId}
        className={`intro ${sceneReady ? "intro--enter" : "intro--pending"} ${
          play ? "intro--disappear" : ""
        } ${resetId > 0 && !play ? "intro--ready" : ""}`}
      >
          <h1 className="logo">Avatar Journey</h1>
          <p className="intro__scroll">스크롤을 해서 여정을 떠나요</p>
          <div className="intro__actions">
            <div className="intro__action intro__action--hidden">
              <button
                className="intro__button"
                onClick={() => {
                  window.open(AI_VIDEO_1_URL, "_blank", "noopener,noreferrer");
                }}
              >
                Video
              </button>
              <span className="intro__tooltip">
                <span>{AI_VIDEO_1_INFO.tools}</span>
                <span>{AI_VIDEO_1_INFO.story}</span>
                <span className="intro__tooltip-reference">
                  <span>{AI_VIDEO_1_INFO.referenceLabel}</span>
                  <span className="intro__tooltip-reference-body">
                    <a
                      className="intro__tooltip-link"
                      href={AI_VIDEO_1_INFO.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {AI_VIDEO_1_INFO.referenceUrl}
                    </a>
                    <span>{AI_VIDEO_1_INFO.referenceNote}</span>
                  </span>
                </span>
              </span>
            </div>
            <button
              className="intro__button"
              onClick={() => {
                setPlay(true);
              }}
            >
              Step In
            </button>
          </div>
        </div>
      <div className={`outro ${end ? "outro--appear" : ""}`}>
        <p className="outro__text">다른 행성으로 떠나요</p>
        <button className="outro__button" onClick={resetToIntro}>
          Step Again
        </button>
      </div>
    </div>
  );
};
