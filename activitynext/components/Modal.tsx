// components/Modal.tsx
"use client";
import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-transparent max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white text-3xl font-bold"
          aria-label="Close modal"
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
}
