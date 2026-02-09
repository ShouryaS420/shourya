// Importing express and controllers
import express from 'express';
import {
    createNewFamilyMember,
    getFamilyMemberDetails,
    removeFamilyMember
} from '../controllers/FamilyMember.js';

const router = express.Router();

router.post('/createNewFamilyMember', createNewFamilyMember);

// Route to get all projects
router.get('/getFamilyMemberDetails/:id', getFamilyMemberDetails);

// Route to delete family member by id
router.delete('/removeFamilyMember/:id', removeFamilyMember);

export default router;
