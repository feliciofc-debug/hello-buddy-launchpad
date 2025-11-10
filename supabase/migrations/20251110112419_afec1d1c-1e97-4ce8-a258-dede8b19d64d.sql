-- Create security_reports table for responsible disclosure
CREATE TABLE IF NOT EXISTS public.security_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_name VARCHAR(255),
  reporter_email VARCHAR(255) NOT NULL,
  vulnerability_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  severity VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'new',
  disclosed_publicly BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_security_status ON public.security_reports(status);
CREATE INDEX IF NOT EXISTS idx_security_severity ON public.security_reports(severity);
CREATE INDEX IF NOT EXISTS idx_security_created_at ON public.security_reports(created_at DESC);

-- Enable RLS
ALTER TABLE public.security_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert security reports (public submission)
CREATE POLICY "Anyone can submit security reports"
  ON public.security_reports
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Only authenticated users can view reports (admin only)
CREATE POLICY "Only authenticated users can view security reports"
  ON public.security_reports
  FOR SELECT
  TO authenticated
  USING (true);