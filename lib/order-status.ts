import { OrderStatus } from '@prisma/client'

// Single source of truth for how a status is labeled — every table/detail
// view imports this instead of keeping its own copy, so the label an order
// gets never drifts between screens (e.g. CANCELLED showing as "Cancelled"
// in one place and "Rejected" in another).
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'In Progress',
  SHIPPED: 'Dispatched',
  DELIVERED: 'Delivered',
  CANCELLED: 'Rejected',
}

// Solid, high-contrast badge — used in list tables and the customer detail header.
export const ORDER_STATUS_SOLID_COLOR: Record<OrderStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-yellow-400 text-white',
  SHIPPED: 'bg-blue-500 text-white',
  DELIVERED: 'bg-green-500 text-white',
  CANCELLED: 'bg-red-500 text-white',
}

// Soft, bordered badge — used for the editable admin status control.
export const ORDER_STATUS_SOFT_COLOR: Record<OrderStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
  PROCESSING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  SHIPPED: 'bg-blue-100 text-blue-700 border-blue-200',
  DELIVERED: 'bg-green-100 text-green-700 border-green-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
}

// Linear progression an order moves through; CANCELLED is a separate
// terminal state reachable from anywhere except DELIVERED/CANCELLED itself.
const FORWARD_STATUSES: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED']

// Statuses an order currently at `current` is allowed to move to next.
// Once advanced past a stage it can never go back to an earlier one, and
// DELIVERED/CANCELLED orders are locked entirely.
export function getAllowedNextStatuses(current: OrderStatus): OrderStatus[] {
  if (current === 'DELIVERED' || current === 'CANCELLED') return []
  const currentRank = FORWARD_STATUSES.indexOf(current)
  const forward = FORWARD_STATUSES.filter(s => FORWARD_STATUSES.indexOf(s) >= currentRank)
  return [...forward, 'CANCELLED']
}

export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true
  return getAllowedNextStatuses(from).includes(to)
}
