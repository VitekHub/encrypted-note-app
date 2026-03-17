/*
  # Create user_keys table

  ## Summary
  Stores encrypted cryptographic key material per user.
  All values are pre-encrypted by the client before being stored here —
  the server never sees any plaintext keys or passwords.

  ## New Tables

  ### `user_keys`
  One row per user. All key columns are nullable (absent until generated).

  | Column                    | Type        | Description                                      |
  |---------------------------|-------------|--------------------------------------------------|
  | user_id                   | uuid PK/FK  | References profiles.id (and auth.users)          |
  | rsa_public_key_spki       | text        | RSA public key in SPKI/base64 format             |
  | rsa_private_key_encrypted | text        | RSA private key, encrypted with master key       |
  | rsa_key_version           | text        | Monotonic version tag for the RSA key pair       |
  | wrapped_master_key        | text        | Master symmetric key wrapped with RSA-OAEP       |
  | updated_at                | timestamptz | Last write timestamp, defaults to now()          |

  ## Security
  - RLS enabled
  - SELECT: authenticated user can only read their own row
  - INSERT: authenticated user can only insert their own row
  - UPDATE: authenticated user can only update their own row
  - DELETE: authenticated user can only delete their own row

  ## Notes
  1. This table holds zero-knowledge data — all values are client-encrypted
  2. The `user_id` is the profile id (= auth.uid())
*/

CREATE TABLE IF NOT EXISTS public.user_keys (
  user_id                   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rsa_public_key_spki       text,
  rsa_private_key_encrypted text,
  rsa_key_version           text,
  wrapped_master_key        text,
  updated_at                timestamptz DEFAULT now()
);

ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own key row"
  ON public.user_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own key row"
  ON public.user_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own key row"
  ON public.user_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own key row"
  ON public.user_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
