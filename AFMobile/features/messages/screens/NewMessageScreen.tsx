// features/messages/screens/NewMessageScreen.tsx
// Ny samtale: søk etter mottaker(e), evt. gruppe-oppsett, og send kryptert førstemelding.
// View-laget — all logikk ligger i useNewMessage / useNewMessageSearch.

import React, { useRef } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { ArrowLeft } from "lucide-react-native";
import { useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import AppHeader from "@/components/common/AppHeader";
import { NewMessageScreenRouteProp, RootStackNavigationProp } from "@/types/navigation";
import { UserSearchResultDTO } from "../models/UserSearchResultDTO";
import { useNewMessage } from "../hooks/useNewMessage";
import { useNewMessageSearch } from "../hooks/useNewMessageSearch";
import SearchResultItem from "../components/SearchResultItem";
import SelectedUserChip from "../components/SelectedUserChip";
import GroupImagePicker from "../components/GroupImagePicker";
import NewMessageComposer from "../components/NewMessageComposer";

export default function NewMessageScreen() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<NewMessageScreenRouteProp>();
  const initialReceiver = route.params?.initialReceiver;

  const searchInputRef = useRef<TextInput>(null);
  const { query, setQuery, results, loading } = useNewMessageSearch();
  const {
    selectedUsers,
    groupName,
    setGroupName,
    groupImage,
    setGroupImage,
    isPresetMode,
    isGroupMode,
    isSubmitting,
    addUser,
    removeUser,
    submit,
  } = useNewMessage({ initialReceiver });

  const filteredResults = results.filter(
    (user) => !selectedUsers.some((u) => u.id === user.id),
  );

  const handleAddUser = (user: UserSearchResultDTO) => {
    addUser(user);
    setQuery("");
    searchInputRef.current?.focus();
  };

  const sectionTitleStyle = {
    fontSize: theme.typography.md,
    fontWeight: theme.typography.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  } as const;

  const ListHeader = (
    <View>
      {/* Søkefelt — skjult i preset-modus (mottaker er forhåndsvalgt) */}
      {!isPresetMode && (
        <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md }}>
          <TextInput
            ref={searchInputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t("newMessage.searchPlaceholder")}
            placeholderTextColor={theme.colors.textPlaceholder}
            selectionColor={theme.colors.primary}
            autoFocus
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              fontSize: theme.typography.md,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.backgroundInput,
            }}
          />
        </View>
      )}

      {/* Valgte mottakere */}
      {selectedUsers.length > 0 && (
        <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          <Text style={sectionTitleStyle}>
            {isGroupMode ? t("newMessage.groupMembers") : t("newMessage.to")} ({selectedUsers.length})
          </Text>
          <FlashList
            horizontal
            data={selectedUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SelectedUserChip
                user={item}
                removable={!(isPresetMode && item.id === initialReceiver?.id)}
                onRemove={removeUser}
              />
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* Gruppe-oppsett */}
      {isGroupMode && (
        <>
          <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.lg }}>
            <Text style={sectionTitleStyle}>{t("newMessage.groupNameLabel")}</Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder={t("newMessage.groupNamePlaceholder")}
              placeholderTextColor={theme.colors.textPlaceholder}
              selectionColor={theme.colors.primary}
              maxLength={100}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                fontSize: theme.typography.md,
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.backgroundInput,
              }}
            />
          </View>
          <GroupImagePicker value={groupImage} onChange={setGroupImage} />
        </>
      )}

      {/* Resultat-header */}
      {!isPresetMode && query.trim().length >= 2 && (
        <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs }}>
          {loading && <Text style={{ color: theme.colors.textMuted }}>{t("newMessage.searching")}</Text>}
          {!loading && filteredResults.length === 0 && (
            <Text style={{ color: theme.colors.textMuted }}>{t("newMessage.noResults")}</Text>
          )}
          {!loading && filteredResults.length > 0 && (
            <Text style={sectionTitleStyle}>
              {t("newMessage.searchResults")} ({filteredResults.length})
            </Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <AppHeader
        title={
          isPresetMode && initialReceiver
            ? t("newMessage.presetTitle", { name: initialReceiver.fullName })
            : t("newMessage.title")
        }
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowLeft}
        showBorder
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
          <FlashList
            data={isPresetMode ? [] : filteredResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <SearchResultItem user={item} onPress={handleAddUser} />}
            ListHeaderComponent={ListHeader}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>

        {selectedUsers.length > 0 && (
          <NewMessageComposer isGroup={isGroupMode} isSubmitting={isSubmitting} onSend={submit} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
