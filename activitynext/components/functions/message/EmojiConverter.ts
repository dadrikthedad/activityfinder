// utils/emoji/emojiConverter.ts

interface EmojiMapping {
  [key: string]: string;
}

// Mapping av tekst-smilies til emojier
const emojiMappings: EmojiMapping = {
  // Grunnleggende smilies
  ':)': '😊',
  ':-)': '😊',
  '(:': '😊',
  ':D': '😃',
  ':-D': '😃',
  ':P': '😛',
  ':-P': '😛',
  ':p': '😛',
  ':-p': '😛',
  ';)': '😉',
  ';-)': '😉',
  ':(': '😞',
  ':-(': '😞',
  ":'(": '😢',
  ':o': '😮',
  ':O': '😮',
  ':-o': '😮',
  ':-O': '😮',
  ':*': '😘',
  ':-*': '😘',
  
  // Mer avanserte
  ':/': '😕',
  ':-/': '😕',
  ':|': '😐',
  ':-|': '😐',
  ':3': '😊',
  '8)': '😎',
  '8-)': '😎',
  'B)': '😎',
  'B-)': '😎',
  '>:(': '😠',
  '>:-(': '😠',
  ':S': '😖',
  ':-S': '😖',
  ':s': '😖',
  ':-s': '😖',
  
  // Spesielle
  '<3': '❤️',
  '</3': '💔',
  ':love:': '😍',
  ':heart:': '❤️',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':fire:': '🔥',
  ':party:': '🎉',
  
  // Ansikte uttrykk
  'xD': '😆',
  'XD': '😆',
  '^_^': '😊',
  '^.^': '😊',
  '-_-': '😑',
  'o_O': '😳',
  'O_o': '😳',
  '0_0': '😳',
  '>_<': '😣',
  
  // Ekstra
  ':shrug:': '🤷‍♂️',
  ':facepalm:': '🤦‍♂️',
  ':thinking:': '🤔',
  ':100:': '💯',
  ':ok:': '👌',
  ':clap:': '👏'
};

/**
 * Konverterer tekst-smilies til emojier i en tekst
 * @param text - Teksten som skal konverteres
 * @returns Tekst med emojier i stedet for smilies
 */
export function convertTextToEmojis(text: string): string {
  if (!text) return text;
  
  let convertedText = text;
  
  // Sorter nøklene etter lengde (lengste først) for å unngå at kortere matches overskriver lengre
  const sortedKeys = Object.keys(emojiMappings).sort((a, b) => b.length - a.length);
  
  for (const emoticon of sortedKeys) {
    const emoji = emojiMappings[emoticon];
    
    // Bruk regex for å matche hele ord/symboler
    // \b fungerer ikke godt med symboler, så vi bruker en mer spesifikk tilnærming
    const regex = new RegExp(
      // Escape spesielle regex-karakterer
      emoticon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'g'
    );
    
    convertedText = convertedText.replace(regex, emoji);
  }
  
  return convertedText;
}

/**
 * Konverterer tekst-smilies til emojier, men bevarer spacing og linjeskift
 * @param text - Teksten som skal konverteres
 * @returns Tekst med emojier, bevarer formatering
 */
export function convertTextToEmojisPreserveFormat(text: string): string {
  if (!text) return text;
  
  // Split på whitespace og linjeskift, men bevar dem
  const parts = text.split(/(\s+|\n)/);
  
  return parts.map(part => {
    // Ikke konverter whitespace eller linjeskift
    if (/^\s+$/.test(part) || part === '\n') {
      return part;
    }
    
    // Konverter delen
    return convertTextToEmojis(part);
  }).join('');
}

/**
 * Sjekker om en tekst inneholder tekst-smilies
 * @param text - Teksten som skal sjekkes
 * @returns true hvis teksten inneholder smilies
 */
export function containsTextEmojis(text: string): boolean {
  if (!text) return false;
  
  return Object.keys(emojiMappings).some(emoticon => 
    text.includes(emoticon)
  );
}