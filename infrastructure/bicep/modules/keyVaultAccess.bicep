// ============================================================================
// Key Vault Access - rollen mellom lokal backend og dev KeyVault
// ============================================================================

param keyVaultName string // Navnet på KeyVaulten fra KeyVault.bicep-modulen
param principalId string // Dette er brukeren som har tilattelse til å bruke KeyVaulten

@allowed([
  'User'
  'ServicePrincipal'
  'Group'
])
param principalType string // 'User' i dev og 'ServicePrincipal' i prod

// Her henter vi referansen til KeyVaulten vi har opprettet
resource keyVault 'Microsoft.KeyVault/vaults@2025-05-01' existing = {
  name: keyVaultName
}

// Key Vaults Secret Officer er rollen som har lese, skrive og slette tilgang til Key Vault (har denne ID-en)
var secretsOfficerRoleId = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, principalId, secretsOfficerRoleId) // Azure krever en unik ID til rollen og med de samme input parameterne så kan vi lage samme GUID-en, så vi slipper å opprette ny hver gang
  scope: keyVault // Scope er det vi knytter rollen opp mot
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsOfficerRoleId) // Full addresse til rollen tilhørende subscriptionen
    principalId: principalId
    principalType: principalType
  }
}
