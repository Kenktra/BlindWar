import React, { useEffect, useRef, useState } from 'react';
import { validateClientAvatarDataUrl } from '../services/apiClient.js';

export interface AvatarCropperModalProps {
  readonly open: boolean;
  readonly currentAvatarImage?: string | null;
  readonly onClose: () => void;
  readonly onSaveAvatar: (dataUrl: string) => Promise<void>;
  readonly onRemoveAvatar: () => Promise<void>;
}

const ACCEPTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_RAW_FILE_BYTES = 3 * 1024 * 1024;
const CROP_STAGE_SIZE = 240;
const EXPORT_SIZE = 160;

async function hasValidRasterSignature(file: File): Promise<boolean> {
  const buf = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length < 4) return false;
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return true;
  }
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }
  // WebP (RIFF....WEBP)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true;
  }
  return false;
}

export const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  open,
  currentAvatarImage,
  onClose,
  onSaveAvatar,
  onRemoveAvatar,
}) => {
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.2);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      return;
    }
    if (currentAvatarImage && !loadedImage) {
      const img = new Image();
      img.onload = () => setLoadedImage(img);
      img.src = currentAvatarImage;
    }
  }, [open, currentAvatarImage, loadedImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CROP_STAGE_SIZE, CROP_STAGE_SIZE);
    const baseScale = Math.max(
      CROP_STAGE_SIZE / loadedImage.width,
      CROP_STAGE_SIZE / loadedImage.height,
    );
    const drawW = loadedImage.width * baseScale * zoom;
    const drawH = loadedImage.height * baseScale * zoom;
    const drawX = (CROP_STAGE_SIZE - drawW) / 2 + offsetX;
    const drawY = (CROP_STAGE_SIZE - drawH) / 2 + offsetY;
    ctx.drawImage(loadedImage, drawX, drawY, drawW, drawH);
  }, [loadedImage, zoom, offsetX, offsetY]);

  if (!open) return null;

  const handleFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setErrorMsg(null);

    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      setErrorMsg(
        'Format non autorisé. Choisissez uniquement une photo PNG, JPEG ou WebP (les fichiers SVG/HTML sont bloqués).',
      );
      return;
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      setErrorMsg('Fichier trop lourd (maximum 3 Mo avant compression).');
      return;
    }
    const validSignature = await hasValidRasterSignature(file);
    if (!validSignature) {
      setErrorMsg(
        'Signature de fichier invalide : ce fichier ne correspond pas à une véritable image PNG, JPEG ou WebP.',
      );
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      setLoadedImage(img);
      setZoom(1.15);
      setOffsetX(0);
      setOffsetY(0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrorMsg('Impossible de lire cette image.');
    };
    img.src = objectUrl;
  };

  const handleSave = async () => {
    if (!loadedImage) {
      setErrorMsg('Sélectionnez d’abord une image valide.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = EXPORT_SIZE;
      exportCanvas.height = EXPORT_SIZE;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponible.');

      const ratio = EXPORT_SIZE / CROP_STAGE_SIZE;
      const baseScale = Math.max(
        CROP_STAGE_SIZE / loadedImage.width,
        CROP_STAGE_SIZE / loadedImage.height,
      );
      const drawW = loadedImage.width * baseScale * zoom * ratio;
      const drawH = loadedImage.height * baseScale * zoom * ratio;
      const drawX = (EXPORT_SIZE - drawW) / 2 + offsetX * ratio;
      const drawY = (EXPORT_SIZE - drawH) / 2 + offsetY * ratio;

      ctx.clearRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
      ctx.drawImage(loadedImage, drawX, drawY, drawW, drawH);

      let dataUrl = exportCanvas.toDataURL('image/webp', 0.86);
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = exportCanvas.toDataURL('image/png');
      }
      const safeDataUrl = validateClientAvatarDataUrl(dataUrl);
      await onSaveAvatar(safeDataUrl);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors du traitement de l’image.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await onRemoveAvatar();
      setLoadedImage(null);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div
        className="bw-modal-dialog bw-modal-compact"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Importer et recadrer votre photo de profil"
      >
        <div className="bw-modal-header">
          <h2>🖼️ Photo de profil</h2>
          <button type="button" className="bw-btn bw-btn-ghost bw-btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="bw-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label className="bw-btn bw-btn-secondary" style={{ width: 'fit-content' }}>
            📁 Choisir une image (PNG, JPEG, WebP)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>

          {errorMsg && <div className="bw-form-error">⚠️ {errorMsg}</div>}

          {loadedImage ? (
            <>
              <div
                className="bw-cropper-stage"
                onPointerDown={(e) => {
                  dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current.active) return;
                  const dx = e.clientX - dragRef.current.lastX;
                  const dy = e.clientY - dragRef.current.lastY;
                  dragRef.current.lastX = e.clientX;
                  dragRef.current.lastY = e.clientY;
                  setOffsetX((v) => Math.max(-180, Math.min(180, v + dx)));
                  setOffsetY((v) => Math.max(-180, Math.min(180, v + dy)));
                }}
                onPointerUp={() => {
                  dragRef.current.active = false;
                }}
                title="Glissez pour ajuster le cadrage"
              >
                <canvas
                  ref={canvasRef}
                  width={CROP_STAGE_SIZE}
                  height={CROP_STAGE_SIZE}
                  style={{ display: 'block', width: '100%', height: '100%' }}
                />
                <div className="bw-cropper-ring" aria-hidden="true" />
              </div>

              <label className="bw-setting-control-row">
                <span className="bw-setting-control-title">Zoom : {Math.round(zoom * 100)}%</span>
                <input
                  type="range"
                  min={0.8}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="bw-range-input"
                />
              </label>

              <p className="bw-muted-small">
                Glissez l’image dans le cadre circulaire puis cliquez sur Enregistrer.
              </p>
            </>
          ) : (
            <p className="bw-muted-small">
              Aucune photo chargée. Vous pouvez importer un PNG, JPEG ou WebP et le recadrer, ou
              conserver un avatar de pion BLIND WAR.
            </p>
          )}

          <div className="bw-modal-footer-btns">
            <button
              type="button"
              className="bw-btn bw-btn-primary"
              disabled={!loadedImage || busy}
              onClick={handleSave}
            >
              {busy ? 'Enregistrement…' : '✅ Enregistrer la photo'}
            </button>
            {currentAvatarImage && (
              <button
                type="button"
                className="bw-btn bw-btn-danger"
                disabled={busy}
                onClick={handleRemove}
              >
                🗑️ Supprimer la photo
              </button>
            )}
            <button type="button" className="bw-btn bw-btn-ghost" onClick={onClose}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
