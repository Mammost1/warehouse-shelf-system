import { Request, Response } from 'express';
import * as reservationService from '../services/reservationService';
import type { ReserveSlotBody } from '../types';

export async function reserveSlot(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as ReserveSlotBody;
    const { orderId, category } = body;
    if (!orderId || !category) {
      res.status(400).json({ error: 'orderId and category are required' });
      return;
    }
    const result = await reservationService.reserveSlot(body);
    res.status(201).json({
      message: 'Slot reserved',
      location: {
        shelf: result.shelf,
        level: result.level,
        slot: result.slot,
        slotId: result.slotId,
        locationLabel: `Shelf: ${result.shelf} | Level: ${result.level} | Slot: ${result.slot}`,
      },
    });
  } catch (err: any) {
    if (err?.code === 'ORDER_ALREADY_RESERVED') {
      res.status(409).json({ error: err.message, alreadyAt: err.alreadyAt });
      return;
    }
    res.status(500).json({ error: err?.message || 'Failed to reserve slot' });
  }
}

export async function getOrderLocation(req: Request, res: Response): Promise<void> {
  try {
    const { orderId } = req.params;
    const result = await reservationService.getOrderLocation(orderId);
    if (!result) {
      res.status(404).json({ error: 'Order not found or not assigned to a slot' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get order location' });
  }
}

export async function getSlotContents(req: Request, res: Response): Promise<void> {
  try {
    const slotId = parseInt(req.params.slotId, 10);
    if (isNaN(slotId)) {
      res.status(400).json({ error: 'Invalid slotId' });
      return;
    }
    const result = await reservationService.getSlotContents(slotId);
    if (!result) {
      res.status(404).json({ error: 'Slot not found' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get slot contents' });
  }
}

export async function getSlotByLocation(req: Request, res: Response): Promise<void> {
  try {
    const shelf = (req.query.shelf as string)?.trim();
    const levelParam = req.query.level as string;
    const slotParam = req.query.slot as string;
    const level = levelParam !== undefined && levelParam !== '' ? parseInt(levelParam, 10) : undefined;
    const slot = slotParam !== undefined && slotParam !== '' ? parseInt(slotParam, 10) : undefined;
    if (!shelf) {
      res.status(400).json({ error: 'กรอก Shelf อย่างน้อย 1 ตัว (เช่น A)' });
      return;
    }
    if (level != null && slot != null && !isNaN(level) && !isNaN(slot)) {
      const one = await reservationService.getSlotByLocation(shelf, level, slot);
      if (!one) {
        res.status(404).json({ error: 'ไม่พบ slot ที่ตำแหน่งนี้' });
        return;
      }
      res.json(one);
      return;
    }
    const list = await reservationService.getReservationsByLocation(shelf, level, slot);
    res.json({ results: list });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get slot by location' });
  }
}

export async function getSlotDetails(req: Request, res: Response): Promise<void> {
  try {
    const slotId = parseInt(req.params.slotId, 10);
    if (isNaN(slotId)) {
      res.status(400).json({ error: 'Invalid slotId' });
      return;
    }
    const result = await reservationService.getSlotDetails(slotId);
    if (!result) {
      res.status(404).json({ error: 'Slot not found' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get slot details' });
  }
}

export async function getAllReservations(req: Request, res: Response): Promise<void> {
  try {
    const list = await reservationService.getAllReservations();
    res.json({ reservations: list });
  } catch (err: any) {
    console.error('[GET /reservations]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to list reservations' });
  }
}

export async function searchReservations(req: Request, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string)?.trim() ?? '';
    const list = await reservationService.searchReservations(q);
    res.json({ results: list });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Search failed' });
  }
}

export async function getSlotStatus(req: Request, res: Response): Promise<void> {
  try {
    const shelfId = (req.query.shelfId as string)?.trim() || undefined;
    const shelfLimit = req.query.shelfLimit !== undefined ? parseInt(String(req.query.shelfLimit), 10) : undefined;
    const shelfOffset = req.query.shelfOffset !== undefined ? parseInt(String(req.query.shelfOffset), 10) : undefined;
    const result = await reservationService.getSlotStatus({ shelfId, shelfLimit, shelfOffset });
    res.json({ slots: result.slots, totalShelves: result.totalShelves });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get slot status' });
  }
}

export async function getShelvesSummary(req: Request, res: Response): Promise<void> {
  try {
    const list = await reservationService.getShelvesSummary();
    res.json({ shelves: list });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get shelves summary' });
  }
}

export async function unreserveOrder(req: Request, res: Response): Promise<void> {
  try {
    const orderId = (req.body?.orderId ?? req.params?.orderId) as string;
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      res.status(400).json({ error: 'orderId is required' });
      return;
    }
    const result = await reservationService.unreserveOrder(orderId.trim());
    res.json({ message: 'Unreserved', orderId: result.orderId, locationLabel: result.locationLabel });
  } catch (err: any) {
    if (err?.message?.includes('ไม่มีการจอง')) {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err?.message || 'Failed to unreserve' });
  }
}

export async function getReservationHistory(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit !== undefined ? parseInt(String(req.query.limit), 10) : 100;
    const offset = req.query.offset !== undefined ? parseInt(String(req.query.offset), 10) : 0;
    const action = (req.query.action as 'reserve' | 'unreserve') || undefined;
    const category = (req.query.category as string)?.trim() || undefined;
    const dateFrom = (req.query.dateFrom as string)?.trim() || undefined;
    const dateTo = (req.query.dateTo as string)?.trim() || undefined;
    const { list, total } = await reservationService.getReservationHistory({ limit, offset, action, category, dateFrom, dateTo });
    res.json({ history: list, total });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get history' });
  }
}
