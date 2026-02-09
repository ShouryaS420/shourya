import express from 'express';
import {
    createRaiseTicket,
    getRaisedTicketDetails,
    getRaisedTicketDetailsByID,
    sendMessage,
} from "../controllers/RaiseTicket.js";

const router = express.Router();

router.post('/createRaiseTicket', createRaiseTicket);
router.get('/getRaisedTicketDetails/:id', getRaisedTicketDetails);
router.get('/getRaisedTicketDetailsByID/:id', getRaisedTicketDetailsByID);
router.post('/sendMessage', sendMessage);

export default router;