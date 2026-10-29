// Lee un acta en PDF con el mismo lector que usa la app (acta-fiche.js), pero en Node.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createCanvas, DOMMatrix, Path2D, ImageData } from "@napi-rs/canvas";

// pdf.js necesita estas clases del navegador para dibujar la página (color de las tarjetas)
globalThis.DOMMatrix ||= DOMMatrix;
globalThis.Path2D ||= Path2D;
globalThis.ImageData ||= ImageData;

const require = createRequire(import.meta.url);
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const ActaFiche = require("../acta-fiche.js");
const fuentes = join(dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json"))), "standard_fonts") + "/";

export async function leerActa(bytes) {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes), standardFontDataUrl: fuentes, isEvalSupported: false, verbosity: 0
  }).promise;
  try {
    return await ActaFiche.parse(pdf, (width, height) => {
      const canvas = createCanvas(width, height);
      return { canvas, ctx: canvas.getContext("2d") };
    });
  } finally {
    await pdf.destroy();
  }
}
