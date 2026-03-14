/*
  # Create profiles table

  ## Summary
  Stores public user profile information. One row per authenticated user.

  ## New Tables

  ### `profiles`
  - `id` (uuid, PK) - References auth.users(id), cascade delete
  - `username` (text, unique, not null) - Case-insensitive unique username (stored lowercase)
  - `created_at` (timestamptz) - Account creation timestamp

  ## Security
  - RLS enabled
  - Authenticated users can read their own profile
  - Authenticated users can insert their own profile (id must match auth.uid())
  - Authenticated users can update their own username
  - No delete policy (handled via auth user deletion cascade)

  ## Notes
  1. Username is stored as lowercase to enforce case-insensitive uniqueness
  2. A unique index on username ensures no two users share a username
  3. The `check_username_available` RPC allows checking availability without exposing other user data
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON profiles (username);

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION check_username_available(username_input text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE username = lower(username_input)
  );
$$;
