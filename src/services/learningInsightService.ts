import pool from '../db';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

export interface TopicPerformance {
    topic: string;
    total_questions: number;
    correct_answers: number;
    accuracy: number;
}

export interface LearningSnapshot {
    student: { id: number; full_name: string; learning_goals?: string };
    period: { start: string; end: string };
    examMetrics: {
        total_completed_exams: number;
        recent: { count: number; average: number };
        previous: { count: number; average: number };
        partBreakdown: {
            part1_avg: number | null;
            part2_avg: number | null;
            part3_avg: number | null;
        };
        trend: 'improving' | 'declining' | 'stable' | 'insufficient';
        delta: number | null;
        recentScores: Array<{
            id: number;
            document_id: number;
            total_score: number;
            submitted_at: string;
            part1_score?: number | null;
            part2_score?: number | null;
            part3_score?: number | null;
        }>;
    };
    attendanceMetrics: {
        present: number;
        absent: number;
        late: number;
        rate: number;
        status: 'insufficient' | 'valid';
    };
    topicMetrics: {
        strengths: TopicPerformance[];
        focusAreas: TopicPerformance[];
        allTopics: TopicPerformance[];
        status: 'insufficient' | 'valid';
    };
    sessionMetrics: {
        focus_level_summary: string | null;
        teacher_notes: string[];
    };
    upcomingLearning: Array<{ date: string; class_name: string }>;
    dataQuality: 'FULL' | 'PARTIAL' | 'INSUFFICIENT';
}

export interface GeneratedInsight {
    summary: string;
    strengths: string[];
    focus_areas: string[];
    action_plan: string[];
    confidence_score: number;
    part_analysis?: {
        part1?: string;
        part2?: string;
        part3?: string;
    };
}

export const STRONG_THRESHOLD = 80;
export const ATTENTION_THRESHOLD = 50;
export const MIN_QUESTIONS_TOPIC = 5;

