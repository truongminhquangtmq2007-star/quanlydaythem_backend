-- =========================================================================
-- KHỞI TẠO CẤU TRÚC DATABASE PHASE 5 - ANALYTICS ENGINE
-- =========================================================================

CREATE TABLE IF NOT EXISTS student_topic_performance (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  topic VARCHAR(255) NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, topic)
);

