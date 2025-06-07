// ModalContext.tsx Brukes for å tilate at modaler kan poppe opp uansett hvor og når på skjermen. Brukes til å bekrefte å slette en venn både på en profilside samt i Friends siden. Brukes i layout.tsx
"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';


interface ModalContextType {
  showModal: (content: ReactNode, options?: { blurBackground?: boolean; position?: { x: number; y: number } }) => void;
  hideModal: () => void;
  isModalOpen: boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);
  const [blurBackground, setBlurBackground] = useState(true); // standard: true
  const isModalOpen = modalContent !== null;
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);
  const showModal = (content: ReactNode, options?: { blurBackground?: boolean; position?: { x: number; y: number } }) => {
    setModalContent(content);
    setBlurBackground(options?.blurBackground !== false);
    setModalPosition(options?.position ?? null);
  };
  const hideModal = () => setModalContent(null);

  return (
    <ModalContext.Provider value={{ showModal, hideModal, isModalOpen }}>
      {children}
    {React.isValidElement(modalContent) && (
        <div
          className="modal-overlay"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`fixed z-[9999] ${
              modalPosition ? "" : "inset-0 flex items-center justify-center"
            } ${blurBackground ? "bg-black/30 backdrop-blur-sm" : ""}`}
            style={
              modalPosition ? { left: modalPosition.x, top: modalPosition.y } : undefined
            }
            onClick={(e) => e.stopPropagation()}
          >
            {modalContent}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
