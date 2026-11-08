// Une todas las migraciones en supabase/instalar-todo.sql para pegarlas de una vez
// en el SQL Editor de Supabase.   npm run sql:unir
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const parts = files.map((f) => `-- ===== ${f} =====\n${readFileSync(`${dir}/${f}`, "utf8").trim()}\n`);
writeFileSync(
  "supabase/instalar-todo.sql",
  `-- Sellos · instalación completa de la base de datos.\n` +
    `-- Pégalo completo en Supabase → SQL Editor → New query → Run.\n` +
    `-- Archivo generado con "npm run sql:unir"; no lo edites a mano.\n\n` +
    parts.join("\n"),
);
console.log(`supabase/instalar-todo.sql generado con ${files.length} migraciones.`);
