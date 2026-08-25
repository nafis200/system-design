import crypto from "crypto";
import fs from "fs";
import path from "path";

import type { Request } from "express";
import httpStatus from "http-status-codes";
import multer from "multer";

import ApiError from "../errors/ApiError";

/**
 * Local disk storage for uploaded images.
 *
 * Everything lives under `backend/uploads/<category>/YYYY/MM/DD/<slug>-<hash>.<ext>`
 * and is served read-only from `/uploads/...`:
 *
 *   uploads/users/2026/08/13/tarik-billa-a1b2c3.jpg
 *   uploads/products/2026/08/13/cotton-shirt-d4e5f6.webp
 *
 * Date partitioning keeps any single directory small and makes it easy to age
 * files out or move a date range to object storage later.
 */

/** `<backend>/uploads` — resolved from this file so it is cwd-independent. */
export const UPLOAD_ROOT = path.resolve(__dirname, "../../../uploads");

/** Top-level folders under the upload root. */
export const UPLOAD_CATEGORIES = ["users", "products"] as const;
export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number];

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const EXTENSION_BY_MIME: Record<AllowedMimeType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const isAllowedMimeType = (value: string): value is AllowedMimeType =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(value);

/** `2026/08/13` for the given moment, in UTC. */
export const datePartition = (at: Date = new Date()): string => {
  const year = String(at.getUTCFullYear());
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  const day = String(at.getUTCDate()).padStart(2, "0");
  return path.join(year, month, day);
};

/**
 * Filesystem-safe slug from a display name. Falls back to `file`, so an
 * all-symbol name can never produce an empty or hidden filename.
 */
export const slugifyName = (name: string): string => {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "file";
};

/**
 * Builds a multer instance that writes into `uploads/<category>/YYYY/MM/DD`.
 *
 * `nameFrom` picks the human-readable part of the filename from the request —
 * the person's name for an avatar, the product name for a product photo.
 */
function createImageUpload(
  category: UploadCategory,
  nameFrom: (req: Request) => string | undefined,
) {
  const storage = multer.diskStorage({
    destination(req, _file, callback) {
      const relativeDir = path.join(category, datePartition());
      const absoluteDir = path.join(UPLOAD_ROOT, relativeDir);

      fs.mkdir(absoluteDir, { recursive: true }, (error) => {
        if (error) {
          callback(error, absoluteDir);
          return;
        }

        // Stash the relative dir so the controller builds the public URL from
        // the same value, rather than recomputing the date across midnight.
        req.uploadRelativeDir = relativeDir;

        callback(null, absoluteDir);
      });
    },

    filename(req, file, callback) {
      const extension = isAllowedMimeType(file.mimetype)
        ? EXTENSION_BY_MIME[file.mimetype]
        : path.extname(file.originalname).toLowerCase();

      const source = nameFrom(req) ?? path.parse(file.originalname).name;

      // A short random suffix keeps two uploads of the same name on the same day
      // from overwriting each other, and stops URLs being guessable.
      const suffix = crypto.randomBytes(6).toString("hex");

      callback(null, `${slugifyName(source)}-${suffix}${extension}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter(_req, file, callback) {
      if (!isAllowedMimeType(file.mimetype)) {
        callback(
          new ApiError(
            httpStatus.UNSUPPORTED_MEDIA_TYPE,
            `Unsupported image type "${file.mimetype}". Allowed: JPEG, PNG, WebP, GIF, AVIF.`,
          ),
        );
        return;
      }
      callback(null, true);
    },
  });
}

/** Profile photos → uploads/users/YYYY/MM/DD, named after the person. */
export const avatarUpload = createImageUpload("users", (req: Request) => {
  const name = (req.body as { name?: unknown } | undefined)?.name;
  if (typeof name === "string" && name.trim()) return name;
  return req.user?.userId;
});

/** Product photos → uploads/products/YYYY/MM/DD, named after the product. */
export const productImageUpload = createImageUpload("products", (req: Request) => {
  const body = req.body as { name?: unknown; sku?: unknown } | undefined;
  if (typeof body?.name === "string" && body.name.trim()) return body.name;
  if (typeof body?.sku === "string" && body.sku.trim()) return body.sku;
  return undefined;
});

/** Public, URL-safe path for a stored file, e.g. `/uploads/users/2026/08/13/x.jpg`. */
export const publicUrlFor = (relativeDir: string, filename: string): string =>
  `/uploads/${relativeDir.split(path.sep).join("/")}/${filename}`;

/**
 * Deletes a previously stored upload. Only touches paths inside the upload root,
 * so a tampered value cannot remove files elsewhere on disk.
 */
export const removeLocalUpload = async (publicUrl?: string): Promise<void> => {
  if (!publicUrl || !publicUrl.startsWith("/uploads/")) return;

  const relative = publicUrl.replace(/^\/uploads\//, "");
  const absolute = path.resolve(UPLOAD_ROOT, relative);

  if (!absolute.startsWith(UPLOAD_ROOT + path.sep)) return;

  await fs.promises.rm(absolute, { force: true });
};

/** Removes a just-written upload after a failed request. */
export const discardUpload = async (
  file?: Express.Multer.File,
): Promise<void> => {
  if (!file?.path) return;
  await fs.promises.rm(file.path, { force: true });
};

export const localFileUploader = {
  avatarUpload,
  productImageUpload,
  datePartition,
  slugifyName,
  publicUrlFor,
  removeLocalUpload,
  /** @deprecated Use `removeLocalUpload`; kept so existing callers keep working. */
  removeLocalAvatar: removeLocalUpload,
  discardUpload,
  UPLOAD_ROOT,
  MAX_IMAGE_BYTES,
};
