// ============================================================================
// KeyVault
// ============================================================================

// Input-parametere for lokasjon, name og tags
param location string

@allowed([
  // Enrivonment kan kun være dev og prod
  'dev'
  'prod'
])
param environment string
param projectName string

var softDeleteDays = environment == 'prod' ? 90 : 7 // Prod = maks 90 dager og dev = min 7 dager
var purgeProtection = environment == 'prod' ? true : null // Trenger PurgeProtection i prod
var publicAccess = environment == 'prod' ? 'Disabled' : 'Enabled' // Disabler public access når det er prod
var defaultAction = environment == 'prod' ? 'Deny' : 'Allow' // Slipper kun inn trafikk fra AzureServices hvis prod

resource keyVault 'Microsoft.KeyVault/vaults@2025-05-01' = {
  name: '${projectName}-${environment}-kv' // af-dev-kv eller af-prod-kv
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId // Henter tenant ID
    enableRbacAuthorization: true
    softDeleteRetentionInDays: softDeleteDays
    enablePurgeProtection: purgeProtection
    publicNetworkAccess: publicAccess
    networkAcls: {
      // Brannmursregler
      defaultAction: defaultAction
      bypass: 'AzureServices'
    }
  }
  tags: {
    project: 'ActivityFinder'
    environment: environment
  }
}
// Navnet på keyVaulten kan hentes ut til andre moduler igjen
output keyVaultName string = keyVault.name
