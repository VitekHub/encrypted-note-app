/*
  # Add delete_own_account RPC function

  ## Summary
  Adds a secure database function that allows an authenticated user to permanently
  delete their own account and all associated data.

  ## What this does
  1. Deletes all rows in `user_data` belonging to the calling user
  2. Deletes all rows in `user_keys` belonging to the calling user
  3. Deletes the row in `profiles` belonging to the calling user
  4. Deletes the user from `auth.users` using the admin API

  ## Security
  - Uses `auth.uid()` to identify the caller — cannot delete another user's data
  - Defined as `SECURITY DEFINER` so it can call `auth.admin` functionality
  - `search_path` is restricted to `public, auth` to prevent search-path injection
  - Only callable by authenticated users (enforced via `TO authenticated`)
*/

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_user_id uuid := auth.uid();
BEGIN
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.user_data WHERE user_id = calling_user_id;
  DELETE FROM public.user_keys WHERE user_id = calling_user_id;
  DELETE FROM public.profiles WHERE id = calling_user_id;
  DELETE FROM auth.users WHERE id = calling_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
