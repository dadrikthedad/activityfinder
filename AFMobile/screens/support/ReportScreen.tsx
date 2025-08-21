import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft, Paperclip, X } from 'lucide-react-native';
import AppHeader from '@/components/common/AppHeader';
import ButtonNative from '@/components/common/buttons/ButtonNative';
import SelectModalNative from '@/components/common/modal/SelectModalNative';
import { AttachmentPicker } from '@/components/files/filepicker/AttachmentPicker';
import { useCompleteBugReport, useCompleteUserReport } from '@/hooks/support/useSpecializedCompleteHooks';
import { PriorityEnum } from '@shared/types/report/reportEnums';
import { RootStackParamList } from '@/types/navigation';
import { showNotificationToastNative, LocalToastType } from '@/components/toast/NotificationToastNative';
import { RNFile } from '@/utils/files/FileFunctions';

type ReportScreenRouteProp = RouteProp<RootStackParamList, 'ReportScreen'>;
type ReportScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ReportScreen'>;



export default function ReportScreen() {
  const route = useRoute<ReportScreenRouteProp>();
  const navigation = useNavigation<ReportScreenNavigationProp>();
  
  // Get params with defaults
  const { type, userId, userName } = route.params || {};
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityEnum>(PriorityEnum.Medium);
  const [isDetailedMode, setIsDetailedMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<RNFile[]>([]);
  
  // Detailed form fields
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  
  // Hooks for submissions
  const bugReportHook = useCompleteBugReport();
  const userReportHook = useCompleteUserReport();
  
  // Get current hook based on type
  const getCurrentHook = () => {
    return type === 'bug' ? bugReportHook : userReportHook;
  };
  
  const currentHook = getCurrentHook();
  const isSubmitting = currentHook.isProcessing;
  const submitError = currentHook.error;
  const currentStep = currentHook.currentStep;
  const uploadProgress = currentHook.uploadProgress;

  // Set initial title based on type
  useEffect(() => {
    if (type === 'user' && userName) {
      setTitle(`Report: ${userName}`);
    } else if (type === 'bug') {
      setTitle('Bug Report');
    }
  }, [type, userName]);

  // Get header title based on type
  const getHeaderTitle = () => {
    if (type === 'bug') return 'Report Bug';
    if (type === 'user') return 'Report User';
    return 'Submit Report';
  };

  // Options for priority dropdown
  const priorityOptions = [
    { label: 'Low', value: PriorityEnum.Low.toString() },
    { label: 'Medium', value: PriorityEnum.Medium.toString() },
    { label: 'High', value: PriorityEnum.High.toString() },
    { label: 'Critical', value: PriorityEnum.Critical.toString() },
  ];

  const getPriorityLabel = () => {
    const option = priorityOptions.find(opt => opt.value === priority.toString());
    return option?.label || 'Select Priority';
  };

  // File attachment handlers
  const handleFilesSelected = (files: RNFile[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
    console.log('📎 Files selected:', files.map(f => f.name));
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Validation
  const isFormValid = () => {
    const titleValid = title.trim().length >= 3;
    const descriptionValid = description.trim().length >= 10;
    return titleValid && descriptionValid;
  };

  // Handle submit
  const handleSubmit = async () => {
    console.log('Submit button pressed');
    console.log('Form validation result:', isFormValid());
    
    if (!isFormValid()) {
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Validation Error",
        customBody: "Please fill in both title and description (min 10 characters)",
        position: 'top'
      });
      return;
    }

    try {
      let result;

      if (type === 'bug') {
        console.log('Submitting bug report with attachments...');
        result = await bugReportHook.submitBugReportWithAttachments(
          title,
          description,
          selectedFiles, // Attachments
          isDetailedMode ? stepsToReproduce : undefined,
          isDetailedMode ? expectedBehavior : undefined,
          isDetailedMode ? actualBehavior : undefined,
          isDetailedMode ? priority : PriorityEnum.Medium
        );
      } else if (type === 'user') {
        console.log('Submitting user report with attachments...');
        result = await userReportHook.submitUserReportWithAttachments(
          title,
          description,
          userId || '',
          selectedFiles, // Attachments
          priority
        );
      }

      if (result) {
        const attachmentText = selectedFiles.length > 0 
          ? ` with ${selectedFiles.length} attachment${selectedFiles.length > 1 ? 's' : ''}`
          : '';
        
        showNotificationToastNative({
          type: LocalToastType.CustomSystemNotice,
          customTitle: "Report Submitted",
          customBody: `Your report has been submitted successfully${attachmentText}! We will review it and get back to you. ✅`,
          position: 'top'
        });

        // Navigate back after a short delay to let user see the toast
        setTimeout(() => {
          navigation.goBack();
        }, 1500);
      }

    } catch (error) {
      console.error('Submit error:', error);
      showNotificationToastNative({
        type: LocalToastType.CustomSystemNotice,
        customTitle: "Submission Failed",
        customBody: "Failed to submit report. Please try again. ❌",
        position: 'top'
      });
    }
  };

  // Get progress text based on current step
  const getProgressText = () => {
    switch (currentStep) {
      case 'submitting':
        return 'Submitting report...';
      case 'uploading':
        return `Uploading files... ${uploadProgress.toFixed(0)}%`;
      case 'completed':
        return 'Completed!';
      default:
        return isSubmitting ? 'Processing...' : '';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* AppHeader */}
        <AppHeader
          title={getHeaderTitle()}
          onBackPress={() => navigation.goBack()}
          backIcon={ArrowLeft}
          showBorder={true}
        />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Progress indicator */}
          {isSubmitting && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>{getProgressText()}</Text>
              {currentStep === 'uploading' && (
                <View style={styles.progressBar}>
                  <View 
                    style={[styles.progressFill, { width: `${uploadProgress}%` }]} 
                  />
                </View>
              )}
            </View>
          )}

          {/* Form Mode Toggle - Only show for bug reports */}
          {type === 'bug' && (
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
              editable={!isSubmitting}
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
              editable={!isSubmitting}
            />
            <Text style={styles.charCount}>{description.length}/5000</Text>
          </View>

          {/* Attachments */}
          <View style={styles.section}>
            <Text style={styles.label}>Attachments (Optional)</Text>
            <AttachmentPicker
              onFilesSelected={handleFilesSelected}
              allowMultipleImages={true}
              allowVideos={false}
              allowDocuments={true}
              useNativeButton={true}
              nativeButtonProps={{
                variant: "outline",
                size: "medium",
                icon: Paperclip,
                disabled: isSubmitting,
              }}
              buttonText="Add Files"
              modalTitle="Add Report Attachments"
            />
            <Text style={styles.attachmentHint}>
              You can attach images or PDF files to help explain the issue
            </Text>
            
            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <View style={styles.filesList}>
                <Text style={styles.filesHeader}>
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected:
                </Text>
                {selectedFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      {file.size && (
                        <Text style={styles.fileSize}>
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </Text>
                      )}
                    </View>
                    <ButtonNative
                      text=""
                      variant="outline"
                      size="small"
                      icon={X}
                      onPress={() => removeFile(index)}
                      disabled={isSubmitting}
                      style={styles.removeButton}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Detailed Fields (only for bug reports in detailed mode) */}
          {isDetailedMode && type === 'bug' && (
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

              {/* Steps to Reproduce */}
              <View style={styles.section}>
                <Text style={styles.label}>Steps to Reproduce</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={stepsToReproduce}
                  onChangeText={setStepsToReproduce}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                  maxLength={2000}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>

              {/* Expected Behavior */}
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
                  editable={!isSubmitting}
                />
              </View>

              {/* Actual Behavior */}
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
                  editable={!isSubmitting}
                />
              </View>
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
                {submitError || 'An error occurred while submitting the report'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <ButtonNative
            text={isSubmitting ? getProgressText() : "Submit Report"}
            onPress={handleSubmit}
            variant="primary"
            size="large"
            fullWidth
            disabled={!isFormValid() || isSubmitting}
            loading={isSubmitting}
            loadingText={getProgressText()}
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
  progressContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  progressText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  attachmentHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  filesList: {
    marginTop: 12,
  },
  filesHeader: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  fileInfo: {
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  fileSize: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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