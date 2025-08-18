import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from "react-native";
import { PublicProfileDTO } from "@shared/types/PublicProfileDTO";
import CheckboxFieldNative from "./CheckboxFieldNative";
import ButtonNative from "../common/buttons/ButtonNative";
import CloseButtonNative from "../common/buttons/CloseButtonNative";

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

const languageOptions = [
  { label: "English", value: "en" },
  { label: "Norwegian - NOT IMPLEMENTED YET", value: "no" },
  { label: "Spanish - NOT IMPLEMENTED YET", value: "es" },
  { label: "German - NOT IMPLEMENTED YET", value: "de" },
];

export default function AdditionalSettingsNative({ initialValues, onSave }: Props) {
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
  const [showAge, setShowAge] = useState(booleanOrFalse(initialValues.showAge));
  const [showBirthday, setShowBirthday] = useState(booleanOrFalse(initialValues.showBirthday));

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // Check if this is EditProfile context (no language setting)
  const isEditProfile = !("language" in initialValues);

  const handleSave = async () => {
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
      setSuccess(true);
      Alert.alert("Success", "Settings saved successfully!");
    } catch (err) {
      console.error("❌ Kunne ikke lagre innstillinger:", err);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  const handleLanguageSelect = (selectedLanguage: string) => {
    setLanguage(selectedLanguage);
    setShowLanguagePicker(false);
  };

  const getLanguageLabel = (value?: string) => {
    const option = languageOptions.find(opt => opt.value === value);
    return option ? option.label : "Select language";
  };

  // Initialize values from props
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
      setShowAge(booleanOrFalse(initialValues.showAge));
      setShowBirthday(booleanOrFalse(initialValues.showBirthday));

      setHasInitialized(true);
    }
  }, [initialValues, hasInitialized]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isEditProfile ? "Profile Settings" : "Additional Settings"}
      </Text>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Language Picker (only in full settings, not edit profile) */}
        {"language" in initialValues && (
          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>Language:</Text>
            <TouchableOpacity
              style={styles.languagePicker}
              onPress={() => setShowLanguagePicker(true)}
            >
              <Text style={styles.languagePickerText}>
                {getLanguageLabel(language)}
              </Text>
              <Text style={styles.languagePickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Checkbox Settings */}
        <View style={styles.checkboxContainer}>
          {"recieveEmailNotifications" in initialValues && (
            <CheckboxFieldNative 
              label="Receive occasional emails" 
              checked={receiveEmails} 
              onChange={setReceiveEmails} 
            />
          )}
          
          {"recievePushNotifications" in initialValues && (
            <CheckboxFieldNative 
              label="Allow push notifications" 
              checked={receivePush} 
              onChange={setReceivePush} 
            />
          )}
          
          {"publicProfile" in initialValues && (
            <CheckboxFieldNative 
              label="Make my profile public" 
              checked={publicProfile} 
              onChange={setPublicProfile} 
            />
          )}
          
          {"showGender" in initialValues && (
            <CheckboxFieldNative 
              label="Show gender on profile" 
              checked={showGender} 
              onChange={setShowGender} 
            />
          )}
          
          {"showEmail" in initialValues && (
            <CheckboxFieldNative 
              label="Show email on profile" 
              checked={showEmail} 
              onChange={setShowEmail} 
            />
          )}
          
          {"showPhone" in initialValues && (
            <CheckboxFieldNative 
              label="Show phone number on profile" 
              checked={showPhone} 
              onChange={setShowPhone} 
            />
          )}
          
          {"showRegion" in initialValues && (
            <CheckboxFieldNative 
              label="Show region on profile" 
              checked={showRegion} 
              onChange={setShowRegion} 
            />
          )}
          
          {"showPostalCode" in initialValues && (
            <CheckboxFieldNative 
              label="Show postal code on profile" 
              checked={showPostalCode} 
              onChange={setShowPostalCode} 
            />
          )}
          
          {"showStats" in initialValues && (
            <CheckboxFieldNative 
              label="Show stats on profile" 
              checked={showStats} 
              onChange={setShowStats} 
            />
          )}
          
          {"showWebsites" in initialValues && (
            <CheckboxFieldNative 
              label="Show websites on profile" 
              checked={showWebsites} 
              onChange={setShowWebsites} 
            />
          )}
          
          {"showAge" in initialValues && (
            <CheckboxFieldNative 
              label="Show age on profile" 
              checked={showAge} 
              onChange={setShowAge} 
            />
          )}
          
          {"showBirthday" in initialValues && (
            <CheckboxFieldNative 
              label="Show birthday on profile" 
              checked={showBirthday} 
              onChange={setShowBirthday} 
            />
          )}
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <ButtonNative
            text={saving ? "Saving..." : success ? "Saved ✅" : "Save Preferences"}
            onPress={handleSave}
            variant="primary"
            size="large"
            fullWidth
            loading={saving}
            disabled={saving}
          />
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <SafeAreaView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Language</Text>
                <CloseButtonNative 
                  onPress={() => setShowLanguagePicker(false)}
                  theme="light"
                  size={32}
                  iconSize={16}
                />
              </View>
              
              <ScrollView style={styles.languageOptionsList}>
                {languageOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.languageOptionItem,
                      language === option.value && styles.languageOptionItemSelected
                    ]}
                    onPress={() => handleLanguageSelect(option.value)}
                  >
                    <Text style={[
                      styles.languageOptionText,
                      language === option.value && styles.languageOptionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                    {language === option.value && (
                      <Text style={styles.languageOptionCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopWidth: 2,
    borderTopColor: '#1C6B1C',
    minHeight: 300,
  },
  
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C6B1C',
    textAlign: 'center',
    marginBottom: 24,
  },
  
  scrollView: {
    flex: 1,
  },
  
  languageSection: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  
  languageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  
  languagePicker: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
  },
  
  languagePickerText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
    paddingRight: 12,
  },
  
  languagePickerArrow: {
    fontSize: 12,
    color: '#6b7280',
    paddingLeft: 8,
  },
  
  checkboxContainer: {
    gap: 8,
    marginBottom: 32,
  },
  
  saveButtonContainer: {
    paddingTop: 16,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 20,
    minHeight: 300,
    maxHeight: '70%',
    width: '90%',
    maxWidth: 400,
  },
  
  modalContent: {
    flex: 1,
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 60,
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  
  languageOptionsList: {
    flex: 1,
    minHeight: 200,
  },
  
  languageOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 50,
  },
  
  languageOptionItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  
  languageOptionText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  
  languageOptionTextSelected: {
    color: '#1C6B1C',
    fontWeight: '500',
  },
  
  languageOptionCheckmark: {
    fontSize: 16,
    color: '#1C6B1C',
    fontWeight: 'bold',
  },
});