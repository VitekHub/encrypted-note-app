/*
  # Create srp_sessions table

  ## Summary
  Holds short-lived, per-login-attempt SRP-6a handshake state. SRP login is a two-round
  protocol: the server generates an ephemeral pair on `srp-login-init` and must remember
  it until the client responds on `srp-login-verify`. This table stores exactly that
  transient state and nothing that reveals the password. Rows are deleted on success and
  auto-expired otherwise via a short TTL.

  One row per in-flight login attempt. All access happens through Edge Functions using
  the service-role key; clients never read or write this table directly.

  ## New Tables

  ### `srp_sessions`
  | Column     | Type        | Description                                                     |
  |------------|-------------|-----------------------------------------------------------------|
  | id         | uuid PK     | Session id, defaults to gen_random_uuid()                       |
  | user_id    | uuid FK     | References profiles.id on delete cascade, not null              |
  | server_b   | text        | Server ephemeral secret `b` (base64/hex), not null              |
  | public_b   | text        | Server ephemeral public `B` sent to the client, not null        |
  | expires_at | timestamptz | Hard expiry, e.g. now() + interval '2 minutes', not null        |
  | created_at | timestamptz | Creation timestamp, defaults to now()                           |

  ## Security
  - RLS enabled with NO client-accessible policies (deny-all to anon and authenticated).
  - Only the service role (used by Edge Functions) can read or write this table.
  - `server_b` is a secret for the duration of one handshake; the short TTL and deny-all
    RLS contain the exposure.

  ## Indexes
  - Index on `expires_at` to support opportunistic purging of expired rows.

  ## Notes
  1. Rows are deleted on successful login and purged when expired.
  2. Storing `b` briefly server-side is inherent to SRP being a two-round protocol.
*/

CREATE TABLE IF NOT EXISTS public.srp_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  server_b   text NOT NULL,
  public_b   text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.srp_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS srp_sessions_expires_at_idx
  ON public.srp_sessions (expires_at);
