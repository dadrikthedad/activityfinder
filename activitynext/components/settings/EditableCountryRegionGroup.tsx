"use client";

import { useState, useEffect } from "react";
import { validateSingleField } from "@/utils/validators";
import EditableButtons from "./EditableButtons";

interface EditableCountryRegionGroupProps {
  country: string;
  region: string;
  countries: { label: string; value: string }[];
  regions: { label: string; value: string }[];
  onTempCountryChange: (val: string) => void;
  onTempRegionChange: (val: string) => void;
  onSave: (country: string, region: string) => Promise<void>;
  onEditStart: (country: string) => Promise<void>;
  onCancel: () => void;
}

export default function EditableCountryRegionGroup({
  country,
  region,
  countries,
  regions,
  onTempCountryChange,
  onTempRegionChange,
  onSave,
  onEditStart,
}: EditableCountryRegionGroupProps) {
  const [editing, setEditing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(country);
  const [selectedRegion, setSelectedRegion] = useState(region);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    setSelectedCountry(country);
    setSelectedRegion(region);
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    const countryError = validateSingleField("country", selectedCountry);
    const isRegionValid = regions.some((opt) => opt.value === selectedRegion);

    const regionError =
      selectedRegion === "" ||
      selectedRegion === "-- Choose --" ||
      !isRegionValid
        ? "Please select a valid region."
        : validateSingleField("region", selectedRegion);

    if (countryError || regionError) {
      setError(countryError || regionError);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(selectedCountry, selectedRegion);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch (err) {
      console.error("❌ Failed to save country/region:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = async () => {
    await onEditStart(selectedCountry); // henter regionene første gang
    setEditing(true);
  };

  useEffect(() => {
    if (!editing || !selectedCountry) return;
  
    // Ikke hent på nytt hvis vi allerede har riktige regioner
    const alreadyLoaded = regions.length > 0 && regions[0].label !== "-- Choose --";
    if (!alreadyLoaded) {
      onEditStart(selectedCountry);
    }
  }, [selectedCountry, editing]);

  useEffect(() => {
    setSelectedCountry(country);
    setSelectedRegion(region);
  }, [country, region]);

  return (
    <div className="grid grid-cols-3 gap-4 items-center py-4">
      <div className="font-medium text-right pr-2">Country & Region</div>

      <div className="flex flex-col gap-2 text-left">
        {editing ? (
          <>
            <select
              className="w-[280px] h-12 px-4 border rounded-md bg-gray-700 text-white text-center border-gray-500"
              value={selectedCountry}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCountry(val);
                setSelectedRegion(""); // reset region
                onTempCountryChange(val);
              }}
              disabled={isSaving}
            >
              {countries.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              className="w-[280px] h-12 px-4 border rounded-md bg-gray-700 text-white text-center border-gray-500"
              value={selectedRegion}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedRegion(val);
                onTempRegionChange(val);
              }}
              disabled={isSaving}
            >
              {regions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {error && (
              <p className="text-red-500 text-sm text-center w-full">{error}</p>
            )}
          </>
        ) : (
          <>
            <span className="block w-[280px] text-center">{country}</span>
            <span className="block w-[280px] text-center">{region}</span>
          </>
        )}
      </div>

      <EditableButtons
        editing={editing}
        saved={saved}
        isSaving={isSaving}
        onEdit={handleEditClick}
        onSave={handleSave}
        onCancel={handleCancel}
        disableSave={selectedRegion === ""}
      />
    </div>
  );
}
