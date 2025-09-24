import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';

interface TestScreenProps {
  navigation: any; // Replace with proper navigation type
}

export const TestScreen: React.FC<TestScreenProps> = ({ navigation }) => {
  const testCategories = [
    {
      title: '🔐 Crypto & E2EE Tests',
      description: 'Test encryption, backup phrases, and key management',
      screen: 'CryptoTestScreen',
      color: '#1C6B1C',
    },
    {
      title: '🌐 API Tests', 
      description: 'Test API endpoints and network functionality',
      screen: 'APITestScreen',
      color: '#2563eb',
      disabled: true, // Not implemented yet
    },
    {
      title: '🎨 UI Component Tests',
      description: 'Test UI components and styling',
      screen: 'UITestScreen', 
      color: '#7c3aed',
      disabled: true, // Not implemented yet
    },
    {
      title: '🧭 Navigation Tests',
      description: 'Test navigation flows and deep links',
      screen: 'NavigationTestScreen',
      color: '#dc2626',
      disabled: true, // Not implemented yet
    },
  ];

  const handleNavigateToTest = (screen: string, disabled?: boolean) => {
    if (disabled) {
      console.log(`${screen} not implemented yet`);
      return;
    }
    navigation.navigate(screen);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🧪 Development Test Hub</Text>
          <Text style={styles.subtitle}>
            Choose a test category to explore - Remove in production
          </Text>
        </View>

        {/* Test Categories */}
        <View style={styles.categoriesContainer}>
          {testCategories.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.categoryButton,
                { backgroundColor: category.disabled ? '#9ca3af' : category.color }
              ]}
              onPress={() => handleNavigateToTest(category.screen, category.disabled)}
              disabled={category.disabled}
            >
              <View style={styles.categoryContent}>
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
                {category.disabled && (
                  <Text style={styles.disabledText}>Coming Soon</Text>
                )}
              </View>
              <Text style={styles.categoryArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Quick Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>1</Text>
              <Text style={styles.statLabel}>Active Tests</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Coming Soon</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ⚠️ This screen is for development only and should be disabled in production builds
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  categoriesContainer: {
    gap: 16,
    marginBottom: 32,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C6B1C',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#e5e7eb',
    lineHeight: 20,
  },
  disabledText: {
    fontSize: 12,
    color: '#d1d5db',
    fontStyle: 'italic',
    marginTop: 4,
  },
  categoryArrow: {
    fontSize: 24,
    color: '#ffffff',
    marginLeft: 16,
  },
  statsContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C6B1C',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  footerText: {
    fontSize: 12,
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '500',
  },
});