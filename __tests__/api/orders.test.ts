/**
 * Tests for POST /api/orders
 *
 * Strategy: mock Prisma, auth, and Stripe so tests run in isolation.
 * We test the key branching paths: auth, validation, COD, card success,
 * card decline, and cart state preservation on failure.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    cart: { findFirst: jest.fn() },
    order: { create: jest.fn(), update: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    notification: { create: jest.fn(), createMany: jest.fn() },
    product: { findMany: jest.fn() },
  },
}))

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: jest.fn() },
    paymentMethods: { attach: jest.fn() },
    paymentIntents: { create: jest.fn() },
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

// ── Imports ───────────────────────────────────────────────────────────────────
import { POST } from '@/app/api/orders/route'
import { db } from '@/lib/db'
import { auth } from '@/auth'
import { stripe } from '@/lib/stripe'
import { Decimal } from '@prisma/client/runtime/library'

const mockDb = db as jest.Mocked<typeof db>
const mockAuth = auth as jest.Mock
const mockStripe = stripe as jest.Mocked<typeof stripe>

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MOCK_USER = {
  id: 'usr_001',
  name: 'Test User',
  email: 'test@example.com',
  role: 'CUSTOMER',
  stripeCustomerId: 'cus_test123',
}

const MOCK_PRODUCT = {
  id: 'prod_001',
  name: 'Blue Hoodie',
  price: new Decimal('50.00'),
  status: 'ACTIVE',
  quantity: 10,
  specifications: [],
}

const MOCK_CART = {
  id: 'cart_001',
  userId: 'usr_001',
  items: [
    {
      id: 'ci_001',
      productId: 'prod_001',
      specificationId: null,
      quantity: 2,
    },
  ],
}

const MOCK_ORDER = {
  id: 'ord_TESTABCD',
  userId: 'usr_001',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  paymentMethod: 'CARD',
  total: new Decimal('110.00'),
}

const VALID_BODY = {
  items: [{ productId: 'prod_001', specificationId: null, quantity: 2 }],
  shippingAddress: { address: '123 Test St, Karachi' },
  paymentMethodType: 'CARD',
  paymentMethodId: 'pm_test_visa',
  saveCard: false,
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default: authenticated customer
    mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } })
    ;(mockDb.user.findUnique as jest.Mock).mockResolvedValue(MOCK_USER)
    ;(mockDb.cart.findFirst as jest.Mock).mockResolvedValue(MOCK_CART)
    ;(mockDb.product.findMany as jest.Mock).mockResolvedValue([MOCK_PRODUCT])
    ;(mockDb.order.create as jest.Mock).mockResolvedValue(MOCK_ORDER)
    ;(mockDb.order.update as jest.Mock).mockResolvedValue({})
    ;(mockDb.cartItem.deleteMany as jest.Mock).mockResolvedValue({})
    ;(mockDb.notification.create as jest.Mock).mockResolvedValue({})
    ;(mockDb.notification.createMany as jest.Mock).mockResolvedValue({})
    ;(mockDb.user.findMany as jest.Mock).mockResolvedValue([]) // no admins by default
    ;(mockStripe!.paymentMethods.attach as jest.Mock).mockResolvedValue({})
    ;(mockStripe!.paymentIntents.create as jest.Mock).mockResolvedValue({
      id: 'pi_test123',
      status: 'succeeded',
      client_secret: null,
    })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────
  it('returns 401 when user is not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  // ── Validation ──────────────────────────────────────────────────────────────
  it('returns 400 when items list is empty', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, items: [] }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/empty/i)
  })

  it('returns 400 when paymentMethodType is invalid', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, paymentMethodType: 'CRYPTO' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when CARD payment method ID is missing', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, paymentMethodId: undefined }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/payment method id/i)
  })

  it('returns 400 when cart session is not found in DB', async () => {
    ;(mockDb.cart.findFirst as jest.Mock).mockResolvedValueOnce(null)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/cart session/i)
  })

  it('returns 400 when checkout item is not in DB cart (session expired)', async () => {
    ;(mockDb.cart.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_CART,
      items: [], // cart is empty in DB
    })

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/refresh your cart/i)
  })

  // ── COD Happy Path ───────────────────────────────────────────────────────────
  it('creates a COD order successfully (status 201)', async () => {
    const codBody = {
      ...VALID_BODY,
      paymentMethodType: 'COD',
      paymentMethodId: undefined,
    }

    const res = await POST(makeRequest(codBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.data.success).toBe(true)
    expect(data.data.orderId).toBeDefined()
  })

  it('clears cart items after a successful COD order', async () => {
    const codBody = {
      ...VALID_BODY,
      paymentMethodType: 'COD',
      paymentMethodId: undefined,
    }

    await POST(makeRequest(codBody))
    expect(mockDb.cartItem.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cartId: MOCK_CART.id }),
      })
    )
  })

  // ── Card Happy Path ──────────────────────────────────────────────────────────
  it('creates a CARD order and marks it PAID on successful payment (status 201)', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.data.success).toBe(true)
  })

  it('clears cart items after a successful card payment', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(mockDb.cartItem.deleteMany).toHaveBeenCalled()
  })

  it('marks order status as PROCESSING and paymentStatus as PAID after card success', async () => {
    await POST(makeRequest(VALID_BODY))

    expect(mockDb.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'PAID',
          status: 'PROCESSING',
        }),
      })
    )
  })

  // ── Card Decline ─────────────────────────────────────────────────────────────
  it('returns 400 and friendly message when card is declined', async () => {
    const stripeError = Object.assign(new Error('Insufficient funds'), {
      type: 'StripeCardError',
      decline_code: 'insufficient_funds',
    })
    ;(mockStripe!.paymentIntents.create as jest.Mock).mockRejectedValueOnce(stripeError)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/insufficient funds/i)
    expect(data.orderId).toBeDefined() // order ID returned so FE can redirect to /checkout/failed
  })

  it('marks order as PAYMENT_FAILED on card decline', async () => {
    const stripeError = Object.assign(new Error('Card declined'), {
      type: 'StripeCardError',
      decline_code: 'generic_decline',
    })
    ;(mockStripe!.paymentIntents.create as jest.Mock).mockRejectedValueOnce(stripeError)

    await POST(makeRequest(VALID_BODY))

    expect(mockDb.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'FAILED',
          status: 'PAYMENT_FAILED',
        }),
      })
    )
  })

  it('does NOT clear cart items when payment fails (so user can retry)', async () => {
    const stripeError = Object.assign(new Error('Card declined'), {
      type: 'StripeCardError',
      decline_code: 'generic_decline',
    })
    ;(mockStripe!.paymentIntents.create as jest.Mock).mockRejectedValueOnce(stripeError)

    await POST(makeRequest(VALID_BODY))

    // cartItem.deleteMany must NOT be called on payment failure
    expect(mockDb.cartItem.deleteMany).not.toHaveBeenCalled()
  })

  // ── 3D Secure ────────────────────────────────────────────────────────────────
  it('returns 200 with requiresAction and clientSecret for 3DS payments', async () => {
    ;(mockStripe!.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
      id: 'pi_3ds_test',
      status: 'requires_action',
      client_secret: 'pi_3ds_test_secret_xyz',
    })

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.requiresAction).toBe(true)
    expect(data.data.clientSecret).toBe('pi_3ds_test_secret_xyz')
    // Cart must NOT be cleared until 3DS is confirmed
    expect(mockDb.cartItem.deleteMany).not.toHaveBeenCalled()
  })
})
