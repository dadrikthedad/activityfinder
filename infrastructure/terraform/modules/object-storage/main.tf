# ============================================================================
# Object Storage — tilsvarer storageAccount.bicep + storageAccountAccess.bicep
# UpCloud Object Storage er S3-kompatibelt
# ============================================================================

terraform {
    required_providers {
        upcloud = {
            source  = "UpCloudLtd/upcloud"
            version = "~> 5.0"
        }
    }
}

# Input-parametere
variable "environment" {
    type = string
    validation {
        condition = contains(["dev", "prod"], var.environment)
        error_message = "Environment must be dev or prod"
    }
}

variable "project_name" { type = string }
variable "region" {type = string}

# UpCloud Object Storage navn: kun lowercase og bindestreker, maks 64 tegn
# Tilsvarer: '${projectName}${environment}stor${uniqueString(resourceGroup().id)}'
locals {
    storage_name = "${var.project_name}-${var.environment}-storage"
}

# ============================================================================
# Object Storage bucket (hovedkonto)
# Tilsvarer: Microsoft.Storage/storageAccounts
# ============================================================================
resource "upcloud_managed_object_storage" "main" {
    name = local.storage_name
    region            = var.region
    configured_status = "started"

    # Offentlig tilgang
    network {
        family = "IPv4"
        name   = "public"
        type   = "public"
    }

    labels = {
        project     = var.project_name
        environment = var.environment
    }
}

# ============================================================================
# Containere — tilsvarer Blob Containere i Bicep
# UpCloud Object Storage er S3-kompatibelt, så "containere" = "buckets"
# ============================================================================

# Krypterte filer - public access
resource "upcloud_managed_object_storage_bucket" "encrypted_files" {
    service_uuid = upcloud_managed_object_storage.main.id
    name         = "encrypted-files"
}

# Public images - profilbilder, gruppebilder
resource "upcloud_managed_object_storage_bucket" "public_images" {
    service_uuid = upcloud_managed_object_storage.main.id
    name         = "public-images"
}


# Private files - support tickets, admin-files, etc
resource "upcloud_managed_object_storage_bucket" "private_files" {
    service_uuid = upcloud_managed_object_storage.main.id
    name         = "private-files"
}

# ============================================================================
# Object Storage bruker — for å få access_key og secret_key
# ============================================================================

resource "upcloud_managed_object_storage_user" "app" {
    service_uuid = upcloud_managed_object_storage.main.id
    username     = "${var.project_name}-${var.environment}-app"
}

resource "upcloud_managed_object_storage_user_access_key" "app" {
    service_uuid = upcloud_managed_object_storage.main.id
    username = upcloud_managed_object_storage_user.app.username
    status = "Active"
}

# ============================================================================
# Outputs — tilsvarer output i Bicep
# Tilsvarer: storageAccountAccess.bicep (RBAC-roller finnes ikke i UpCloud,
# access keys brukes i stedet og lagres i Vault)
# ============================================================================
output "storage_name" {
    value = upcloud_managed_object_storage.main.name
}

output "endpoint" {
    description = "S3-kompatibel endepunkt — brukes i appsettings"
    value       = upcloud_managed_object_storage.main.endpoint
}

output "access_key" {
    description = "S3 Access Key — lagres i Vault"
    value       = upcloud_managed_object_storage_user_access_key.app.access_key_id
    sensitive   = true
}

output "secret_key" {
    description = "S3 Secret Key — lagres i Vault"
    value       = upcloud_managed_object_storage_user_access_key.app.secret_access_key
    sensitive   = true
}
