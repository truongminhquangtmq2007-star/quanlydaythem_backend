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
}

// Phần III: Trắc nghiệm Trả lời ngắn (Điền số / kết quả)
export interface ShortAnswerQuestion {
  id: number;
  questionText: string;
  image_url?: string;
  correctAnswer: string; // Ví dụ: "56", "-3.5", "1/2"
}

// Tổng thể bài thi
export interface FullExamData {
  part1: MultipleChoiceQuestion[];
  part2: TrueFalseQuestion[];
  part3: ShortAnswerQuestion[];
}