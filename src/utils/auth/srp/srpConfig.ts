/**
 * Agreed SRP-6a parameters shared by the client and the Edge Functions.
 *
 * We use the `secure-remote-password` library's built-in group and hash so both
 * sides run identical, vetted parameters. The library uses the RFC 5054 2048-bit
 * safe-prime group with SHA-256.
 *
 * `SRP_GROUP` is persisted in `srp_credentials.srp_group` so the parameter set is
 * explicit per credential and can be upgraded in the future.
 */
export const SRP_GROUP = 'RFC5054-2048' as const
export const SRP_HASH = 'SHA-256' as const

export type SrpGroup = typeof SRP_GROUP
