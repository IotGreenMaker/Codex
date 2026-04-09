"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
};

type ConfirmationModalProps = {
  isOpen: boolean;
  options: ConfirmationOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationModal({ isOpen, options, onConfirm, onCancel }: ConfirmationModalProps) {
  if (!isOpen || !options) return null;

  const {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger"
  } = options;

  const variantStyles = {
    danger: {
      icon: "text-red-400",
      confirm: "bg-red-500/20 border-red-400/30 hover:bg-red-500/30 text-red-100",
      iconBg: "bg-red-500/10 border-red-400/20"
    },
    warning: {
      icon: "text-amber-400",
      confirm: "bg-amber-500/20 border-amber-400/30 hover:bg-amber-500/30 text-amber-100",
      iconBg: "bg-amber-500/10 border-amber-400/20"
    },
    info: {
      icon: "text-sky-400",
      confirm: "bg-sky-500/20 border-sky-400/30 hover:bg-sky-500/30 text-sky-100",
      iconBg: "bg-sky-500/10 border-sky-400/20"
    }
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative glass-panel rounded-3xl p-6 max-w-sm mx-4 w-full shadow-2xl border border-white/10">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition"
        >
          <X className="h-4 w-4 text-lime-100/70" />
        </button>

        {/* Icon */}
        <div className={`mx-auto w-12 h-12 rounded-full ${style.iconBg} border flex items-center justify-center mb-4`}>
          <AlertTriangle className={`h-6 w-6 ${style.icon}`} />
        </div>

        {/* Content */}
        <h3 className="text-center text-lg font-semibold text-lime-100 mb-2">{title}</h3>
        <p className="text-center text-sm text-lime-100/70 mb-6">{message}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-lime-100 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${style.confirm}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easy confirmation dialogs
export function useConfirmation() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ConfirmationOptions | null;
    onConfirm: (() => void) | null;
  }>({ isOpen: false, options: null, onConfirm: null });

  const ask = (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        options,
        onConfirm: () => {
          resolve(true);
          setModalState({ isOpen: false, options: null, onConfirm: null });
        }
      });
      // Store reject handler for cancel
      (window as any).__confirmReject = () => {
        resolve(false);
        setModalState({ isOpen: false, options: null, onConfirm: null });
      };
    });
  };

  const handleCancel = () => {
    setModalState({ isOpen: false, options: null, onConfirm: null });
    (window as any).__confirmReject?.();
  };

  const handleConfirm = () => {
    modalState.onConfirm?.();
  };

  const Modal = (
    <ConfirmationModal
      isOpen={modalState.isOpen}
      options={modalState.options}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { ask, Modal };
}