/**
 * Minimal markdown → PDF for submission pack (no pandoc required).
 * Usage: node scripts/md-to-pdf.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function stripMd(line) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^\s*[-*]\s+/, "• ")
    .replace(/^\s*\d+\.\s+/, (m) => m);
}

function writePdf(mdPath, pdfPath, title) {
  const text = fs.readFileSync(mdPath, "utf8");
  const doc = new PDFDocument({ margin: 50, size: "LETTER" });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  doc.fontSize(16).font("Helvetica-Bold").text(title, { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica");

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      doc.moveDown(0.4);
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(13).text(stripMd(line), {
        width: 512,
      });
      doc.font("Helvetica").fontSize(10);
      continue;
    }
    if (/^#{3,6}\s/.test(line)) {
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").fontSize(11).text(stripMd(line), {
        width: 512,
      });
      doc.font("Helvetica").fontSize(10);
      continue;
    }
    if (/^```/.test(line) || /^---+$/.test(line)) {
      continue;
    }
    doc.text(stripMd(line), { width: 512, align: "left" });
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

const submission = path.join(root, "docs", "submission");
fs.mkdirSync(submission, { recursive: true });

// Rebuild combined README + AI_USAGE with UTF-8
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const ai = fs.readFileSync(path.join(root, "AI_USAGE.md"), "utf8");
const combined = `# README + AI_USAGE (combined for form upload)\n\n---\n\n${readme}\n\n---\n\n${ai}\n`;
fs.writeFileSync(path.join(submission, "README_AND_AI_USAGE.md"), combined, "utf8");

await writePdf(
  path.join(root, "docs", "RESEARCH.md"),
  path.join(submission, "Research_Note.pdf"),
  "Research Note — LLD Practice Platform",
);
await writePdf(
  path.join(root, "docs", "DESIGN.md"),
  path.join(submission, "Design_Note.pdf"),
  "Design Note — LLD Practice Platform",
);
await writePdf(
  path.join(submission, "README_AND_AI_USAGE.md"),
  path.join(submission, "README_AND_AI_USAGE.pdf"),
  "README + AI_USAGE — LLD Practice Platform",
);

console.log("Wrote PDFs to docs/submission/");
