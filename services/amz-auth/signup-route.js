'use strict';

const { randomUUID } = require('node:crypto');

const ALLOWED_PLANS = new Set(['essencial', 'profissional', 'avancado']);
const DEFAULT_INSTANCE_ID = '00000000-0000-0000-0000-000000000000';

function normalizeSignupBody(body = {}) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const nome = String(data.nome || '').trim();
  const whatsapp = String(data.whatsapp || '').replace(/\D/g, '');
  const requestedPlan = String(data.plano_solicitado || '');
  const plano = ALLOWED_PLANS.has(requestedPlan) ? requestedPlan : 'essencial';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    return { error: 'Informe um e-mail válido.' };
  }
  if (password.length < 8 || password.length > 72) {
    return { error: 'A senha deve ter entre 8 e 72 caracteres.' };
  }
  if (nome.length < 2 || nome.length > 120) {
    return { error: 'Informe seu nome.' };
  }
  if (whatsapp.length < 10 || whatsapp.length > 15) {
    return { error: 'Informe um WhatsApp válido com DDD.' };
  }

  return {
    value: {
      email,
      password,
      nome,
      whatsapp,
      plano,
      metadata: { nome, whatsapp, plano_solicitado: plano },
    },
  };
}

function createIpRateLimiter({ windowMs = 15 * 60 * 1000, max = 5 } = {}) {
  const attempts = new Map();

  return (req, res, next) => {
    const now = Date.now();
    if (attempts.size > 10_000) {
      for (const [key, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(key);
      }
    }
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const previous = attempts.get(ip);
    const entry = !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : previous;
    entry.count += 1;
    attempts.set(ip, entry);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        erro: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.',
      });
    }
    return next();
  };
}

function createSignupNotifier({ supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  if (!supabaseUrl || !serviceRoleKey) {
    return async () => {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
    };
  }

  return async ({ userId }) => {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetchImpl(`${supabaseUrl}/functions/v1/notify-new-signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!response.ok) {
          throw new Error(`notify-new-signup HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
        }
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
        }
      }
    }
    throw lastError;
  };
}

function registerSignupRoute({
  app,
  pool,
  bcrypt,
  notifySignup,
  instanceId = process.env.GOTRUE_SITE_INSTANCE_ID || DEFAULT_INSTANCE_ID,
  rateLimit = {},
}) {
  if (!app || !pool || !bcrypt) {
    throw new Error('registerSignupRoute requer app, pool e bcrypt');
  }

  app.post('/auth/v1/signup', createIpRateLimiter(rateLimit), async (req, res) => {
    const parsed = normalizeSignupBody(req.body);
    if (parsed.error) return res.status(400).json({ erro: parsed.error });

    const signup = parsed.value;
    const userId = randomUUID();
    let client;

    try {
      // Custo 10 é o mesmo padrão usado no login da VPS.
      const encryptedPassword = await bcrypt.hash(signup.password, 10);
      client = await pool.connect();
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, confirmation_token, email_change, recovery_token
        ) VALUES (
          $1::uuid, $2::uuid, 'authenticated', 'authenticated', $3, $4,
          now(), '{"provider":"email","providers":["email"]}'::jsonb, $5::jsonb,
          now(), now(), '', '', ''
        )`,
        [instanceId, userId, signup.email, encryptedPassword, JSON.stringify(signup.metadata)],
      );

      // O trigger também faz estas operações. Mantê-las idempotentes aqui
      // protege instalações em que a migration ainda não foi recarregada.
      await client.query(
        `INSERT INTO public.user_roles (user_id, role)
         SELECT $1::uuid, 'empresa'::public.app_role
         WHERE NOT EXISTS (
           SELECT 1 FROM public.user_roles WHERE user_id = $1::uuid
         )
         ON CONFLICT (user_id, role) DO NOTHING`,
        [userId],
      );
      await client.query(
        `UPDATE public.profiles
         SET plano_solicitado = $2,
             plano_solicitado_em = now(),
             pagamento_status = 'pending_payment'
         WHERE id = $1::uuid`,
        [userId, signup.plano],
      );

      await client.query('COMMIT');
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error?.code === '23505') {
        return res.status(409).json({
          erro: 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.',
        });
      }
      console.error('[amz-auth][signup] falhou', error);
      return res.status(500).json({ erro: 'Não foi possível criar a conta agora.' });
    } finally {
      client?.release();
    }

    let notificationSent = false;
    try {
      if (notifySignup) {
        await notifySignup({ userId });
        notificationSent = true;
      }
    } catch (error) {
      console.error('[amz-auth][signup] conta criada, mas a notificação falhou', error);
    }

    return res.status(201).json({
      user: {
        id: userId,
        email: signup.email,
        user_metadata: signup.metadata,
        app_metadata: { provider: 'email', providers: ['email'] },
      },
      notification_sent: notificationSent,
    });
  });
}

module.exports = {
  createIpRateLimiter,
  createSignupNotifier,
  normalizeSignupBody,
  registerSignupRoute,
};