// ========================================================
// 1. BUILD DETERMINISTIC LEARNING SNAPSHOT
// ========================================================
export const buildLearningSnapshot = async (studentId: number): Promise<LearningSnapshot> => {
    // 1. Student Profile
    const studentRes = await pool.query('SELECT id, full_name, learning_goals FROM students WHERE id = $1', [studentId]);
    if (studentRes.rows.length === 0) {
        throw new Error('STUDENT_NOT_FOUND');
    }
    const student = studentRes.rows[0];

    // 2. Exam Metrics & Trend (STRICTLY FILTER: status = 'COMPLETED')
    const examsRes = await pool.query(`
        SELECT 
            id,
            document_id,
            total_score, 
            part1_score,
            part2_score,
            part3_score,
            submitted_at 
        FROM exam_submissions 
        WHERE student_id = $1 AND status = 'COMPLETED'
        ORDER BY submitted_at DESC 
        LIMIT 10
    `, [studentId]);

    const completedExams = examsRes.rows;
    const recentExams = completedExams.slice(0, 3);
    const prevExams = completedExams.slice(3, 6);

    const calcAvg = (exams: any[]) => exams.length > 0 
        ? exams.reduce((s, e) => s + Number(e.total_score || 0), 0) / exams.length 
        : 0;
    
    const recentAvg = calcAvg(recentExams);
    const prevAvg = calcAvg(prevExams);

    // Calculate Part 1, 2, 3 averages
    const calcPartAvg = (partCol: 'part1_score' | 'part2_score' | 'part3_score') => {
        const valid = completedExams
            .map(e => e[partCol])
            .filter(v => v !== null && v !== undefined)
            .map(Number);
        return valid.length > 0 
            ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 
            : null;
    };

    const part1_avg = calcPartAvg('part1_score');
    const part2_avg = calcPartAvg('part2_score');
    const part3_avg = calcPartAvg('part3_score');

    let trend: 'improving' | 'declining' | 'stable' | 'insufficient' = 'insufficient';
    let delta: number | null = null;
    
    if (recentExams.length >= 2 && prevExams.length >= 1) {
        delta = recentAvg - prevAvg;
        if (delta >= 1.0) trend = 'improving';
        else if (delta <= -1.0) trend = 'declining';
        else trend = 'stable';
    } else if (recentExams.length >= 2) {
        // Xu hướng giữa bài mới nhất và bài cũ nhất trong nhóm gần đây
        delta = Number(recentExams[0].total_score) - Number(recentExams[recentExams.length - 1].total_score);
        if (delta >= 1.0) trend = 'improving';
        else if (delta <= -1.0) trend = 'declining';
        else trend = 'stable';
    }

    // 3. Topic Metrics (Canonical column: topic_name)
    const topicsRes = await pool.query(`
        SELECT 
            TRIM(topic_name) as topic_name, 
            SUM(total_questions)::int as total_questions, 
            SUM(correct_answers)::int as correct_answers, 
            ROUND(CAST(SUM(correct_answers) AS NUMERIC) * 100.0 / NULLIF(SUM(total_questions), 0), 1) as accuracy_rate 
        FROM student_topic_performance 
        WHERE student_id = $1
        GROUP BY TRIM(topic_name)
        HAVING SUM(total_questions) > 0
        ORDER BY accuracy_rate DESC, total_questions DESC
    `, [studentId]);

    let topicRows: any[] = topicsRes.rows;

    // Fallback: If student_topic_performance is empty, aggregate from completed exam_submissions topic_performance JSONB
    if (topicRows.length === 0) {
        const jsonbRes = await pool.query(`
            SELECT topic_performance 
            FROM exam_submissions 
            WHERE student_id = $1 AND status = 'COMPLETED' AND topic_performance IS NOT NULL 
            LIMIT 20
        `, [studentId]);

        if (jsonbRes.rows.length > 0) {
            const aggregate: Record<string, { correct: number; total: number }> = {};
            for (const row of jsonbRes.rows) {
                const tp = row.topic_performance as Record<string, any>;
                if (tp && typeof tp === 'object') {
                    for (const [topic, stats] of Object.entries(tp)) {
                        const cleanTopic = String(topic).trim();
                        if (!aggregate[cleanTopic]) aggregate[cleanTopic] = { correct: 0, total: 0 };
                        aggregate[cleanTopic].correct += Number(stats.correct || stats.corrects || 0);
                        aggregate[cleanTopic].total += Number(stats.total || stats.attempts || 0);
                    }
                }
            }
            topicRows = Object.entries(aggregate).map(([topic_name, s]) => ({
                topic_name,
                total_questions: s.total,
                correct_answers: s.correct,
                accuracy_rate: s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0
            })).sort((a, b) => b.accuracy_rate - a.accuracy_rate);
        }
    }

    const strengths: TopicPerformance[] = [];
    const focusAreas: TopicPerformance[] = [];
    const allTopics: TopicPerformance[] = [];

    topicRows.forEach(r => {
        const total = Number(r.total_questions || 0);
        const correct = Number(r.correct_answers || 0);
        const acc = Math.round(Number(r.accuracy_rate || (total > 0 ? (correct / total) * 100 : 0)));
        const perf: TopicPerformance = {
            topic: r.topic_name,
            total_questions: total,
            correct_answers: correct,
            accuracy: acc
        };
        allTopics.push(perf);

        // Phân loại Thế mạnh / Lỗ hổng: YÊU CẦU tối thiểu MIN_QUESTIONS_TOPIC (>= 5 câu)
        if (total >= MIN_QUESTIONS_TOPIC) {
            if (acc >= STRONG_THRESHOLD) strengths.push(perf);
            else if (acc <= ATTENTION_THRESHOLD) focusAreas.push(perf);
        }
    });

    // 4. Attendance
    const attRes = await pool.query(`
        SELECT status FROM attendance 
        WHERE student_id = $1 AND attendance_date >= CURRENT_DATE - INTERVAL '30 days'
    `, [studentId]);
    const attendanceCount = attRes.rows.length;
    const present = attRes.rows.filter(r => r.status === 'PRESENT' || r.status === 'Có mặt').length;
    const absent = attRes.rows.filter(r => r.status === 'ABSENT' || r.status === 'Vắng').length;
    const late = attRes.rows.filter(r => r.status === 'LATE' || r.status === 'Muộn').length;
    const attRate = attendanceCount > 0 ? Math.round((present / attendanceCount) * 100) : 100;

    // 5. Session Metrics (focus_level is VARCHAR in DB)
    const sessionRes = await pool.query(`
        SELECT focus_level, teacher_notes FROM session_evaluations 
        WHERE student_id = $1 
        ORDER BY id DESC LIMIT 5
    `, [studentId]);
    const notes = sessionRes.rows.map(r => r.teacher_notes).filter((n): n is string => Boolean(n && String(n).trim() !== ''));
    const validFocus = sessionRes.rows
        .map(r => r.focus_level)
        .filter(f => f && String(f).trim() !== '-' && String(f).trim() !== '');
    const focusSummary = validFocus.length > 0 ? String(validFocus[0]) : null;

    // 6. Upcoming Sessions
    const upcomingRes = await pool.query(`
        SELECT DISTINCT s.session_date, c.class_name
        FROM sessions s
        JOIN classes c ON s.class_id = c.id
        JOIN enrollments e ON e.class_id = c.id
        WHERE e.student_id = $1 
          AND (e.status IS NULL OR e.status = 'ACTIVE' OR e.status = 'Đang học')
          AND s.session_date >= CURRENT_DATE
        ORDER BY s.session_date ASC 
        LIMIT 3
    `, [studentId]);

    // 7. Data Quality Logic
    let quality: 'FULL' | 'PARTIAL' | 'INSUFFICIENT' = 'INSUFFICIENT';
    if (completedExams.length >= 2 && (attendanceCount >= 2 || allTopics.length >= 1)) {
        quality = 'FULL';
    } else if (completedExams.length >= 1 || attendanceCount >= 1 || allTopics.length >= 1) {
        quality = 'PARTIAL';
    }

    return {
        student: { id: student.id, full_name: student.full_name, learning_goals: student.learning_goals },
        period: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() },
        examMetrics: {
            total_completed_exams: completedExams.length,
            recent: { count: recentExams.length, average: Math.round(recentAvg * 10) / 10 },
            previous: { count: prevExams.length, average: Math.round(prevAvg * 10) / 10 },
            partBreakdown: {
                part1_avg,
                part2_avg,
                part3_avg
            },
            trend,
            delta: delta !== null ? Math.round(delta * 10) / 10 : null,
            recentScores: completedExams.map(e => ({
                id: e.id,
                document_id: e.document_id,
                total_score: Number(e.total_score),
                submitted_at: e.submitted_at ? new Date(e.submitted_at).toISOString() : new Date().toISOString(),
                part1_score: e.part1_score !== null ? Number(e.part1_score) : null,
                part2_score: e.part2_score !== null ? Number(e.part2_score) : null,
                part3_score: e.part3_score !== null ? Number(e.part3_score) : null
            }))
        },
        attendanceMetrics: {
            present, absent, late, rate: attRate,
            status: attendanceCount >= 2 ? 'valid' : 'insufficient'
        },
        topicMetrics: {
            strengths, focusAreas, allTopics,
            status: allTopics.length > 0 ? 'valid' : 'insufficient'
        },
        sessionMetrics: {
            focus_level_summary: focusSummary,
            teacher_notes: notes
        },
        upcomingLearning: upcomingRes.rows.map(r => ({
            date: r.session_date ? new Date(r.session_date).toISOString().split('T')[0] : '',
            class_name: r.class_name
        })),
        dataQuality: quality
    };
};

