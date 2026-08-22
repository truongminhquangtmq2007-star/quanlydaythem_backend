-- =========================================================================
-- KHỞI TẠO CẤU TRÚC DATABASE PHASE 3 - EXAM ENGINE
-- =========================================================================

-- 1. Bảng Ngân hàng Đề thi (exams)
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL, -- liên kết file gốc
  title VARCHAR(255) NOT NULL,
  grade VARCHAR(50),
  subject VARCHAR(100),
  duration_minutes INTEGER DEFAULT 60,
  status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, PUBLISHED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Ngữ cảnh / Bài đọc chùm (question_contexts)
CREATE TABLE IF NOT EXISTS question_contexts (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT
);

-- 3. Bảng Câu hỏi (questions)
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
  context_id INTEGER REFERENCES question_contexts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  question_type VARCHAR(50) DEFAULT 'MCQ', -- MCQ, TRUE_FALSE, SHORT_ANSWER
  difficulty VARCHAR(50) DEFAULT 'MEDIUM',
  topic VARCHAR(100),
  raw_latex TEXT,
  order_index INTEGER DEFAULT 0
);

-- 4. Bảng Lựa chọn / Đáp án (question_options)
CREATE TABLE IF NOT EXISTS question_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0
);

