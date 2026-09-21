import { createContext, useContext, useState } from "react";

const Context = createContext();

export const PlayProvider = ({ children }) => {
  const [play, setPlay] = useState(false);
  const [end, setEnd] = useState(false);
  const [hasScroll, setHasScroll] = useState(false);
  const [resetId, setResetId] = useState(0);

  const resetToIntro = () => {
    setPlay(false);
    setEnd(false);
    setHasScroll(false);
    setResetId((id) => id + 1);
  };

  return (
    <Context.Provider
      value={{
        play,
        setPlay,
        end,
        setEnd,
        hasScroll,
        setHasScroll,
        resetId,
        resetToIntro,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export const usePlay = () => {
  const context = useContext(Context);

  if (context === undefined) {
    throw new Error("usePlay must be used within a PlayProvider");
  }

  return context;
};
