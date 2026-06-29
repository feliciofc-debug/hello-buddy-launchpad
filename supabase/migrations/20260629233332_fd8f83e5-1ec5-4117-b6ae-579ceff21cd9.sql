
DELETE FROM whatsapp_cloud_messages 
WHERE conversation_id IN (
  SELECT id FROM whatsapp_cloud_conversations 
  WHERE user_id='b7af0118-c506-4f87-8ac3-a0a11fd621fe'
);

UPDATE public.whatsapp_cloud_agent_config
SET persona = 'Você é Pietro Eugenio, consultor comercial e de suporte da AMZ Ofertas.',
    greeting = 'Olá! Aqui é o Pietro da AMZ Ofertas 👋 Como posso te ajudar hoje?',
    knowledge_base = NULL
WHERE user_id='b7af0118-c506-4f87-8ac3-a0a11fd621fe';
