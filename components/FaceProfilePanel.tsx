"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, UserRound } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useCredits } from "@/components/CreditsProvider";
import { PLAN_PROFILE_SLOTS } from "@/lib/data";
import {
  deleteFaceProfile,
  listFaceProfiles,
  upsertFaceProfile,
  type FaceProfile,
} from "@/lib/faceProfiles";
import { processUploadFiles } from "@/lib/processUpload";

type Props = {
  compact?: boolean;
  onSelect?: (profile: FaceProfile) => void;
  selectedId?: string | null;
};

export default function FaceProfilePanel({ compact, onSelect, selectedId }: Props) {
  const { t } = useI18n();
  const { planId } = useCredits();
  const [profiles, setProfiles] = useState<FaceProfile[]>([]);
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const maxSlots = useMemo(() => {
    if (planId === "free") return 1;
    return PLAN_PROFILE_SLOTS[planId] ?? 1;
  }, [planId]);

  useEffect(() => {
    setProfiles(listFaceProfiles());
  }, []);

  const saveProfile = () => {
    if (!name.trim()) {
      setError(t.profiles.nameRequired);
      return;
    }
    if (photos.length < 1) {
      setError(t.profiles.photoRequired);
      return;
    }
    if (profiles.length >= maxSlots) {
      setError(t.profiles.slotFull.replace("{n}", String(maxSlots)));
      return;
    }
    const profile: FaceProfile = {
      id: `fp-${Date.now()}`,
      name: name.trim(),
      slot: profiles.length + 1,
      photoUrls: photos.slice(0, 12),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = upsertFaceProfile(profile);
    setProfiles(next);
    setName("");
    setPhotos([]);
    setError(null);
    onSelect?.(profile);
  };

  return (
    <div className={compact ? "space-y-3" : "glass-card space-y-4 p-4 sm:p-6"}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-medium text-white/80">
          <UserRound className="h-4 w-4 text-glow-purple" />
          {t.profiles.title}
        </h3>
        <span className="text-[11px] text-white/40">
          {t.profiles.slots
            .replace("{used}", String(profiles.length))
            .replace("{max}", String(maxSlots))}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect?.(p)}
            className={`rounded-xl border p-3 text-left transition ${
              selectedId === p.id
                ? "border-glow-emerald/50 bg-glow-emerald/10"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                #{p.slot} {p.name}
              </span>
              <button
                type="button"
                className="rounded p-1 text-white/30 hover:text-red-300"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfiles(deleteFaceProfile(p.id));
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-1 overflow-hidden">
              {p.photoUrls.slice(0, 4).map((url) => (
                <img key={url} src={url} alt="" className="h-10 w-10 rounded-md object-cover" />
              ))}
            </div>
          </button>
        ))}
      </div>

      {!compact && (
        <div className="space-y-3 border-t border-white/[0.06] pt-4">
          <p className="text-xs text-white/45">{t.profiles.createHint}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.profiles.namePlaceholder}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-glow-purple/40"
          />
          <label className="btn-secondary inline-flex cursor-pointer px-3 py-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            {busy ? t.profiles.uploading : t.profiles.uploadPhotos}
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
              className="hidden"
              onChange={async (e) => {
                setBusy(true);
                setError(null);
                const files = Array.from(e.target.files || []);
                const { ok, errors } = await processUploadFiles(files, 12 - photos.length);
                if (ok.length) setPhotos((prev) => [...prev, ...ok.map((f) => f.url)].slice(0, 12));
                if (errors.length) setError(t.profiles.uploadError);
                setBusy(false);
                e.target.value = "";
              }}
            />
          </label>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {photos.map((url) => (
                <img key={url} src={url} alt="" className="h-12 w-12 rounded-md object-cover" />
              ))}
            </div>
          )}
          {error && <p className="text-xs text-amber-200">{error}</p>}
          <button type="button" onClick={saveProfile} className="btn-primary w-full py-2.5 text-sm">
            {t.profiles.save}
          </button>
        </div>
      )}
    </div>
  );
}
