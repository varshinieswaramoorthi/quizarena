-- Connect to your Supabase Project Dashboard
-- Navigate to the "SQL Editor" on the left navigation bar
-- Click "New Query" and paste this exact script, then click "Run":

CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Force the Schema Cache to refresh natively (Required for PostgREST)
NOTIFY pgrst, 'reload schema';
