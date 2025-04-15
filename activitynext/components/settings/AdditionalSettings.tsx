"use client";

import React, { useState, useEffect } from "react";
// FormButton brukes som lagre knappen
import ProfileNavButton from "./ProfileNavButton";
// Lagrer oppdatering og sender det i denne DTO til backend
import { PublicProfileDTO } from "@/types/PublicProfileDTO"; // 👈 sørg for denne finnes
// Kryss av feltene
import CheckboxField from "./CheckboxField";
// Refresher siden neste gang vi går inn etter en endring er satt
import { useRouter } from "next/navigation";

// 
interface Props {
  initialValues: Partial<Pick<
  PublicProfileDTO,
    "language" | "recieveEmailNotifications" | "recievePushNotifications" | "publicProfile"
    | "showGender"
    | "showEmail"
    | "showPhone"
    | "showRegion"
    | "showPostalCode"        
    | "showStats"             
    | "showWebsites"   
    | "showAge"
    | "showBirthday" 
  >>;
  onSave: (updated: Partial<PublicProfileDTO>) => Promise<void>;
}


export default function AdditionalSettings({ initialValues, onSave }: Props) {
  const [language, setLanguage] = useState(initialValues.language); //Språkvalg, kommer om lenge
  const booleanOrFalse = (value?: boolean) => value ?? false; // Brukes for å sjekke om en variabel har verdi eller ikke
  const [receiveEmails, setReceiveEmails] = useState(booleanOrFalse(initialValues.recieveEmailNotifications)); // epost ved oppdateringer
  const [receivePush, setReceivePush] = useState(booleanOrFalse(initialValues.recievePushNotifications)); // notification

  const [publicProfile, setPublicProfile] = useState(booleanOrFalse(initialValues.publicProfile)); //Gjøre profilen synlig
  const [showGender, setShowGender] = useState(booleanOrFalse(initialValues.showGender));// Felter for å vise eller skjule i profile
  const [showEmail, setShowEmail] = useState(booleanOrFalse(initialValues.showEmail));
  const [showPhone, setShowPhone] = useState(booleanOrFalse(initialValues.showPhone));
  const [showRegion, setShowRegion] = useState(booleanOrFalse(initialValues.showRegion));
  const [showPostalCode, setShowPostalCode] = useState(booleanOrFalse(initialValues.showPostalCode));
  const [showStats, setShowStats] = useState(booleanOrFalse(initialValues.showStats));
  const [showWebsites, setShowWebsites] = useState(booleanOrFalse(initialValues.showWebsites));
  const [showAge, setShowAge] = useState(booleanOrFalse(initialValues.showAge));
  const [showBirthday, setShowBirthday] = useState(booleanOrFalse(initialValues.showBirthday));

  //Sjekker om vi er i editprofile eller i settings utifra om language er med eller ikke.
  const isEditProfile = !("language" in initialValues);

  // brukes for å vise om en knapp lagrer eller har lagret
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter(); // Brukes for å refreshe siden etter en oppdatering
  const [hasInitialized, setHasInitialized] = useState(false); // Brukes en useEffect kun en gang


  const handleSave = async () => { // Samler alle verdiene som finnes og kan endres og sender til backend i UserSettingsDTO.ts tror jeg
    setSaving(true);
    try {
      const updated: Partial<PublicProfileDTO> = {};
      if ("language" in initialValues) updated.language = language;
      if ("recieveEmailNotifications" in initialValues) updated.recieveEmailNotifications = receiveEmails;
      if ("recievePushNotifications" in initialValues) updated.recievePushNotifications = receivePush;
      if ("publicProfile" in initialValues) updated.publicProfile = publicProfile;
      if ("showGender" in initialValues) updated.showGender = showGender;
      if ("showEmail" in initialValues) updated.showEmail = showEmail;
      if ("showPhone" in initialValues) updated.showPhone = showPhone;
      if ("showRegion" in initialValues) updated.showRegion = showRegion;
      if ("showPostalCode" in initialValues) updated.showPostalCode = showPostalCode;
      if ("showStats" in initialValues) updated.showStats = showStats;
      if ("showWebsites" in initialValues) updated.showWebsites = showWebsites;
      if ("showAge" in initialValues) updated.showAge = showAge;
      if ("showBirthday" in initialValues) updated.showBirthday = showBirthday;

      await onSave(updated);
      router.refresh();
      setSuccess(true);
    } catch (err) {
      console.error("❌ Kunne ikke lagre innstillinger:", err);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  useEffect(() => { // Setter verdien fra backend når vi henter siden
    if (!hasInitialized && initialValues) {
  
      setLanguage(initialValues.language);
      setReceiveEmails(booleanOrFalse(initialValues.recieveEmailNotifications));
      setReceivePush(booleanOrFalse(initialValues.recievePushNotifications));
      setPublicProfile(booleanOrFalse(initialValues.publicProfile));
      setShowGender(booleanOrFalse(initialValues.showGender));
      setShowEmail(booleanOrFalse(initialValues.showEmail));
      setShowPhone(booleanOrFalse(initialValues.showPhone));
      setShowRegion(booleanOrFalse(initialValues.showRegion));
      setShowPostalCode(booleanOrFalse(initialValues.showPostalCode));
      setShowStats(booleanOrFalse(initialValues.showStats));
      setShowWebsites(booleanOrFalse(initialValues.showWebsites));
      setShowAge(booleanOrFalse(initialValues.showAge));
      setShowBirthday(booleanOrFalse(initialValues.showBirthday))
  
      setHasInitialized(true); // ✅ gjør at syncen bare skjer én gang
    }
  }, [initialValues, hasInitialized]);

  
  

  return (
    <div className="mt-8 border-t pt-6 min-h-[40vh]">
      <h2 className="text-xl text-[#1C6B1C] font-semibold mb-4 text-center">
      {isEditProfile ? "Profile Settings" : "Additional Settings"}
    </h2>

      <div className="flex flex-col gap-4">
        {"language" in initialValues && (
          <div className="grid grid-cols-[1fr_3fr_1fr] items-center gap-4">
            <span className="font-medium text-left">Language:</span>
            <div className="flex justify-center">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-[480px] h-12 px-4 border rounded-md bg-gray-700 text-white text-center border-gray-500"
              >
                <option value="en">English</option>
                <option value="no">Norwegian - NOT IMPLEMENTED YET</option>
                <option value="es">Spanish - NOT IMPLEMENTED YET</option>
                <option value="de">German - NOT IMPLEMENTED YET</option>
              </select>
            </div>
            <div />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {"recieveEmailNotifications" in initialValues && (
            <CheckboxField label="Receive occasional emails" checked={receiveEmails} onChange={setReceiveEmails} />
          )}
          {"recievePushNotifications" in initialValues && (
            <CheckboxField label="Allow push notifications" checked={receivePush} onChange={setReceivePush} />
          )}
          {"publicProfile" in initialValues && (
            <CheckboxField label="Make my profile public" checked={publicProfile} onChange={setPublicProfile} />
          )}
          {"showGender" in initialValues && (
            <CheckboxField label="Show gender on profile" checked={showGender} onChange={setShowGender} />
          )}
          {"showEmail" in initialValues && (
            <CheckboxField label="Show email on profile" checked={showEmail} onChange={setShowEmail} />
          )}
          {"showPhone" in initialValues && (
            <CheckboxField label="Show phone number on profile" checked={showPhone} onChange={setShowPhone} />
          )}
          {"showRegion" in initialValues && (
            <CheckboxField label="Show region on profile" checked={showRegion} onChange={setShowRegion} />
          )}
          {"showPostalCode" in initialValues && (
            <CheckboxField label="Show postal code on profile" checked={showPostalCode} onChange={setShowPostalCode} />
          )}
          {"showStats" in initialValues && (
            <CheckboxField label="Show stats on profile" checked={showStats} onChange={setShowStats} />
          )}
          {"showWebsites" in initialValues && (
            <CheckboxField label="Show websites on profile" checked={showWebsites} onChange={setShowWebsites} />
          )}
          {"showAge" in initialValues && (
            <CheckboxField label="Show age on profile" checked={showAge} onChange={setShowAge} />
          )}
          {"showBirthday" in initialValues && (
            <CheckboxField label="Show birthday on profile" checked={showBirthday} onChange={setShowBirthday} />
          )}
        </div>

        <div className="flex flex-col gap-4 items-center text-center">
          <ProfileNavButton // Knappen som lagrer alt
            text={saving ? "Saving..." : success ? "Saved ✅" : "Save Preferences"}
            onClick={handleSave}
            disabled={saving}
            className="mt-4"
          />
        </div>
      </div>
    </div>
  );
}
