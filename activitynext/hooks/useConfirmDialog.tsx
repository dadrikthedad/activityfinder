// Brukes til å bekrefte et valg, kan ta imot en message hvis den brukes flere steder. Brukes nå til useRemoveFriend-funksjonen
"use client";

import { useCallback } from "react";
import { useModal } from "@/context/ModalContext";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import Card from "@/components/common/Card"; // husk riktig path
import { ReactNode } from "react";

export type ConfirmOptions = {
  title?: string;
  message: ReactNode;
};

export function useConfirmDialog() {
  const { showModal, hideModal } = useModal();

  const confirm = useCallback(
    (options: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        const handleClose = (result: boolean) => {
          hideModal();
          resolve(result);
        };

        showModal(
          <Card className="max-w-md w-full text-center space-y-6 border-2 border-[#1C6B1C] bg-white dark:bg-[#1e2122] shadow-md p-6 ">
            <h2 className="text-2xl font-bold text-[#1C6B1C]">
              {options.title || "Confirm"}
            </h2>
            <div className="text-gray-800 dark:text-gray-200">
              {options.message}
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <ProfileNavButton
                text="Cancel"
                onClick={() => handleClose(false)}
                variant="small"
                className="bg-gray-500 hover:bg-gray-600 text-white"
              />
              <ProfileNavButton
                text="Confirm"
                onClick={() => handleClose(true)}
                variant="small"
                className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white"
              />
            </div>
          </Card>
        );
      });
    },
    [showModal, hideModal]
  );

  return { confirm };
}
