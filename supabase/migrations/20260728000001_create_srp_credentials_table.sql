/*
  # Create srp_credentials table

  ## Summary
  Stores the SRP-6a verifier material that replaces the password. This table is the
  server-side anchor for password-authenticated key exchange: instead of any password
  or password hash, it holds a random salt and a discrete-log-hard verifier
  (`v = g^x mod N`). The verifier cannot be inverted to recover the password and cannot
  be used to impersonate the client without an online attack.

  One row per user. All access happens through Edge Functions using the service-role
  key; clients never read or write this table directly.

  ## New Tables

  ### `srp_credentials`
  | Column     | Type        | Description                                                    |
  |------------|-------------|----------------------------------------------------------------|
  | user_id    | uuid PK/FK  | References profiles.id (and auth.users) on delete cascade      |
  | salt       | text        | Random SRP salt `s` (base64/hex), not null                     |
  | verifier   | text        | SRP verifier `v = g^x mod N` (base64/hex), not null            |
  | srp_group  | text        | SRP group id, e.g. 'RFC5054-4096', so params are explicit      |
  | updated_at | timestamptz | Last write timestamp, defaults to now()                        |

  ## Security
  - RLS enabled with NO client-accessible policies (deny-all to anon and authenticated).
  - Only the service role (used by Edge Functions) can read or write this table; the
    service role bypasses RLS by design.
  - Enabling RLS with zero policies makes the table deny-all to client roles, which is
    exactly the intended posture.

  ## Notes
  1. The verifier and salt never leave the server in a way that reveals the password.
  2. `srp_group` records the parameter set so groups can be upgraded per user later.
*/

CREATE TABLE IF NOT EXISTS public.srp_credentials (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  salt       text NOT NULL,
  verifier   text NOT NULL,
  srp_group  text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.srp_credentials ENABLE ROW LEVEL SECURITY;
