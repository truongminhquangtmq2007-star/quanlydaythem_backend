export interface ExamValidationError {
  field: string;
  message: string;
  part?: string;
  question_id?: number | string;
}

export interface ExamValidationResult {
  isValid: boolean;
  errors: ExamValidationError[];
  sanitizedExam?: any;
}

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript\s*:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi
];

export function sanitizeText(text: any): string {
  if (text === null || text === undefined) return '';
  let str = String(text).trim();
  for (const pattern of DANGEROUS_PATTERNS) {
    str = str.replace(pattern, '');
  }
  return str;
}

export function normalizeTrueFalseValue(val: any): 'Đ' | 'S' | '' {
  if (val === null || val === undefined) return '';
  const s = String(val).trim().toUpperCase();
  if (s === 'Đ' || s === 'D' || s === 'ĐÚNG' || s === 'DUNG' || s === 'TRUE' || s === 'T' || s === '1') return 'Đ';
  if (s === 'S' || s === 'SAI' || s === 'FALSE' || s === 'F' || s === '0') return 'S';
  return '';
}

export function validateAndSanitizeExam(examData: any): ExamValidationResult {
  const errors: ExamValidationError[] = [];

  if (!examData || typeof examData !== 'object') {
    return {
      isValid: false,
      errors: [{ field: 'examData', message: 'Dữ liệu đề thi không hợp lệ hoặc rỗng.' }]
    };
  }

  const part1 = Array.isArray(examData.part1) ? examData.part1 : [];
  const part2 = Array.isArray(examData.part2) ? examData.part2 : [];
  const part3 = Array.isArray(examData.part3) ? examData.part3 : [];
  const rawShared = examData.shared_context || examData.sharedContexts || [];
  const sharedList = Array.isArray(rawShared) ? rawShared : rawShared ? [rawShared] : [];

  const sanitizedPart1: any[] = [];
  const sanitizedPart2: any[] = [];
  const sanitizedPart3: any[] = [];
  const sanitizedShared: any[] = [];

  // 1. VALIDATE PART 1 (MCQ)
  const seenP1Ids = new Set<string>();
  let p1Index = 1;

  for (const q of part1) {
    const qId = q.id !== undefined && q.id !== null ? q.id : p1Index;
    const qIdStr = String(qId);
    if (seenP1Ids.has(qIdStr)) {
      errors.push({
        field: 'part1.id',
        message: `Phần 1: Trùng lặp ID câu hỏi (${qIdStr}).`,
        part: 'part1',
        question_id: qId
      });
    }
    seenP1Ids.add(qIdStr);

    const questionText = sanitizeText(q.questionText || q.content || '');
    if (!questionText) {
      errors.push({
        field: 'part1.questionText',
        message: `Phần 1 (Câu ${qId}): Nội dung câu hỏi không được để trống.`,
        part: 'part1',
        question_id: qId
      });
    }

    const options = q.options || {};
    const optKeys = ['A', 'B', 'C', 'D'];
    const sanitizedOptions: Record<string, string> = {};

    for (const key of optKeys) {
      const optVal = sanitizeText(options[key] ?? options[key.toLowerCase()] ?? '');
      if (!optVal) {
        errors.push({
          field: `part1.options.${key}`,
          message: `Phần 1 (Câu ${qId}): Lựa chọn ${key} không được để trống.`,
          part: 'part1',
          question_id: qId
        });
      }
      sanitizedOptions[key] = optVal;
    }

    const rawAns = String(q.correctAnswer || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(rawAns)) {
      errors.push({
        field: 'part1.correctAnswer',
        message: `Phần 1 (Câu ${qId}): Đáp án đúng (${rawAns || 'rỗng'}) phải thuộc một trong các lựa chọn [A, B, C, D].`,
        part: 'part1',
        question_id: qId
      });
    }

    sanitizedPart1.push({
      ...q,
      id: qId,
      part: 'part1',
      part_number: 1,
      question_type: 'MCQ',
      questionText,
      options: sanitizedOptions,
      correctAnswer: rawAns,
      explanation: sanitizeText(q.explanation || q.solution || ''),
      topic: sanitizeText(q.topic || q.main_topic || q.sub_topic || 'Chung'),
      difficulty: q.difficulty || 'MEDIUM'
    });

    p1Index++;
  }

  // 2. VALIDATE PART 2 (TRUE/FALSE - EXACTLY 4 STATEMENTS)
  const seenP2Ids = new Set<string>();
  let p2Index = 1;

  for (const q of part2) {
    const qId = q.id !== undefined && q.id !== null ? q.id : p2Index;
    const qIdStr = String(qId);
    if (seenP2Ids.has(qIdStr)) {
      errors.push({
        field: 'part2.id',
        message: `Phần 2: Trùng lặp ID câu hỏi (${qIdStr}).`,
        part: 'part2',
        question_id: qId
      });
    }
    seenP2Ids.add(qIdStr);

    const questionText = sanitizeText(q.questionText || q.content || '');
    if (!questionText) {
      errors.push({
        field: 'part2.questionText',
        message: `Phần 2 (Câu ${qId}): Nội dung câu hỏi không được để trống.`,
        part: 'part2',
        question_id: qId
      });
    }

    const statements = q.statements || {};
    const stmtKeys = ['a', 'b', 'c', 'd'];
    const sanitizedStatements: Record<string, string> = {};
    const sanitizedAnswers: Record<string, 'Đ' | 'S'> = {};

    const keysPresent = Object.keys(statements).filter(k => stmtKeys.includes(k.toLowerCase()));
    if (keysPresent.length !== 4) {
      errors.push({
        field: 'part2.statements',
        message: `Phần 2 (Câu ${qId}): Bắt buộc phải có chính xác 4 mệnh đề [a, b, c, d] (hiện có: ${keysPresent.length}).`,
        part: 'part2',
        question_id: qId
      });
    }

    const rawCorrect = q.correctAnswers || q.correctAnswer || {};
    for (const key of stmtKeys) {
      const stmtVal = sanitizeText(statements[key] ?? statements[key.toUpperCase()] ?? '');
      if (!stmtVal) {
        errors.push({
          field: `part2.statements.${key}`,
          message: `Phần 2 (Câu ${qId}): Nội dung mệnh đề ${key} không được để trống.`,
          part: 'part2',
          question_id: qId
        });
      }
      sanitizedStatements[key] = stmtVal;

      const rawVal = rawCorrect[key] ?? rawCorrect[key.toUpperCase()];
      const normVal = normalizeTrueFalseValue(rawVal);
      if (!normVal) {
        errors.push({
          field: `part2.correctAnswer.${key}`,
          message: `Phần 2 (Câu ${qId}): Đáp án mệnh đề ${key} phải là 'Đ' (Đúng) hoặc 'S' (Sai).`,
          part: 'part2',
          question_id: qId
        });
      }
      sanitizedAnswers[key] = normVal as 'Đ' | 'S';
    }

    sanitizedPart2.push({
      ...q,
      id: qId,
      part: 'part2',
      part_number: 2,
      question_type: 'TRUE_FALSE',
      questionText,
      statements: sanitizedStatements,
      correctAnswers: sanitizedAnswers,
      correctAnswer: sanitizedAnswers,
      explanation: sanitizeText(q.explanation || q.solution || ''),
      topic: sanitizeText(q.topic || q.main_topic || q.sub_topic || 'Chung'),
      difficulty: q.difficulty || 'MEDIUM'
    });

    p2Index++;
  }

  // 3. VALIDATE PART 3 (SHORT ANSWER)
  const seenP3Ids = new Set<string>();
  let p3Index = 1;

  for (const q of part3) {
    const qId = q.id !== undefined && q.id !== null ? q.id : p3Index;
    const qIdStr = String(qId);
    if (seenP3Ids.has(qIdStr)) {
      errors.push({
        field: 'part3.id',
        message: `Phần 3: Trùng lặp ID câu hỏi (${qIdStr}).`,
        part: 'part3',
        question_id: qId
      });
    }
    seenP3Ids.add(qIdStr);

    const questionText = sanitizeText(q.questionText || q.content || '');
    if (!questionText) {
      errors.push({
        field: 'part3.questionText',
        message: `Phần 3 (Câu ${qId}): Nội dung câu hỏi không được để trống.`,
        part: 'part3',
        question_id: qId
      });
    }

    const rawAns = sanitizeText(q.correctAnswer ?? q.answer ?? '');
    if (!rawAns) {
      errors.push({
        field: 'part3.correctAnswer',
        message: `Phần 3 (Câu ${qId}): Đáp án trả lời ngắn không được để trống.`,
        part: 'part3',
        question_id: qId
      });
    }

    sanitizedPart3.push({
      ...q,
      id: qId,
      part: 'part3',
      part_number: 3,
      question_type: 'SHORT_ANSWER',
      questionText,
      correctAnswer: rawAns,
      explanation: sanitizeText(q.explanation || q.solution || ''),
      solution: sanitizeText(q.solution || q.explanation || ''),
      topic: sanitizeText(q.topic || q.main_topic || q.sub_topic || 'Chung'),
      difficulty: q.difficulty || 'HARD'
    });

    p3Index++;
  }

  // 4. VALIDATE SHARED CONTEXTS
  let ctxIndex = 1;
  for (const ctx of sharedList) {
    const ctxId = ctx.id || ctx.context_id || ctxIndex++;
    const content = sanitizeText(ctx.content || ctx.text || '');
    const questionIds = Array.isArray(ctx.questionIds) ? ctx.questionIds.map(Number) : (Array.isArray(ctx.question_ids) ? ctx.question_ids.map(Number) : []);

    if (!content) {
      errors.push({
        field: `shared_context.${ctxId}`,
        message: `Ngữ liệu chung (ID ${ctxId}): Nội dung ngữ cảnh không được để trống.`
      });
    }

    sanitizedShared.push({
      ...ctx,
      id: ctxId,
      context_id: ctxId,
      content,
      part: ctx.part || 'part1',
      questionIds
    });
  }

  const totalQuestions = sanitizedPart1.length + sanitizedPart2.length + sanitizedPart3.length;
  if (totalQuestions === 0) {
    errors.push({
      field: 'examContent',
      message: 'Đề thi phải có ít nhất 1 câu hỏi (trong Phần 1, Phần 2 hoặc Phần 3).'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedExam: {
      part1: sanitizedPart1,
      part2: sanitizedPart2,
      part3: sanitizedPart3,
      shared_context: sanitizedShared,
      sharedContexts: sanitizedShared
    }
  };
}
