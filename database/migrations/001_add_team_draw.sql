ALTER TABLE sessions
  MODIFY type ENUM('standard', 'single_draw', 'team_draw') NOT NULL DEFAULT 'single_draw';

UPDATE sessions
SET type = 'single_draw'
WHERE type IN ('', 'standard');

ALTER TABLE sessions
  MODIFY type ENUM('single_draw', 'team_draw') NOT NULL DEFAULT 'single_draw';

ALTER TABLE sessions
  ADD COLUMN settings JSON NULL AFTER status;

UPDATE sessions
SET settings = JSON_OBJECT()
WHERE settings IS NULL;
