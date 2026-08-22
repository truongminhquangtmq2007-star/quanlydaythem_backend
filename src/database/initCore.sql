-- =========================================================================
-- KHỞI TẠO CẤU TRÚC DATABASE LÕI (PHASE 1 - CORE)
-- Lệnh CREATE TABLE IF NOT EXISTS kết hợp ALTER TABLE để không mất dữ liệu
-- =========================================================================

-- 1. Bảng users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'TEACHER',
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Bổ sung các cột nếu bảng đã có từ trước
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'TEACHER';


-- 2. Bảng students
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_code VARCHAR(50) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  parent_phone VARCHAR(50),
  school VARCHAR(255),
  grade VARCHAR(50),
  current_level VARCHAR(100),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Bổ sung các cột nếu bảng đã có từ trước
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_code VARCHAR(50) UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS school VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS grade VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS current_level VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';


-- 3. Bảng classes
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  class_code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  subject VARCHAR(100),
  grade VARCHAR(50),
  teacher_id INTEGER REFERENCES users(id),
  max_students INTEGER DEFAULT 20,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Bổ sung các cột nếu bảng đã có từ trước
ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_code VARCHAR(50) UNIQUE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS subject VARCHAR(100);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grade VARCHAR(50);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 20;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';

-- Chuyển class_name sang name nếu class_name tồn tại
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='classes' and column_name='class_name') THEN
    EXECUTE 'UPDATE classes SET name = class_name WHERE name IS NULL';
  END IF;
END $$;


-- 4. Bảng class_members (Liên kết Học sinh - Lớp)
CREATE TABLE IF NOT EXISTS class_members (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  enroll_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  UNIQUE(class_id, student_id)
);


-- 5. Bảng sessions (Buổi học thực tế)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  content TEXT,
  document_ids JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'SCHEDULED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Bổ sung các cột nếu bảng đã có từ trước
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_date DATE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS document_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'SCHEDULED';


-- 6. Bảng attendance (Điểm danh)
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'PRESENT', -- Các giá trị: PRESENT, LATE, ABSENT_EXCUSED, ABSENT_UNEXCUSED
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, student_id)
);

