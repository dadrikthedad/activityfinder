// utils/notifications/NotificationsUserListFormatterNative.tsx
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import React from 'react';
import { Text, TextStyle } from 'react-native';


// 🆕 Eksporterte hjelpefunksjoner som kan brukes andre steder (React Native versjon)
export const formatUserListNative = (users?: UserSummaryDTO[]): string => {
  const names = users?.map(user => user.fullName) || [];
 
  if (names.length === 0) {
    return "someone";
  }
 
  if (names.length === 1) {
    return names[0];
  }
 
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
 
  if (names.length === 3) {
    return `${names[0]}, ${names[1]} and ${names[2]}`;
  }
 
  // For 4+ brukere: vis første 2 + "and X more"
  const remainingCount = names.length - 2;
  return `${names[0]}, ${names[1]} and ${remainingCount} more`;
};
