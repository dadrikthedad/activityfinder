// features/dev/screens/DevUserListScreen.tsx
// Kun Development — lister alle brukere og lar deg logge inn som hvem som helst.
import React from "react";
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { ChevronLeft } from "lucide-react-native";
import { useDevLogin } from "@/features/dev/hooks/useDevLogin";
import { DevUserDTO } from "@/features/dev/models/DevUserDTO";
import { RootStackNavigationProp } from "@/types/navigation";

export default function DevUserListScreen() {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { users, isLoading, loggingInUserId, errorMessage, handleSelectUser } = useDevLogin();

  const renderItem = ({ item }: { item: DevUserDTO }) => {
    const isBusy = loggingInUserId === item.id;
    const isLocked = loggingInUserId !== null;
    return (
      <TouchableOpacity
        onPress={() => handleSelectUser(item)}
        disabled={isLocked}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          opacity: isLocked && !isBusy ? 0.5 : 1,
        }}
      >
        <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
          <Text style={{
            fontSize: theme.typography.md,
            fontWeight: theme.typography.semibold,
            color: theme.colors.textPrimary,
          }}>
            {item.fullName || t("dev.noName")}
          </Text>
          <Text style={{
            fontSize: theme.typography.sm,
            color: theme.colors.textSecondary,
            marginTop: 2,
          }}>
            {item.email}
          </Text>
        </View>
        {isBusy && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        backgroundColor: theme.colors.navbar,
      }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color={theme.colors.navbarText} />
        </TouchableOpacity>
        <View>
          <Text style={{
            fontSize: theme.typography.lg,
            fontWeight: theme.typography.bold,
            color: theme.colors.navbarText,
          }}>
            {t("dev.title")}
          </Text>
          <Text style={{ fontSize: theme.typography.xs, color: theme.colors.textMuted }}>
            {t("dev.subtitle")}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : errorMessage ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg }}>
          <Text style={{ fontSize: theme.typography.md, color: theme.colors.error, textAlign: "center" }}>
            {errorMessage}
          </Text>
        </View>
      ) : (
        <FlashList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={{ padding: theme.spacing.xl, alignItems: "center" }}>
              <Text style={{ fontSize: theme.typography.md, color: theme.colors.textSecondary }}>
                {t("dev.noUsers")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