// ========================================================
// 2. DETERMINISTIC RECOMMENDATIONS ENGINE
// ========================================================
export const generateDeterministicRecommendations = (snapshot: LearningSnapshot): GeneratedInsight => {
    const studentName = snapshot.student.full_name || 'Học sinh';
    const totalExams = snapshot.examMetrics.total_completed_exams;
    const recentAvg = snapshot.examMetrics.recent.average;
    const trend = snapshot.examMetrics.trend;
    const attRate = snapshot.attendanceMetrics.rate;
    const strengths = snapshot.topicMetrics.strengths;
    const focusAreas = snapshot.topicMetrics.focusAreas;
    const upcoming = snapshot.upcomingLearning;

    const trendText = trend === 'improving' 
        ? 'đang có xu hướng tiến bộ rõ rệt' 
        : trend === 'declining' 
        ? 'có dấu hiệu chững lại và cần củng cố' 
        : trend === 'stable' 
        ? 'duy trì phong độ ổn định' 
        : 'cần tích lũy thêm kết quả làm bài';

    const partInfo: string[] = [];
    if (snapshot.examMetrics.partBreakdown.part1_avg !== null) {
        partInfo.push(`Phần I (Trắc nghiệm): ${snapshot.examMetrics.partBreakdown.part1_avg}/10`);
    }
    if (snapshot.examMetrics.partBreakdown.part2_avg !== null) {
        partInfo.push(`Phần II (Đúng/Sai): ${snapshot.examMetrics.partBreakdown.part2_avg}/10`);
    }
    if (snapshot.examMetrics.partBreakdown.part3_avg !== null) {
        partInfo.push(`Phần III (Trả lời ngắn): ${snapshot.examMetrics.partBreakdown.part3_avg}/10`);
    }

    const summary = totalExams > 0 
        ? `Đánh giá tổng quan tiến độ của ${studentName}: Điểm trung bình gần đây đạt ${recentAvg}/10 qua ${totalExams} bài thi hoàn thành (${trendText}). Tỷ lệ chuyên cần 30 ngày qua đạt ${attRate}%.${partInfo.length > 0 ? ' Điểm theo phần: ' + partInfo.join(', ') + '.' : ''}`
        : `Học sinh ${studentName} hiện có tỷ lệ chuyên cần ${attRate}%. Cần làm thêm các bài kiểm tra đánh giá để hệ thống phân tích năng lực chi tiết.`;

    const strengthList = strengths.length > 0
        ? strengths.map(s => `${s.topic} (Độ chính xác: ${s.accuracy}% trên ${s.total_questions} câu)`)
        : ['Chưa có chuyên đề đạt ngưỡng thế mạnh vững chắc (≥ 80% trên tối thiểu 5 câu). Cần tích cực luyện thêm.'];

    const focusList = focusAreas.length > 0
        ? focusAreas.map(f => `${f.topic} (Độ chính xác: ${f.accuracy}% trên ${f.total_questions} câu) - Cần củng cố phương pháp`)
        : ['Chưa phát hiện lỗ hổng nghiêm trọng (< 50%). Tiếp tục duy trì phong độ.'];

    // 4-PRIORITY DETERMINISTIC ACTION PLAN
    const actionPlan: string[] = [];

    // Priority 1: Lỗ hổng kiến thức
    if (focusAreas.length > 0) {
        actionPlan.push(
            `[Ưu tiên 1 - Khắc phục lỗ hổng]: Tập trung giải lại các bài tập thuộc chuyên đề ${focusAreas.map(f => f.topic).join(', ')}, đặc biệt là phương pháp nhận diện và suy luận công thức.`
        );
    } else {
        actionPlan.push(
            `[Ưu tiên 1 - Khắc phục lỗ hổng]: Hiện không có chuyên đề nào dưới 50%. Hãy rà soát lại các câu sai ngẫu nhiên trong bài thi gần nhất để tránh mất điểm đáng tiếc.`
        );
    }

    // Priority 2: Phát huy thế mạnh
    if (strengths.length > 0) {
        actionPlan.push(
            `[Ưu tiên 2 - Phát huy thế mạnh]: Thử sức với các bài toán vận dụng cao ở chuyên đề ${strengths.map(s => s.topic).join(', ')} để tối ưu điểm số Phần II và Phần III.`
        );
    } else {
        actionPlan.push(
            `[Ưu tiên 2 - Phát huy thế mạnh]: Làm thêm ít nhất 10 bài tập ở chuyên đề quen thuộc để xây dựng chuyên đề thế mạnh đạt trên 80%.`
        );
    }

    // Priority 3: Kỷ luật & Chuyên cần
    if (attRate < 80) {
        actionPlan.push(
            `[Ưu tiên 3 - Chuyên cần]: Tỷ lệ chuyên cần đang ở mức ${attRate}%. Hãy tham gia đầy đủ các buổi học tiếp theo để tránh hổng kiến thức mới.`
        );
    } else {
        actionPlan.push(
            `[Ưu tiên 3 - Chuyên cần]: Duy trì chuyên cần xuất sắc (${attRate}%), tích cực tương tác và đặt câu hỏi cho giáo viên khi chưa hiểu bài.`
        );
    }

    // Priority 4: Kế hoạch tiếp theo
    if (upcoming.length > 0) {
        actionPlan.push(
            `[Ưu tiên 4 - Chuẩn bị lịch trình]: Chuẩn bị trước bài cho buổi học sắp tới: ${upcoming[0].class_name} (${upcoming[0].date}).`
        );
    } else {
        actionPlan.push(
            `[Ưu tiên 4 - Chuẩn bị lịch trình]: Hoàn thành đầy đủ các bài tập tự luyện và chuẩn bị sẵn sàng cho bài kiểm tra định kỳ tiếp theo.`
        );
    }

    return {
        summary,
        strengths: strengthList,
        focus_areas: focusList,
        action_plan: actionPlan,
        confidence_score: snapshot.dataQuality === 'FULL' ? 0.95 : snapshot.dataQuality === 'PARTIAL' ? 0.75 : 0.5,
        part_analysis: {
            part1: snapshot.examMetrics.partBreakdown.part1_avg !== null ? `Trung bình Phần I: ${snapshot.examMetrics.partBreakdown.part1_avg}/10` : 'Chưa có dữ liệu Phần I',
            part2: snapshot.examMetrics.partBreakdown.part2_avg !== null ? `Trung bình Phần II: ${snapshot.examMetrics.partBreakdown.part2_avg}/10` : 'Chưa có dữ liệu Phần II',
            part3: snapshot.examMetrics.partBreakdown.part3_avg !== null ? `Trung bình Phần III: ${snapshot.examMetrics.partBreakdown.part3_avg}/10` : 'Chưa có dữ liệu Phần III'
        }
    };
};

