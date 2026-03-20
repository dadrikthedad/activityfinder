// ActivityFinder infrastruktur bygged med Bicep
// For kjøring: az deployment sub create --location swedencentral --template-file infrastructure/bicep/main.bicep

targetScope = 'subscription' // Vi skal opprette dette i subscription-nivået - vi ønsker å opprette en resource group manuelt

param location string = 'swedencentral' // Input parameter for å endre lokasjon ved kjøring
param devUserObjectId string = '0d1955d9-6da5-4fe8-a225-3f415615d831'

var devEnvironment = 'dev'
var projectName = 'af'

// ================= DEV ENVIRONMENT =================

// ============================================================================
// Resource Group
// ============================================================================
resource rg 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  // Oppretter en resursgruppe for dev
  name: 'af-dev-rg'
  location: location
  tags: {
    project: 'ActivityFinder'
    environment: devEnvironment
  }
}

// ============================================================================
// Key Vault
// ============================================================================
module keyVault 'modules/keyvault.bicep' = {
  // Sti til bicep-filen
  name: 'keyVaultDeployment'
  scope: rg // Vi kobler den mot rg-en
  params: {
    // Parameterne vi har satt opp i Keyvault.bicep
    location: location
    environment: devEnvironment
    projectName: projectName
  }
}

// ============================================================================
// Key Vault Access - rolle til keyVault (kun Admin for øyeblikket)
// ============================================================================
module keyVaultAccess 'modules/keyVaultAccess.bicep' = {
  name: 'keyVaultAccess'
  scope: rg
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    principalId: devUserObjectId
    principalType: 'User'
  }
}

// ============================================================================
// Blob Storage
// ============================================================================
module blobStorage 'modules/storageAccount.bicep' = {
  name: 'storageDeployment'
  scope: rg
  params: {
    location: location
    environment: devEnvironment
    projectName: projectName
  }
}

// ============================================================================
// Storage Access - rolle til Blob Storage (kun Admin for øyeblikket)
// ============================================================================
module storageAccountAccess 'modules/storageAccountAccess.bicep' = {
  name: 'storageAccountAccess'
  scope: rg
  params: {
    storageAccountName: blobStorage.outputs.storageAccountName
    principalId: devUserObjectId
    principalType: 'User'
  }
}

// ============================================================================
// Communication Service - for epost og sms med custom domain (midlertidig Azure)
// ============================================================================
module communicationService 'modules/communicationService.bicep' = {
  name: 'communicationDeployment'
  scope: rg
  params: {
    environment: devEnvironment
    projectName: projectName
  }
}
