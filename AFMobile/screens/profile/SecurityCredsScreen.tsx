import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import EditableEmailFieldNative from "@/components/settings/EditableEmailFieldNative";
import EditablePasswordFieldsNative from "@/components/settings/EditablePasswordFieldsNative";
import AppHeader from "@/components/common/AppHeader";
import { useFullCurrentUser } from "@/hooks/useCurrentUser";
import { useNavigation } from "@react-navigation/native";

export default function SecurityCredsScreen() {
  const { user, loading, error } = useFullCurrentUser();
  const [email, setEmail] = useState<string | null>(null);
  const navigation = useNavigation();

  // Check if email matches
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1C6B1C" />
          <Text style={styles.loadingText}>Loading login credentials...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Security Settings"
        subtitle="Change your login credentials"
        onBackPress={handleGoBack}
        backIcon={ArrowLeft}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.fieldsContainer}>
            <EditableEmailFieldNative
              email={email ?? ""}
              onEmailUpdated={(newEmail) => setEmail(newEmail)}
            />
            <EditablePasswordFieldsNative />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
 
  scrollView: {
    flex: 1,
  },
 
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'center',
  },
 
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
 
  fieldsContainer: {
    width: '100%',
    maxWidth: 600,
  },
 
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
 
  loadingText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
 
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
 
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    lineHeight: 24,
  },
});