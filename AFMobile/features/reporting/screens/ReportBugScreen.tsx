import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { ArrowLeft } from "lucide-react-native";
import { useSubmitBugReport } from "../hooks/useSubmitBugReport";
import { ReportAttachmentSection } from "../components/ReportAttachmentSection";
import AppHeader from "@/components/common/AppHeader";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import FormFieldNative from "@/components/common/FormFieldNative";

export default function ReportBugScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();

  const {
    title,
    setTitle,
    description,
    setDescription,
    stepsToReproduce,
    setStepsToReproduce,
    expectedBehavior,
    setExpectedBehavior,
    actualBehavior,
    setActualBehavior,
    isSubmitting,
    submit,
    attachments,
  } = useSubmitBugReport({ onSuccess: () => navigation.goBack() });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t("bug.title")}
        onBackPress={() => navigation.goBack()}
        backIcon={ArrowLeft}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tittel */}
        <FormFieldNative
          id="title"
          label={t("bug.titleLabel")}
          value={title}
          onChangeText={setTitle}
          placeholder={t("bug.titlePlaceholder")}
          maxLength={200}
          error={title.length > 0 && !title.trim() ? t("bug.validationTitleRequired") : undefined}
          touched={title.length > 0}
        />

        {/* Beskrivelse */}
        <View>
          <FormFieldNative
            id="description"
            label={t("bug.descriptionLabel")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("bug.descriptionPlaceholder")}
            multiline
            numberOfLines={5}
            maxLength={2000}
            error={description.length > 0 && description.length < 10 ? t("bug.validationDescriptionMin") : undefined}
            touched={description.length > 0}
          />
          <Text
            style={{
              fontSize: theme.typography.xs,
              color: description.length > 1800 ? theme.colors.error : theme.colors.textMuted,
              textAlign: "right",
              marginTop: -theme.spacing.sm,
            }}
          >
            {description.length}/2000
          </Text>
        </View>

        {/* Steg for å gjenskape */}
        <FormFieldNative
          id="stepsToReproduce"
          label={t("bug.stepsLabel")}
          value={stepsToReproduce}
          onChangeText={setStepsToReproduce}
          placeholder={t("bug.stepsPlaceholder")}
          multiline
          numberOfLines={3}
        />

        {/* Forventet oppførsel */}
        <FormFieldNative
          id="expectedBehavior"
          label={t("bug.expectedLabel")}
          value={expectedBehavior}
          onChangeText={setExpectedBehavior}
          multiline
          numberOfLines={2}
        />

        {/* Faktisk oppførsel */}
        <FormFieldNative
          id="actualBehavior"
          label={t("bug.actualLabel")}
          value={actualBehavior}
          onChangeText={setActualBehavior}
          multiline
          numberOfLines={2}
        />

        <ReportAttachmentSection
          attachments={attachments.attachments}
          canAddMore={attachments.canAddMore}
          onRemove={attachments.removeAttachment}
          onFilesSelected={attachments.addAttachments}
          label={t("bug.attachmentsLabel")}
          addButtonText={t("bug.addAttachment")}
          limitText={t("bug.attachmentLimit")}
        />

        {/* Send-knapp */}
        <ButtonNative
          text={isSubmitting ? t("bug.submitting") : t("bug.submit")}
          onPress={submit}
          disabled={isSubmitting}
          variant="primary"
          size="large"
          fullWidth
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
