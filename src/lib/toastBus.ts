"use client";

// Tiny global toast bus — any client component calls toastSuccess/toastError;
// the single <Toaster /> mounted in AppShell renders them. No context needed.

export type ToastKind = "success" | "error";
export type ToastEvent = { id: string; kind: ToastKind; message: string };

type Listener = (t: ToastEvent) => void;

const listeners = new Set<Listener>();

export function subscribeToToasts(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(kind: ToastKind, message: string) {
  const event: ToastEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    message,
  };
  listeners.forEach((fn) => fn(event));
}

export const toastSuccess = (message: string) => emit("success", message);
export const toastError = (message: string) => emit("error", message);
