// screens/main/HomeScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { HomeScreenNavigationProp } from "@shared/types/navigation";
import { useNavigation } from "@react-navigation/native";

export default function HomeScreen() {
  const { userId } = useAuth(); // Removed logout since navbar handles it
  const navigation = useNavigation<HomeScreenNavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>
            Welcome!
          </Text>
          <Text style={styles.subtitle}>
            You are now logged in to ActivityFinder
          </Text>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ready to explore!</Text>
            <Text style={styles.cardText}>
              Your ActivityFinder mobile app is ready to use. Start discovering 
              activities and making the most of your time.
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <ButtonNative
              text="Find Activities"
              variant="primary"
              size="large"
              fullWidth
              onPress={() => {
                // Navigate to activities screen
                console.log("Navigate to activities");
              }}
              style={styles.actionButton}
            />

            <ButtonNative
              text="My Profile"
              variant="outline"
              size="large"
              fullWidth
              onPress={() => {
                // Navigate to profile screen
                console.log("Navigate to profile");
              }}
              style={styles.actionButton}
            />

            <ButtonNative
              text="Settings"
              variant="secondary"
              size="medium"
              fullWidth
              onPress={() => {
                // Navigate to settings screen
                console.log("Navigate to settings");
              }}
              style={styles.actionButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    paddingVertical: 40,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1C6B1C",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    color: "#6b7280",
    lineHeight: 24,
  },
  actionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
});