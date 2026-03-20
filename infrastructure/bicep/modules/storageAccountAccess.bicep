// ============================================================================
// Blob Storage Account Storage Access - rollen som gir tilgang til Blob Storage
// ============================================================================

param storageAccountName string // Navnet på StorageAccount fra storageAccount.bicep-modulen
param principalId string // Dette er brukeren som har tilattelse til å bruke Storage Accounten

@allowed([
  'User'
  'ServicePrincipal'
  'Group'
])
param principalType string // 'User' i dev og 'ServicePrincipal' i prod

// Her henter vi referansen til storageAccounten vi har opprettet
resource storageAccount 'Microsoft.Storage/storageAccounts@2025-06-01' existing = {
  name: storageAccountName
}

// Blob Storage Rollen
var blobContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, principalId, blobContributorRoleId) // Azure krever en unik ID til rollen og med de samme input parameterne så kan vi lage samme GUID-en, så vi slipper å opprette ny hver gang
  scope: storageAccount // Scope er det vi knytter rollen opp mot
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobContributorRoleId) // Full addresse til rollen tilhørende subscriptionen
    principalId: principalId
    principalType: principalType
  }
}
