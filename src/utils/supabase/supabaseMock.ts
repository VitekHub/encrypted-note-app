import { vi } from 'vitest'

export interface SupabaseChainResult {
  data?: unknown
  error?: { message: string; code?: string } | null
}

export interface SupabaseAuthMock {
  getSession: ReturnType<typeof vi.fn>
  signUp: ReturnType<typeof vi.fn>
  signInWithPassword: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  updateUser: ReturnType<typeof vi.fn>
}

export interface SupabaseFromChain {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

export interface SupabaseMock {
  auth: SupabaseAuthMock
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
  _chain: SupabaseFromChain
}

export function createSupabaseMock(defaults?: {
  session?: { user: { id: string }; [key: string]: unknown } | null
  fromResult?: SupabaseChainResult
  rpcResult?: SupabaseChainResult
}): SupabaseMock {
  const session = defaults?.session ?? null
  const fromResult: SupabaseChainResult = defaults?.fromResult ?? { data: null, error: null }
  const rpcResult: SupabaseChainResult = defaults?.rpcResult ?? { data: null, error: null }

  const chain: SupabaseFromChain = {
    select: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(fromResult),
  }

  chain.select.mockReturnValue(chain)
  chain.insert.mockResolvedValue(fromResult)
  chain.upsert.mockResolvedValue(fromResult)
  chain.delete.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)

  const mock: SupabaseMock = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue(rpcResult),
    _chain: chain,
  }

  return mock
}
