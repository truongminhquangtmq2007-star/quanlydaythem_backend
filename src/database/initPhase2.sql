-- =========================================================================
-- KHỞI TẠO CẤU TRÚC DATABASE PHASE 2 - LEARNING
-- =========================================================================

-- 1. Bảng Kho Học Liệu (documents)
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  document_code VARCHAR(50) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'REFERENCE', -- LECTURE, EXERCISE, EXAM, REFERENCE
  file_url TEXT,
  grade VARCHAR(50),
  subject VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bổ sung cột nếu bảng đã tồn tại từ trước nhưng thiếu cột
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_code VARCHAR(50) UNIQUE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'REFERENCE';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS grade VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS subject VARCHAR(100);

-- 2. Bảng Bài Tập Đã Giao (assignments)
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  due_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bổ sung cột nếu bảng đã tồn tại từ trước nhưng thiếu cột
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_at TIMESTAMP;

