-- Create 'store-assets' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read store-assets
CREATE POLICY "Everyone can read store-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-assets');

-- Policy: Only Admins can upload to store-assets
CREATE POLICY "Admins can upload to store-assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'store-assets' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Policy: Only Admins can update their own uploads in store-assets
CREATE POLICY "Admins can update store-assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'store-assets' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Policy: Only Admins can delete from store-assets
CREATE POLICY "Admins can delete store-assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'store-assets' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
