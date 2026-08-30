CREATE TABLE IF NOT EXISTS monthly_student_reports (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  remark_text TEXT,
  data_summary JSONB,
  generated_by VARCHAR(20) DEFAULT 'AI',
  edited_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, month)
);

