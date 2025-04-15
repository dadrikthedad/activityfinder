// Innstilling siden, vi kan endre flere felt i user.cs samt flere innstillinger. Tar oss videre til change credentials og tilbake til profil
"use client";
import EditableCountryRegionGroup from "@/components/settings/EditableCountryRegionGroup";
import EditableField from "@/components/settings/EditableField";
import EditableSelectField from "@/components/settings/EditableSelectField";
import { useCountryAndRegion } from "@/hooks/useCountryAndRegion";
import { useFormHandlers } from "@/hooks/useFormHandlers";
import { useUpdateUserField } from "@/hooks/useUpdateUserField";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useEffect, useState } from "react";
import AdditionalSettings from "@/components/settings/AdditionalSettings";
import { useUpdateUserSettings } from "@/hooks/useUpdateUserSettings";
import ProfileNavButton from "@/components/settings/ProfileNavButton";

export default function ProfileSettingsPage() {
  const { updateSettings } = useUpdateUserSettings(); // Henter funksjonen for å lagre/redigere brukerens innstillinger til backend.
  const [refreshIndex, setRefreshIndex] = useState(0); // Tvinger en re-fetch av brukerinnstillinger ved å oppdatere verdien (brukes som dependency i useUserSettings).
  
  const { // Initialiserer og håndterer all formdata-lagring og -oppdatering for feltene i profilen (navn, e-post, osv.).
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

  const { //  Henter tilgjengelige land og regioner basert på valgt land. Brukes til land/region-dropdowns.
    countries,
    regions,
    countryCodes,
    fetchRegionsForCountry, // 👈 henter den her
  } = useCountryAndRegion({
    country: formData.country,
    setFormData,
  });

  const { updateField, error, success } = useUpdateUserField(); // Gir deg en funksjon for å oppdatere ett enkelt felt hos brukeren + status for feilmelding og suksess.
  const { settings, loading } = useUserSettings(refreshIndex); // Henter brukerens gjeldende innstillinger fra backend, og viser loading mens de lastes.

  useEffect(() => { // Brukes for debugging. Logger ut informasjon om brukeren til konsollen når settings er lastet (for debugging).
    if (settings) {
      console.log("👤 Innlogget bruker-ID:", settings.userId);
      console.log("🧠 Hele settings-objektet:", settings);
    }
  }, [settings]);

  
  useEffect(() => { // Oppdaterer formData basert på det som kommer fra settings, så skjemaet er forhåndsutfylt.
    if (settings) {
      setFormData({
        firstName: settings.firstName || "",
        middleName: settings.middleName || "",
        lastName: settings.lastName || "",
        email: settings.contactEmail || "",
        phone: settings.contactPhone || "",
        country: settings.country || "",
        region: settings.region || "",
        postalCode: settings.postalCode || "",
        gender: settings.gender || "",
        password: "",
        confirmPassword: "",
        dateOfBirth: "", 
      });
    }
  }, [settings, setFormData]);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-green-600"></div>
          <p className="mt-4 text-gray-500">Loading profile settings...</p>
        </div>
      </div>
    );
  }
  
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
      <EditableField // FirstName feltet
        name="firstName"
        label="First Name:"
        value={formData.firstName}
        onSave={async (val) => {
            await updateField("updateFirstName", val);
            setFormData((prev) => ({ ...prev, firstName: val }));
        }}
        />

        <EditableField // Middle Name feltet
            name="middleName"
          label="Middle Name:"
          value={formData.middleName || ""}
          onSave={async (val) => {
            await updateField("updateMiddleName", val);
            setFormData((prev) => ({ ...prev, middleName: val }));
          }}
        />

        <EditableField // Last Name feltet
            name ="lastName"
          label="Last Name:"
          value={formData.lastName}
          onSave={async (val) => {
            await updateField("updateLastName", val);
            setFormData((prev) => ({ ...prev, lastName: val }));
          }}
        />
        <EditableField // User phone feltet
            name="phone"
            label="Phone:"
            value={formData.phone || ""}
            onSave={async (val) => {
                await updateField("updatePhone", val);
                setFormData((prev) => ({ ...prev, phone: val }));
            }}
        />
        
        
        
        <EditableCountryRegionGroup // Endre lang og region. Mye logikk slik at når vi endrer land, så endrer regionene seg deretter
          country={formData.country}
          region={formData.region || ""}
          countries={countries}
          regions={regions}
          onTempCountryChange={(val) =>
            setFormData((prev) => ({ ...prev, country: val }))
          }
          onTempRegionChange={(val) =>
            setFormData((prev) => ({ ...prev, region: val }))
          }
          onEditStart={async (countryName) => {
            const code = countryCodes[countryName];
            if (!countryName || !code) {
              console.warn("❌ Kan ikke hente regioner, land mangler eller ukjent:", countryName);
              return;
            }
            await fetchRegionsForCountry(countryName);
          }}
          onSave={async (countryName, region) => {
            const countryCode = countryCodes[countryName];
            if (!countryCode) {
              console.error("❌ Fant ikke kode for land:", countryName);
              return;
            }

            await updateField("updateLocation", {
              country: countryCode,
              region,
            });

            setFormData((prev) => ({
              ...prev,
              country: countryName,
              region,
            }));
          }}
          onCancel={() => {
            // 👇 Bruk samme verdier som du satte i handleCancel internt
            setFormData((prev) => ({
              ...prev,
              country: settings?.country || "",
              region: settings?.region || "",
            }));
          }}
        />


        <EditableField // PostalCode
            name="postalCode"
            label="Postal Code:"
            value={formData.postalCode || ""}
            onSave={async (val) => {
                await updateField("updatePostalCode", val);
                setFormData((prev) => ({ ...prev, postalCode: val }));
            }}
        />

        <EditableSelectField // Kjønn feltet
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

      <EditableField // Kontakt phone fra Profile
        name="contactPhone"
        label="Contact Phone:"
        value={formData.phone || ""}
        onSave={async (val) => {
          await updateField("updateContactPhone", val);
          setFormData((prev) => ({ ...prev, phone: val }));
        }}
      />
      <p className="text-xs text-gray-400 -mt-3 mb-2 text-center">
          Will be visible on your profile if Show phone is checked below.
        </p>

      <EditableField // Kontakt epost fra Profile
        name="contactEmail"
        label="Contact Email:"
        value={formData.email || ""}
        onSave={async (val) => {
          await updateField("updateContactEmail", val);
          setFormData((prev) => ({ ...prev, email: val }));
        }}
      />
      <p className="text-xs text-gray-400 -mt-3 mb-2 text-center">
          Will be visible on your profile if Show Email is checked below. Try to avoid giving away your login info.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12">

      {settings && (
        <ProfileNavButton // Tilbake til profil knappen
          href={`/profile/${settings.userId}`}
          text="Back to Profile"
          variant="long"
        />
)}

        <ProfileNavButton // Endre passord/epost
          href="/securitycred"
          text="Change Login Credentials"
          variant="long"
        />
</div>
      {/* Additional settings */}
    {settings ? (
          <AdditionalSettings
          initialValues={{
            language: settings.language,
            recieveEmailNotifications: settings.recieveEmailNotifications,
            recievePushNotifications: settings.recievePushNotifications,
            publicProfile: settings.publicProfile,
            showGender: settings.showGender,
            showEmail: settings.showEmail,
            showPhone: settings.showPhone,
            showRegion: settings.showRegion,
            showPostalCode: settings.showPostalCode,
            showStats: settings.showStats,
            showWebsites: settings.showWebsites,
            showAge: settings.showAge,
            showBirthday: settings.showBirthday
          }}
          onSave={async (updated) => {
            await updateSettings(updated);
            setRefreshIndex((prev) => prev + 1); // Dette refresher settings ved lagring
          }}
        />
      ) : (
        <p>Loading settings...</p>
      )}
    </div>
    
    </div>
  );
}