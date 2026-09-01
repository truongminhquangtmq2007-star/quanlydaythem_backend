"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const calendarController_1 = require("../controllers/calendarController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const verifyTokenOrQuery = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            return next();
        }
        catch (err) {
            res.status(403).json({ message: 'Token không hợp lệ' });
            return;
        }
    }
    const token = req.query.token;
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            return next();
        }
        catch (err) {
            res.status(403).json({ message: 'Token không hợp lệ' });
            return;
        }
    }
    res.status(401).json({ message: 'Chưa xác thực người dùng' });
};
// Support both /auth and /auth-url canonical endpoints
router.get('/auth', verifyTokenOrQuery, authMiddleware_1.isTeacherOrAdmin, calendarController_1.authGoogleCalendar);
router.get('/auth-url', verifyTokenOrQuery, authMiddleware_1.isTeacherOrAdmin, calendarController_1.authGoogleCalendar);
router.get('/status', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, calendarController_1.getCalendarStatus);
router.get('/callback', calendarController_1.oauthCallback);
router.post('/sync-event', authMiddleware_1.verifyToken, authMiddleware_1.isTeacherOrAdmin, calendarController_1.syncEvent);
exports.default = router;
//# sourceMappingURL=calendarRoutes.js.map