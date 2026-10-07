export function shouldAskAmzAnuncioClient(input: {
  tenantId: string;
  amzTenantId: string;
  clientName?: string | null;
  useTenantBrand?: boolean;
}): boolean {
  return input.tenantId === input.amzTenantId &&
    !String(input.clientName || "").trim() &&
    input.useTenantBrand !== true;
}

export function amzAnuncioClientButtons() {
  return {
    body: "Escolha uma opção:",
    buttons: [
      { id: "anuncio_other_store", title: "Informar outra loja" },
      { id: "anuncio_use_amz", title: "Usar marca da AMZ" },
    ],
  };
}

export function amzMissingClientLogoButtons() {
  return {
    body: "Como deseja continuar?",
    buttons: [
      { id: "anuncio_send_client_logo", title: "Enviar logo agora" },
      { id: "anuncio_use_amz", title: "Usar marca da AMZ" },
    ],
  };
}

export function anuncioSuccessMessage(): string {
  return "Pronto! Ficou assim.";
}
