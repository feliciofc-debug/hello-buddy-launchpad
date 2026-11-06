const baseUrl = (process.env.AMZ_RENAVE_URL ?? "http://127.0.0.1:3012")
  .replace(/\/+$/, "");
const token = process.env.AMZ_RENAVE_TOKEN;
if (!token) throw new Error("AMZ_RENAVE_TOKEN é obrigatório");

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, body
    ? {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RENAVE-Token": token,
      },
      body: JSON.stringify(body),
    }
    : undefined);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} falhou com HTTP ${response.status}`);
  return payload;
}

function findPlate(value) {
  if (typeof value === "string" && /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(value)) {
    return value.toUpperCase();
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const plate = findPlate(item);
      if (plate) return plate;
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const plate = findPlate(item);
      if (plate) return plate;
    }
  }
  return undefined;
}

function randomIndex(length) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % length;
}

function mockSuffix() {
  const digits = "0123456789";
  const letters = "ABCDEFGHJ";
  return `${digits[randomIndex(10)]}${letters[randomIndex(letters.length)]}${
    digits[randomIndex(10)]
  }${digits[randomIndex(10)]}`;
}

function validTestCpf() {
  const digits = Array.from(
    crypto.getRandomValues(new Uint8Array(9)),
    (value) => value % 10,
  );
  if (digits.every((digit) => digit === digits[0])) return validTestCpf();
  for (let length = 9; length <= 10; length++) {
    const sum = digits.slice(0, length).reduce(
      (total, digit, index) => total + digit * (length + 1 - index),
      0,
    );
    const remainder = (sum * 10) % 11;
    digits.push(remainder === 10 ? 0 : remainder);
  }
  return digits.join("");
}

const health = await request("/health");
console.log({ etapa: "health", ok: health.ok === true });

const client = await request("/renave/chamar", {
  ambiente: "hom",
  operacao: "clienteAutenticado",
  params: {},
});
console.log({ etapa: "clienteAutenticado", status: client.status });

const mock = await request("/renave/chamar", {
  ambiente: "hom",
  operacao: "mockVeiculoUsado",
  params: {},
  body: {
    ufJurisdicaoVeiculo: "RJ",
    sufixoPlaca: mockSuffix(),
    comRouboFurto: false,
    jaBaixado: false,
    documentoProprietario: validTestCpf(),
    nomeProprietario: "PROPRIETARIO TESTE",
  },
});
const plate = findPlate(mock.body);
if (!plate) throw new Error("Mock criado sem placa reconhecível na resposta");
const renavam = String(mock.body?.renavam ?? "");
const numeroCrv = String(mock.body?.numeroCrv ?? "");
if (!/^\d{11}$/.test(renavam) || !/^\d{12}$/.test(numeroCrv)) {
  throw new Error("Mock criado sem RENAVAM/CRV válidos");
}
console.log({
  etapa: "mockVeiculoUsado",
  status: mock.status,
  placa: `${plate.slice(0, 3)}****`,
});

const aptitude = await request("/renave/chamar", {
  ambiente: "hom",
  operacao: "aptidaoVeiculo",
  params: {
    placa: plate,
    renavam,
    numeroCrv,
    tipoCrv: "AZUL",
  },
});
console.log({ etapa: "aptidaoVeiculo", status: aptitude.status });
