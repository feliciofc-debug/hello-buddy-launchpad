export type AnuncioPhotoSource = "improved" | "original" | "none";

export async function selectAnuncioPhoto<T>(input: {
  preferred?: string | null;
  original?: string | null;
  load: (url: string) => Promise<T | null>;
}): Promise<{ value: T | null; source: AnuncioPhotoSource }> {
  const preferred = String(input.preferred || "").trim();
  const original = String(input.original || "").trim();
  if (preferred) {
    const value = await input.load(preferred);
    if (value != null) {
      return {
        value,
        source: original && original === preferred ? "original" : "improved",
      };
    }
  }
  if (original && original !== preferred) {
    const value = await input.load(original);
    if (value != null) return { value, source: "original" };
  }
  return { value: null, source: "none" };
}
