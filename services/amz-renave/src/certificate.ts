import { createHash } from "node:crypto";
import forge from "node-forge";

export type CertificateMetadata = {
  cnpj: string;
  validoAte: string;
  fingerprint: string;
};

function validCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const calculate = (length: number): number => {
    let factor = length - 7;
    let total = 0;
    for (let index = 0; index < length; index++) {
      total += Number(value[index]) * factor--;
      if (factor === 1) factor = 9;
    }
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(value[12]) &&
    calculate(13) === Number(value[13]);
}

function certificateText(certificate: forge.pki.Certificate): string {
  return [...certificate.subject.attributes, ...certificate.issuer.attributes]
    .map((attribute) => String(attribute.value ?? ""))
    .join(" ");
}

function extractCnpj(certificate: forge.pki.Certificate): string {
  const candidates = certificateText(certificate).match(/\d{14}/g) ?? [];
  const cnpj = candidates.find(validCnpj);
  if (!cnpj) throw new Error("O certificado não contém um CNPJ válido");
  return cnpj;
}

function assertIcpBrasil(certificate: forge.pki.Certificate): void {
  const identity = certificateText(certificate)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (!identity.includes("icp-brasil") && !identity.includes("icp brasil")) {
    throw new Error("O certificado não pertence à ICP-Brasil");
  }
}

export function inspectECnpjPfx(
  pfx: Buffer,
  password: string,
  now = new Date(),
): CertificateMetadata {
  let pkcs12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(pfx.toString("binary"));
    pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    throw new Error("PFX inválido ou senha incorreta");
  }

  const certBagOid = String(forge.pki.oids.certBag);
  const shroudedKeyBagOid = String(forge.pki.oids.pkcs8ShroudedKeyBag);
  const keyBagOid = String(forge.pki.oids.keyBag);
  const certBags = pkcs12.getBags({
    bagType: certBagOid,
  })[certBagOid] ?? [];
  const keyBags = [
    ...(pkcs12.getBags({
      bagType: shroudedKeyBagOid,
    })[shroudedKeyBagOid] ?? []),
    ...(pkcs12.getBags({
      bagType: keyBagOid,
    })[keyBagOid] ?? []),
  ];
  const privateKey = keyBags.find((bag) => bag.key)?.key;
  const certificate = privateKey
    ? certBags.find((bag) => {
      const publicKey = bag.cert?.publicKey as
        | forge.pki.rsa.PublicKey
        | undefined;
      return publicKey?.n?.compareTo(privateKey.n) === 0 &&
        publicKey.e?.compareTo(privateKey.e) === 0;
    })?.cert
    : undefined;
  if (!certificate || !privateKey) {
    throw new Error("PFX sem certificado e chave privada");
  }

  assertIcpBrasil(certificate);
  const cnpj = extractCnpj(certificate);
  if (
    now < certificate.validity.notBefore ||
    now > certificate.validity.notAfter
  ) {
    throw new Error("Certificado fora da validade");
  }

  const der = forge.asn1.toDer(
    forge.pki.certificateToAsn1(certificate),
  ).getBytes();
  const fingerprint = createHash("sha256")
    .update(Buffer.from(der, "binary"))
    .digest("hex");

  return {
    cnpj,
    validoAte: certificate.validity.notAfter.toISOString(),
    fingerprint,
  };
}
