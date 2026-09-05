export interface TopicPerformance {
    topic: string;
    total_questions: number;
    correct_answers: number;
    accuracy: number;
}
export interface LearningSnapshot {
    student: {
        id: number;
        full_name: string;
        learning_goals?: string;
    };
    period: {
        start: string;
        end: string;
    };
    examMetrics: {
        total_completed_exams: number;
        recent: {
            count: number;
            average: number;
        };
        previous: {
            count: number;
            average: number;
        };
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
    upcomingLearning: Array<{
        date: string;
        class_name: string;
    }>;
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
export declare const STRONG_THRESHOLD = 80;
export declare const ATTENTION_THRESHOLD = 50;
export declare const MIN_QUESTIONS_TOPIC = 5;
export declare const buildLearningSnapshot: (studentId: number) => Promise<LearningSnapshot>;
export declare const generateDeterministicRecommendations: (snapshot: LearningSnapshot) => GeneratedInsight;
export declare const generateStudentPersonalizedInsight: (snapshot: LearningSnapshot) => Promise<GeneratedInsight>;
//# sourceMappingURL=learningInsightService.d.ts.map