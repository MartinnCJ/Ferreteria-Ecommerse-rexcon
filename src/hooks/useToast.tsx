import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string) => setToast(message), []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && <div className="toast">✓ {toast}</div>}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
