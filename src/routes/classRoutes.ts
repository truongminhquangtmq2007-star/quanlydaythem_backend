import { Router } from 'express';
import { 
  getClasses, 
  createClass, 
  updateClass, 
  deleteClass, 
  assignTeacher,
  addMember,
  createSession,
  updateAttendance,
  getClassMembers,
  getClassSessions,
  getSessionAttendance,
  getClass
} from '../controllers/classController';
import { getAssignableDocuments, assignDocumentsToClass } from '../controllers/classDocumentController';
import { getClassAssignments } from '../controllers/assignmentController';
import { verifyToken, isTeacherOrAdmin, isAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/', verifyToken, isTeacherOrAdmin, getClasses);
router.get('/:id', verifyToken, isTeacherOrAdmin, getClass);
router.post('/', verifyToken, isTeacherOrAdmin, createClass);
router.put('/:id', verifyToken, isTeacherOrAdmin, updateClass);
router.delete('/:id', verifyToken, isTeacherOrAdmin, deleteClass);
router.put('/:id/assign-teacher', verifyToken, isTeacherOrAdmin, assignTeacher);

// ==========================================
// API MỚI CHO PHASE 1 - CORE
// ==========================================

router.get('/:id/members', verifyToken, isTeacherOrAdmin, getClassMembers);
router.post('/:id/members', verifyToken, isTeacherOrAdmin, addMember);

router.get('/:id/sessions', verifyToken, isTeacherOrAdmin, getClassSessions);
router.post('/:id/sessions', verifyToken, isTeacherOrAdmin, createSession);

router.get('/:id/assignments', verifyToken, isTeacherOrAdmin, getClassAssignments);

router.get('/sessions/:id/attendance', verifyToken, isTeacherOrAdmin, getSessionAttendance);
router.put('/sessions/:id/attendance', verifyToken, isTeacherOrAdmin, updateAttendance);


router.get('/:id/assignable-documents', verifyToken, isTeacherOrAdmin, getAssignableDocuments);
router.post('/:id/assign-documents', verifyToken, isTeacherOrAdmin, assignDocumentsToClass);

export default router;