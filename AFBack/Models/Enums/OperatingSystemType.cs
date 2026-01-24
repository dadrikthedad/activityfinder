namespace AFBack.Models.Enums;

public enum OperatingSystemType
{
    // ======================== Default ========================
    Unknown = 0,
    
    // ======================== Desktop ========================
    Windows = 1,
    MacOS = 2,
    Linux = 3,
    ChromeOS = 4,
    
    // ======================== Mobile ========================
    iOS = 10,
    Android = 11,
    
    // ======================== Other ========================
    iPadOS = 20,      // Hvis du vil skille iPad fra iPhone
    HarmonyOS = 21,   // Huawei (økende i Asia)
    FreeBSD = 30,
    Unix = 31,
}
