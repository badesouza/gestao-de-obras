import { useState } from 'react';
import { ApiError, entityApi } from '../../lib/api-client';
import { Input } from '../../components/ui/Input';

interface CoatOfArmsFieldProps {
  value: string;
  onChange: (url: string) => void;
}

/** Coat of arms URL input with file upload and preview */
export function CoatOfArmsField({ value, onChange }: CoatOfArmsFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewError, setPreviewError] = useState(false);

  const handleUrlChange = (nextValue: string) => {
    setPreviewError(false);
    onChange(nextValue);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setPreviewError(false);
    setUploading(true);
    try {
      const result = await entityApi.uploadCoatOfArms(file);
      onChange(result.url);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <Input
        label="Brasão (URL da imagem ou data URL)"
        type="text"
        value={value}
        onChange={(e) => handleUrlChange(e.target.value)}
        placeholder="https://…, data:image/… ou envie um arquivo"
      />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-[var(--color-ink)]">Enviar arquivo</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={uploading}
          onChange={(e) => void handleFileChange(e)}
          className="text-sm text-[var(--color-muted)] file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--color-surface-soft)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--color-ink)]"
        />
      </label>

      {uploading ? (
        <p className="text-xs text-[var(--color-muted)]">Enviando imagem…</p>
      ) : null}
      {uploadError ? (
        <p className="text-xs text-[var(--color-error)]">{uploadError}</p>
      ) : null}

      {value && !previewError ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted)]">
            Pré-visualização
          </p>
          <img
            src={value}
            alt="Brasão da entidade"
            className="mx-auto max-h-32 max-w-full object-contain"
            onError={() => setPreviewError(true)}
          />
        </div>
      ) : null}

      {value && previewError ? (
        <p className="text-xs text-[var(--color-error)]">
          Não foi possível carregar a imagem. Verifique a URL ou envie outro arquivo.
        </p>
      ) : null}
    </div>
  );
}
