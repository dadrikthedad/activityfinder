import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import ButtonNative from '@/components/common/buttons/ButtonNative';
import SelectModalNative from '@/components/common/modal/SelectModalNative';
import CloseButtonNative from '@/components/common/buttons/CloseButtonNative';
import { useSubmitBugReport } from '@/hooks/support/useSubmitBugReport';
import { useSubmitUserReport } from '@/hooks/support/useSubmitUserReport';
import { useSubmitCustomReport } from '@/hooks/support/useSubmitCustomReport';
import { ReportTypeEnum, PriorityEnum } from '@shared/types/report/reportEnums';
import { RootStackParamList } from '@/types/navigation';
import { getBrowserInfo } from '@/services/support/supportService';
type ReportScreenRouteProp = RouteProp<RootStackParamList, 'ReportScreen'>;
type ReportScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ReportScreen'>;

interface ReportScreenParams {
  type?: 'bug' | 'user';
  userId?: string;
  userName?: string;
}

export default function ReportScreen() {
  const route = useRoute<ReportScreenRouteProp>();
  const navigation = useNavigation<ReportScreenNavigationProp>();
  
  // Get params with defaults
  const { type, userId, userName } = route.params || {};
  
  // Form state
  const [reportType, setReportType] = useState<ReportTypeEnum>(
    type === 'bug' ? ReportTypeEnum.BugReport : 
    type === 'user' ? ReportTypeEnum.UserReport : 
    ReportTypeEnum.Other
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityEnum>(PriorityEnum.Medium);
  const [isDetailedMode, setIsDetailedMode] = useState(false);
  
  // Detailed form fields
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  
  // Hooks for submissions
  const bugReportHook = useSubmitBugReport();
  const userReportHook = useSubmitUserReport();
  const customReportHook = useSubmitCustomReport();
  
  const isSubmitting = bugReportHook.isSubmitting || userReportHook.isSubmitting || customReportHook.isSubmitting;
  const submitError = bugReportHook.error || userReportHook.error || customReportHook.error;

  // Set initial title based on type
  useEffect(() => {
    if (type === 'user' && userName) {
      setTitle(`Report: ${userName}`);
    } else if (type === 'bug') {
      setTitle('Bug Report');
    }
  }, [type, userName]);

  // Options for dropdowns
  const reportTypeOptions = [
    { label: 'Bug Report', value: ReportTypeEnum.BugReport.toString() },
    { label: 'User Report', value: ReportTypeEnum.UserReport.toString() },
    { label: 'Feature Request', value: ReportTypeEnum.FeatureRequest.toString() },
    { label: 'Other', value: ReportTypeEnum.Other.toString() },
  ];

  const priorityOptions = [
    { label: 'Low', value: PriorityEnum.Low.toString() },
    { label: 'Medium', value: PriorityEnum.Medium.toString() },
    { label: 'High', value: PriorityEnum.High.toString() },
    { label: 'Critical', value: PriorityEnum.Critical.toString() },
  ];

  // Get selected option labels
  const getReportTypeLabel = () => {
    const option = reportTypeOptions.find(opt => opt.value === reportType.toString());
    return option?.label || 'Select Type';
  };

  const getPriorityLabel = () => {
    const option = priorityOptions.find(opt => opt.value === priority.toString());
    return option?.label || 'Select Priority';
  };

  // Validation
  const isFormValid = () => {
    return title.trim().length >= 3 && description.trim().length >= 10;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!isFormValid()) {
      Alert.alert('Error', 'Please fill in both title (min 3 characters) and description (min 10 characters)');
      return;
    }

    try {
      if (reportType === ReportTypeEnum.BugReport) {
        // Use bug report hook with auto browser info
        await bugReportHook.submitBugReport(
          title,
          description,
          isDetailedMode ? stepsToReproduce : undefined,
          isDetailedMode ? expectedBehavior : undefined,
          isDetailedMode ? actualBehavior : undefined,
          priority
        );
      } else if (reportType === ReportTypeEnum.UserReport && userId) {
        // Use user report hook
        await userReportHook.submitUserReport(
          title,
          description,
          userId,
          priority
        );
      } else {
        // Use custom report hook for other types
        const browserInfo = await getBrowserInfo();
        await customReportHook.submitCustomReport({
          type: reportType,
          title,
          description,
          priority,
          stepsToReproduce: isDetailedMode ? stepsToReproduce : undefined,
          expectedBehavior: isDetailedMode ? expectedBehavior : undefined,
          actualBehavior: isDetailedMode ? actualBehavior : undefined,
          reportedUserId: reportType === ReportTypeEnum.UserReport ? userId : undefined,
          ...browserInfo
        });
      }

      Alert.alert(
        'Success',
        'Your report has been submitted successfully. We will review it and get back to you.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {type === 'bug' ? 'Report Bug' : 
             type === 'user' ? `Report User` : 
             'Submit Report'}
          </Text>
          <CloseButtonNative 
            onPress={() => navigation.goBack()}
            theme="light"
            size={32}
            iconSize={16}
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Form Mode Toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Report Mode</Text>
            <View style={styles.modeToggle}>
              <ButtonNative
                text="Quick Report"
                variant={!isDetailedMode ? "primary" : "outline"}
                size="small"
                onPress={() => setIsDetailedMode(false)}
                style={styles.modeButton}
              />
              <ButtonNative
                text="Detailed Report"
                variant={isDetailedMode ? "primary" : "outline"}
                size="small"
                onPress={() => setIsDetailedMode(true)}
                style={styles.modeButton}
              />
            </View>
            <Text style={styles.modeDescription}>
              {isDetailedMode 
                ? "Include additional details to help us better understand the issue"
                : "Quick and simple - just title and description"
              }
            </Text>
          </View>

          {/* Report Type (if not preset) */}
          {!type && (
            <View style={styles.section}>
              <Text style={styles.label}>Report Type *</Text>
              <SelectModalNative
                title="Select Report Type"
                options={reportTypeOptions}
                selectedValue={reportType.toString()}
                onSelect={(value) => setReportType(parseInt(value) as ReportTypeEnum)}
                customTrigger={
                  <View style={styles.selectTrigger}>
                    <Text style={styles.selectText}>{getReportTypeLabel()}</Text>
                    <Text style={styles.selectArrow}>▼</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Brief description of the issue"
              maxLength={200}
              autoCapitalize="sentences"
            />
            <Text style={styles.charCount}>{title.length}/200</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Provide a detailed description of the issue or concern"
              maxLength={5000}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoCapitalize="sentences"
            />
            <Text style={styles.charCount}>{description.length}/5000</Text>
          </View>

          {/* Detailed Fields (only in detailed mode) */}
          {isDetailedMode && (
            <>
              {/* Priority */}
              <View style={styles.section}>
                <Text style={styles.label}>Priority</Text>
                <SelectModalNative
                  title="Select Priority"
                  options={priorityOptions}
                  selectedValue={priority.toString()}
                  onSelect={(value) => setPriority(parseInt(value) as PriorityEnum)}
                  customTrigger={
                    <View style={styles.selectTrigger}>
                      <Text style={styles.selectText}>{getPriorityLabel()}</Text>
                      <Text style={styles.selectArrow}>▼</Text>
                    </View>
                  }
                />
              </View>

              {/* Bug-specific fields */}
              {reportType === ReportTypeEnum.BugReport && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.label}>Steps to Reproduce</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={stepsToReproduce}
                      onChangeText={setStepsToReproduce}
                      placeholder="1. Go to..."
                      maxLength={2000}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.label}>Expected Behavior</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={expectedBehavior}
                      onChangeText={setExpectedBehavior}
                      placeholder="What should have happened?"
                      maxLength={1000}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.label}>Actual Behavior</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={actualBehavior}
                      onChangeText={setActualBehavior}
                      placeholder="What actually happened?"
                      maxLength={1000}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                </>
              )}
            </>
          )}

          {/* User Info (for user reports) */}
          {type === 'user' && userName && (
            <View style={styles.section}>
              <Text style={styles.label}>Reporting User</Text>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{userName}</Text>
                <Text style={styles.userIdText}>ID: {userId}</Text>
              </View>
            </View>
          )}

          {/* Error Display */}
          {submitError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {submitError.message || 'An error occurred while submitting the report'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <ButtonNative
            text={isSubmitting ? "Submitting..." : "Submit Report"}
            onPress={handleSubmit}
            variant="primary"
            size="large"
            fullWidth
            disabled={!isFormValid() || isSubmitting}
            loading={isSubmitting}
            loadingText="Submitting..."
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 120,
    maxHeight: 200,
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
  },
  modeDescription: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  selectTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  selectText: {
    fontSize: 16,
    color: '#111827',
  },
  selectArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  userInfo: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  userIdText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
});