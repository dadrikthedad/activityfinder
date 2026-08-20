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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useUnistyles } from "react-native-unistyles";
import { ArrowLeft } from "lucide-react-native";
import { RootStackParamList } from "@/types/navigation";
import { UserReportReason } from "../models/UserReportReason";
import { useSubmitReport } from "../hooks/useSubmitReport";
import { ReportAttachmentSection } from "../components/ReportAttachmentSection";
import AppHeader from "@/components/common/AppHeader";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import FormFieldNative from "@/components/common/FormFieldNative";

type ReportUserScreenRouteProp = RouteProp<RootStackParamList, "ReportUserScreen">;

const REASON_KEYS: { reason: UserReportReason; i18nKey: string }[] = [
  { reason: UserReportReason.Harassment,            i18nKey: "report.reasonHarassment" },
  { reason: UserReportReason.Spam,                  i18nKey: "report.reasonSpam" },
  { reason: UserReportReason.InappropriateContent,  i18nKey: "report.reasonInappropriateContent" },
  { reason: UserReportReason.Impersonation,         i18nKey: "report.reasonImpersonation" },
  { reason: UserReportReason.Scam,                  i18nKey: "report.reasonScam" },
  { reason: UserReportReason.HateSpeech,            i18nKey: "report.reasonHateSpeech" },
  { reason: UserReportReason.Threats,               i18nKey: "report.reasonThreats" },
  { reason: UserReportReason.MinorSafety,           i18nKey: "report.reasonMinorSafety" },
  { reason: UserReportReason.Other,                 i18nKey: "report.reasonOther" },
];

export default function ReportUserScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const route = useRoute<ReportUserScreenRouteProp>();
  const { reportedUserId, reportedUserName } = route.params ?? {};

  const [showReasonPicker, setShowReasonPicker] = React.useState(false);

  const { reason, setReason, description, setDescription, isSubmitting, submit, attachments } =
    useSubmitReport({
      reportedUserId: reportedUserId ?? "",
      onSuccess: () => navigation.goBack(),
    });

  const selectedLabel = reason
    ? t(REASON_KEYS.find((r) => r.reason === reason)!.i18nKey as any)
    : t("report.selectReason");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t("report.title")}
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
        {/* Undertittel med brukernavn */}
        {reportedUserName && (
          <Text style={{
            fontSize: theme.typography.lg,
            fontWeight: theme.typography.semibold,
            color: theme.colors.textPrimary,
            textAlign: "center",
          }}>
            {t("report.reporting")} {reportedUserName}
          </Text>
        )}

        {/* Årsak */}
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={{ fontSize: theme.typography.sm, color: theme.colors.textSecondary }}>
            {t("report.reasonLabel")}
          </Text>

          <TouchableOpacity
            onPress={() => setShowReasonPicker((v) => !v)}
            style={{
              borderWidth: 1,
              borderColor: reason ? theme.colors.borderFocus : theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              backgroundColor: theme.colors.backgroundInput,
            }}
          >
            <Text
              style={{
                color: reason ? theme.colors.textPrimary : theme.colors.textPlaceholder,
                fontSize: theme.typography.md,
              }}
            >
              {selectedLabel}
            </Text>
          </TouchableOpacity>

          {showReasonPicker && (
            <View
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surface,
                overflow: "hidden",
              }}
            >
              {REASON_KEYS.map(({ reason: r, i18nKey }) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => {
                    setReason(r);
                    setShowReasonPicker(false);
                  }}
                  style={{
                    padding: theme.spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                    backgroundColor: reason === r ? theme.colors.backgroundAlt : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: reason === r ? theme.colors.primary : theme.colors.textPrimary,
                      fontSize: theme.typography.md,
                      fontWeight:
                        reason === r ? theme.typography.semibold : theme.typography.regular,
                    }}
                  >
                    {t(i18nKey as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Beskrivelse */}
        <View>
          <FormFieldNative
            id="description"
            label={t("report.descriptionLabel")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("report.descriptionPlaceholder")}
            multiline
            numberOfLines={5}
            maxLength={2000}
            error={description.length > 0 && description.length < 10 ? t("report.validationDescriptionMin") : undefined}
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

        <ReportAttachmentSection
          attachments={attachments.attachments}
          canAddMore={attachments.canAddMore}
          onRemove={attachments.removeAttachment}
          onFilesSelected={attachments.addAttachments}
          label={t("report.attachmentsLabel")}
          addButtonText={t("report.addAttachment")}
          limitText={t("report.attachmentLimit")}
        />

        {/* Send-knapp */}
        <ButtonNative
          text={isSubmitting ? t("report.submitting") : t("report.submit")}
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

