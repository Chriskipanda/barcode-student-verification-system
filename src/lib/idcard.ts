import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

export interface IdCardStudent {
  full_name: string;
  admission_number: string;
  barcode: string;
  programme: string;
  nta_level: string;
  year_of_study: number;
  photoDataUrl?: string | null;
  is_visitor?: boolean;
  expires_at?: string | null;
}

function barcodeDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, { format: "CODE128", width: 2, height: 50, displayValue: false, margin: 0 });
  return canvas.toDataURL("image/png");
}

// Render a single ID card on a credit-card-sized PDF (85.6 x 54 mm).
export function generateIdCardPDF(student: IdCardStudent, collegeName = "Arusha Technical College") {
  const doc = new jsPDF({ unit: "mm", format: [85.6, 54] });
  doc.setFillColor(20, 80, 50);
  doc.rect(0, 0, 85.6, 9, "F");
  doc.setTextColor(255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(collegeName.toUpperCase(), 42.8, 6, { align: "center" });

  if (student.photoDataUrl) {
    try { doc.addImage(student.photoDataUrl, "JPEG", 3, 12, 22, 28); } catch { /* ignore */ }
  } else {
    doc.setDrawColor(180);
    doc.rect(3, 12, 22, 28);
  }

  doc.setTextColor(20);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(student.full_name.slice(0, 28), 27, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Adm: ${student.admission_number}`, 27, 21);
  doc.text(`${student.programme}`.slice(0, 32), 27, 25);
  doc.text(`NTA ${student.nta_level} · Year ${student.year_of_study}`, 27, 29);
  if (student.is_visitor) {
    doc.setTextColor(200, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.text("VISITOR PASS", 27, 33);
    if (student.expires_at) {
      doc.setFont("helvetica", "normal");
      doc.text(`Expires ${student.expires_at}`, 27, 36);
    }
    doc.setTextColor(20);
  }

  try {
    const bc = barcodeDataUrl(student.barcode);
    doc.addImage(bc, "PNG", 3, 42, 79.6, 9);
  } catch { /* ignore */ }

  return doc;
}

export function downloadIdCard(student: IdCardStudent, collegeName?: string) {
  const doc = generateIdCardPDF(student, collegeName);
  doc.save(`id-card-${student.admission_number}.pdf`);
}

// Bulk: 8 cards per A4 page (2 cols x 4 rows)
export function downloadBulkIdCards(students: IdCardStudent[], collegeName = "Arusha Technical College") {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cardW = 85.6, cardH = 54;
  const marginX = (210 - cardW * 2 - 5) / 2;
  const marginY = (297 - cardH * 4 - 15) / 2;
  let i = 0;
  for (const s of students) {
    const idx = i % 8;
    if (i > 0 && idx === 0) doc.addPage();
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = marginX + col * (cardW + 5);
    const y = marginY + row * (cardH + 5);
    drawCard(doc, s, x, y, collegeName);
    i++;
  }
  doc.save(`id-cards-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function drawCard(doc: jsPDF, s: IdCardStudent, x: number, y: number, collegeName: string) {
  doc.setDrawColor(180); doc.rect(x, y, 85.6, 54);
  doc.setFillColor(20, 80, 50); doc.rect(x, y, 85.6, 9, "F");
  doc.setTextColor(255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(collegeName.toUpperCase(), x + 42.8, y + 6, { align: "center" });
  if (s.photoDataUrl) { try { doc.addImage(s.photoDataUrl, "JPEG", x + 3, y + 12, 22, 28); } catch {} }
  else { doc.setDrawColor(180); doc.rect(x + 3, y + 12, 22, 28); }
  doc.setTextColor(20); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(s.full_name.slice(0, 28), x + 27, y + 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.text(`Adm: ${s.admission_number}`, x + 27, y + 21);
  doc.text(s.programme.slice(0, 32), x + 27, y + 25);
  doc.text(`NTA ${s.nta_level} · Year ${s.year_of_study}`, x + 27, y + 29);
  try {
    const bc = barcodeDataUrl(s.barcode);
    doc.addImage(bc, "PNG", x + 3, y + 42, 79.6, 9);
  } catch {}
}
