// ============================================================================
// Communication Service - for epost og sms med custom domain (midlertidig Azure)
// ============================================================================
param environment string
param projectName string

resource communicationService 'Microsoft.Communication/communicationServices@2025-09-01' = {
  name: '${projectName}-${environment}-comm'
  location: 'global' // Communication Services må være globale
  properties: {
    dataLocation: 'Europe'
    linkedDomains: [
      emailDomain.id
    ]
  }
  tags: {
    project: projectName
    environment: environment
  }
}

// ============================================================================
// Email Communication Service - for epost
// ============================================================================
resource emailService 'Microsoft.Communication/emailServices@2025-09-01' = {
  name: '${projectName}-${environment}-email'
  location: 'global'
  properties: {
    dataLocation: 'Europe'
  }
  tags: {
    project: projectName
    environment: environment
  }
}

// ============================================================================
// Email Domain - Konfiguerer domene for epost
// ============================================================================
resource emailDomain 'Microsoft.Communication/emailServices/domains@2025-09-01' = {
  parent: emailService
  name: 'AzureManagedDomain' // Ved custom domene - 'notify.lynsoftware.com' istedenfor 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged' // Ved custom domene - 'CustomerManaged' istedenfor 'AzureManaged'
  }
}

output communicationServiceName string = communicationService.name
output emailSenderDomain string = emailDomain.properties.fromSenderDomain // Avsenderdomenet vi trenger i appsettings for senere
