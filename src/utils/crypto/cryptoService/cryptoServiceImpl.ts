import { rsaKeyService } from '../keys/asymmetric/rsa'
import { masterKeyService } from '../keys/symmetric/master'
import { fieldKeyService } from '../keys/symmetric/field'
import { loginLockoutService } from '../../loginLockoutService'
import { passwordDerivedService } from '../keys/symmetric/passwordDerived'
import { argon2CalibrationService } from '../argon2Calibration'
import type { CalibrationResult } from '../argon2Calibration'
import type { Argon2Params } from '../keys/symmetric/passwordDerived'
import type { CryptoService } from './types'

function getAdditionalAuthenticatedData(userId: string, fieldId: string): string {
  return `${userId}:${fieldId}`
}

/**
 * Singleton instance of CryptoService.
 */
export const cryptoService: CryptoService = {
  /** @inheritdoc */
  async setup(password: string): Promise<{ masterKey: CryptoKey; argon2Params: Argon2Params }> {
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
      argon2Params: params,
    }
  },

  /** @inheritdoc */
  async unlock(password: string): Promise<CryptoKey> {
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
    return masterKeyService.convertToDerivable(unwrappedMasterKey)
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
  async updatePassword(oldPassword, newPassword): Promise<void> {
    await rsaKeyService.updatePassword(oldPassword, newPassword)
  },

  /** @inheritdoc */
  async calibrateToDeviceCapability(): Promise<CalibrationResult> {
    const result = await argon2CalibrationService.calibrate()
    passwordDerivedService.setParams(result.params)
    return result
  },

  /** @inheritdoc */
  async teardown(): Promise<void> {
    await Promise.all([rsaKeyService.deleteKeys(), masterKeyService.deleteKey(), loginLockoutService.reset()])
  },

  /** @inheritdoc */
  lock() {
    fieldKeyService.clear()
  },
}
