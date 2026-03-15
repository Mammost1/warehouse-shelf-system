export interface Shelf {
  id: string;
  category: string;
  max_levels: number;
  slot_height_cm: number;
}

export interface Level {
  id: number;
  shelf_id: string;
  level_num: number;
}

export interface Slot {
  id: number;
  level_id: number;
  slot_num: number;
}

export interface Order {
  id: string;
  category: string;
  height_cm: number | null;
}

export interface Reservation {
  id: number;
  order_id: string;
  slot_id: number;
  reserved_at: string;
}

export interface SlotLocation {
  slot_id: number;
  shelf_id: string;
  level_num: number;
  slot_num: number;
  location_label: string;
}

export interface ReserveSlotBody {
  orderId: string;
  category: string;
  heightCm?: number;
  productName?: string | null;
  quantity?: number;
}

export interface OrderLocationResponse {
  orderId: string;
  location: {
    shelf: string;
    level: number;
    slot: number;
    slotId: number;
    locationLabel: string;
  } | null;
}

export interface SlotContentsResponse {
  slotId: number;
  shelf: string;
  level: number;
  slot: number;
  locationLabel: string;
  orderId: string | null;
}
