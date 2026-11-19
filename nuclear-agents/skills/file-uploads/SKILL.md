---
name: file-uploads
description: Build file uploads in a Synapsis product: size and type limits, presigned URLs to object storage, metadata rows, virus scanning, progress and retries on the client. Use when users attach documents, photos or avatars, or the app downloads private files.
title: File uploads
title_es: Subida de archivos
description_es: Construir la subida de archivos en un producto Synapsis: límites de tamaño y tipo, URLs prefirmadas, filas de metadatos, análisis de virus, progreso y reintentos en el cliente. Úsalo cuando los usuarios adjuntan documentos, fotos o avatares, o la app descarga archivos privados.
kind: domain
tags: [uploads, files, presigned url, storage, images, avatar, virus scan, attachments]
---
# File uploads

## When to use

Avatars, photos, receipts, document attachments, exports a user downloads.

## What the platform has

The backend platform has **no file uploads yet** (its roadmap: "file uploads"): a controller parameter is JSON
(a model, a path or query value), with no multipart body. So the file never goes through the API: the client
uploads it straight to object storage with a **presigned URL** the backend signs, and the backend keeps only the
metadata. That is also the right design for large files. Record in the project's docs that it waits for the
platform's own words.

## Steps

1. **The metadata** (`nuclear gen resource files StoredFile --source db --fields "..."`): `id` (UUID), `ownerId`,
   `purpose` (`avatar` | `receipt` | `attachment`), `key` (the object's path in the bucket, made by the server:
   `<purpose>/<ownerId>/<uuid>`), `contentType`, `size: int` (bytes), `checksum?`, `status`: `pending` →
   `uploaded` → `scanning` → `ready` | `rejected`, `createdAt`.
2. **Limits per purpose**, in one service: allowed types (`image/jpeg`, `image/png`, `image/webp` for an avatar;
   `application/pdf` for a receipt) and a maximum size (5 MB, 20 MB). Allow-list, never deny-list.
3. **Ask for an upload** (`POST files/uploads` with `purpose`, `contentType`, `size`, the file name for display):
   validate the limits, save the row `pending`, and answer a presigned PUT URL that expires in minutes and fixes
   the content type and the maximum length. The storage API (S3-compatible or another) is an HTTP repository or a
   target package (`nuclear add <package>`, which ties that service to the dialect); its keys come from `env(...)`.
4. **The client uploads** the bytes with a PUT to that URL, showing progress, with retries on network failures
   and a cancel button; large files use the storage's multipart upload.
5. **Confirm**: `POST files/{id}/complete`; the backend checks the object exists, its real size and type (read the
   first bytes: magic numbers, not the extension), then `scanning`.
6. **Scan** with an antivirus service (an HTTP repository) and set `ready` or `rejected`; only `ready` files are
   linked or shown. Images: strip EXIF metadata (location!) and make the resized copies the app shows.
7. **Download**: private files are served by short-lived presigned GET URLs made after checking the caller may
   read that file; public files (avatars) through a CDN URL.
8. **Clean up**: `pending` rows older than a day and their objects; the old avatar when a new one is ready; every
   file of a deleted account (`privacy-gdpr`).
9. **Mobile**: picking a file or a photo needs the dialect's picker package (`nuclear add <package>`); ask the
   camera or photos permission only when the user taps "add photo". Compress images before uploading.

## The platform's tools

- `nuclear gen resource files StoredFile --source db --fields "ownerId:int purpose:string key:string contentType:string size:int status:string"`
- `nuclear gen usecase files RequestUpload --route "POST files/uploads"`, `nuclear gen usecase files CompleteUpload --route "POST files/{id}/complete"`
- `nuclear make service files FileRules`; `nuclear add <package>` for a storage or picker SDK.
- `nuclear migrate make "files"`, `nuclear migrate`; `nuclear test`.

## Pitfalls

- Trusting the client's content type or file extension; serving uploads from the app's own domain as HTML (XSS).
- Using the user's file name in the storage key (path traversal, collisions).
- Presigned URLs that last hours, or that do not pin type and size.
- Showing a file before the scan finished.
- Base64 files inside JSON bodies: three times the memory, request size limits.
- Leaving GPS coordinates in photo metadata.

## Checklist

- [ ] Type allow-list and size limit per purpose, checked on request and again on completion.
- [ ] Storage keys are server-made UUID paths; no user file name in a key.
- [ ] Presigned URLs expire in minutes; downloads check the caller's right first.
- [ ] Only `ready` files are visible; a test covers a rejected file.
- [ ] Orphan `pending` uploads and files of deleted accounts are removed.
- [ ] Keys come from `env(...)`; `nuclear check .` reports 0 errors; `nuclear test` is green.
