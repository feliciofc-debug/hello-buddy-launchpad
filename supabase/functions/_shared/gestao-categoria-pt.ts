const MAP: Array<{ re: RegExp; categoria: string }> = [
  { re: /\bpneu/, categoria: "pneus" },
  { re: /\bfunilaria|\bpintura|\blataria/, categoria: "funilaria_pintura" },
  { re: /\bmecani|\boficina|\brevis/, categoria: "mecanica" },
  { re: /\besteti|\bdetailing|\blavagem/, categoria: "estetica" },
  { re: /\bdocument|\bdetran|\btransfer/, categoria: "documentacao" },
  { re: /\btransport|\bfrete|\bguincho/, categoria: "transporte" },
  { re: /\banunc|\bportal|\bwebmotors|\bolx/, categoria: "anuncio" },
  { re: /\bcomiss/, categoria: "comissao" },
];

export function inferGestaoCategoria(text: string): string {
  const t = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const { re, categoria } of MAP) {
    if (re.test(t)) return categoria;
  }
  return "outros";
}
