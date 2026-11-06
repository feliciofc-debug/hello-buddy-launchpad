import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ENVELOPE_VERSION = 1;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

type Ciphertext = {
  iv: string;
  tag: string;
  data: string;
};

type Envelope = {
  v: 1;
  keyVersion: string;
  cnpj: string;
  dekWrapped: Ciphertext;
  pfx: Ciphertext;
  senha: Ciphertext;
};

export type OpenedCertificate = {
  pfx: Buffer;
  senha: Buffer;
  cnpj: string;
  keyVersion: string;
};

function decodeMasterKey(value: string | undefined, name: string): Buffer {
  if (!value) throw new Error(`${name} é obrigatória`);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`${name} deve ser base64 válido`);
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== value) {
    key.fill(0);
    throw new Error(`${name} deve conter 32 bytes em base64`);
  }
  return key;
}

function aadFor(lojaId: string, cnpj: string): Buffer {
  if (!lojaId.trim()) throw new Error("lojaId é obrigatório");
  if (!/^\d{14}$/.test(cnpj)) throw new Error("CNPJ inválido");
  return Buffer.from(`${lojaId}\0${cnpj}`, "utf8");
}

function encrypt(plain: Buffer, key: Buffer, aad: Buffer): Ciphertext {
  const iv = randomBytes(IV_BYTES);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad);
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: data.toString("base64"),
    };
  } finally {
    iv.fill(0);
  }
}

function decrypt(ciphertext: Ciphertext, key: Buffer, aad: Buffer): Buffer {
  const iv = Buffer.from(ciphertext.iv, "base64");
  const tag = Buffer.from(ciphertext.tag, "base64");
  const data = Buffer.from(ciphertext.data, "base64");
  try {
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error("Envelope inválido");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch {
    throw new Error("Não foi possível abrir o certificado selado");
  } finally {
    iv.fill(0);
    tag.fill(0);
    data.fill(0);
  }
}

function parseEnvelope(selado: string): Envelope {
  try {
    const decoded = Buffer.from(selado, "base64").toString("utf8");
    const value = JSON.parse(decoded) as Partial<Envelope>;
    if (
      value.v !== ENVELOPE_VERSION ||
      typeof value.keyVersion !== "string" ||
      !/^\d{14}$/.test(String(value.cnpj)) ||
      !isCiphertext(value.dekWrapped) ||
      !isCiphertext(value.pfx) ||
      !isCiphertext(value.senha)
    ) {
      throw new Error("formato");
    }
    return value as Envelope;
  } catch {
    throw new Error("Certificado selado inválido");
  }
}

function isCiphertext(value: unknown): value is Ciphertext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["iv", "tag", "data"].every((key) =>
    typeof record[key] === "string" && record[key].length > 0
  );
}

export class MasterKeyring {
  readonly currentVersion: string;
  readonly #currentKey: Buffer;
  readonly #previousKey: Buffer | undefined;

  private constructor(
    currentVersion: string,
    currentKey: Buffer,
    previousKey?: Buffer,
  ) {
    this.currentVersion = currentVersion;
    this.#currentKey = currentKey;
    this.#previousKey = previousKey;
  }

  static fromEnvironment(input: {
    currentVersion: string;
    currentKeyBase64: string | undefined;
    previousKeyBase64?: string | undefined;
  }): MasterKeyring {
    const currentKey = decodeMasterKey(
      input.currentKeyBase64,
      "AMZ_RENAVE_MASTER_KEY",
    );
    const previousKey = input.previousKeyBase64
      ? decodeMasterKey(
        input.previousKeyBase64,
        "AMZ_RENAVE_MASTER_KEY_PREV",
      )
      : undefined;
    return new MasterKeyring(input.currentVersion, currentKey, previousKey);
  }

  seal(input: {
    pfx: Buffer;
    senha: Buffer;
    lojaId: string;
    cnpj: string;
  }): { selado: string; keyVersion: string } {
    const aad = aadFor(input.lojaId, input.cnpj);
    const dek = randomBytes(KEY_BYTES);
    try {
      const envelope: Envelope = {
        v: ENVELOPE_VERSION,
        keyVersion: this.currentVersion,
        cnpj: input.cnpj,
        dekWrapped: encrypt(dek, this.#currentKey, aad),
        pfx: encrypt(input.pfx, dek, aad),
        senha: encrypt(input.senha, dek, aad),
      };
      return {
        selado: Buffer.from(JSON.stringify(envelope), "utf8").toString("base64"),
        keyVersion: this.currentVersion,
      };
    } finally {
      aad.fill(0);
      dek.fill(0);
    }
  }

  open(selado: string, lojaId: string): OpenedCertificate {
    const envelope = parseEnvelope(selado);
    const aad = aadFor(lojaId, envelope.cnpj);
    let dek: Buffer | undefined;
    try {
      const masterKey = envelope.keyVersion === this.currentVersion
        ? this.#currentKey
        : this.#previousKey;
      if (!masterKey) {
        throw new Error(`Versão de chave indisponível: ${envelope.keyVersion}`);
      }
      dek = decrypt(envelope.dekWrapped, masterKey, aad);
      const pfx = decrypt(envelope.pfx, dek, aad);
      try {
        const senha = decrypt(envelope.senha, dek, aad);
        return {
          pfx,
          senha,
          cnpj: envelope.cnpj,
          keyVersion: envelope.keyVersion,
        };
      } catch (error) {
        pfx.fill(0);
        throw error;
      }
    } finally {
      aad.fill(0);
      dek?.fill(0);
    }
  }
}
