import QRCode from "qrcode";

export async function qrSvg(data: string, opts: { dark?: string; margin?: number } = {}) {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 1,
    color: { dark: opts.dark ?? "#111111", light: "#ffffff" },
  });
}

export async function qrPng(data: string, width = 900) {
  return QRCode.toBuffer(data, { type: "png", errorCorrectionLevel: "M", margin: 2, width });
}
