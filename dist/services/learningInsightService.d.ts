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
        recent: {
            count: number;
            average: number;
        };
        previous: {
            count: number;
            average: number;
        };
        trend: 'improving' | 'declining' | 'stable' | 'insufficient';
        delta: number | null;
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
        status: 'insufficient' | 'valid';
    };
    sessionMetrics: {
        focus_level_avg: number | null;
        teacher_notes: string[];
    };
    upcomingLearning: Array<{
        date: string;
        class_name: string;
    }>;
    dataQuality: 'FULL' | 'PARTIAL' | 'INSUFFICIENT';
}
export declare const STRONG_THRESHOLD = 80;
export declare const ATTENTION_THRESHOLD = 50;
export declare const MIN_QUESTIONS_TOPIC = 5;
export declare const buildLearningSnapshot: (studentId: number) => Promise<LearningSnapshot>;
export declare const generateStudentPersonalizedInsight: (snapshot: LearningSnapshot) => Promise<any>;
//# sourceMappingURL=learningInsightService.d.ts.map