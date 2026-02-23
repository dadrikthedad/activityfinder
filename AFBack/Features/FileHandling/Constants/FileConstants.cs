namespace AFBack.Features.FileHandling.Constants;

public static class FileConstants
{
  
   // ============================= Magic Bytes ==============================
   /// <summary>
   /// Magic bytes signatures for common file types.
   /// Key: file extension (lowercase with dot)
   /// Value: array of valid signatures (some formats have multiple valid signatures)
   /// </summary>
   public static readonly Dictionary<string, byte[][]> MagicBytes = new()
   {
       // Images
       [".jpg"] = [[0xFF, 0xD8, 0xFF]],
       [".jpeg"] = [[0xFF, 0xD8, 0xFF]],
       [".png"] = [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
       [".gif"] = [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
       [".webp"] = [[0x52, 0x49, 0x46, 0x46]],
      
       // Video
       [".mp4"] = [
           [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
           [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70],
           [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]
       ],
       [".webm"] = [[0x1A, 0x45, 0xDF, 0xA3]],
      
       // Audio
       [".mp3"] = [[0xFF, 0xFB], [0xFF, 0xFA], [0xFF, 0xF3], [0xFF, 0xF2], [0x49, 0x44, 0x33]],
       [".aac"] = [[0xFF, 0xF1], [0xFF, 0xF9]],
       [".ogg"] = [[0x4F, 0x67, 0x67, 0x53]],
      
       // Documents
       [".pdf"] = [[0x25, 0x50, 0x44, 0x46]],
      
       // Archives/Applications
       [".zip"] = [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]],
       [".apk"] = [[0x50, 0x4B, 0x03, 0x04]],
       [".exe"] = [[0x4D, 0x5A]],
       [".msix"] = [[0x50, 0x4B, 0x03, 0x04]],
   };
  
  
   /// <summary>
   /// Extensions that should skip magic byte validation due to complex structure.
   /// </summary>
   public static readonly HashSet<string> SkipMagicByteValidation = [
       ".ipa", // iOS
       ".enc", //
       ".txt", // Tekstfiler har ingen magic bytes
       ".log"  // Loggfiler har ingen magic bytes
   ];
  
  
   /// <summary>
   /// Checks if magic byte validation should be skipped for this extension.
   /// </summary>
   public static bool ShouldSkipMagicByteValidation(string extension)
       => SkipMagicByteValidation.Contains(extension.ToLowerInvariant());
  
   /// <summary>
   /// Henter signaturen/magic bytes for en extension (sikrer at extension alltid er små bokstaver)
   /// </summary>
   public static byte[][]? GetSignatures(string extension)
       => MagicBytes.GetValueOrDefault(extension.ToLowerInvariant());
  
   /// <summary>
   /// Validerer at signaturen og de leste bytene stemmer
   /// </summary>
   /// <param name="buffer">Leste bytes</param>
   /// <param name="signature">Forventet signatur</param>
   /// <returns>True hvis bytes stemmer med signatur, false hvis ikke</returns>
   public static bool SignatureMatches(byte[] buffer, byte[] signature)
   {
       for (var i = 0; i < signature.Length; i++)
       {
           if (buffer[i] != signature[i])
               return false;
       }
       return true;
   }
  
   // ============================= Content Types ==============================
   /// <summary>
   /// Maps file extensions to MIME content types.
   /// </summary>
   private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
   {
       // Images
       [".jpg"] = "image/jpeg",
       [".jpeg"] = "image/jpeg",
       [".png"] = "image/png",
       [".gif"] = "image/gif",
       [".webp"] = "image/webp",
      
       // Video
       [".mp4"] = "video/mp4",
       [".webm"] = "video/webm",
      
       // Audio
       [".mp3"] = "audio/mpeg",
       [".aac"] = "audio/aac",
       [".ogg"] = "audio/ogg",
      
       // Documents
       [".pdf"] = "application/pdf",
       [".txt"] = "text/plain",
       [".log"] = "text/plain",
      
       // Archives/Applications
       [".zip"] = "application/zip",
       [".apk"] = "application/vnd.android.package-archive",
       [".exe"] = "application/vnd.microsoft.portable-executable",
       [".msix"] = "application/msix",
       [".ipa"] = "application/octet-stream",
       [".aab"] = "application/octet-stream",
       [".pkg"] = "application/octet-stream",
       [".dmg"] = "application/x-apple-diskimage"
   };
  
   /// <summary>
   /// Gets the content type for a file extension.
   /// </summary>
   public static string GetContentType(string fileName)
   {
       var extension = Path.GetExtension(fileName);
       return ContentTypes.GetValueOrDefault(extension, "application/octet-stream");
   }
   
}

