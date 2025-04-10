"use client";

import React, { useState } from "react";
import FormButton from "@/components/FormButton";
import { PublicProfileDTO } from "@/types/PublicProfileDTO"; // 👈 sørg for denne finnes
import CheckboxField from "./CheckboxField";

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

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      language,
      recieveEmailNotifications: receiveEmails,
      recievePushNotifications: receivePush,
      publicProfile,
      showGender,
      showEmail,
      showPhone,
      showRegion,
      showPostalCode,     // ✅ NY
      showStats,          // ✅ NY
      showWebsites
    });
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-xl font-semibold mb-4">Additional Preferences</h2>

      <div className="flex flex-col gap-4">
        <label className="text-left">
          <span className="font-medium">Language:</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full mt-1 px-4 py-2 rounded-md border bg-white text-black"
          >
            <option value="en">English</option>
            <option value="no">Norwegian-NOTIMPLIMENTED YET</option>
            <option value="es">Spanish-NOTIMPLIMENTED YET</option>
            <option value="de">German-NOTIMPLIMENTED YET</option>
          </select>
        </label>
        
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

        <FormButton
          text={saving ? "Saving..." : success ? "Saved ✅" : "Save Preferences"}
          onClick={handleSave}
          type="button"
          disabled={saving}
          className="w-fit mt-2"
        />
      </div>
    </div>
  );
}
