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
  initialValues: Pick<
  PublicProfileDTO,
    "language" | "recieveEmailNotifications" | "recievePushNotifications" | "publicProfile"
    | "showGender"
    | "showEmail"
    | "showPhone"
    | "showRegion"
    | "showPostalCode"        // ✅ NY
    | "showStats"             // ✅ NY
    | "showWebsites"   
  >;
  onSave: (updated: Partial<PublicProfileDTO>) => Promise<void>;
}


export default function AdditionalSettings({ initialValues, onSave }: Props) {
  const [language, setLanguage] = useState(initialValues.language);
  const booleanOrFalse = (value?: boolean) => value ?? false;
  const [receiveEmails, setReceiveEmails] = useState(booleanOrFalse(initialValues.recieveEmailNotifications));
  const [receivePush, setReceivePush] = useState(booleanOrFalse(initialValues.recievePushNotifications));

  const [publicProfile, setPublicProfile] = useState(booleanOrFalse(initialValues.publicProfile));
  const [showGender, setShowGender] = useState(booleanOrFalse(initialValues.showGender));
  const [showEmail, setShowEmail] = useState(booleanOrFalse(initialValues.showEmail));
  const [showPhone, setShowPhone] = useState(booleanOrFalse(initialValues.showPhone));
  const [showRegion, setShowRegion] = useState(booleanOrFalse(initialValues.showRegion));
  const [showPostalCode, setShowPostalCode] = useState(booleanOrFalse(initialValues.showPostalCode));
  const [showStats, setShowStats] = useState(booleanOrFalse(initialValues.showStats));
  const [showWebsites, setShowWebsites] = useState(booleanOrFalse(initialValues.showWebsites));


  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const [hasInitialized, setHasInitialized] = useState(false);


  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        language,
        recieveEmailNotifications: receiveEmails,
        recievePushNotifications: receivePush,
        publicProfile,
        showGender,
        showEmail,
        showPhone,
        showRegion,
        showPostalCode,
        showStats,
        showWebsites
      });
      router.refresh(); // Bare kjør hvis alt gikk fint
      setSuccess(true);
    } catch (err) {
      console.error("❌ Kunne ikke lagre innstillinger:", err);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  useEffect(() => {
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
  
      setHasInitialized(true); // ✅ gjør at syncen bare skjer én gang
    }
  }, [initialValues, hasInitialized]);

  
  

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-xl font-semibold mb-4">Additional Preferences</h2>

      <div className="flex flex-col gap-4">
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
          <div /> {/* Tom kolonne for å balansere */}
       </div>
        <CheckboxField
          label="Receive occasional emails"
          checked={receiveEmails}
          onChange={setReceiveEmails}
        />

        <CheckboxField
          label="Allow push notifications"
          checked={receivePush}
          onChange={setReceivePush}
        />

        <CheckboxField
          label="Make my profile public"
          checked={publicProfile}
          onChange={setPublicProfile}
        />

        <CheckboxField
          label="Show gender on profile"
          checked={showGender}
          onChange={setShowGender}
        />

        <CheckboxField
          label="Show email on profile"
          checked={showEmail}
          onChange={setShowEmail}
        />

        <CheckboxField
          label="Show phone number on profile"
          checked={showPhone}
          onChange={setShowPhone}
        />

        <CheckboxField
          label="Show region on profile"
          checked={showRegion}
          onChange={setShowRegion}
        />

        <CheckboxField
          label="Show postal code on profile"
          checked={showPostalCode}
          onChange={setShowPostalCode}
        />

        <CheckboxField
          label="Show stats on profile"
          checked={showStats}
          onChange={setShowStats}
        />

        <CheckboxField
          label="Show websites on profile"
          checked={showWebsites}
          onChange={setShowWebsites}
        />
       <div className="flex flex-col gap-4 items-center text-center">
      <ProfileNavButton
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
