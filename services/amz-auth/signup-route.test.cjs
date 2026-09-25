'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createIpRateLimiter,
  normalizeSignupBody,
  registerSignupRoute,
} = require('./signup-route');

test('normaliza cadastro e preserva somente planos válidos', () => {
  const parsed = normalizeSignupBody({
    email: ' Cliente@Exemplo.com ',
    password: 'senha-segura',
    data: {
      nome: 'Cliente Teste',
      whatsapp: '(21) 99999-0000',
      plano_solicitado: 'avancado',
    },
  });

  assert.equal(parsed.error, undefined);
  assert.equal(parsed.value.email, 'cliente@exemplo.com');
  assert.equal(parsed.value.whatsapp, '21999990000');
  assert.equal(parsed.value.plano, 'avancado');
});

test('rejeita senha curta e usa plano seguro como fallback', () => {
  const invalid = normalizeSignupBody({
    email: 'cliente@exemplo.com',
    password: 'curta',
    data: { nome: 'Cliente', whatsapp: '21999990000' },
  });
  assert.match(invalid.error, /senha/i);

  const valid = normalizeSignupBody({
    email: 'cliente@exemplo.com',
    password: 'senha-segura',
    data: {
      nome: 'Cliente',
      whatsapp: '21999990000',
      plano_solicitado: 'plano-inexistente',
    },
  });
  assert.equal(valid.value.plano, 'essencial');
});

test('limita tentativas por IP', () => {
  const middleware = createIpRateLimiter({ windowMs: 60_000, max: 2 });
  const req = { ip: '203.0.113.8' };
  const response = () => {
    const result = { statusCode: 200, body: null, headers: {} };
    return {
      result,
      setHeader: (key, value) => {
        result.headers[key] = value;
      },
      status: (statusCode) => {
        result.statusCode = statusCode;
        return {
          json: (body) => {
            result.body = body;
            return result;
          },
        };
      },
    };
  };

  let nextCalls = 0;
  middleware(req, response(), () => { nextCalls += 1; });
  middleware(req, response(), () => { nextCalls += 1; });
  const blocked = response();
  middleware(req, blocked, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(blocked.result.statusCode, 429);
});

test('rota cria usuário com bcrypt custo 10 e notifica após commit', async () => {
  let handlers;
  const app = {
    post: (path, ...registered) => {
      assert.equal(path, '/auth/v1/signup');
      handlers = registered;
    },
  };
  const queries = [];
  const client = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return {};
    },
    release: () => {},
  };
  const bcryptCalls = [];
  const notified = [];
  registerSignupRoute({
    app,
    pool: { connect: async () => client },
    bcrypt: {
      hash: async (password, cost) => {
        bcryptCalls.push({ password, cost });
        return 'bcrypt-hash';
      },
    },
    notifySignup: async (payload) => notified.push(payload),
  });

  const req = {
    ip: '203.0.113.9',
    body: {
      email: 'cliente@exemplo.com',
      password: 'senha-segura',
      data: {
        nome: 'Cliente Teste',
        whatsapp: '21999990000',
        plano_solicitado: 'profissional',
      },
    },
  };
  const result = { statusCode: 200, body: null, headers: {} };
  const res = {
    setHeader: (key, value) => { result.headers[key] = value; },
    status: (statusCode) => {
      result.statusCode = statusCode;
      return { json: (body) => { result.body = body; return result; } };
    },
  };

  await new Promise((resolve, reject) => {
    handlers[0](req, res, () => {
      Promise.resolve(handlers[1](req, res)).then(resolve, reject);
    });
  });

  assert.deepEqual(bcryptCalls, [{ password: 'senha-segura', cost: 10 }]);
  assert.equal(queries[0].sql, 'BEGIN');
  assert.match(queries[1].sql, /INSERT INTO auth\.users/);
  assert.equal(queries.at(-1).sql, 'COMMIT');
  assert.equal(notified.length, 1);
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.notification_sent, true);
});
