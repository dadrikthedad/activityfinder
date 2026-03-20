# ============================================================================
# HashiCorp Vault — tilsvarer keyvault.bicep
# Kjører som en VPS på UpCloud siden UpCloud ikke har managed Key Vault
# ============================================================================

terraform {
    required_providers {
        upcloud = {
            source  = "UpCloudLtd/upcloud"
            version = "~> 5.0"
        }
    }
}

variable "project_name" { type = string }
variable "environment" { type = string }
variable "zone" { type = string }
variable "ssh_public_key" { 
    type = string
    sensitive = true 
}

# ============================================================================
# Vault VPS
# ============================================================================

resource "upcloud_server" "vault" {
    hostname = "${var.project_name}-${var.environment}-vault"
    zone = var.zone # VPS bruker zone, og ikke region
    plan = "1xCPU-2GB"
    metadata = true
    firewall = true

    template {
        storage = "Ubuntu Server 24.04 LTS (Noble Numbat)"
        size = 25 #GB
    }

    network_interface {
        type = "public"
    }

    login {
        user = "terraform"
        keys = [var.ssh_public_key]
        create_password = false
    }

    labels = {
        project = var.project_name
        environment = var.environment
        role = "vault"
    }
}

output "public_ip" {
    description = "Offentlig IP til Vault-serveren"
    value       = upcloud_server.vault.network_interface[0].ip_address
}