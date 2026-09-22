-- API availability is not proof of Meta App Review approval.

ALTER TABLE `instagram_public_connections`
  MODIFY COLUMN `app_review_status`
    enum('unknown','api_available','required','error')
    NOT NULL DEFAULT 'unknown';
