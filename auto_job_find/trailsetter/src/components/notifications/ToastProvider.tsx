// ToastProvider: Global notification context/provider
'use client';
import { createContext, useContext, useState, ReactNode } from 'react';
import { toast, Toaster } from 'sonner'; // Shadcn UI toast compatible

interface ToastContextType {
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType>({ notify: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    toast[msg ? type : 'info'](msg);
  };
  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <Toaster position="top-center" richColors />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
