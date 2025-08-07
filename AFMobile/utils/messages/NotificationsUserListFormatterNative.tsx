// utils/notifications/NotificationsUserListFormatterNative.tsx
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import React from 'react';
import { Text, TextStyle } from 'react-native';

// React Native versjon av HighlightedText
interface HighlightedTextProps {
  children: React.ReactNode;
  style?: TextStyle;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ children, style }) => (
  <Text style={[{ fontWeight: 'bold', color: '#1C6B1C' }, style]}>
    {children}
  </Text>
);

// Hjelpefunksjon med forhåndsdefinerte stiler (matcher web-versjonen)
const BoldName = ({ children }: { children: React.ReactNode }) => (
  <HighlightedText>{children}</HighlightedText>
);

// 🆕 Eksporterte hjelpefunksjoner som kan brukes andre steder (React Native versjon)
export const formatUserListNative = (users?: UserSummaryDTO[]): React.ReactElement => {
  // Bruk navn fra users
  const names = users?.map(user => user.fullName) || [];
  
  if (names.length === 0) {
    return <BoldName>someone</BoldName>;
  }
 
  if (names.length === 1) {
    return <BoldName>{names[0]}</BoldName>;
  }
 
  if (names.length === 2) {
    return (
      <Text>
        <BoldName>{names[0]}</BoldName>
        {" and "}
        <BoldName>{names[1]}</BoldName>
      </Text>
    );
  }
 
  if (names.length === 3) {
    return (
      <Text>
        <BoldName>{names[0]}</BoldName>
        {", "}
        <BoldName>{names[1]}</BoldName>
        {" and "}
        <BoldName>{names[2]}</BoldName>
      </Text>
    );
  }
 
  // For 4+ brukere: vis første 2 + "and X more"
  const remainingCount = names.length - 2;
  return (
    <Text>
      <BoldName>{names[0]}</BoldName>
      {", "}
      <BoldName>{names[1]}</BoldName>
      {" and "}
      <BoldName>{remainingCount} more</BoldName>
    </Text>
  );
};