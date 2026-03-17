-- Passo 2: Atualizar config PJ do expo
UPDATE pj_clientes_config
SET 
  wuzapi_port = 8083,
  wuzapi_token = 'xY1zA2bC3dE4fG5hI6jK7lM8nO9pQ0r',
  wuzapi_instance_name = 'expo',
  whatsapp_conectado = false,
  wuzapi_jid = null
WHERE user_id = 'b7af0118-c506-4f87-8ac3-a0a11fd621fe';

-- Passo 3: Atualizar o registro existente na porta 8083 para apontar para Contabo/expo
UPDATE wuzapi_instances
SET 
  wuzapi_url = 'http://api2.amzofertas.com.br:8083',
  wuzapi_token = 'xY1zA2bC3dE4fG5hI6jK7lM8nO9pQ0r',
  assigned_to_user = 'b7af0118-c506-4f87-8ac3-a0a11fd621fe',
  instance_name = 'expo',
  is_connected = false,
  updated_at = NOW()
WHERE port = 8083;

-- Passo 4: Remover registros antigos da Locaweb do expo
DELETE FROM wuzapi_instances 
WHERE assigned_to_user = 'b7af0118-c506-4f87-8ac3-a0a11fd621fe'
  AND wuzapi_url ILIKE '%191.252.193.73%';