// ========================================================
// 3. AI-POWERED INSIGHT WITH DETERMINISTIC FALLBACK
// ========================================================
export const generateStudentPersonalizedInsight = async (snapshot: LearningSnapshot): Promise<GeneratedInsight> => {
    // 1. Luôn có sẵn bản phân tích tất định (Deterministic) làm fallback an toàn tuyệt đối
    const deterministicInsight = generateDeterministicRecommendations(snapshot);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("⚠️ GEMINI_API_KEY không tồn tại, trả về bản phân tích tất định chất lượng cao.");
        return deterministicInsight;
    }

    try {
        const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30000 } });
        const modelName = 'gemini-3.7-flash';

        const prompt = `
Bạn là một trợ lý AI Sư phạm Cố vấn học tập chuyên sâu. Hãy phân tích báo cáo kết quả học tập của học sinh sau đây và đưa ra nhận xét sư phạm xác thực, cụ thể, không được bịa đặt bất kỳ số liệu nào khác ngoài dữ liệu được cung cấp:

DỮ LIỆU ĐO LƯỜNG TẤT ĐỊNH:
- Tên học sinh: ${snapshot.student.full_name}
- Điểm trung bình gần đây: ${snapshot.examMetrics.recent.average}/10
- Xu hướng học tập: ${snapshot.examMetrics.trend} (Delta: ${snapshot.examMetrics.delta ?? 'Không đủ dữ liệu'})
- Phân rã điểm theo phần đề thi:
  + Phần I (Trắc nghiệm 4 lựa chọn): ${snapshot.examMetrics.partBreakdown.part1_avg ?? 'Chưa có'}/10
  + Phần II (Trắc nghiệm Đúng/Sai 4 ý): ${snapshot.examMetrics.partBreakdown.part2_avg ?? 'Chưa có'}/10
  + Phần III (Trả lời ngắn): ${snapshot.examMetrics.partBreakdown.part3_avg ?? 'Chưa có'}/10
- Chuyên đề thế mạnh (≥80% trên tối thiểu 5 câu): ${snapshot.topicMetrics.strengths.map(s => `${s.topic} (${s.accuracy}%)`).join(', ') || 'Chưa có'}
- Chuyên đề cần bổ sung (≤50% trên tối thiểu 5 câu): ${snapshot.topicMetrics.focusAreas.map(f => `${f.topic} (${f.accuracy}%)`).join(', ') || 'Không có chuyên đề báo động'}
- Tỷ lệ chuyên cần: ${snapshot.attendanceMetrics.rate}% (${snapshot.attendanceMetrics.present} buổi có mặt, ${snapshot.attendanceMetrics.absent} vắng, ${snapshot.attendanceMetrics.late} trễ)
- Ghi chú gần nhất của giáo viên: ${snapshot.sessionMetrics.teacher_notes.join('; ') || 'Chưa có ghi chú'}
- Buổi học sắp tới: ${snapshot.upcomingLearning.map(u => `${u.class_name} ngày ${u.date}`).join(', ') || 'Chưa có lịch'}

YÊU CẦU ĐẦU RA JSON:
Trả về DUY NHẤT một JSON hợp lệ (không kèm Markdown \`\`\`json) có cấu trúc:
{
  "summary": "Nhận xét tổng quan súc tích về tiến độ, điểm trung bình và xu hướng",
  "strengths": ["Mỗi dòng nhận xét 1 thế mạnh cụ thể kèm số liệu"],
  "focus_areas": ["Mỗi dòng nhận xét 1 lỗ hổng cần khắc phục"],
  "action_plan": [
    "[Ưu tiên 1 - Lỗ hổng]: Hành động cụ thể",
    "[Ưu tiên 2 - Thế mạnh]: Hành động nâng cao",
    "[Ưu tiên 3 - Kỷ luật]: Hành động chuyên cần",
    "[Ưu tiên 4 - Lịch trình]: Chuẩn bị bài tiếp theo"
  ],
  "confidence_score": ${snapshot.dataQuality === 'FULL' ? 0.95 : 0.75}
}
`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt
        });

        const rawText = response.text || '';
        const cleanJson = rawText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed && parsed.summary && Array.isArray(parsed.action_plan)) {
            return {
                summary: parsed.summary,
                strengths: parsed.strengths || deterministicInsight.strengths,
                focus_areas: parsed.focus_areas || deterministicInsight.focus_areas,
                action_plan: parsed.action_plan,
                confidence_score: parsed.confidence_score || deterministicInsight.confidence_score,
                part_analysis: deterministicInsight.part_analysis
            };
        }
        return deterministicInsight;
    } catch (aiErr: any) {
        console.warn("⚠️ AI Service không phản hồi hoặc gặp lỗi, tự động dùng kết quả tất định. Chi tiết:", aiErr?.message || aiErr);
        return deterministicInsight;
    }
};
