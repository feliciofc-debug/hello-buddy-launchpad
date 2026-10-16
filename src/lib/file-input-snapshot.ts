/** Copia arquivos antes de limpar `<input type="file">` (FileList é “vivo”). */
export function snapshotInputFiles(
  fileList: FileList | null | undefined,
): File[] {
  return Array.from(fileList ?? []);
}
