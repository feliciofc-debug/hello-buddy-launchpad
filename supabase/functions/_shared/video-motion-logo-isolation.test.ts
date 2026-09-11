import {
  logoEhDeProspect,
  validarProvenienciaLogo,
} from "./video-motion-enfileirar.ts";

const userId = "11111111-1111-1111-1111-111111111111";
const oficial = `${userId}/logo-amz.png`;
const prospectA = `${userId}/prospect/revista-maisbonita.png`;
const legacyProspect = `${userId}/prospect-antiga.png`;

Deno.test("logo do cliente A nunca é aceita na identidade oficial B", () => {
  const erro = validarProvenienciaLogo(userId, prospectA, "tenant", oficial);
  if (!erro) throw new Error("logo do prospect A vazou para a identidade tenant B");
});

Deno.test("logo oficial nunca é aceita como logo de prospect", () => {
  const erro = validarProvenienciaLogo(userId, oficial, "prospect", oficial);
  if (!erro) throw new Error("logo oficial foi aceita numa identidade de prospect");
});

Deno.test("logos de prospect novas e legadas são reconhecidas", () => {
  if (!logoEhDeProspect(userId, prospectA) || !logoEhDeProspect(userId, legacyProspect)) {
    throw new Error("namespace de prospecção não foi reconhecido");
  }
});

Deno.test("vídeo sem logo bloqueia qualquer caminho residual", () => {
  const erro = validarProvenienciaLogo(userId, prospectA, "none", oficial);
  if (!erro) throw new Error("logo residual foi aceita em vídeo sem logo");
});