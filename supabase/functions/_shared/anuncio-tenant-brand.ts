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
    body: "Para qual loja é esse anúncio?",
    buttons: [
      { id: "anuncio_other_store", title: "Informar outra loja" },
      { id: "anuncio_use_amz", title: "Usar marca da AMZ" },
    ],
  };
}

export function anuncioSuccessMessage(): string {
  return "Pronto! Ficou assim. Quer publicar no feed ou no story?";
}
