/**
 * Golden Records インフラ
 * Golden Records infrastructure
 * Infrastruktur Golden Records
 *
 * - Firestore (Native mode) — 正規化されたドキュメントストア
 * - Vertex AI Vector Search (Matching Engine) — セマンティック検索
 * - IAM バインディング — Cloud Run SA → Firestore / Vertex AI
 */

variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "GCP region (e.g. asia-northeast1)"
  type        = string
  default     = "asia-northeast1"
}

variable "firestore_location" {
  description = "Firestore location (multi-region or region)"
  type        = string
  default     = "nam5"
}

variable "cloud_run_service_account" {
  description = "Cloud Run 実行 SA (email)"
  type        = string
}

variable "vector_dimensions" {
  description = "Embedding dimensions (text-embedding-004 = 768)"
  type        = number
  default     = 768
}

variable "vector_approximate_neighbors_count" {
  description = "ANN 近傍数 (top-K 以上)"
  type        = number
  default     = 40
}

variable "vector_bucket_name" {
  description = "Vector Search 用 GCS バケット (embeddings の staging)"
  type        = string
}

# ----------------------------------------------------------------------
# Firestore (Native mode)
# ----------------------------------------------------------------------
resource "google_firestore_database" "golden_records" {
  project     = var.project_id
  name        = "golden-records"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  delete_protection_state           = "DELETE_PROTECTION_ENABLED"
}

# 複合インデックス: tenantId + type
resource "google_firestore_index" "tenant_type" {
  project    = var.project_id
  database   = google_firestore_database.golden_records.name
  collection = "golden_records"

  fields {
    field_path = "tenantId"
    order      = "ASCENDING"
  }
  fields {
    field_path = "type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "validFrom"
    order      = "DESCENDING"
  }
}

# 複合インデックス: type + validFrom (グローバル検索用)
resource "google_firestore_index" "type_valid" {
  project    = var.project_id
  database   = google_firestore_database.golden_records.name
  collection = "golden_records"

  fields {
    field_path = "type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "validFrom"
    order      = "DESCENDING"
  }
}

# ----------------------------------------------------------------------
# Vertex AI Vector Search Index
# ----------------------------------------------------------------------
resource "google_storage_bucket" "vector_staging" {
  project                     = var.project_id
  name                        = var.vector_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_vertex_ai_index" "golden_records" {
  project      = var.project_id
  region       = var.region
  display_name = "golden-records-index"
  description  = "SuguVisa Golden Records hybrid semantic search"

  metadata {
    contents_delta_uri = "gs://${google_storage_bucket.vector_staging.name}/initial/"
    config {
      dimensions                  = var.vector_dimensions
      approximate_neighbors_count = var.vector_approximate_neighbors_count
      distance_measure_type       = "COSINE_DISTANCE"
      algorithm_config {
        tree_ah_config {
          leaf_node_embedding_count = 500
          leaf_nodes_to_search_percent = 10
        }
      }
    }
  }

  index_update_method = "STREAM_UPDATE"
}

resource "google_vertex_ai_index_endpoint" "golden_records" {
  project      = var.project_id
  region       = var.region
  display_name = "golden-records-endpoint"
  description  = "SuguVisa Golden Records endpoint for online ANN"
  public_endpoint_enabled = true
}

# 注: deployed_index は別リソースで管理。
# 本番環境では `gcloud ai index-endpoints deploy-index ...` もしくは
# terraform-google-modules/ai-platform を検討。

# ----------------------------------------------------------------------
# IAM: Cloud Run SA に Firestore / Vertex AI アクセス権を付与
# ----------------------------------------------------------------------
resource "google_project_iam_member" "cr_firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${var.cloud_run_service_account}"
}

resource "google_project_iam_member" "cr_vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${var.cloud_run_service_account}"
}

resource "google_storage_bucket_iam_member" "cr_vector_bucket" {
  bucket = google_storage_bucket.vector_staging.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.cloud_run_service_account}"
}

# ----------------------------------------------------------------------
# Output
# ----------------------------------------------------------------------
output "firestore_database" {
  value       = google_firestore_database.golden_records.name
  description = "Firestore database name for Golden Records"
}

output "vector_index_id" {
  value       = google_vertex_ai_index.golden_records.name
  description = "Vertex AI Vector Search index resource name"
}

output "vector_index_endpoint_id" {
  value       = google_vertex_ai_index_endpoint.golden_records.name
  description = "Vertex AI Vector Search index endpoint"
}

output "vector_staging_bucket" {
  value       = google_storage_bucket.vector_staging.name
  description = "GCS bucket used as staging area for embeddings"
}
