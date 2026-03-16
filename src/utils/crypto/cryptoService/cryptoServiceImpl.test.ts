import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../keys/asymmetric/rsa', () => ({
  rsaKeyService: {
    generateKeys: vi.fn(),
    storeKeys: vi.fn(),
    loadPrivateKey: vi.fn(),
    hasKeys: vi.fn(),
    reEncryptPrivateKey: vi.fn(),
    rotateKeys: vi.fn(),
  },
}))
vi.mock('../keys/symmetric/master', () => ({
  masterKeyService: {
    generateKey: vi.fn(),
    wrapKey: vi.fn(),
    storeKey: vi.fn(),
    loadKey: vi.fn(),
    unwrapKey: vi.fn(),
    convertToDerivable: vi.fn(),
    hasKey: vi.fn(),
  },
}))
vi.mock('../keys/symmetric/field', () => ({
  fieldKeyService: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    isEncrypted: vi.fn(),
    clear: vi.fn(),
  },
}))
vi.mock('../keys/symmetric/passwordDerived', () => ({
  passwordDerivedService: {
    setParams: vi.fn(),
    getParams: vi.fn(),
  },
}))
vi.mock('../../loginLockoutService', () => ({
  loginLockoutService: {
    checkLockout: vi.fn(),
    recordFailedAttempt: vi.fn(),
    reset: vi.fn(),
  },
}))
vi.mock('../argon2Calibration', () => ({
  argon2CalibrationService: {
    calibrate: vi.fn(),
    runBenchmark: vi.fn(),
  },
}))
vi.mock('../../supabase/userKeyService', () => ({
  deleteUserKeysRow: vi.fn(),
}))

import { rsaKeyService } from '../keys/asymmetric/rsa'
import { masterKeyService } from '../keys/symmetric/master'
import { fieldKeyService } from '../keys/symmetric/field'
import { passwordDerivedService } from '../keys/symmetric/passwordDerived'
import { loginLockoutService } from '../../loginLockoutService'
import { argon2CalibrationService } from '../argon2Calibration'
import { deleteUserKeysRow } from '../../supabase/userKeyService'

const mockRsaKeyService = vi.mocked(rsaKeyService)
const mockMasterKeyService = vi.mocked(masterKeyService)
const mockFieldKeyService = vi.mocked(fieldKeyService)
const mockPasswordDerivedService = vi.mocked(passwordDerivedService)
const mockLoginLockoutService = vi.mocked(loginLockoutService)
const mockArgon2CalibrationService = vi.mocked(argon2CalibrationService)
const mockDeleteUserKeysRow = vi.mocked(deleteUserKeysRow)

import { cryptoService } from './cryptoServiceImpl'

const FAKE_PARAMS = { memorySize: 65536, iterations: 3, parallelism: 4, hashLength: 32 }
const FAKE_MASTER_KEY = {} as CryptoKey
const FAKE_DERIVABLE_KEY = {} as CryptoKey
const FAKE_RSA_KEY_PAIR = { publicKey: {} as CryptoKey, privateKey: {} as CryptoKey }
const FAKE_RSA_PRIVATE_KEY = {} as CryptoKey

beforeEach(() => {
  vi.clearAllMocks()

  mockLoginLockoutService.checkLockout.mockResolvedValue(undefined)
  mockLoginLockoutService.reset.mockResolvedValue(undefined)
  mockLoginLockoutService.recordFailedAttempt.mockResolvedValue(undefined)

  mockArgon2CalibrationService.calibrate.mockResolvedValue({ params: FAKE_PARAMS, durationMs: 500 })
  mockPasswordDerivedService.setParams.mockReturnValue(undefined)
  mockPasswordDerivedService.getParams.mockReturnValue(FAKE_PARAMS)

  mockRsaKeyService.generateKeys.mockResolvedValue(FAKE_RSA_KEY_PAIR)
  mockRsaKeyService.storeKeys.mockResolvedValue(undefined)
  mockRsaKeyService.hasKeys.mockResolvedValue(true)
  mockRsaKeyService.loadPrivateKey.mockResolvedValue(FAKE_RSA_PRIVATE_KEY)
  mockRsaKeyService.reEncryptPrivateKey.mockResolvedValue(undefined)
  mockRsaKeyService.rotateKeys.mockResolvedValue(undefined)

  mockMasterKeyService.generateKey.mockResolvedValue(FAKE_MASTER_KEY)
  mockMasterKeyService.wrapKey.mockResolvedValue('wrapped-key-base64')
  mockMasterKeyService.storeKey.mockResolvedValue(undefined)
  mockMasterKeyService.loadKey.mockResolvedValue('wrapped-key-base64')
  mockMasterKeyService.unwrapKey.mockResolvedValue(FAKE_MASTER_KEY)
  mockMasterKeyService.convertToDerivable.mockResolvedValue(FAKE_DERIVABLE_KEY)
  mockMasterKeyService.hasKey.mockResolvedValue(true)

  mockFieldKeyService.encrypt.mockResolvedValue('encrypted-blob')
  mockFieldKeyService.decrypt.mockResolvedValue('plaintext')
  mockFieldKeyService.isEncrypted.mockReturnValue(true)

  mockDeleteUserKeysRow.mockResolvedValue(undefined)
})

