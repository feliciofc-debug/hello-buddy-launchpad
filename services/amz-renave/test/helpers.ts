import forge from "node-forge";
import { MasterKeyring } from "../src/envelope.js";

export const TEST_CNPJ = "85106037000585";

export function generateTestPfx(password = "senha-correta"): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  certificate.setSubject([
    { name: "commonName", value: `Loja Teste:${TEST_CNPJ}` },
    { name: "organizationName", value: "Empresa Teste" },
  ]);
  certificate.setIssuer([
    { name: "commonName", value: "AC ICP-Brasil Teste" },
    { name: "organizationName", value: "ICP-Brasil" },
  ]);
  certificate.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
  ]);
  certificate.sign(keys.privateKey, forge.md.sha256.create());

  const p12 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [certificate],
    password,
    { algorithm: "3des" },
  );
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}

export function testKeyring(
  version = "v1",
  key = Buffer.alloc(32, 7),
  previousKey?: Buffer,
): MasterKeyring {
  return MasterKeyring.fromEnvironment({
    currentVersion: version,
    currentKeyBase64: key.toString("base64"),
    previousKeyBase64: previousKey?.toString("base64"),
  });
}
