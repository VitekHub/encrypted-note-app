/*
  # Create user_data table

  ## Summary
  Stores user-specific application data (note content, settings, etc.) in the cloud.
  Replaces localStorage for all persistent user data.
  All values are client-side encrypted before storage — server sees only ciphertext.

  ## New Tables

  ### `user_data`
  - `id` (uuid, PK) - Auto-generated row identifier
  - `user_id` (uuid, not null) - References profiles(id), cascade delete
  - `data_key` (text, not null) - Data field identifier (e.g. 'note', 'settings')
  - `data_value` (text, not null) - Encrypted value (base64 ciphertext) or JSON string
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - RLS enabled
  - Authenticated users can only read, insert, update, delete their own data rows
  - data_key + user_id combination is unique (one value per key per user)

  ## Notes
  1. 'note' rows contain AES-256-GCM ciphertext (zero-knowledge)
  2. 'settings' rows contain JSON (not encrypted, not sensitive — only UI preferences)
  3. An upsert pattern is used for writes to handle first-time vs update scenarios
*/

CREATE TABLE IF NOT EXISTS user_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  data_key text NOT NULL,
  data_value text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, data_key)
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS user_data_user_id_idx ON user_data (user_id);

CREATE POLICY "Users can read own data"
  ON user_data FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
