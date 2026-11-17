export declare const UNLINKED_STUDENT_MESSAGE = "T\u00E0i kho\u1EA3n ch\u01B0a \u0111\u01B0\u1EE3c li\u00EAn k\u1EBFt v\u1EDBi h\u1ED3 s\u01A1 h\u1ECDc sinh. Vui l\u00F2ng li\u00EAn h\u1EC7 gi\u00E1o vi\u00EAn \u0111\u1EC3 \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.";
export interface QueryablePool {
    query: (text: string, params?: any[]) => Promise<any>;
}
/**
 * Resolves the canonical `students.id` for an authenticated STUDENT user.
 * Never falls back to `users.id` and rejects mismatched or unlinked student claims.
 */
export declare const resolveCanonicalStudentId: (user: any, dbPool?: QueryablePool) => Promise<number | null>;
//# sourceMappingURL=studentIdentity.d.ts.map