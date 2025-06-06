// ModalContext.tsx Brukes for å tilate at modaler kan poppe opp uansett hvor og når på skjermen. Brukes til å bekrefte å slette en venn både på en profilside samt i Friends siden. Brukes i layout.tsx
"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';
import Card from "@/components/common/Card"; 

interface ModalContextType {
  showModal: (content: ReactNode) => void;
  hideModal: () => void;
  isModalOpen: boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);
  const isModalOpen = modalContent !== null;
  const showModal = (content: ReactNode) => setModalContent(content);
  const hideModal = () => setModalContent(null);

  return (
    <ModalContext.Provider value={{ showModal, hideModal, isModalOpen }}>
      {children}
      {modalContent && (
        <div
          className="modal-overlay"
          onClick={(e) => e.stopPropagation()} // viktig
        >
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()} // viktig
          >
            <Card
              className="max-w-md w-full border-2 border-[#1C6B1C]"
              onClick={(e) => e.stopPropagation()} // viktig
            >
              {modalContent}
            </Card>
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
