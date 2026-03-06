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
    const masterKey = await masterKeyService.generateKey()
    await masterKeyService.storeKey(masterKey, rsaKeyPair.publicKey)

    return masterKeyService.convertToDerivable(masterKey)
  },

  /** @inheritdoc */
  async unlock(password: string): Promise<CryptoKey> {
    const rsaPrivateKey = await rsaKeyService.loadPrivateKey(password)
    return await masterKeyService.loadKey(rsaPrivateKey)
  },

  /** @inheritdoc */
  async isSetUp(): Promise<boolean> {
    const [hasRsaKeys, hasMasterKey] = await Promise.all([rsaKeyService.hasKeys(), masterKeyService.hasKey()])
    return hasRsaKeys && hasMasterKey
  },

  /** @inheritdoc */
  async encrypt(data, masterKey, fieldId, userId) {
    const aad = getAdditionalAuthenticatedData(userId, fieldId)
    return await fieldKeyService.encrypt(data, masterKey, fieldId, aad)
  },

  /** @inheritdoc */
  async decrypt(data, masterKey, fieldId, userId) {
    const aad = getAdditionalAuthenticatedData(userId, fieldId)
    return await fieldKeyService.decrypt(data, masterKey, fieldId, aad)
  },

  /** @inheritdoc */
  isEncrypted(value: string): boolean {
    return fieldKeyService.isEncrypted(value)
  },

  /** @inheritdoc */
  async teardown(): Promise<void> {
    await Promise.all([rsaKeyService.deleteKeys(), masterKeyService.deleteKey()])
  },
}