describe('cryptoService.setup', () => {
  it('calibrates Argon2 and sets params', async () => {
    await cryptoService.setup('password')
    expect(mockArgon2CalibrationService.calibrate).toHaveBeenCalled()
    expect(mockPasswordDerivedService.setParams).toHaveBeenCalledWith(FAKE_PARAMS)
  })

  it('generates RSA keys and stores them', async () => {
    await cryptoService.setup('password')
    expect(mockRsaKeyService.generateKeys).toHaveBeenCalled()
    expect(mockRsaKeyService.storeKeys).toHaveBeenCalledWith(FAKE_RSA_KEY_PAIR, 'password')
  })

  it('generates, wraps, and stores a master key', async () => {
    await cryptoService.setup('password')
    expect(mockMasterKeyService.generateKey).toHaveBeenCalled()
    expect(mockMasterKeyService.wrapKey).toHaveBeenCalledWith(FAKE_MASTER_KEY, FAKE_RSA_KEY_PAIR.publicKey)
    expect(mockMasterKeyService.storeKey).toHaveBeenCalledWith('wrapped-key-base64')
  })

  it('returns the derivable master key and calibrated params', async () => {
    const result = await cryptoService.setup('password')
    expect(result.masterKey).toBe(FAKE_DERIVABLE_KEY)
    expect(result.params).toEqual(FAKE_PARAMS)
  })
})

describe('cryptoService.unlock', () => {
  it('checks lockout before proceeding', async () => {
    await cryptoService.unlock('password')
    expect(mockLoginLockoutService.checkLockout).toHaveBeenCalled()
  })

  it('loads the RSA private key and unwraps the master key', async () => {
    await cryptoService.unlock('password')
    expect(mockRsaKeyService.loadPrivateKey).toHaveBeenCalledWith('password')
    expect(mockMasterKeyService.loadKey).toHaveBeenCalled()
    expect(mockMasterKeyService.unwrapKey).toHaveBeenCalledWith('wrapped-key-base64', FAKE_RSA_PRIVATE_KEY)
  })

  it('resets lockout on success', async () => {
    await cryptoService.unlock('password')
    expect(mockLoginLockoutService.reset).toHaveBeenCalled()
  })

  it('returns the derivable master key and params', async () => {
    const result = await cryptoService.unlock('password')
    expect(result.masterKey).toBe(FAKE_DERIVABLE_KEY)
    expect(result.params).toEqual(FAKE_PARAMS)
  })

  it('records a failed attempt and re-throws on error', async () => {
    const err = new Error('wrong password')
    mockRsaKeyService.loadPrivateKey.mockRejectedValue(err)

    await expect(cryptoService.unlock('wrong')).rejects.toThrow('wrong password')
    expect(mockLoginLockoutService.recordFailedAttempt).toHaveBeenCalled()
    expect(mockLoginLockoutService.reset).not.toHaveBeenCalled()
  })
})

