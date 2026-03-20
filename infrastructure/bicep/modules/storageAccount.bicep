// ============================================================================
// Storage Account - Hovedkontoen 
// ============================================================================

param location string
param environment string
param projectName string

// Storage account navn må være lowercase, ingen bindestreker, 3-24 tegn
var storageAccountName = '${projectName}${environment}stor${uniqueString(resourceGroup().id)}' // Eks: afdevstorabcdefghijklm eller afprodstordfskjalfjk
var storageSku = environment == 'prod' ? 'Standard_ZRS' : 'Standard_LRS' // Trenger ikke lagring flere steder i DEV, men trengs i Prod

resource storageAccount 'Microsoft.Storage/storageAccounts@2025-06-01' = {
  name: storageAccountName
  location: location
  sku: {
    // Ønsket variant av storage Account
    name: storageSku
  }
  kind: 'StorageV2' // StorageV2 anbefalte valget. Kan lagre blob, filer, køer etc
  properties: {
    accessTier: 'Hot' // Brukes ofte
    allowBlobPublicAccess: true // Setter at blobben kan tilatte public access på containerne
    minimumTlsVersion: 'TLS1_2' // Raskest og sikrest sikkerhetskonfigurasjon
    supportsHttpsTrafficOnly: true // Kun HTTPS-trafikk
  }
  tags: {
    project: projectName
    environment: environment
  }
}

// ============================================================================
// Blob Service - En Storage Account må ha en Blob Service
// ============================================================================

var retentionEnabled = environment == 'prod' // Retentionten er på i prod, men ikke i dev
var retentionDays = retentionEnabled ? 30 : null //

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2025-06-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: retentionEnabled
      days: retentionDays
    }
  }
}

// ============================================================================
// Blob Containere - Containere for filer for forskjellige sammenhenger 
// ============================================================================
// Krypterte filer - public access
resource encryptedFiles 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-06-01' = {
  parent: blobService
  name: 'encrypted-files'
  properties: {
    publicAccess: 'Blob'
  }
}

// Public images - Offetnlig tilgjengelig bilder feks Profilbilder/Gruppebilder
resource publicImages 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-06-01' = {
  parent: blobService
  name: 'public-images'
  properties: {
    publicAccess: 'Blob'
  }
}

// Private filer - F.eks Support ticket attachmetns, admin-filer etc
resource privateFiles 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-06-01' = {
  parent: blobService
  name: 'private-files'
  properties: {
    publicAccess: 'None'
  }
}

output storageAccountName string = storageAccount.name
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob // Trenger bare URL-en for blob
