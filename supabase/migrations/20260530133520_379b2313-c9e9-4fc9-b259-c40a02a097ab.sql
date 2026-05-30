DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Allow public direct reads of individual avatar objects by exact path (used by <img src> URLs),
-- but prevent broad listing of all files in the bucket via the storage API.
CREATE POLICY "Public read of avatar objects"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars' AND name IS NOT NULL AND position('/' in name) > 0);
