-- Basis-Schema (idempotent). Für neue Umgebungen und die CI-E2E-Datenbank.
-- Danach ggf. database/migrations/*.sql anwenden.

CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type ENUM('single_draw', 'team_draw') NOT NULL DEFAULT 'single_draw',
  status ENUM('inactive', 'active', 'closed') NOT NULL DEFAULT 'active',
  settings JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Wird von der App nicht mehr beschrieben (Namen laufen über das In-Memory-Relay),
-- bleibt aus Kompatibilitätsgründen im Schema.
CREATE TABLE IF NOT EXISTS participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  session_uuid VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY fk_participants_session (session_uuid),
  CONSTRAINT fk_participants_session FOREIGN KEY (session_uuid)
    REFERENCES sessions (uuid) ON DELETE CASCADE
);
