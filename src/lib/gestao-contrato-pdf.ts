import { jsPDF } from "jspdf";

export function contratoCorpoToPdfBase64(text: string): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, 180) as string[];
  let y = 20;
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 15, y);
    y += 6;
  }
  const uri = doc.output("datauristring");
  return uri.split(",")[1] ?? "";
}
