# ActivityFinder infrastruktur bygget med Terraform
# For kjøring:
#   terraform init
#   terraform apply -var-file="environments/dev.tfvars"

terraform {
    required_version = ">= 1.6.0"

    required_providers {
        upcloud = {
            source = "UpCloudLtd/upcloud"
            version = "~> 5.0"
        }
    }
}

provider "upcloud" {
  # Sett UPCLOUD_USERNAME og UPCLOUD_PASSWORD som miljøvariabler
}

# ============================================================================
# Variabler — tilsvarer 'param' i Bicep
# ============================================================================

# Valgt sone
variable "region" {
    description = "UpCloud region"
    type        = string
    default     = "europe-1"
}

variable "environment" {
    description = "Environment name (dev or prod)"
    type = string
    default = "dev"
    validation {
      condition = contains(["dev", "prod"], var.environment)
      error_message = "Environment must be dev or prod"
    }
}

variable "zone" {
    description = "UpCloud zone for servers"
    type = string
    default = "fi-hel1"
}

variable "ssh_public_key" {
    description = "SSH public key for access to servers"
    type = string
    sensitive = true
}

# ============================================================================
# Lokale variabler — tilsvarer 'var' i Bicep
# ============================================================================
locals {
    project_name = "af"
}

# ============================================================================
# Object Storage
# ============================================================================
module "object_storage" {
    source = "./modules/object-storage"

    project_name = local.project_name
    environment = var.environment
    region = var.region
}

# ============================================================================
# Vault — tilsvarer keyvault.bicep
# ============================================================================
module "vault" {
    source = "./modules/vault"

    project_name = local.project_name
    environment = var.environment
    zone = var.zone
    ssh_public_key = var.ssh_public_key
}

# ============================================================================
# Outputs
# ============================================================================
output "vault_public_ip" {
    description = "Public IP for Vault server"
    value       = module.vault.public_ip
}

output "storage_access_key" {
    description = "Object Storage access key"
    value       = module.object_storage.access_key
    sensitive   = true
}

output "storage_secret_key" {
    description = "Object Storage secret key"
    value       = module.object_storage.secret_key
    sensitive   = true
}

output "storage_endpoint" {
    description = "Object Storage endpoint"
    value       = module.object_storage.endpoint
}