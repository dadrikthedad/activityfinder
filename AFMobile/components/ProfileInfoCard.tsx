import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
} from "react-native";
import { PublicProfileDTO } from "@shared/types/PublicProfileDTO";
import ButtonNative from "@/components/common/buttons/ButtonNative";
import { useAuth } from "@/context/AuthContext";
import { updateBio, updateWebsites } from "@/services/profile/profile";
import { PlusCircle, Trash2 } from "lucide-react-native";

interface Props {
  profile: Partial<PublicProfileDTO>;
  showEmail?: boolean;
  isEditable?: boolean;
  refetchProfile?: () => Promise<void>;
}

// Reusable InfoRow component
const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
  <View style={styles.infoRow}>
    <Text style={styles.label}>{label}:</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

export default function ProfileInfoCardNative({
  profile,
  isEditable = false,
  refetchProfile,
}: Props) {
  // Editing states
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState(profile?.bio ?? "");
  const [bioSaved, setBioSaved] = useState(false);
  const [editingWebsites, setEditingWebsites] = useState(false);
  const [websiteList, setWebsiteList] = useState<string[]>(profile?.websites || []);
  const [websitesSaved, setWebsitesSaved] = useState(false);
  
  const { token } = useAuth();
  const lastInputRef = useRef<TextInput | null>(null);

  // Utility functions
  const isEmpty = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("no-NO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Bio functions
  const saveBio = async () => {
    if (!token) return;
    try {
      await updateBio(bioText, token);
      setBioSaved(true);
      setTimeout(() => setBioSaved(false), 2000);
      setEditingBio(false);

      if (refetchProfile) {
        await refetchProfile();
      }
    } catch (err) {
      console.error("❌ Failed to update bio:", err);
      Alert.alert("Error", "Failed to update bio. Please try again.");
    }
  };

  const cancelBioEdit = () => {
    setEditingBio(false);
    setBioText(profile?.bio ?? "");
  };

  // Website functions
  const saveWebsites = async () => {
    if (!token) return;
    const cleanedWebsites = websiteList.filter((url) => url.trim() !== "");
    try {
      await updateWebsites(cleanedWebsites, token);
      setWebsitesSaved(true);
      setTimeout(() => setWebsitesSaved(false), 2000);
      setEditingWebsites(false);
      if (refetchProfile) await refetchProfile();
    } catch (err) {
      console.error("❌ Failed to update websites:", err);
      Alert.alert("Error", "Failed to update websites. Please try again.");
    }
  };

  const cancelWebsiteEdit = () => {
    setEditingWebsites(false);
    setWebsiteList(profile?.websites || []);
  };

  const handleWebsitePress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open this URL");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open website");
    }
  };

  const addWebsiteField = () => {
    setWebsiteList([...websiteList, ""]);
    setTimeout(() => {
      lastInputRef.current?.focus();
    }, 100);
  };

  const removeWebsiteField = (index: number) => {
    const updated = websiteList.filter((_, i) => i !== index);
    setWebsiteList(updated);
  };

  const updateWebsiteField = (index: number, value: string) => {
    const updated = [...websiteList];
    updated[index] = value;
    setWebsiteList(updated);
  };

  // Render functions for different sections
  const renderBasicInfo = () => {
    const hasAnyBasicInfo = !isEmpty(profile.fullName) || 
      (profile?.showAge && typeof profile.age === "number") ||
      (profile?.showGender && !isEmpty(profile.gender)) ||
      !isEmpty(profile?.country) ||
      (profile?.showPostalCode && !isEmpty(profile.postalCode)) ||
      (profile?.showBirthday && profile?.dateOfBirth) ||
      (profile?.showEmail && !isEmpty(profile.contactEmail)) ||
      (profile?.showPhone && !isEmpty(profile.contactPhone));

    if (!hasAnyBasicInfo) return null;

    return (
      <>
        {!isEmpty(profile.fullName) && (
          <InfoRow label="Name" value={profile.fullName!} />
        )}

        {profile?.showAge && typeof profile.age === "number" && (
          <InfoRow label="Age" value={profile.age} />
        )}

        {profile?.showGender && !isEmpty(profile.gender) && (
          <InfoRow label="Gender" value={profile.gender!} />
        )}

        {!isEmpty(profile?.country) && (
          <InfoRow 
            label="From" 
            value={
              profile.country! + 
              (profile.showRegion && !isEmpty(profile.region) ? `, ${profile.region}` : "")
            } 
          />
        )}

        {profile?.showPostalCode && !isEmpty(profile.postalCode) && (
          <InfoRow label="Postal Code" value={profile.postalCode!} />
        )}

        {profile?.showBirthday && profile?.dateOfBirth && (
          <InfoRow label="Birthday" value={formatDate(profile.dateOfBirth)} />
        )}

        {profile?.showEmail && !isEmpty(profile.contactEmail) && (
          <InfoRow label="Email" value={profile.contactEmail!} />
        )}

        {profile?.showPhone && !isEmpty(profile.contactPhone) && (
          <InfoRow label="Phone" value={profile.contactPhone!} />
        )}
      </>
    );
  };

  const renderStats = () => {
    if (!profile?.showStats) return null;

    const hasAnyStats = !isEmpty(profile.totalLikesGiven) ||
      !isEmpty(profile.totalLikesRecieved) ||
      !isEmpty(profile.totalCommentsMade) ||
      !isEmpty(profile.totalMessagesRecieved) ||
      !isEmpty(profile.totalMessagesSendt);

    if (!hasAnyStats) return null;

    return (
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Stats</Text>
        
        {!isEmpty(profile.totalLikesGiven) && (
          <InfoRow label="Likes Given" value={profile.totalLikesGiven!} />
        )}

        {!isEmpty(profile.totalLikesRecieved) && (
          <InfoRow label="Likes Received" value={profile.totalLikesRecieved!} />
        )}

        {!isEmpty(profile.totalCommentsMade) && (
          <InfoRow label="Comments Made" value={profile.totalCommentsMade!} />
        )}

        {!isEmpty(profile.totalMessagesRecieved) && (
          <InfoRow label="Messages Received" value={profile.totalMessagesRecieved!} />
        )}

        {!isEmpty(profile.totalMessagesSendt) && (
          <InfoRow label="Messages Sent" value={profile.totalMessagesSendt!} />
        )}
      </View>
    );
  };

  const renderBio = () => {
    const hasBio = profile.bio && profile.bio.trim() !== "";
    
    if (!isEditable && !hasBio) return null;

    return (
      <View style={styles.bioSection}>
        <Text style={styles.sectionTitle}>About Me</Text>
        
        {isEditable ? (
          editingBio ? (
            <View>
              <TextInput
                value={bioText}
                onChangeText={setBioText}
                maxLength={1000}
                multiline
                style={styles.bioInput}
                placeholder="Write your bio here (max 1000 characters)..."
                placeholderTextColor="#666"
              />
              <View style={styles.buttonRow}>
                <ButtonNative
                  text={bioSaved ? "Saved ✅" : "Save"}
                  onPress={saveBio}
                  variant="primary"
                  style={styles.actionButton}
                />
                <ButtonNative
                  text="Cancel"
                  onPress={cancelBioEdit}
                  variant="secondary"
                  style={styles.actionButton}
                />
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.bioText}>{profile?.bio || "No bio added yet."}</Text>
              <View style={styles.centerButton}>
                <ButtonNative
                  text="Edit About Me"
                  onPress={() => setEditingBio(true)}
                  variant="primary"
                  style={styles.editButton}
                />
              </View>
            </View>
          )
        ) : (
          <Text style={styles.bioText}>{profile?.bio}</Text>
        )}
      </View>
    );
  };

  const renderWebsites = () => {
    if (!profile?.showWebsites) return null;

    const hasWebsites = profile?.websites && profile.websites.length > 0;

    return (
      <View style={styles.websitesSection}>
        <Text style={styles.sectionTitle}>Websites</Text>
        
        {isEditable ? (
          editingWebsites ? (
            <View>
              {websiteList.length === 0 ? (
                <ButtonNative
                  text="Add website"
                  onPress={() => setWebsiteList([""])}
                  variant="outline"
                  style={styles.addWebsiteButton}
                />
              ) : (
                <ScrollView style={styles.websiteInputContainer}>
                  {websiteList.map((url, idx) => (
                    <View key={idx} style={styles.websiteInputRow}>
                      <TextInput
                        ref={idx === websiteList.length - 1 ? lastInputRef : null}
                        style={styles.websiteInput}
                        value={url}
                        onChangeText={(text) => updateWebsiteField(idx, text)}
                        placeholder="https://example.com"
                        placeholderTextColor="#666"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      
                      {idx === websiteList.length - 1 && (
                        <TouchableOpacity
                          onPress={addWebsiteField}
                          style={styles.iconButton}
                        >
                          <PlusCircle size={20} color="#1C6B1C" />
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity
                        onPress={() => removeWebsiteField(idx)}
                        style={styles.iconButton}
                      >
                        <Trash2 size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              
              <View style={styles.buttonRow}>
                <ButtonNative
                  text={websitesSaved ? "Saved ✅" : "Save"}
                  onPress={saveWebsites}
                  variant="primary"
                  style={styles.actionButton}
                />
                <ButtonNative
                  text="Cancel"
                  onPress={cancelWebsiteEdit}
                  variant="secondary"
                  style={styles.actionButton}
                />
              </View>
            </View>
          ) : (
            <View>
              {hasWebsites ? (
                <View style={styles.websiteList}>
                  {profile.websites!.map((url, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleWebsitePress(url)}
                      style={styles.websiteItem}
                    >
                      <Text style={styles.websiteLink}>• {url}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No websites added yet.</Text>
              )}
              <View style={styles.centerButton}>
                <ButtonNative
                  text="Edit Websites"
                  onPress={() => setEditingWebsites(true)}
                  variant="primary"
                  style={styles.editButton}
                />
              </View>
            </View>
          )
        ) : (
          hasWebsites && (
            <View style={styles.websiteList}>
              {profile.websites!.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleWebsitePress(url)}
                  style={styles.websiteItem}
                >
                  <Text style={styles.websiteLink}>• {url}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Profile</Text>
      
      {renderBasicInfo()}
      {renderStats()}
      {renderBio()}
      {renderWebsites()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#1C6B1C',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#145214',
    marginBottom: 12,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  label: {
    fontWeight: '600',
    color: '#333',
    minWidth: 80,
  },
  value: {
    color: '#666',
    flex: 1,
  },
  statsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  bioSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  bioText: {
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#f8f9fa',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
  centerButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  editButton: {
    paddingHorizontal: 24,
  },
  websitesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
  },
  addWebsiteButton: {
    alignSelf: 'flex-start',
  },
  websiteInputContainer: {
    maxHeight: 200,
  },
  websiteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  websiteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f9fa',
  },
  iconButton: {
    padding: 4,
  },
  websiteList: {
    marginBottom: 12,
  },
  websiteItem: {
    paddingVertical: 4,
  },
  websiteLink: {
    color: '#2563EB',
    fontSize: 16,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 14,
    marginBottom: 12,
  },
});