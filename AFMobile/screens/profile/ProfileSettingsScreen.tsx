import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfileSettingsScreenNavigationProp } from '@/types/navigation';

// Import your custom hooks (you'll need to adapt these from web to React Native)
import { useCountryAndRegion } from '@/hooks/useCountryAndRegion';
import { useFormHandlers } from '@/hooks/useFormHandlers';
import { useUpdateUserField } from '@/hooks/useUpdateUserField';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useUpdateUserSettings } from '@/hooks/useUpdateUserSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// Import your React Native components (you'll need to create these)
import EditableFieldNative from '@/components/settings/EditableFieldNative';
import EditableSelectFieldNative from '@/components/settings/EditableSelectFieldNative';
import EditableCountryRegionGroupNative from '@/components/settings/EditableCountryRegionGroupNative';
import AdditionalSettingsNative from '@/components/settings/AdditionalSettingsNative';
import ButtonNative from '@/components/common/buttons/ButtonNative';

// Import toast functionality
import { showNotificationToastNative } from '@/components/toast/NotificationToastNative';// Adjust path as needed
import { LocalToastType } from '@/components/toast/NotificationToastNative';// Adjust path as needed

export default function ProfileSettingsScreen() {
  const navigation = useNavigation<ProfileSettingsScreenNavigationProp>();
  const currentUser = useCurrentUser(); // Hent current user fra store
  const { updateSettings } = useUpdateUserSettings();
  const [refreshIndex, setRefreshIndex] = useState(0);
  
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

  const {
    countries,
    regions,
    countryCodes,
    fetchRegionsForCountry,
  } = useCountryAndRegion({
    country: formData.country,
    setFormData,
  });

  const { updateField, error, success } = useUpdateUserField();
  const { settings, loading } = useUserSettings(refreshIndex);

  useEffect(() => {
    if (settings) {
      console.log("👤 Innlogget bruker-ID:", settings.userId);
      console.log("🧠 Hele settings-objektet:", settings);
    }
  }, [settings]);

  useEffect(() => {
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

  // Show success message using Toast instead of Alert
  useEffect(() => {
    if (success) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Success",
        customBody: "Changes saved successfully! ✅",
        position: 'top'
      });
    }
  }, [success]);

  // Show error message using Toast instead of Alert
  useEffect(() => {
    if (error) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Error",
        customBody: error,
        position: 'top'
      });
    }
  }, [error]);

  if (loading || !settings) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1C6B1C" />
        <Text style={styles.loadingText}>Loading profile settings...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Edit Profile</Text>
        </View>

        <View style={styles.formContainer}>
          <EditableFieldNative
            name="firstName"
            label="First Name:"
            value={formData.firstName}
            onSave={async (val) => {
              await updateField("updateFirstName", val);
              setFormData((prev) => ({ ...prev, firstName: val }));
            }}
          />

          <EditableFieldNative
            name="middleName"
            label="Middle Name:"
            value={formData.middleName || ""}
            onSave={async (val) => {
              await updateField("updateMiddleName", val);
              setFormData((prev) => ({ ...prev, middleName: val }));
            }}
          />

          <EditableFieldNative
            name="lastName"
            label="Last Name:"
            value={formData.lastName}
            onSave={async (val) => {
              await updateField("updateLastName", val);
              setFormData((prev) => ({ ...prev, lastName: val }));
            }}
          />

          <EditableFieldNative
            name="phone"
            label="Phone:"
            value={formData.phone || ""}
            onSave={async (val) => {
              await updateField("updatePhone", val);
              setFormData((prev) => ({ ...prev, phone: val }));
            }}
          />
          
          <EditableCountryRegionGroupNative
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
              setFormData((prev) => ({
                ...prev,
                country: settings?.country || "",
                region: settings?.region || "",
              }));
            }}
          />

          <EditableFieldNative
            name="postalCode"
            label="Postal Code:"
            value={formData.postalCode || ""}
            onSave={async (val) => {
              await updateField("updatePostalCode", val);
              setFormData((prev) => ({ ...prev, postalCode: val }));
            }}
          />

          <EditableSelectFieldNative
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

          <EditableFieldNative
            name="contactPhone"
            label="Contact Phone:"
            value={formData.phone || ""}
            onSave={async (val) => {
              await updateField("updateContactPhone", val);
              setFormData((prev) => ({ ...prev, phone: val }));
            }}
          />
          <Text style={styles.helpText}>
            Will be visible on your profile if Show phone is checked below.
          </Text>

          <EditableFieldNative
            name="contactEmail"
            label="Contact Email:"
            value={formData.email || ""}
            onSave={async (val) => {
              await updateField("updateContactEmail", val);
              setFormData((prev) => ({ ...prev, email: val }));
            }}
          />
          <Text style={styles.helpText}>
            Will be visible on your profile if Show Email is checked below. Try to avoid giving away your login info.
          </Text>
        </View>

        <View style={styles.navigationButtons}>
            {currentUser?.user?.userId && (
                <ButtonNative
                text="Back to Profile"
                onPress={() => {
                    const userId = currentUser.user?.userId;
                    if (userId) {
                    navigation.navigate('Profile', { id: userId.toString() });
                    }
                }}
                variant="secondary"
                size="large"
                fullWidth
                />
            )}

            <ButtonNative
                text="Change Login Credentials"
                onPress={() => navigation.navigate('SecurityCredsScreen')}
                variant="primary"
                size="large"
                fullWidth
            />
            </View>

        {settings ? (
          <AdditionalSettingsNative
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
              setRefreshIndex((prev) => prev + 1);
            }}
          />
        ) : (
          <Text style={styles.loadingText}>Loading settings...</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C6B1C',
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 24,
    gap: 24,
  },
  helpText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  navigationButtons: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 48,
    marginBottom: 32,
    paddingHorizontal: 24,
  },
});