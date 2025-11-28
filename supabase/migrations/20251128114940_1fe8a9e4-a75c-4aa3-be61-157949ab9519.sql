-- Tabela de configuração Google Ads
CREATE TABLE IF NOT EXISTS google_ads_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  client_id TEXT,
  client_secret TEXT,
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  customer_id TEXT,
  account_email TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de campanhas Google Ads
CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'ENABLED',
  budget_daily DECIMAL(10,2),
  budget_total DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  targeting JSONB DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  ad_type TEXT DEFAULT 'SEARCH',
  biblioteca_campanha_id UUID REFERENCES biblioteca_campanhas(id),
  produto_id UUID REFERENCES produtos(id),
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE google_ads_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own Google Ads config"
ON google_ads_config FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own Google Ads campaigns"
ON google_ads_campaigns FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Índices
CREATE INDEX idx_google_ads_campaigns_user ON google_ads_campaigns(user_id);
CREATE INDEX idx_google_ads_campaigns_status ON google_ads_campaigns(status);
CREATE INDEX idx_google_ads_campaigns_biblioteca ON google_ads_campaigns(biblioteca_campanha_id);

-- Triggers para updated_at
CREATE TRIGGER update_google_ads_config_updated_at 
  BEFORE UPDATE ON google_ads_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_ads_campaigns_updated_at
  BEFORE UPDATE ON google_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();