/**
 * Tests for POST /api/auth/register
 *
 * Strategy: mock Prisma, bcrypt, and Stripe so tests are fast and
 * do not require a real database or external services.
 */

// ── Mocks (must be before imports) ────────────────────────────────────────────
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password_123'),
}))

jest.mock('@/lib/stripe', () => ({
  stripe: {
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

// ── Imports ───────────────────────────────────────────────────────────────────
import { POST } from '@/app/api/auth/register/route'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { stripe } from '@/lib/stripe'

const mockDb = db as jest.Mocked<typeof db>
const mockStripe = stripe as jest.Mocked<typeof stripe>

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: user does not exist yet
    ;(mockDb.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockDb.user.create as jest.Mock).mockResolvedValue({ id: 'usr_001' })
  })

  // ── Happy Path ──────────────────────────────────────────────────────────────
  it('returns 201 and success message on valid registration', async () => {
    const res = await POST(makeRequest({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.data.message).toMatch(/successfully/i)
  })

  it('hashes the password before saving to DB', async () => {
    await POST(makeRequest({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    }))

    expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 12)
    const createCall = (mockDb.user.create as jest.Mock).mock.calls[0][0]
    expect(createCall.data.passwordHash).toBe('hashed_password_123')
    // Raw password MUST NOT be stored
    expect(createCall.data).not.toHaveProperty('password')
  })

  it('creates a Stripe customer and stores the ID during registration', async () => {
    await POST(makeRequest({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    }))

    expect(mockStripe!.customers.create).toHaveBeenCalledWith({
      email: 'alice@example.com',
      name: 'Alice Smith',
    })
    const createCall = (mockDb.user.create as jest.Mock).mock.calls[0][0]
    expect(createCall.data.stripeCustomerId).toBe('cus_test123')
  })

  // ── Conflict ────────────────────────────────────────────────────────────────
  it('returns 409 if email is already registered', async () => {
    ;(mockDb.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing',
      email: 'alice@example.com',
    })

    const res = await POST(makeRequest({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/already in use/i)
    expect(mockDb.user.create).not.toHaveBeenCalled()
  })

  // ── Validation ──────────────────────────────────────────────────────────────
  it('returns 400 with an invalid email format', async () => {
    const res = await POST(makeRequest({
      name: 'Alice Smith',
      email: 'not-an-email',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    }))

    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short', async () => {
    const res = await POST(makeRequest({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'short',
      confirmPassword: 'short',
    }))

    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest({
      email: 'alice@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    }))

    expect(res.status).toBe(400)
  })

  // ── Stripe Failure Resilience ───────────────────────────────────────────────
  it('still creates the user even if Stripe customer creation fails', async () => {
    ;(mockStripe!.customers.create as jest.Mock).mockRejectedValueOnce(
      new Error('Stripe is down')
    )

    const res = await POST(makeRequest({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    }))

    expect(res.status).toBe(201)
    const createCall = (mockDb.user.create as jest.Mock).mock.calls[0][0]
    // stripeCustomerId should be null when Stripe fails
    expect(createCall.data.stripeCustomerId).toBeNull()
  })
})
