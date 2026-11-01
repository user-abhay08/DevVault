-- Proposed only. Verify the production schema before applying this migration.
-- The code-review routes read and write this table. This matches the local
-- code_reviews table schema and preserves existing project data.
CREATE TABLE IF NOT EXISTS `code_reviews` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `project_id` INT NOT NULL,
    `overall_score` INT DEFAULT NULL,
    `summary` TEXT,
    `code_quality` JSON DEFAULT NULL,
    `bugs` JSON DEFAULT NULL,
    `security` JSON DEFAULT NULL,
    `performance` JSON DEFAULT NULL,
    `maintainability` JSON DEFAULT NULL,
    `recommendations` JSON DEFAULT NULL,
    `reviewed_files` JSON DEFAULT NULL,
    `reviewed_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_code_reviews_project_id` (`project_id`),
    CONSTRAINT `fk_code_reviews_project`
        FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
