import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import Loader from './Loader'; // <- mismo folder

const LoadingContext = createContext({
  show: (_t) => {},
  hide: () => {},
  withLoading: async (_fn, _t) => {},
});

export const LoadingProvider = ({ children }) => {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('Cargando…');

  const show = useCallback((t) => {
    setCount((c) => c + 1);
    if (t) setText(t);
  }, []);

  const hide = useCallback(() => {
    setCount((c) => Math.max(0, c - 1));
  }, []);

  const withLoading = useCallback(async (fn, t) => {
    show(t);
    try {
      return await fn();
    } finally {
      hide();
    }
  }, [show, hide]);

  const value = useMemo(() => ({ show, hide, withLoading }), [show, hide, withLoading]);

  return (
    <LoadingContext.Provider value={value}>
      <Loader open={count > 0} text={text} />
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => useContext(LoadingContext);
