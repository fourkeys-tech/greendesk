"use client";

import React, { useState } from "react";
import { Printer, Download, Check } from "lucide-react";

export interface QrPrintItem {
  qrDataUrl: string;
  assetCode: string;
  assetName: string;
  parkName?: string;
  companyName?: string;
}

/** Escape teks sebelum disisipkan ke HTML hasil doc.write (cegah HTML injection). */
function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Hanya izinkan data URL gambar dari generator QR. */
function safeImageSrc(url: string): string {
  return /^data:image\/(png|svg\+xml|jpeg|webp);/i.test(url) ? escapeHtml(url) : "";
}

export function printSingleQr(item: QrPrintItem) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cetak QR - ${escapeHtml(item.assetCode)}</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: white;
            color: #0f172a;
          }
          .sticker {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
            border: 2px solid #0f172a;
            border-radius: 16px;
            width: fit-content;
            max-width: 320px;
            background: white;
          }
          .company {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #047857;
            margin-bottom: 8px;
          }
          .qr-img {
            width: 220px;
            height: 220px;
            object-fit: contain;
          }
          .code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 0.08em;
            margin-top: 8px;
            color: #020617;
          }
          .name {
            font-size: 13px;
            font-weight: 700;
            color: #334155;
            margin-top: 4px;
          }
          .loc {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .scan-note {
            font-size: 10px;
            color: #64748b;
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px dashed #cbd5e1;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div class="sticker">
          ${item.companyName ? `<div class="company">${escapeHtml(item.companyName)}</div>` : ""}
          <img class="qr-img" src="${safeImageSrc(item.qrDataUrl)}" alt="${escapeHtml(item.assetCode)}" />
          <div class="code">${escapeHtml(item.assetCode)}</div>
          <div class="name">${escapeHtml(item.assetName)}</div>
          ${item.parkName ? `<div class="loc">${escapeHtml(item.parkName)}</div>` : ""}
          <div class="scan-note">Scan untuk lapor kerusakan fasilitas taman</div>
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }, 250);
}

export function printAllQr(items: QrPrintItem[], companyName?: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Lembar Stiker Gambar QR Aset</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: white;
            color: #0f172a;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
          .sticker {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 14px;
            border: 2px dashed #0f172a;
            border-radius: 12px;
            page-break-inside: avoid;
            background: white;
          }
          .company {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #047857;
            margin-bottom: 4px;
          }
          .qr-img {
            width: 150px;
            height: 150px;
            object-fit: contain;
          }
          .code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 15px;
            font-weight: 900;
            letter-spacing: 0.08em;
            margin-top: 6px;
            color: #020617;
          }
          .name {
            font-size: 11px;
            font-weight: 700;
            color: #1e293b;
            margin-top: 3px;
            line-height: 1.2;
          }
          .loc {
            font-size: 9px;
            color: #64748b;
            margin-top: 2px;
          }
          .scan-note {
            font-size: 8px;
            color: #94a3b8;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="grid">
          ${items
            .map(
              (item) => `
            <div class="sticker">
              ${companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : ""}
              <img class="qr-img" src="${safeImageSrc(item.qrDataUrl)}" alt="${escapeHtml(item.assetCode)}" />
              <div class="code">${escapeHtml(item.assetCode)}</div>
              <div class="name">${escapeHtml(item.assetName)}</div>
              ${item.parkName ? `<div class="loc">${escapeHtml(item.parkName)}</div>` : ""}
              <div class="scan-note">Scan untuk lapor</div>
            </div>
          `
            )
            .join("")}
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }, 250);
}

export function downloadSingleQr(qrDataUrl: string, assetCode: string) {
  const link = document.createElement("a");
  link.href = qrDataUrl;
  link.download = `QR-${assetCode.replace(/[^A-Za-z0-9._-]/g, "_")}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadAllQr(items: QrPrintItem[]) {
  items.forEach((item, index) => {
    setTimeout(() => {
      downloadSingleQr(item.qrDataUrl, item.assetCode);
    }, index * 200);
  });
}

interface PrintQrSheetButtonProps {
  items: QrPrintItem[];
  companyName?: string;
}

export function PrintQrSheetButton({ items, companyName }: PrintQrSheetButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadAll = () => {
    setDownloading(true);
    downloadAllQr(items);
    setTimeout(() => setDownloading(false), items.length * 200 + 500);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => printAllQr(items, companyName)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition cursor-pointer shadow-sm shadow-emerald-600/20"
      >
        <Printer className="w-4 h-4" />
        <span>Cetak Lembar QR Sekarang ({items.length})</span>
      </button>

      <button
        type="button"
        onClick={handleDownloadAll}
        disabled={downloading}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs"
      >
        {downloading ? (
          <>
            <Check className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>Mengunduh {items.length} Gambar...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-slate-500" />
            <span>Unduh Semua Gambar QR (.png)</span>
          </>
        )}
      </button>
    </div>
  );
}

interface SingleCardQrActionsProps {
  item: QrPrintItem;
}

export function SingleCardQrActions({ item }: SingleCardQrActionsProps) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100 w-full">
      <button
        type="button"
        onClick={() => printSingleQr(item)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-[11px] font-bold transition cursor-pointer border border-emerald-200/70"
        title={`Cetak hanya gambar QR ${item.assetCode}`}
      >
        <Printer className="w-3.5 h-3.5 text-emerald-600" />
        <span>Cetak Gambar QR</span>
      </button>

      <button
        type="button"
        onClick={() => downloadSingleQr(item.qrDataUrl, item.assetCode)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-semibold transition cursor-pointer border border-slate-200"
        title={`Unduh file gambar QR-${item.assetCode}.png`}
      >
        <Download className="w-3.5 h-3.5 text-slate-500" />
        <span>Unduh PNG</span>
      </button>
    </div>
  );
}
