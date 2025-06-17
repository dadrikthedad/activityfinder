// Her har vi passord-feltet som brukes både i login, signup og securitycred
import React, { useState } from "react";
import { Eye, EyeOff, Info } from "lucide-react";

interface PasswordFieldProps {
  id: string; //unikt navn på feltet
  label: string; // tekst over/ved siden av feltet
  value: string; // verdi i feltet
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; // hvis bruker skriver i feltet så oppdatere det seg med denne funksjonen
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void; // Denne funksjonen kjøres hvis vi trykker vekk fra feltet, vi bruker den til å validere et felt når vi er ferdig i det
  error?: string; // viser feil under teksten
  touched?: boolean; // sjekker om vi har vært innom feltet
  placeholder?: string; // placeholder i feltet
  tooltip?: string; // tooltippen igjen
  disabled?: boolean;
}

const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  touched,
  placeholder,
  tooltip,
  disabled,
}) => {
  const [showPassword, setShowPassword] = useState(false); // Gjør passord synlig/ikke synlig
  const showError = touched && error; // Viser kun error hvis vi har vært i feltet og får en valideringsfeil

  return (
    <>
      <label htmlFor={id} className="text-gray-300 font-medium text-right">
        {label}
      </label>

      <div className="relative w-full flex flex-col">
        <div className="relative w-full">
          <input
            id={id}
            type={showPassword ? "text" : "password"}
            name={id}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled} 
            className={`w-[280px] h-12 px-4 pr-16 border rounded-md bg-gray-700 text-white 
                ${showError ? "border-red-500" : "border-gray-500"}`}
          />

                <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                tabIndex={-1}
                >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
        </div>

        {showError && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>

      {/* Tooltip */}
      {tooltip ? (
        <div className="ml-4 relative flex justify-start group">
          <Info className="text-gray-400 cursor-pointer" size={18} />
          <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
              bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-56 z-10">
            {tooltip}
          </div>
        </div>
      ) : (
        <div />
      )}
    </>
  );
};

export default PasswordField;
