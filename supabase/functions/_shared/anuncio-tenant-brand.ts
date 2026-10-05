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
    body: "Se este anúncio for da própria AMZ, confirme abaixo.",
    buttons: [
      { id: "anuncio_use_amz", title: "Usar marca da AMZ" },
    ],
  };
}
