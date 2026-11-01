"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, RequestAttachment } from "@/lib/types";

const BUCKET = "attachments";
const MAX_FILE_MB = 20;

function sizeLabel(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Pièces jointes d'une demande. Fichiers dans le bucket privé
 * « attachments » (supabase storage) + métadonnées dans
 * request_attachments (RLS : client propriétaire, staff, chauffeur affecté).
 */
export default function RequestAttachments({
  requestId,
  clientId,
}: {
  requestId: string;
  clientId: string;
}) {
  const supabase = useRef<ReturnType<typeof createClient> | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RequestAttachment[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<Profile["role"] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  const client = () => (supabase.current ??= createClient());

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await client().auth.getUser();
      if (!user) return;
      setMeId(user.id);
      const { data: me } = await client().from("profiles").select("role").eq("id", user.id).single();
      if (me) setMeRole(me.role as Profile["role"]);
    })();
  }, []);

  const canUpload = meRole === "admin" || meRole === "dispatcher" || meId === clientId;
  const canDelete = (a: RequestAttachment) =>
    (meRole === "admin" || meRole === "dispatcher") || a.uploaded_by === meId;

  const load = useCallback(async () => {
    const { data } = await client()
      .from("request_attachments")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as RequestAttachment[]);
  }, [requestId]);

  useEffect(() => {
    if (open && items === null) void load();
  }, [open, items, load]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          setError(`« ${file.name} » dépasse ${MAX_FILE_MB} Mo.`);
          continue;
        }
        const path = `${requestId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-() ]+/g, "_")}`;
        const { error: upErr } = await client().storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (upErr) {
          setError(`Envoi impossible : ${upErr.message}`);
          continue;
        }
        await client()
          .from("request_attachments")
          .insert({
            request_id: requestId,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            uploaded_by: meId,
          });
      }
      fileInputRef.current && (fileInputRef.current.value = "");
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function download(a: RequestAttachment) {
    const { data } = await client().storage.from(BUCKET).createSignedUrl(a.storage_path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(a: RequestAttachment) {
    await client().storage.from(BUCKET).remove([a.storage_path]);
    await client().from("request_attachments").delete().eq("id", a.id);
    await load();
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-navy-600 hover:text-navy-800 dark:text-slate-300"
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        Pièces jointes {items ? `(${items.length})` : ""}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
          {error && <p className="mb-2 text-xs font-semibold text-red-600">{error}</p>}

          {items === null && <p className="text-xs text-slate-400">Chargement…</p>}
          {items !== null && items.length === 0 && (
            <p className="text-xs text-slate-400">
              Aucun document joint — ordonnance, transfert, carte vitale ou justificatif : ajoutez-les ici.
            </p>
          )}
          {items !== null && items.length > 0 && (
            <ul className="space-y-1.5">
              {items.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs dark:bg-white/10">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-200">
                    {a.file_name}
                    <span className="ml-1.5 text-slate-400">{sizeLabel(a.size_bytes)}</span>
                  </span>
                  <span className="shrink-0 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void download(a)}
                      className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-navy-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
                    >
                      Télécharger
                    </button>
                    {canDelete(a) && (
                      <button
                        type="button"
                        onClick={() => void remove(a)}
                        className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-red-600 hover:bg-red-50 dark:border-white/10 dark:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {canUpload && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => void upload(e.target.files)}
              disabled={uploading}
              className="mt-2 w-full cursor-pointer rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-navy-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
            />
          )}
          {uploading && <p className="mt-1 text-xs text-slate-400">Envoi en cours…</p>}
        </div>
      )}
    </div>
  );
}
