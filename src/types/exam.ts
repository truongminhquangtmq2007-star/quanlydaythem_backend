// Phần I: Trắc nghiệm 4 lựa chọn (A, B, C, D)
export interface MultipleChoiceQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  context_id?: number;
}

// Phần II: Trắc nghiệm Đúng / Sai (Mỗi câu gồm 4 ý a, b, c, d)
export interface TrueFalseQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  statements: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctAnswer: {
    a: 'Đ' | 'S';
    b: 'Đ' | 'S';
    c: 'Đ' | 'S';
    d: 'Đ' | 'S';
  };
  context_id?: number;
}

// Phần III: Trắc nghiệm Trả lời ngắn (Điền số / kết quả)
export interface ShortAnswerQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  correctAnswer: string; // Ví dụ: "56", "-3.5", "1/2"
  context_id?: number;
}

// Ngữ cảnh chung / Câu hỏi chùm (Shared Context)
export interface SharedContext {
  id: number;
  content: string;
  image_url?: string;
  questionIds: number[];
  part?: string; // Cho phép string tự do hoặc để trống (optional)
  questions?: (MultipleChoiceQuestion | TrueFalseQuestion | ShortAnswerQuestion | any)[];
  context_id?: number;
}

// Tổng thể bài thi
export interface FullExamData {
  part1: MultipleChoiceQuestion[];
  part2: TrueFalseQuestion[];
  part3: ShortAnswerQuestion[];
  shared_context?: SharedContext[];
  sharedContexts?: SharedContext[];
}

// Câu trả lời đơn lẻ của học sinh
export interface StudentAnswerItem {
  question_id: number | string;
  student_answer: string | { [statementKey: string]: 'Đ' | 'S' | string };
  part?: string;
}

// Cấu trúc payload khi học sinh nộp bài
export interface ExamSubmissionPayload {
  document_id?: number;
  exam_id?: number;
  student_answers?: {
    part1?: { [questionId: string]: string };
    part2?: { [questionId: string]: { [statement: string]: 'Đ' | 'S' } };
    part3?: { [questionId: string]: string };
    [key: string]: any;
  } | StudentAnswerItem[];
  answers?: StudentAnswerItem[];
  cheat_count?: number;
  time_taken_seconds?: number;
}

// Chi tiết đối chiếu từng câu (học sinh vs đáp án chuẩn)
export interface QuestionGradingDetail {
  question_id: number;
  part: string;
  student_answer: any;
  correct_answer: any;
  is_correct: boolean;
  score_earned: number;
  max_score: number;
  statement_results?: {
    statement: string;
    student: string;
    correct: string;
    is_correct: boolean;
  }[];
}

// Kết quả chấm điểm bài thi
export interface ExamGradingResult {
  total_score: number;
  part1_score: number;
  part2_score: number;
  part3_score: number;
  part1_correct: number;
  part1_total: number;
  part2_correct: number;
  part2_total: number;
  part3_correct: number;
  part3_total: number;
  total_correct: number;
  total_questions: number;
  cheat_count: number;
  time_taken_seconds?: number;
  allow_view_answers?: boolean;
  details: QuestionGradingDetail[];
}

