import { rsaKeyService } from '../keys/asymmetric/rsa'
import { masterKeyService } from '../keys/symmetric/master'
import { fieldKeyService } from '../keys/symmetric/field'
import type { CryptoService } from './types'

function getAdditionalAuthenticatedData(userId: string, fieldId: string): string {
  return `${userId}:${fieldId}`
}

/**
 * Singleton instance of CryptoService.
 */
export const cryptoService: CryptoService = {
  /** @inheritdoc */
  async setup(password: string): Promise<CryptoKey> {
    const rsaKeyPair = await rsaKeyService.generateKeys()
    await rsaKeyService.storeKeys(rsaKeyPair, password)
    const generatedMasterKey = await masterKeyService.generateKey()
    const wrappedMasterKey = await masterKeyService.wrapKey(generatedMasterKey, rsaKeyPair.publicKey)
    await masterKeyService.storeKey(wrappedMasterKey)

    return masterKeyService.convertToDerivable(generatedMasterKey)
  },

  /** @inheritdoc */
  async unlock(password: string): Promise<CryptoKey> {
    const rsaPrivateKey = await rsaKeyService.loadPrivateKey(password)
    const wrappedMasterKey = await masterKeyService.loadKey()
    const unwrappedMasterKey = await masterKeyService.unwrapKey(wrappedMasterKey, rsaPrivateKey)
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
  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    await rsaKeyService.updatePassword(oldPassword, newPassword)
  },

  /** @inheritdoc */
  async teardown(): Promise<void> {
    await Promise.all([rsaKeyService.deleteKeys(), masterKeyService.deleteKey()])
  },
}
