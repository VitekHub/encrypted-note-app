/*
  # Create login_lockout table

  ## Summary
  Stores per-user login lockout state in a dedicated table, separate from
  cryptographic key material. Each user has at most one row. All four fields
  are nullable; null means no active lockout / no recorded attempts.

  ## New Table: login_lockout

  | Column                  | Type        | Description                                             |
  |-------------------------|-------------|---------------------------------------------------------|
  | user_id                 | uuid PK/FK  | References profiles.id                                  |
  | attempts                | text        | Serialised failed-attempt count                         |
  | attempts_sig            | text        | HMAC signature of the attempts value (tamper detection) |
  | lock_until              | text        | ISO timestamp until which the account is locked         |
  | lock_until_sig          | text        | HMAC signature of the lock_until value                  |
  | updated_at              | timestamptz | Last write timestamp, defaults to now()                 |

  ## Security
  - RLS enabled
  - SELECT: authenticated user can only read their own row
  - INSERT: authenticated user can only insert their own row
  - UPDATE: authenticated user can only update their own row
  - DELETE: authenticated user can only delete their own row
*/

CREATE TABLE IF NOT EXISTS public.login_lockout (
  user_id      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempts     text,
  attempts_sig text,
  lock_until   text,
  lock_until_sig text,
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.login_lockout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lockout row"
  ON public.login_lockout FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lockout row"
  ON public.login_lockout FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lockout row"
  ON public.login_lockout FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lockout row"
  ON public.login_lockout FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
