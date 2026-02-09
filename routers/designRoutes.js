// routes/designRoutes.js
import express from 'express';
import { getDesigns, getDesign, createDesign } from '../controllers/DesignController.js';

const router = express.Router();

router.get('/', getDesigns);
router.get('/:id', getDesign);
router.post('/createDesign', createDesign);

export default router;
