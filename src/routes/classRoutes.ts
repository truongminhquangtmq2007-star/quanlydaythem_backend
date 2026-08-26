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
import { verifyToken, isAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/', verifyToken, getClasses);
router.get('/:id', verifyToken, getClass);
router.post('/', verifyToken, createClass);
router.put('/:id', verifyToken, updateClass);
router.delete('/:id', verifyToken, deleteClass);
router.put('/:id/assign-teacher', verifyToken, assignTeacher);

// ==========================================
// API MỚI CHO PHASE 1 - CORE
// ==========================================

router.get('/:id/members', verifyToken, getClassMembers);
router.post('/:id/members', verifyToken, addMember);

router.get('/:id/sessions', verifyToken, getClassSessions);
router.post('/:id/sessions', verifyToken, createSession);

router.get('/:id/assignments', verifyToken, getClassAssignments);

router.get('/sessions/:id/attendance', verifyToken, getSessionAttendance);
router.put('/sessions/:id/attendance', verifyToken, updateAttendance);


router.get('/:id/assignable-documents', verifyToken, getAssignableDocuments);
router.post('/:id/assign-documents', verifyToken, assignDocumentsToClass);

export default router;