describe('cryptoService.isSetUp', () => {
  it('returns true when both RSA keys and master key exist', async () => {
    mockRsaKeyService.hasKeys.mockResolvedValue(true)
    mockMasterKeyService.hasKey.mockResolvedValue(true)
    expect(await cryptoService.isSetUp()).toBe(true)
  })

  it('returns false when RSA keys are missing', async () => {
    mockRsaKeyService.hasKeys.mockResolvedValue(false)
    mockMasterKeyService.hasKey.mockResolvedValue(true)
    expect(await cryptoService.isSetUp()).toBe(false)
  })

  it('returns false when master key is missing', async () => {
    mockRsaKeyService.hasKeys.mockResolvedValue(true)
    mockMasterKeyService.hasKey.mockResolvedValue(false)
    expect(await cryptoService.isSetUp()).toBe(false)
  })
})

describe('cryptoService.encrypt', () => {
  it('builds the correct AAD and delegates to fieldKeyService', async () => {
    await cryptoService.encrypt('plain', FAKE_DERIVABLE_KEY, 'note', 'uid-1')

    expect(mockFieldKeyService.encrypt).toHaveBeenCalledWith('plain', FAKE_DERIVABLE_KEY, 'note', 'v1:uid-1:note')
  })

  it('returns the encrypted blob', async () => {
    const result = await cryptoService.encrypt('plain', FAKE_DERIVABLE_KEY, 'note', 'uid-1')
    expect(result).toBe('encrypted-blob')
  })
})

describe('cryptoService.decrypt', () => {
  it('builds the correct AAD and delegates to fieldKeyService', async () => {
    await cryptoService.decrypt('encrypted-blob', FAKE_DERIVABLE_KEY, 'note', 'uid-1')

    expect(mockFieldKeyService.decrypt).toHaveBeenCalledWith(
      'encrypted-blob',
      FAKE_DERIVABLE_KEY,
      'note',
      'v1:uid-1:note'
    )
  })

  it('returns the plaintext', async () => {
    const result = await cryptoService.decrypt('blob', FAKE_DERIVABLE_KEY, 'note', 'uid-1')
    expect(result).toBe('plaintext')
  })
})

describe('cryptoService.isEncrypted', () => {
  it('delegates to fieldKeyService.isEncrypted', () => {
    mockFieldKeyService.isEncrypted.mockReturnValue(true)
    expect(cryptoService.isEncrypted('blob')).toBe(true)
    expect(mockFieldKeyService.isEncrypted).toHaveBeenCalledWith('blob')
  })

  it('returns false when fieldKeyService returns false', () => {
    mockFieldKeyService.isEncrypted.mockReturnValue(false)
    expect(cryptoService.isEncrypted('garbage')).toBe(false)
  })
})

describe('cryptoService.updatePassword', () => {
  it('delegates to rsaKeyService.reEncryptPrivateKey', async () => {
    await cryptoService.updatePassword('oldPass', 'newPass')
    expect(mockRsaKeyService.reEncryptPrivateKey).toHaveBeenCalledWith('oldPass', 'newPass')
  })
})

describe('cryptoService.updateParams', () => {
  it('delegates to rsaKeyService.reEncryptPrivateKey with params', async () => {
    await cryptoService.updateParams('pass', FAKE_PARAMS)
    expect(mockRsaKeyService.reEncryptPrivateKey).toHaveBeenCalledWith('pass', 'pass', FAKE_PARAMS)
  })
})

describe('cryptoService.rotateRsaKeys', () => {
  it('delegates to rsaKeyService.rotateKeys', async () => {
    await cryptoService.rotateRsaKeys('password')
    expect(mockRsaKeyService.rotateKeys).toHaveBeenCalledWith('password')
  })
})

describe('cryptoService.calibrateToDeviceCapability', () => {
  it('delegates to argon2CalibrationService.calibrate', async () => {
    const result = await cryptoService.calibrateToDeviceCapability()
    expect(mockArgon2CalibrationService.calibrate).toHaveBeenCalled()
    expect(result).toEqual({ params: FAKE_PARAMS, durationMs: 500 })
  })
})

describe('cryptoService.teardown', () => {
  it('deletes user keys and resets lockout in parallel', async () => {
    await cryptoService.teardown()
    expect(mockDeleteUserKeysRow).toHaveBeenCalled()
    expect(mockLoginLockoutService.reset).toHaveBeenCalled()
  })
})

describe('cryptoService.clear', () => {
  it('calls fieldKeyService.clear', () => {
    cryptoService.clear()
    expect(mockFieldKeyService.clear).toHaveBeenCalled()
  })
})
