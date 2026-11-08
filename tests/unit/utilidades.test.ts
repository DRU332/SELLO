import { describe, expect, it } from "vitest";
import { brandTheme, contrast, contrastReport, suggestColorsFromPixels } from "@/lib/colors";
import { toCsv } from "@/lib/csv";
import { formatMxPhone, normalizeMxPhone, waLink } from "@/lib/phone";
import { describeConditions } from "@/lib/program";
import { sniffImage, validateSvg } from "@/lib/svg";
import type { Program } from "@/lib/types";

describe("Teléfonos de México", () => {
  it("normaliza formatos comunes a +52 y 10 dígitos", () => {
    expect(normalizeMxPhone("33 1234 5678")).toBe("+523312345678");
    expect(normalizeMxPhone("(33) 1234-5678")).toBe("+523312345678");
    expect(normalizeMxPhone("+52 1 33 1234 5678")).toBe("+523312345678");
    expect(normalizeMxPhone("523312345678")).toBe("+523312345678");
  });
  it("rechaza números incompletos u obvios", () => {
    expect(normalizeMxPhone("12345")).toBeNull();
    expect(normalizeMxPhone("0000000000")).toBeNull();
    expect(normalizeMxPhone("")).toBeNull();
  });
  it("arma enlaces wa.me con el mensaje codificado", () => {
    expect(waLink("¡Hola Ana!", "+523312345678")).toBe("https://wa.me/523312345678?text=%C2%A1Hola%20Ana!");
    expect(formatMxPhone("+523312345678")).toBe("33 1234 5678");
  });
});

describe("Contraste de colores de marca", () => {
  it("siempre deja texto legible, incluso con colores parecidos", () => {
    for (const [p, s] of [["#ffff00", "#ffffcc"], ["#777777", "#888888"], ["#000000", "#111111"], ["#5b3a29", "#f6ead9"]]) {
      const t = brandTheme(p, s);
      expect(contrast(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.text, t.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.primary, t.background)).toBeGreaterThanOrEqual(3);
      expect(contrastReport(p, s).every((r) => r.ok)).toBe(true);
    }
  });
  it("sugiere el color dominante del logo ignorando el fondo blanco", () => {
    const px: number[] = [];
    for (let i = 0; i < 400; i++) px.push(255, 255, 255, 255); // fondo
    for (let i = 0; i < 200; i++) px.push(180, 35, 24, 255); // rojo de la marca
    for (let i = 0; i < 50; i++) px.push(20, 120, 60, 255); // verde
    const s = suggestColorsFromPixels(Buffer.from(px));
    expect(s.primary).toBe("#b42318");
    expect(s.palette).toContain("#14783c");
  });
});

describe("Logos", () => {
  it("rechaza SVG con scripts, eventos o enlaces externos", () => {
    expect(validateSvg('<svg><script>alert(1)</script></svg>').ok).toBe(false);
    expect(validateSvg('<svg onload="alert(1)"></svg>').ok).toBe(false);
    expect(validateSvg('<svg><image href="https://x.com/a.png"/></svg>').ok).toBe(false);
    expect(validateSvg('<svg><foreignObject></foreignObject></svg>').ok).toBe(false);
    expect(validateSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg></svg>').ok).toBe(false);
    expect(validateSvg('<svg style="background:url(http://x)"></svg>').ok).toBe(false);
  });
  it("acepta SVG simples", () => {
    expect(validateSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" fill="url(#g)"/></svg>').ok).toBe(true);
  });
  it("detecta el tipo real por contenido, no por extensión", () => {
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffImage(Buffer.from('<?xml version="1.0"?><svg></svg>'))).toBe("svg");
    expect(sniffImage(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffImage(Buffer.from("<html><script></script></html>"))).toBeNull();
  });
});

describe("CSV", () => {
  it("escapa comillas y neutraliza fórmulas de Excel", () => {
    const csv = toCsv(["Nombre", "Nota"], [["=HYPERLINK(\"x\")", 'Dijo "hola", adiós']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Dijo ""hola"", adiós"');
  });
});

describe("Condiciones visibles", () => {
  it("describen sellos, regalo, bloqueo, doble sello, vigencia y restricciones", () => {
    const p: Program = {
      stamps_required: 8, signup_gift: 2, reward_final: "Un café", reward_mid: "Un pan", reward_mid_at: 5,
      valid_from: null, valid_until: "2027-12-31", restrictions: "No aplica en festivos.", cooldown_minutes: 30,
      double_rules: [{ days: [1, 2, 3, 4, 5], from: "16:00", to: "18:00" }],
    };
    const text = describeConditions(p, "America/Mexico_City").join(" ");
    expect(text).toContain("Junta 8 sellos y recibe: Un café.");
    expect(text).toContain("Premio a los 5 sellos: Un pan.");
    expect(text).toContain("2 sellos de regalo");
    expect(text).toContain("mínimo 30 minutos entre sellos");
    expect(text).toContain("Doble sello de lunes a viernes de 16:00 a 18:00 h");
    expect(text).toContain("31 de diciembre de 2027");
    expect(text).toContain("No aplica en festivos.");
  });
});
