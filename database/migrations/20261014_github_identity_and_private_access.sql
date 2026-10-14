-- Proposed only. Do not apply until the user explicitly approves it.
-- GitHub IDs are unique identities; OAuth tokens are encrypted by the backend before storage.
ALTER TABLE `users`
    ADD COLUMN `github_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `github_login` VARCHAR(39) NULL,
    ADD COLUMN `github_access_token_enc` VARBINARY(1024) NULL,
    ADD COLUMN `github_access_token_iv` BINARY(12) NULL,
    ADD COLUMN `github_access_token_tag` BINARY(16) NULL,
    ADD COLUMN `github_access_token_expires_at` DATETIME NULL,
    ADD COLUMN `github_refresh_token_enc` VARBINARY(1024) NULL,
    ADD COLUMN `github_refresh_token_iv` BINARY(12) NULL,
    ADD COLUMN `github_refresh_token_tag` BINARY(16) NULL,
    ADD COLUMN `github_refresh_token_expires_at` DATETIME NULL,
    ADD COLUMN `github_connected_at` TIMESTAMP NULL DEFAULT NULL,
    ADD UNIQUE KEY `uq_users_github_id` (`github_id`);
