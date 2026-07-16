import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  Archive,
  Building2,
  Check,
  Download,
  ImagePlus,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { useApartmentData, createEmptyApartment } from '../data/ApartmentDataProvider';
import { PRIMARY_ADMIN_EMAIL } from '../data/accessConfig';
import {
  deleteManagedApartment,
  makeApartmentId,
  removeAccessAccount,
  saveAccessAccount,
  saveManagedApartment,
} from '../data/apartmentService';
import { migrateLegacyData } from '../data/legacyMigration';
import type { AccessRole, ManagedApartment } from '../data/types';

interface PendingPhoto {
  file: File;
  caption: string;
  previewUrl: string;
}

function cloneApartment(apartment: ManagedApartment): ManagedApartment {
  return {
    ...apartment,
    instructionsVi: [...apartment.instructionsVi],
    instructionsEn: [...apartment.instructionsEn],
    photos: apartment.photos.map(photo => ({ ...photo })),
  };
}

function stepsToText(steps: string[]): string {
  return steps.join('\n\n');
}

function textToSteps(value: string): string[] {
  return value
    .split(/\n\s*\n/g)
    .map(step => step.trim())
    .filter(Boolean);
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export default function DataManagement() {
  const { apartments, accessAccounts, canEdit, isAdmin, role, user } = useApartmentData();
  const [working, setWorking] = useState<ManagedApartment | null>(null);
  const [removedStoragePaths, setRemovedStoragePaths] = useState<string[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AccessRole>('editor');
  const [accessSaving, setAccessSaving] = useState('');
  const [legacyKey, setLegacyKey] = useState('');
  const [apartmentQuery, setApartmentQuery] = useState('');
  const [migrationMessage, setMigrationMessage] = useState('');
  const [migrationPercent, setMigrationPercent] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const pendingPhotosRef = useRef<PendingPhoto[]>([]);

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(() => () => {
    pendingPhotosRef.current.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
  }, []);

  const totalPhotos = useMemo(
    () => apartments.reduce((sum, apartment) => sum + apartment.photos.length, 0),
    [apartments],
  );
  const filteredApartments = useMemo(() => {
    const normalizedQuery = normalizeSearch(apartmentQuery);
    if (!normalizedQuery) return apartments;
    return apartments.filter(apartment => normalizeSearch(apartment.apartment).includes(normalizedQuery));
  }, [apartmentQuery, apartments]);

  const openEditor = (apartment?: ManagedApartment) => {
    pendingPhotos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    setPendingPhotos([]);
    setRemovedStoragePaths([]);
    setWorking(apartment ? cloneApartment(apartment) : createEmptyApartment());
    setMessage('');
    setError('');
  };

  const closeEditor = () => {
    pendingPhotos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    setPendingPhotos([]);
    setRemovedStoragePaths([]);
    setWorking(null);
  };

  const updateField = <K extends keyof ManagedApartment>(field: K, value: ManagedApartment[K]) => {
    setWorking(current => current ? { ...current, [field]: value } : current);
  };

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = [...files].filter(file => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024);
    const next = accepted.map(file => ({
      file,
      caption: file.name.replace(/\.[^.]+$/, ''),
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingPhotos(current => [...current, ...next]);
    if (accepted.length !== files.length) setError('Only image files up to 10 MB were added.');
  };

  const removeExistingPhoto = (index: number) => {
    if (!working) return;
    const photo = working.photos[index];
    if (photo?.storagePath) setRemovedStoragePaths(current => [...current, photo.storagePath]);
    updateField('photos', working.photos.filter((_, photoIndex) => photoIndex !== index));
  };

  const removePendingPhoto = (index: number) => {
    setPendingPhotos(current => {
      const photo = current[index];
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return current.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const saveApartment = async () => {
    if (!working || !user?.email) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const id = working.id || makeApartmentId(working.apartment, apartments.map(apartment => apartment.id));
      await saveManagedApartment(
        { ...working, id },
        pendingPhotos.map(photo => ({ file: photo.file, caption: photo.caption })),
        removedStoragePaths,
        user.email,
      );
      setMessage(working.id ? 'Apartment updated successfully.' : 'New apartment added successfully.');
      closeEditor();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the apartment.');
    } finally {
      setSaving(false);
    }
  };

  const deleteApartment = async (apartment: ManagedApartment) => {
    if (!window.confirm(`Delete “${apartment.apartment}” and its uploaded photos?`)) return;
    setError('');
    setMessage('');
    try {
      await deleteManagedApartment(apartment);
      setMessage('Apartment deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete the apartment.');
    }
  };

  const addAccount = async () => {
    setAccessSaving(newEmail);
    setError('');
    try {
      await saveAccessAccount(newEmail, newRole);
      setNewEmail('');
      setNewRole('editor');
      setMessage('Access account saved.');
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : 'Unable to save the account.');
    } finally {
      setAccessSaving('');
    }
  };

  const changeRole = async (email: string, nextRole: AccessRole) => {
    setAccessSaving(email);
    setError('');
    try {
      await saveAccessAccount(email, nextRole);
      setMessage('User role updated.');
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : 'Unable to update the role.');
    } finally {
      setAccessSaving('');
    }
  };

  const removeAccount = async (email: string) => {
    if (!window.confirm(`Remove access for ${email}?`)) return;
    setAccessSaving(email);
    setError('');
    try {
      await removeAccessAccount(email);
      setMessage('User access removed.');
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : 'Unable to remove the account.');
    } finally {
      setAccessSaving('');
    }
  };

  const migrateExistingData = async () => {
    if (!user?.email) return;
    if (apartments.length > 0 && !window.confirm('Re-importing will overwrite matching legacy apartment records. Continue?')) return;
    setMigrating(true);
    setError('');
    setMigrationPercent(0);
    try {
      await migrateLegacyData(legacyKey, user.email, (nextMessage, percent) => {
        setMigrationMessage(nextMessage);
        setMigrationPercent(percent);
      });
      setLegacyKey('');
      setMessage('Existing apartment data imported. The previous access key is no longer needed.');
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : 'Unable to import the existing data.');
    } finally {
      setMigrating(false);
    }
  };

  const exportBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      apartments: apartments.map(apartment => ({
        ...apartment,
        photos: apartment.photos.map(({ storagePath, caption }) => ({ storagePath, caption })),
      })),
      accessAccounts: isAdmin ? accessAccounts : undefined,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `apartment-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!canEdit) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <ShieldCheck className="mx-auto h-10 w-10 text-indigo-500" />
        <h2 className="mt-3 text-sm font-extrabold text-slate-900 dark:text-white">View-only account</h2>
        <p className="mt-1 text-xs text-slate-500">Your current role ({role}) can view data but cannot edit it.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-indigo-500">Live Firebase data</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">Quản lý căn hộ & quyền truy cập</h2>
            <p className="mt-1 text-[10px] text-slate-500">Thay đổi được lưu ngay; không cần sửa GitHub hoặc deploy lại.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportBackup} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-extrabold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <Download className="h-3.5 w-3.5" /> Export backup
            </button>
            <button type="button" onClick={() => openEditor()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[10px] font-extrabold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Thêm căn hộ
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={<Building2 />} label="Apartments" value={apartments.length} />
          <Stat icon={<Wifi />} label="Wi-Fi profiles" value={apartments.filter(item => item.wifiName || item.password).length} />
          <Stat icon={<ImagePlus />} label="Photos" value={totalPhotos} />
        </div>
      </section>

      {(message || error) && (
        <div className={`rounded-xl border p-3 text-[11px] font-semibold ${error ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
          {error || message}
        </div>
      )}

      {isAdmin && (
        <details open={apartments.length === 0} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20 sm:p-5">
          <summary className="cursor-pointer text-xs font-extrabold text-amber-950 dark:text-amber-200">
            {apartments.length === 0 ? 'Nhập dữ liệu hiện tại một lần' : 'Recovery: re-import legacy apartment data'}
          </summary>
          <div className="mt-3 flex items-start gap-3">
            <Archive className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-[10px] leading-5 text-amber-800 dark:text-amber-300">Nhập access key cũ để chuyển toàn bộ Wi-Fi, instruction và hình ảnh sang Firebase. Sau khi hoàn tất, app sẽ không hỏi mã này nữa.{apartments.length > 0 ? ' Chỉ dùng lại mục này để khôi phục một lần import bị gián đoạn.' : ''}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input type="password" value={legacyKey} onChange={event => setLegacyKey(event.target.value)} placeholder="Previous access key" className="h-11 flex-1 rounded-xl border border-amber-200 bg-white px-3 text-base outline-none focus:border-amber-500 dark:border-amber-900 dark:bg-slate-950 md:text-xs" />
                <button type="button" onClick={() => void migrateExistingData()} disabled={migrating || !legacyKey.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-[10px] font-extrabold text-white disabled:opacity-50">
                  {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  {migrating ? 'Importing…' : 'Import existing data'}
                </button>
              </div>
              {migrationMessage && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-950"><div className="h-full bg-amber-500 transition-all" style={{ width: `${migrationPercent}%` }} /></div>
                  <p className="mt-1.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400">{migrationMessage}</p>
                </div>
              )}
            </div>
          </div>
        </details>
      )}

      {working && (
        <ApartmentEditor
          key={working.id || 'new-apartment'}
          working={working}
          pendingPhotos={pendingPhotos}
          saving={saving}
          onUpdate={updateField}
          onUpdateExistingPhoto={(index, caption) => updateField('photos', working.photos.map((photo, photoIndex) => photoIndex === index ? { ...photo, caption } : photo))}
          onUpdatePendingPhoto={(index, caption) => setPendingPhotos(current => current.map((photo, photoIndex) => photoIndex === index ? { ...photo, caption } : photo))}
          onRemoveExistingPhoto={removeExistingPhoto}
          onRemovePendingPhoto={removePendingPhoto}
          onFiles={handlePhotoFiles}
          onSave={() => void saveApartment()}
          onCancel={closeEditor}
        />
      )}

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">Danh sách căn hộ</h3>
            <p className="mt-1 text-[9px] text-slate-400">Edit Wi-Fi, lockbox and guest instructions from one record.</p>
          </div>
          <label className="relative block sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="search" value={apartmentQuery} onChange={event => setApartmentQuery(event.target.value)} placeholder="Search apartment name…" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-base text-slate-800 caret-indigo-500 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:caret-indigo-300 dark:placeholder:text-slate-500 dark:focus:bg-slate-950 md:text-xs" />
          </label>
        </div>
        {apartments.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">No apartment data yet. Import the existing package or add a new apartment.</div>
        ) : filteredApartments.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">Không tìm thấy căn hộ phù hợp với “{apartmentQuery}”.</div>
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3 sm:p-4">
            {filteredApartments.map(apartment => (
              <article key={apartment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[11px] font-extrabold leading-5 text-slate-800 dark:text-slate-200">{apartment.apartment}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(apartment.wifiName || apartment.password) && <Tag icon={<Wifi />} label="Wi-Fi" />}
                      {(apartment.lockboxCode || apartment.instructionsVi.length || apartment.instructionsEn.length) && <Tag icon={<KeyRound />} label="Check-in" />}
                      {apartment.photos.length > 0 && <Tag icon={<ImagePlus />} label={`${apartment.photos.length} photos`} />}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openEditor(apartment)} className="rounded-lg border border-slate-200 bg-white p-2 text-indigo-600 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void deleteApartment(apartment)} className="rounded-lg border border-slate-200 bg-white p-2 text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-indigo-500" /><h3 className="text-xs font-extrabold text-slate-900 dark:text-white">Quyền truy cập</h3></div>
            <p className="mt-1 text-[9px] text-slate-400">Admin có thể thêm hoặc thu hồi tài khoản mà không cần deploy lại.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
              <input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="new-user@example.com" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 md:text-xs" />
              <select value={newRole} onChange={event => setNewRole(event.target.value as AccessRole)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none dark:border-slate-700 dark:bg-slate-950">
                <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option>
              </select>
              <button type="button" onClick={() => void addAccount()} disabled={!newEmail.trim() || Boolean(accessSaving)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[10px] font-extrabold text-white disabled:opacity-50"><UserPlus className="h-4 w-4" /> Add user</button>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {accessAccounts.map(account => {
              const primary = account.email === PRIMARY_ADMIN_EMAIL;
              return (
                <div key={account.email} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">{account.email}</p>
                    {primary && <p className="mt-0.5 text-[9px] font-extrabold text-indigo-500">Primary admin · cannot be removed</p>}
                  </div>
                  <div className="flex gap-2">
                    <select value={primary ? 'admin' : account.role} disabled={primary || accessSaving === account.email} onChange={event => void changeRole(account.email, event.target.value as AccessRole)} className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 sm:w-28">
                      <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option>
                    </select>
                    {!primary && <button type="button" onClick={() => void removeAccount(account.email)} disabled={accessSaving === account.email} className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-rose-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ApartmentEditor({ working, pendingPhotos, saving, onUpdate, onUpdateExistingPhoto, onUpdatePendingPhoto, onRemoveExistingPhoto, onRemovePendingPhoto, onFiles, onSave, onCancel }: {
  key?: string;
  working: ManagedApartment;
  pendingPhotos: PendingPhoto[];
  saving: boolean;
  onUpdate: <K extends keyof ManagedApartment>(field: K, value: ManagedApartment[K]) => void;
  onUpdateExistingPhoto: (index: number, caption: string) => void;
  onUpdatePendingPhoto: (index: number, caption: string) => void;
  onRemoveExistingPhoto: (index: number) => void;
  onRemovePendingPhoto: (index: number) => void;
  onFiles: (files: FileList | null) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [viText, setViText] = useState(() => stepsToText(working.instructionsVi));
  const [enText, setEnText] = useState(() => stepsToText(working.instructionsEn));

  return (
    <section className="rounded-2xl border-2 border-indigo-200 bg-white shadow-lg shadow-indigo-100/60 dark:border-indigo-900 dark:bg-slate-900 dark:shadow-none">
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800 sm:px-5">
        <div><p className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-500">{working.id ? 'Edit apartment' : 'New apartment'}</p><h3 className="mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">{working.apartment || 'Apartment details'}</h3></div>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 p-2 text-slate-500 dark:border-slate-700"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        <FormSection title="Thông tin chính">
          <Field label="Apartment name *" value={working.apartment} onChange={value => onUpdate('apartment', value)} wide />
          <Field label="Key collection address" value={working.keyAddress} onChange={value => onUpdate('keyAddress', value)} />
          <Field label="Google Maps URL" value={working.keyMapUrl} onChange={value => onUpdate('keyMapUrl', value)} />
          <Field label="Lockbox code" value={working.lockboxCode} onChange={value => onUpdate('lockboxCode', value)} />
          <Field label="Lockbox type" value={working.lockboxType} onChange={value => onUpdate('lockboxType', value)} />
        </FormSection>
        <FormSection title="Wi-Fi">
          <Field label="Wi-Fi name" value={working.wifiName} onChange={value => onUpdate('wifiName', value)} />
          <Field label="Password" value={working.password} onChange={value => onUpdate('password', value)} />
          <Field label="Wi-Fi note" value={working.wifiNote} onChange={value => onUpdate('wifiNote', value)} wide />
        </FormSection>
        <FormSection title="Guest instructions">
          <div className="col-span-full rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-[10px] leading-5 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
            Nội dung ở ô <strong>Tiếng Việt</strong> sẽ được dùng khi chọn 🇻🇳 VI và bấm Copy. Nội dung ở ô <strong>English</strong> sẽ được dùng khi chọn 🇬🇧 EN. Mỗi bước cách nhau bằng một dòng trống.
          </div>
          <TextArea
            label="🇻🇳 HƯỚNG DẪN TIẾNG VIỆT · nội dung để Copy VI"
            helper="Nhập từng bước bằng tiếng Việt; chừa một dòng trống giữa hai bước."
            placeholder={'Ví dụ:\nĐi đến hộp khóa cạnh cửa chính.\n\nNhập mã hộp khóa và lấy chìa khóa.'}
            value={viText}
            tone="vi"
            onChange={value => { setViText(value); onUpdate('instructionsVi', textToSteps(value)); }}
          />
          <TextArea
            label="🇬🇧 ENGLISH INSTRUCTIONS · content used for Copy EN"
            helper="Enter each step in English; leave one blank line between steps."
            placeholder={'Example:\nGo to the lockbox beside the main entrance.\n\nEnter the lockbox code and collect the key.'}
            value={enText}
            tone="en"
            onChange={value => { setEnText(value); onUpdate('instructionsEn', textToSteps(value)); }}
          />
          <TextArea label="Thông tin hướng dẫn chung / bản gốc" helper="Chỉ dùng làm nội dung dự phòng nếu chưa nhập hướng dẫn theo ngôn ngữ ở trên." value={working.instructions} onChange={value => onUpdate('instructions', value)} />
          <TextArea label="Ghi chú nội bộ" helper="Chỉ dành cho người quản lý; không nằm trong nội dung Copy cho khách." value={working.notes} onChange={value => onUpdate('notes', value)} />
        </FormSection>
        <FormSection title="Check-in photos">
          <div className="col-span-full grid grid-cols-2 gap-3 md:grid-cols-4">
            {working.photos.map((photo, index) => <PhotoEditor key={photo.storagePath} src={photo.url || ''} caption={photo.caption} onCaption={value => onUpdateExistingPhoto(index, value)} onRemove={() => onRemoveExistingPhoto(index)} />)}
            {pendingPhotos.map((photo, index) => <PhotoEditor key={photo.previewUrl} src={photo.previewUrl} caption={photo.caption} onCaption={value => onUpdatePendingPhoto(index, value)} onRemove={() => onRemovePendingPhoto(index)} isNew />)}
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center text-indigo-600 transition hover:bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/20">
              <ImagePlus className="h-6 w-6" /><span className="mt-2 text-[10px] font-extrabold">Add photos</span><span className="mt-1 text-[8px] text-indigo-400">JPG, PNG, WebP · max 10 MB</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={event => { onFiles(event.target.files); event.target.value = ''; }} />
            </label>
          </div>
        </FormSection>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800 sm:px-5">
        <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-slate-200 px-4 text-[10px] font-extrabold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button>
        <button type="button" onClick={onSave} disabled={saving || !working.apartment.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[10px] font-extrabold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : 'Save apartment'}</button>
      </div>
    </section>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <div><h4 className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{title}</h4><div className="grid gap-3 md:grid-cols-2">{children}</div></div>;
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={wide ? 'md:col-span-2' : ''}><span className="mb-1.5 block text-[9px] font-bold text-slate-500 dark:text-slate-400">{label}</span><input value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white md:text-xs" /></label>;
}

function TextArea({ label, helper, placeholder, value, onChange, tone = 'default' }: { label: string; helper?: string; placeholder?: string; value: string; onChange: (value: string) => void; tone?: 'default' | 'vi' | 'en' }) {
  const toneClass = tone === 'vi'
    ? 'border-rose-200 bg-rose-50/40 focus:border-rose-500 dark:border-rose-900 dark:bg-rose-950/20'
    : tone === 'en'
      ? 'border-blue-200 bg-blue-50/40 focus:border-blue-500 dark:border-blue-900 dark:bg-blue-950/20'
      : 'border-slate-200 bg-slate-50 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950';
  const labelClass = tone === 'vi' ? 'text-rose-700 dark:text-rose-300' : tone === 'en' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400';
  return <label><span className={`mb-1 block text-[10px] font-extrabold ${labelClass}`}>{label}</span>{helper && <span className="mb-2 block text-[9px] leading-4 text-slate-400">{helper}</span>}<textarea value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} rows={8} className={`w-full resize-y rounded-xl border p-3 text-base leading-5 text-slate-800 outline-none transition focus:bg-white dark:text-white md:text-xs ${toneClass}`} /></label>;
}

function PhotoEditor({ src, caption, onCaption, onRemove, isNew = false }: { key?: string; src: string; caption: string; onCaption: (value: string) => void; onRemove: () => void; isNew?: boolean }) {
  return <article className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"><div className="relative aspect-square bg-slate-100 dark:bg-slate-900">{src ? <img src={src} alt={caption} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] text-slate-400">Loading image…</span>}<button type="button" onClick={onRemove} className="absolute right-2 top-2 rounded-full bg-rose-600 p-1.5 text-white shadow"><X className="h-3 w-3" /></button>{isNew && <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-1 text-[8px] font-extrabold text-white">NEW</span>}</div><input value={caption} onChange={event => onCaption(event.target.value)} placeholder="Photo caption" className="h-10 w-full border-0 border-t border-slate-200 bg-white px-2 text-[9px] outline-none dark:border-slate-700 dark:bg-slate-900" /></article>;
}

function Stat({ icon, label, value }: { icon: ReactElement; label: string; value: number }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60"><div className="flex items-center gap-1.5 text-indigo-500 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}<span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span></div><p className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">{value}</p></div>;
}

function Tag({ icon, label }: { icon: ReactElement; label: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[8px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 [&_svg]:h-2.5 [&_svg]:w-2.5">{icon}{label}</span>;
}
