import React, { JSX } from 'react';
import { HighlightedText } from '../HighlightedText';
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";

// Hjelpefunksjon med forhåndsdefinerte stiler
const BoldName = ({ children }: { children: React.ReactNode }) => (
  <HighlightedText>{children}</HighlightedText>
);

// 🆕 Eksporterte hjelpefunksjoner som kan brukes andre steder
export const formatUserList = (users?: UserSummaryDTO[]): JSX.Element => {
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
      <span>
        <BoldName>{names[0]}</BoldName>
        {" and "}
        <BoldName>{names[1]}</BoldName>
      </span>
    );
  }
 
  if (names.length === 3) {
    return (
      <span>
        <BoldName>{names[0]}</BoldName>
        {", "}
        <BoldName>{names[1]}</BoldName>
        {" and "}
        <BoldName>{names[2]}</BoldName>
      </span>
    );
  }
 
  // For 4+ brukere: vis første 2 + "and X more"
  const remainingCount = names.length - 2;
  return (
    <span>
      <BoldName>{names[0]}</BoldName>
      {", "}
      <BoldName>{names[1]}</BoldName>
      {" and "}
      <BoldName>{remainingCount} more</BoldName>
    </span>
  );
};