// Brukes til å bekrefte et valg, kan ta imot en message hvis den brukes flere steder. Brukes nå til useRemoveFriend-funksjonen
import { useState, useCallback } from "react";
import { Dialog } from "@headlessui/react";
import ProfileNavButton from "@/components/settings/ProfileNavButton";

export type ConfirmOptions = {
  title?: string;
  message: React.ReactNode; // Støtter JSX nå
};

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: "" });
  const [resolvePromise, setResolvePromise] = useState<(value: boolean) => void>();

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleClose = (result: boolean) => {
    setIsOpen(false);
    if (resolvePromise) {
      resolvePromise(result);
    }
  };

  const ConfirmDialog = () => (
    <Dialog open={isOpen} onClose={() => handleClose(false)} className="fixed z-50 inset-0">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-[#1e2122] p-6 rounded-lg max-w-md w-full text-center space-y-6 border-2 border-[#1C6B1C]">
          <Dialog.Title className="text-2xl font-bold text-[#1C6B1C]">
            {options.title || "Confirm"}
          </Dialog.Title>
          <div className="text-gray-800 dark:text-gray-200">{options.message}</div>
          <div className="flex justify-center gap-4">
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
        </Dialog.Panel>
      </div>
    </Dialog>
  );

  return { confirm, ConfirmDialog };
}