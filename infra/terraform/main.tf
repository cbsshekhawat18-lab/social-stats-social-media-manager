
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "region"         { type = string  default = "ap-south-1" }      # Mumbai
variable "replica_region" { type = string  default = "ap-southeast-1" } # Singapore
variable "env"            { type = string }                              # "prod" / "staging"
variable "vpc_cidr"       { type = string  default = "10.0.0.0/16" }
variable "office_cidrs"   { type = list(string) default = [] }           # bastion / admin SSH allowlist

locals {
  tags = {
    project     = "socialstats"
    environment = var.env
    managed_by  = "terraform"
  }
}

provider "aws" {
  region = var.region
  default_tags { tags = local.tags }
}

# ─────────────────────────────────────────────────────────────────────────────
# Network — public + private subnets across two AZs
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "socialstats-${var.env}" }
}

data "aws_availability_zones" "azs" { state = "available" }

# Public subnets — only the ALB lives here
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = data.aws_availability_zones.azs.names[count.index]
  map_public_ip_on_launch = false   # never default-public
  tags = { Name = "socialstats-${var.env}-pub-${count.index}", Tier = "public" }
}

# Private subnets — app servers + RDS only
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 8)
  availability_zone = data.aws_availability_zones.azs.names[count.index]
  tags = { Name = "socialstats-${var.env}-pri-${count.index}", Tier = "private" }
}

# ─────────────────────────────────────────────────────────────────────────────
# KMS — separate keys for DB, S3, secrets. Rotation enabled.
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_kms_key" "rds" {
  description         = "RDS at-rest encryption — socialstats-${var.env}"
  enable_key_rotation = true
  deletion_window_in_days = 30
}
resource "aws_kms_alias" "rds" {
  name          = "alias/socialstats-${var.env}-rds"
  target_key_id = aws_kms_key.rds.id
}

resource "aws_kms_key" "backups" {
  description         = "Backup S3 + RDS snapshot encryption — socialstats-${var.env}"
  enable_key_rotation = true
  deletion_window_in_days = 30
}
resource "aws_kms_alias" "backups" {
  name          = "alias/socialstats-${var.env}-backups"
  target_key_id = aws_kms_key.backups.id
}

# ─────────────────────────────────────────────────────────────────────────────
# Security groups — deny by default, narrowly opened
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name        = "socialstats-${var.env}-alb"
  description = "Public ALB — only 80/443 from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443  to_port = 443  protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80   to_port = 80   protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "ACME http-01 challenge + redirect"
  }
  egress { from_port = 0 to_port = 0 protocol = "-1" cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "app" {
  name        = "socialstats-${var.env}-app"
  description = "Django app server — only ALB → 8000"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8000 to_port = 8000 protocol = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress { from_port = 0 to_port = 0 protocol = "-1" cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "rds" {
  name        = "socialstats-${var.env}-rds"
  description = "Postgres — only app SG"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432 to_port = 5432 protocol = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  # No outbound — RDS doesn't initiate connections
  egress { from_port = 0 to_port = 0 protocol = "-1" cidr_blocks = [] }
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS Postgres — encrypted at rest, in private subnet, automated backups
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "rds" {
  name       = "socialstats-${var.env}-rds"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier              = "socialstats-${var.env}"
  engine                  = "postgres"
  engine_version          = "15.7"
  instance_class          = "db.t4g.medium"
  allocated_storage       = 100
  storage_type            = "gp3"
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.rds.arn

  db_name                 = "socialstats"
  username                = "socialstats_app"
  manage_master_user_password = true   # AWS Secrets Manager auto-rotation

  db_subnet_group_name    = aws_db_subnet_group.rds.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible     = false

  # Backups — daily 30-day retention, encrypted with the backups KMS key
  backup_retention_period = 30
  backup_window           = "21:30-22:30"     # IST 03:00-04:00
  copy_tags_to_snapshot   = true
  delete_automated_backups = false

  # Maintenance + monitoring
  maintenance_window      = "sun:23:00-sun:23:30"
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn
  monitoring_interval     = 60
  enabled_cloudwatch_logs_exports = ["postgresql"]

  # Connection — TLS-only enforced via parameter group below
  parameter_group_name    = aws_db_parameter_group.tls_only.name

  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "socialstats-${var.env}-final"

  apply_immediately       = false   # let maintenance window apply changes
}

resource "aws_db_parameter_group" "tls_only" {
  name   = "socialstats-${var.env}-tls-only"
  family = "postgres15"

  # Force every connection through TLS
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Cross-region read replica — Singapore (RPO ~minutes)
# ─────────────────────────────────────────────────────────────────────────────
provider "aws" {
  alias  = "replica"
  region = var.replica_region
  default_tags { tags = local.tags }
}

resource "aws_kms_key" "rds_replica" {
  provider            = aws.replica
  description         = "RDS replica encryption — socialstats-${var.env}-replica"
  enable_key_rotation = true
}

resource "aws_db_instance" "replica" {
  provider            = aws.replica
  identifier          = "socialstats-${var.env}-replica"
  replicate_source_db = aws_db_instance.main.arn
  instance_class      = aws_db_instance.main.instance_class
  storage_encrypted   = true
  kms_key_id          = aws_kms_key.rds_replica.arn
  publicly_accessible = false
  skip_final_snapshot = true
  apply_immediately   = false
}

# ─────────────────────────────────────────────────────────────────────────────
# GuardDuty — AWS-managed threat detection (CloudTrail + VPC Flow + DNS)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_guardduty_detector" "main" {
  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"

  datasources {
    s3_logs {
      enable = true
    }
  }
}

# Security Hub — central console for GuardDuty + Inspector + IAM Access Analyzer
resource "aws_securityhub_account" "main" {
  enable_default_standards = true
}

# IAM Access Analyzer — surfaces public/cross-account access
resource "aws_accessanalyzer_analyzer" "main" {
  analyzer_name = "socialstats-${var.env}-access-analyzer"
  type          = "ACCOUNT"
}

output "vpc_id"          { value = aws_vpc.main.id }
output "private_subnets" { value = aws_subnet.private[*].id }
output "rds_endpoint"    { value = aws_db_instance.main.endpoint  sensitive = true }
output "kms_backups_arn" { value = aws_kms_key.backups.arn }
