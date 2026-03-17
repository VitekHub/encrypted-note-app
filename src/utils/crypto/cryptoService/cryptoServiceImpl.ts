import { rsaKeyService } from '../keys/asymmetric/rsa'
import { masterKeyService } from '../keys/symmetric/master'
import { fieldKeyService } from '../keys/symmetric/field'
import { loginLockoutService } from '../../loginLockoutService'
import { passwordDerivedService } from '../keys/symmetric/passwordDerived'
import { deleteUserKeysRow } from '../../supabase/userKeyService'
import { argon2CalibrationService } from '../argon2Calibration'
import type { CalibrationResult, Argon2Params } from '../argon2Calibration'
import type { CryptoService } from './types'

const CURRENT_VERSION = 'v1' as const

function getAdditionalAuthenticatedData(userId: string, fieldId: string): string {
  return `${CURRENT_VERSION}:${userId}:${fieldId}`
}

/**
 * Singleton instance of CryptoService.
 */
export const cryptoService: CryptoService = {
  /** @inheritdoc */
  async setup(password: string): Promise<{ masterKey: CryptoKey; params: Argon2Params }> {
    // Calibrate Argon2id for this device to find strongest viable params
    const { params } = await argon2CalibrationService.calibrate()
    passwordDerivedService.setParams(params)

    const rsaKeyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(rsaKeyPair, password)
    const generatedMasterKey = await masterKeyService.generateKey()
    const wrappedMasterKey = await masterKeyService.wrapKey(generatedMasterKey, rsaKeyPair.publicKey)
    await masterKeyService.storeKey(wrappedMasterKey)

    return {
      masterKey: await masterKeyService.convertToDerivable(generatedMasterKey),
      params,
    }
  },

  /** @inheritdoc */
  async unlock(password: string): Promise<{ masterKey: CryptoKey; params: Argon2Params }> {
    await loginLockoutService.checkLockout()

    let unwrappedMasterKey: CryptoKey

    try {
      const rsaPrivateKey = await rsaKeyService.loadPrivateKey(password)
      const wrappedMasterKey = await masterKeyService.loadKey()
      unwrappedMasterKey = await masterKeyService.unwrapKey(wrappedMasterKey, rsaPrivateKey)
    } catch (error) {
      await loginLockoutService.recordFailedAttempt()
      throw error
    }

    await loginLockoutService.reset()
    return {
      masterKey: await masterKeyService.convertToDerivable(unwrappedMasterKey),
      params: passwordDerivedService.getParams(),
    }
  },

  /** @inheritdoc */
  async isSetUp(): Promise<boolean> {
    const [hasRsaKeys, hasMasterKey] = await Promise.all([rsaKeyService.hasKeys(), masterKeyService.hasKey()])
    return hasRsaKeys && hasMasterKey
  },

  /** @inheritdoc */
  async encrypt(data, masterKey, fieldId, userId) {
    const aad = getAdditionalAuthenticatedData(userId, fieldId)
    return fieldKeyService.encrypt(data, masterKey, fieldId, aad)
  },

  /** @inheritdoc */
  async decrypt(data, masterKey, fieldId, userId) {
    const aad = getAdditionalAuthenticatedData(userId, fieldId)
    return fieldKeyService.decrypt(data, masterKey, fieldId, aad)
  },

  /** @inheritdoc */
  isEncrypted(value: string): boolean {
    return fieldKeyService.isEncrypted(value)
  },

  /** @inheritdoc */
  async rotateRsaKeys(password: string): Promise<void> {
    await rsaKeyService.rotateKeys(password)
  },

  /** @inheritdoc */
  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    await rsaKeyService.reEncryptPrivateKey(oldPassword, newPassword)
  },

  /** @inheritdoc */
  async updateParams(password: string, newParams: Argon2Params): Promise<void> {
    await rsaKeyService.reEncryptPrivateKey(password, password, newParams)
  },

  /** @inheritdoc */
  async calibrateToDeviceCapability(): Promise<CalibrationResult> {
    return argon2CalibrationService.calibrate()
  },

  /** @inheritdoc */
  async teardown(): Promise<void> {
    await Promise.all([deleteUserKeysRow(), loginLockoutService.reset()])
  },

  /** @inheritdoc */
  clear() {
    fieldKeyService.clear()
  },
}
