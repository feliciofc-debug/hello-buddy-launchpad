export type VehicleBrandPosition =
  | "bottom-right"
  | "top-left"
  | "bottom-center";

export function vehicleBrandPositionList(mediaId: string) {
  return {
    body: "Onde você quer colocar a logo?",
    button: "Escolher posição",
    section_title: "Posição da marca",
    rows: [
      {
        id: `vehicle_brand_position:bottom-right:${mediaId}`,
        title: "Canto inferior direito",
      },
      {
        id: `vehicle_brand_position:top-left:${mediaId}`,
        title: "Canto superior esquerdo",
      },
      {
        id: `vehicle_brand_position:bottom-center:${mediaId}`,
        title: "Centro embaixo",
      },
    ],
  };
}

export function parseVehicleBrandPosition(
  value: string,
): { mediaId: string; position: VehicleBrandPosition } | null {
  const match = String(value || "").match(
    /<<INTERACTIVE_ID:vehicle_brand_position:(bottom-right|top-left|bottom-center):([0-9a-f-]+)>>/i,
  );
  if (!match) return null;
  return {
    position: match[1].toLowerCase() as VehicleBrandPosition,
    mediaId: match[2].toLowerCase(),
  };
}
