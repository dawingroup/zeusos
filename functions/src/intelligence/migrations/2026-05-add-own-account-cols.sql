-- ============================================================================
-- Migration: extend social_intelligence dataset to support OWN-account tracking
-- Applied 2026-05 alongside marketing-module social media feature.
-- Run with:
--   bq query --use_legacy_sql=false < 2026-05-add-own-account-cols.sql
-- ============================================================================

-- 1. raw_posts: bridge to marketing-module post lifecycle
ALTER TABLE `social_intelligence.raw_posts`
  ADD COLUMN IF NOT EXISTS account_type STRING,
  ADD COLUMN IF NOT EXISTS subsidiary_id STRING,
  ADD COLUMN IF NOT EXISTS dawinos_post_id STRING,
  ADD COLUMN IF NOT EXISTS dawinos_account_id STRING;

-- 2. account_metrics: bridge to subsidiary + the marketing-module SocialMediaAccount doc
ALTER TABLE `social_intelligence.account_metrics`
  ADD COLUMN IF NOT EXISTS account_type STRING,
  ADD COLUMN IF NOT EXISTS subsidiary_id STRING,
  ADD COLUMN IF NOT EXISTS dawinos_account_id STRING;

-- 3. Optional dedicated table for per-day per-platform engagement of OUR posts.
--    Lets us draw trend lines per post (not just per account), and JOINs to
--    competitor `raw_posts` for benchmark queries.
CREATE TABLE IF NOT EXISTS `social_intelligence.own_post_engagement_daily` (
  snapshot_id STRING NOT NULL,
  dawinos_post_id STRING NOT NULL,
  dawinos_account_id STRING NOT NULL,
  subsidiary_id STRING NOT NULL,
  platform STRING NOT NULL,
  snapshot_date DATE NOT NULL,
  impressions INT64,
  reach INT64,
  likes INT64,
  comments INT64,
  shares INT64,
  clicks INT64,
  saves INT64,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY snapshot_date
CLUSTER BY dawinos_post_id, platform;

-- 4. Mirror our SocialMediaPost lifecycle so analytics can query post counts/status by subsidiary.
CREATE TABLE IF NOT EXISTS `dawinos_operational.social_media_posts_snapshots` (
  snapshot_id STRING NOT NULL,
  event_id STRING,
  operation STRING, -- CREATE | UPDATE | DELETE
  post_id STRING NOT NULL,
  company_id STRING,
  subsidiary_id STRING,
  campaign_id STRING,
  title STRING,
  status STRING,
  platforms_json STRING,
  social_account_ids_json STRING,
  media_type STRING,
  scheduled_for TIMESTAMP,
  published_at TIMESTAMP,
  created_by STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(captured_at)
CLUSTER BY post_id, subsidiary_id, status;

CREATE TABLE IF NOT EXISTS `dawinos_operational.social_media_accounts_snapshots` (
  snapshot_id STRING NOT NULL,
  event_id STRING,
  operation STRING,
  account_id STRING NOT NULL,
  subsidiary_id STRING,
  platform STRING,
  display_name STRING,
  handle STRING,
  profile_url STRING,
  status STRING,
  tracking_enabled BOOL,
  oauth_enabled BOOL,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(captured_at)
CLUSTER BY account_id, subsidiary_id, platform;
