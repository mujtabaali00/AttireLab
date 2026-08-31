/**
 * Smoke tests for lib/order-status.ts
 * Run with: npm test
 */
import {
  ORDER_STATUS_LABELS,
  getAllowedNextStatuses,
  isValidStatusTransition,
} from '@/lib/order-status'

describe('ORDER_STATUS_LABELS', () => {
  it('covers every OrderStatus', () => {
    const statuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    statuses.forEach(s => {
      expect(ORDER_STATUS_LABELS).toHaveProperty(s)
      expect(typeof ORDER_STATUS_LABELS[s as keyof typeof ORDER_STATUS_LABELS]).toBe('string')
    })
  })
})

describe('getAllowedNextStatuses', () => {
  it('PENDING can advance to PROCESSING, SHIPPED, DELIVERED, or CANCELLED', () => {
    const next = getAllowedNextStatuses('PENDING')
    expect(next).toContain('PROCESSING')
    expect(next).toContain('CANCELLED')
    expect(next).toContain('PENDING') // current status is included (stays allowed)
  })

  it('DELIVERED is a terminal state — no further transitions', () => {
    expect(getAllowedNextStatuses('DELIVERED')).toHaveLength(0)
  })

  it('CANCELLED is a terminal state — no further transitions', () => {
    expect(getAllowedNextStatuses('CANCELLED')).toHaveLength(0)
  })

  it('PAYMENT_FAILED is a terminal state — no further transitions', () => {
    expect(getAllowedNextStatuses('PAYMENT_FAILED')).toHaveLength(0)
  })
})

describe('isValidStatusTransition', () => {
  it('same-status is always valid', () => {
    expect(isValidStatusTransition('PENDING', 'PENDING')).toBe(true)
    expect(isValidStatusTransition('SHIPPED', 'SHIPPED')).toBe(true)
  })

  it('forward transitions are valid', () => {
    expect(isValidStatusTransition('PENDING', 'PROCESSING')).toBe(true)
    expect(isValidStatusTransition('PROCESSING', 'SHIPPED')).toBe(true)
    expect(isValidStatusTransition('SHIPPED', 'DELIVERED')).toBe(true)
  })

  it('backward transitions are invalid', () => {
    expect(isValidStatusTransition('DELIVERED', 'PENDING')).toBe(false)
    expect(isValidStatusTransition('SHIPPED', 'PENDING')).toBe(false)
  })

  it('any non-terminal status can be cancelled', () => {
    expect(isValidStatusTransition('PENDING', 'CANCELLED')).toBe(true)
    expect(isValidStatusTransition('PROCESSING', 'CANCELLED')).toBe(true)
    expect(isValidStatusTransition('SHIPPED', 'CANCELLED')).toBe(true)
  })

  it('cannot transition from CANCELLED', () => {
    expect(isValidStatusTransition('CANCELLED', 'PENDING')).toBe(false)
    expect(isValidStatusTransition('CANCELLED', 'DELIVERED')).toBe(false)
  })

  it('cannot transition from PAYMENT_FAILED', () => {
    expect(isValidStatusTransition('PAYMENT_FAILED', 'PENDING')).toBe(false)
    expect(isValidStatusTransition('PAYMENT_FAILED', 'DELIVERED')).toBe(false)
  })
})
