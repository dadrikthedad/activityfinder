// components/PasswordField.tsx
import React, { useState } from "react";
import { Eye, EyeOff, Info } from "lucide-react";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  touched?: boolean;
  placeholder?: string;
  tooltip?: string;
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
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const showError = touched && error;

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
            className={`w-full h-12 px-4 pr-10 border rounded-md bg-gray-700 text-white 
              ${showError ? "border-red-500" : "border-gray-500"}`}
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {showError && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>

      {/* Tooltip */}
      {tooltip ? (
        <div className="relative flex justify-start group">
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
