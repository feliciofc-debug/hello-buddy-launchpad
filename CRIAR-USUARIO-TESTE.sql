-- Script para criar usuário de teste no Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Criar usuário de teste (substitua o email e senha se quiser)
-- A senha será: Teste123456
-- O hash abaixo é para a senha "Teste123456"

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'teste@amzofertas.com.br',
  crypt('Teste123456', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"nome":"Usuario Teste","tipo":"empresa"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- 2. Criar perfil do usuário (se a tabela profiles existir)
-- Primeiro, vamos pegar o ID do usuário que acabamos de criar
DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Buscar ID do usuário
  SELECT id INTO user_id FROM auth.users WHERE email = 'teste@amzofertas.com.br';
  
  -- Criar perfil se não existir
  IF user_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id,
      tipo,
      plano,
      created_at,
      updated_at
    ) VALUES (
      user_id,
      'empresa',
      'empresarial_personalizado',
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO UPDATE SET
      tipo = 'empresa',
      plano = 'empresarial_personalizado',
      updated_at = NOW();
  END IF;
END $$;

-- 3. Verificar se foi criado
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'teste@amzofertas.com.br';
