import { Router } from 'express';
import * as reservationController from '../controllers/reservationController';

const router = Router();

router.post('/reserve-slot', reservationController.reserveSlot);
router.get('/order/:orderId', reservationController.getOrderLocation);
router.get('/slot-by-location', reservationController.getSlotByLocation);
router.get('/slot/:slotId/details', reservationController.getSlotDetails);
router.get('/slot/:slotId', reservationController.getSlotContents);
router.get('/reservations', reservationController.getAllReservations);
router.get('/slot-status', reservationController.getSlotStatus);
router.get('/shelves-summary', reservationController.getShelvesSummary);
router.get('/search', reservationController.searchReservations);
router.post('/unreserve', reservationController.unreserveOrder);
router.get('/history', reservationController.getReservationHistory);

export default router;
