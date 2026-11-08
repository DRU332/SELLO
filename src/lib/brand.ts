import { publicEnv } from "@/lib/env";

export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/logos/${path}`;
}

export function cardUrl(token: string) {
  return `${publicEnv.appUrl}/t/${token}`;
}

export function businessUrl(slug: string) {
  return `${publicEnv.appUrl}/n/${slug}`;
}

export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
