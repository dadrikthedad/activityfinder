"use client";

import React, { useState } from "react";
import FormButton from "@/components/FormButton";
import { UserSettingsDTO } from "@/types/settings"; // 👈 sørg for denne finnes

interface Props {
  initialValues: Pick<
    UserSettingsDTO,
    "language" | "recieveEmailNotifications" | "recievePushNotifications"
  >;
  onSave: (updated: Partial<UserSettingsDTO>) => Promise<void>;
}

export default function AdditionalSettings({ initialValues, onSave }: Props) {
  const [language, setLanguage] = useState(initialValues.language);
  const [receiveEmails, setReceiveEmails] = useState(initialValues.recieveEmailNotifications);
  const [receivePush, setReceivePush] = useState(initialValues.recievePushNotifications);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      language,
      recieveEmailNotifications: receiveEmails,
      recievePushNotifications: receivePush,
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

        <label className="text-left flex items-center gap-2">
          <input
            type="checkbox"
            checked={receiveEmails}
            onChange={(e) => setReceiveEmails(e.target.checked)}
          />
          Receive occasional emails
        </label>

        <label className="text-left flex items-center gap-2">
          <input
            type="checkbox"
            checked={receivePush}
            onChange={(e) => setReceivePush(e.target.checked)}
          />
          Allow push notifications
        </label>

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
