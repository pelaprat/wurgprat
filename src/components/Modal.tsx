"use client";

import { ReactNode, useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /**
   * Maximum width of the modal on desktop.
   * Options: "sm" (384px), "md" (448px), "lg" (512px), "xl" (576px)
   */
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

/**
 * Responsive modal component:
 * - Mobile: Bottom sheet that slides up from bottom
 * - Desktop: Centered modal with scale animation
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
}: ModalProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingIn(true);
        });
      });
    } else {
      setIsAnimatingIn(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Mobile: Bottom Sheet */}
      <div className="md:hidden fixed inset-0 z-50">
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${
            isAnimatingIn ? "opacity-50" : "opacity-0"
          }`}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Sheet */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl transform transition-transform duration-300 ease-spring max-h-[90vh] flex flex-col ${
            isAnimatingIn ? "translate-y-0" : "translate-y-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title-mobile" : undefined}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          {title && (
            <div className="px-4 pb-3 border-b flex justify-between items-center flex-shrink-0">
              <h2
                id="modal-title-mobile"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-gray-500 hover:text-gray-700 active:bg-gray-100 rounded-lg transition-colors btn-press"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-safe">
            {children}
          </div>
        </div>
      </div>

      {/* Desktop: Centered Modal */}
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-200 ${
            isAnimatingIn ? "opacity-50" : "opacity-0"
          }`}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div
          className={`relative bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} max-h-[80vh] flex flex-col transform transition-all duration-200 ${
            isAnimatingIn
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95"
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title-desktop" : undefined}
        >
          {/* Header */}
          {title && (
            <div className="px-6 py-4 border-b flex justify-between items-center flex-shrink-0">
              <h2
                id="modal-title-desktop"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 -mr-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </>
  );
}
