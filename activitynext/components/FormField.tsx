// Input-felt som brukes til input, både i editprofile og signup. Har flere valgmuliheter om det er input eller dropdown-felt, samt en tooltip som brukes i signup
import { Info } from "lucide-react";
import React from "react";

// Grensenisttet som et slikt felt må følge
interface FormFieldProps {
  id: string; // Navnet
  label: string; // teksten som vises over feltet/til siden
  tooltip?: string; // info som vises når du holder musen over info-ikoet
  type?: string; // "text", "email" "password" osv
  value: string; // nåværende verdi som er i feltet
  onChange: (
    e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>
  ) => void; // Ved endring så kjøres denne funksjonen, som oppdatere feltet
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void; //Hvis vi trykker på utsiden av feltet, så oppdateres feltet hvis vi ønsker
  error?: string; // Gir error ved feil validering
  touched?: boolean; // Hvis vi har rørt feltet en gang
  placeholder?: string; // Placeholder tekst
  as?: "input" | "select"; // Her får vi valg mellom om det er input eller en dropdown
  options?: { label: string; value: string }[]; // alternativer for dropdown
  disabled?: boolean; // Hvis vi har submittet og ønsker ikke at bruker skal kunne endre det imens, så disabler vi den
}

const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  tooltip,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  touched,
  placeholder,
  as = "input",
  options = [],
  disabled = false,
}) => {
  const showError = touched && !!error;

  return (
    <>
      <label htmlFor={id} className="text-gray-300 font-medium text-right">
        {label}
      </label>

      <div className="flex flex-col w-full">
      {as === "input" ? (
        type === "date" ? (
            <input
            id={id}
            type="date"
            name={id}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            max={new Date().toISOString().split("T")[0]}
            disabled={disabled}
            className={`w-[280px] h-12 px-4 border rounded-md bg-gray-700 text-white 
                ${showError ? "border-red-500" : "border-gray-500"}`}
        />
  ) : (
    <input // Hvis det er et vanlig inpu-felt så er det input og vi har da valgene under
      id={id}
      type={type}
      name={id}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-[280px] h-12 px-4 border rounded-md bg-gray-700 text-white 
        ${showError ? "border-red-500" : "border-gray-500"}`}
    />
  )
        ) : (
          <select //Hvis det r en dropdown så har vi disse valgene
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            className={`w-[280px] h-12 px-4 border rounded-md bg-gray-700 text-white 
              ${showError ? "border-red-500" : "border-gray-500"}`}
          >
            {options.map((opt, index) => (
            <option key={`${opt.value}-${index}`} value={opt.value}>
                {opt.label}
            </option>
            ))}
          </select>
        )}
        {showError && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>

      {/* Tooltip brukes for å holde musa over hvis man lurer på hva som skal fylles inn og hvorfor. Brukes foreløpig kun til signup*/}
      {tooltip ? (
        <div className="ml-4 relative flex justify-start group">
        <Info className="text-gray-400 cursor-pointer" size={18} />
        <div className="absolute left-6 bottom-full mb-2 hidden group-hover:flex 
            bg-gray-800 text-white text-xs p-2 rounded-md shadow-md w-40 z-10">
          {tooltip}
        </div>
      </div>
      ) : (
        <div /> // Keeps grid layout aligned
      )}
    </>
  );
};

export default FormField;
