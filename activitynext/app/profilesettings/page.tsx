"use client";

import FormButton from "@/components/FormButton";
import EditableCountryRegionGroup from "@/components/settings/EditableCountryRegionGroup";
import EditableField from "@/components/settings/EditableField";
import EditableSelectField from "@/components/settings/EditableSelectField";
import { useCountryAndRegion } from "@/hooks/useCountryAndRegion";
import { useFormHandlers } from "@/hooks/useFormHandlers";
import { useUpdateUserField } from "@/hooks/useUpdateUserField";
import Link from "next/link";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useEffect } from "react";



export default function ProfileSettingsPage() {

  const {
    formData,
    setFormData,
  } = useFormHandlers({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    dateOfBirth: "",
    country: "",
    region: "",
    postalCode: "",
    gender: "",
  });

  const { countries, regions, countryCodes } = useCountryAndRegion({
    country: formData.country,
    setFormData,
    editing: true, // 👈 viktig!
  });

  const { updateField, error, success } = useUpdateUserField();
  const { settings } = useUserSettings();

  
  useEffect(() => {
    if (settings) {
      setFormData({
        firstName: settings.firstName || "",
        middleName: settings.middleName || "",
        lastName: settings.lastName || "",
        phone: settings.phone || "",
        country: settings.country || "",
        region: settings.region || "",
        postalCode: settings.postalCode || "",
        gender: settings.gender || "",
        email: "",
        password: "",
        confirmPassword: "",
        dateOfBirth: "", // hvis den finnes
      });
    }
  }, [settings, setFormData]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen px-6 py-12 text-center">
        <div className="max-w-4xl mx-auto mt-12 px-4">
      <h1 className="text-4xl font-bold text-[#1C6B1C]">Edit Profile</h1>

            {success && (
            <p className="text-green-600 text-center mb-4">Changes saved successfully! ✅</p>
        )}

        {error && (
            <p className="text-red-600 text-center mb-4">{error}</p>
        )}

    <div className="grid grid-cols-1 gap-y-6">
      <EditableField
        name="firstName"
        label="First Name:"
        value={formData.firstName}
        onSave={async (val) => {
            await updateField("updateFirstName", val);
            setFormData((prev) => ({ ...prev, firstName: val }));
        }}
        />

        <EditableField
            name="middleName"
          label="Middle Name:"
          value={formData.middleName || ""}
          onSave={async (val) => {
            await updateField("updateMiddleName", val);
            setFormData((prev) => ({ ...prev, middleName: val }));
          }}
        />

        <EditableField
            name ="lastName"
          label="Last Name:"
          value={formData.lastName}
          onSave={async (val) => {
            await updateField("updateLastName", val);
            setFormData((prev) => ({ ...prev, lastName: val }));
          }}
        />
        <EditableField
            name="phone"
            label="Phone:"
            value={formData.phone || ""}
            onSave={async (val) => {
                await updateField("updatePhone", val);
                setFormData((prev) => ({ ...prev, phone: val }));
            }}
        />
        
        
        
        <EditableCountryRegionGroup
          country={formData.country}
          region={formData.region || ""}
          countries={countries}
          regions={regions}
          onTempCountryChange={(val) => setFormData((prev) => ({ ...prev, country: val }))}
          onTempRegionChange={(val) => setFormData((prev) => ({ ...prev, region: val }))}
          onSave={async (countryName, region) => {
            const countryCode = countryCodes[countryName];
            console.log("🔍 Sending to API:", { country: countryCode, region }); // 👈 få ISO2-kode
            if (!countryCode) {
              console.error("❌ Fant ikke landskode for:", countryName);
              return;
            }

            await updateField("updateLocation", {
              country: countryCode, // 👈 send kode, ikke navn
              region,
            });

            setFormData((prev) => ({ ...prev, country: countryName, region }));
          }}
        />


        <EditableField
            name="postalCode"
            label="Postal Code:"
            value={formData.postalCode || ""}
            onSave={async (val) => {
                await updateField("updatePostalCode", val);
                setFormData((prev) => ({ ...prev, postalCode: val }));
            }}
        />

        <EditableSelectField
        name="gender"
        label="Gender:"
        value={formData.gender}
        options={[
            { label: "Male", value: "Male" },
            { label: "Female", value: "Female" },
            { label: "Unspecified", value: "Unspecified" },
        ]}
        onSave={async (val) => {
            await updateField("updateGender", val);
            setFormData((prev) => ({ ...prev, gender: val }));
        }}
        />
      </div>
      <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12">
            <Link href="/profile" passHref>
                <FormButton
                text="Back to Profile"
                type="button"
                fullWidth={false}
                className="text-lg px-10 py-3"
                />
            </Link>

            <Link href="/biosettings" passHref>
                <FormButton
                text="Edit Bio"
                type="button"
                fullWidth={false}
                className="text-lg px-10 py-3"
                />
            </Link>
</div>
    </div>
    </div>
  );
}