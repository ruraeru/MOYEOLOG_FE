'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle, Camera, CheckCircle2, Loader2, User as UserIcon, X } from 'lucide-react';
import { userApi, type UserResponse, type UserUpdate } from '@/lib/user-api';
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/axios';
import {
  codePointLength,
  convertToWebP,
  getFileUrl,
  hasInvisibleOrControlChar,
  hasVisibleChar,
  graphemeLength,
  validateImageFile,
} from '@/lib/utils';
import { MAX_UPLOAD_BYTES } from '@/lib/constants';
import { useAlertStore } from '@/hooks/useAlert';
import { InlineError } from './ui';

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const BIO_MAX = 200;

// 백엔드 규칙과 같게: 앞뒤 공백 제거, 글자(grapheme) 기준 2~20자, 제어 문자·보이지 않는 문자 금지(이모지 ZWJ·이체 선택자는 허용)
const profileSchema = z.object({
  nickname: z.string().superRefine((value, ctx) => {
    const trimmed = value.trim();
    const length = graphemeLength(trimmed);
    let message: string | null = null;
    if (!trimmed) message = '활동 이름을 입력해 주세요.';
    else if (hasInvisibleOrControlChar(trimmed)) message = '줄바꿈·탭·보이지 않는 문자는 활동 이름에 쓸 수 없어요.';
    else if (!hasVisibleChar(trimmed)) message = '보이는 글자를 넣어 주세요.';
    else if (length < NICKNAME_MIN) message = `활동 이름은 ${NICKNAME_MIN}자 이상이어야 해요.`;
    else if (length > NICKNAME_MAX) message = `활동 이름은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`;
    if (message) ctx.addIssue({ code: 'custom', message });
  }),
  bio: z.string().refine((value) => codePointLength(value) <= BIO_MAX, `자기소개는 ${BIO_MAX}자까지 쓸 수 있어요.`),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface SaveInput {
  fields: UserUpdate;
  image: File | null;
}

export default function ProfileSection({ user }: { user: UserResponse }) {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const { confirm } = useAlertStore();

  const [notice, setNotice] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { nickname: user.nickname ?? '', bio: user.bio ?? '' },
  });

  // 서버 값이 바뀌면(저장 후 등) 폼을 그 값으로 맞춥니다.
  useEffect(() => {
    reset({ nickname: user.nickname ?? '', bio: user.bio ?? '' });
  }, [user.nickname, user.bio, reset]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const showNotice = (type: 'success' | 'info', text: string) => {
    setNotice({ type, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  };

  const bioValue = useWatch({ control, name: 'bio' });
  const bioLength = codePointLength(bioValue ?? '');
  const serverImage = getFileUrl(user.profileImage);
  const preview = localPreview ?? serverImage;

  const clearSelectedImage = () => {
    setImageFile(null);
    setLocalPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** 저장 결과를 화면·헤더(세션)에 반영합니다. */
  const applyUpdatedUser = async (updated: UserResponse) => {
    queryClient.setQueryData(['user', 'me'], updated);
    await updateSession({
      user: {
        name: updated.nickname,
        image: getFileUrl(updated.profileImage),
      },
    }).catch(() => {});
  };

  const saveMutation = useMutation({
    mutationFn: ({ fields, image }: SaveInput) => userApi.updateMe(fields, image, session),
    onMutate: () => {
      setError(null);
      setNotice(null);
    },
    onSuccess: async (updated) => {
      clearSelectedImage();
      setImageError(null);
      await applyUpdatedUser(updated);
      showNotice('success', '저장했어요');
    },
    onError: (err, { image }) => {
      const message = getApiErrorMessage(err, '프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      const status = getApiErrorStatus(err);
      const imageRejected =
        !!image && (status === 413 || status === 415 || (status === 400 && /이미지|사진|파일|형식/.test(message)));
      if (imageRejected) {
        // 거부된 사진을 계속 다시 보내지 않도록 선택을 비웁니다.
        clearSelectedImage();
        setError(`${message} 사진 선택을 취소했어요. 다른 사진을 골라 주세요.`);
      } else {
        setError(message);
      }
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: () => userApi.deleteProfileImage(session),
    onMutate: () => {
      setError(null);
      setNotice(null);
    },
    onSuccess: async (updated) => {
      await applyUpdatedUser(updated);
      showNotice('success', '프로필 사진을 지웠어요');
    },
    onError: (err) => setError(getApiErrorMessage(err, '프로필 사진을 지우지 못했어요.')),
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);

    const invalid = validateImageFile(file);
    if (invalid) {
      setImageError(invalid);
      e.target.value = '';
      return;
    }

    const converted = await convertToWebP(file);
    if (converted.size > MAX_UPLOAD_BYTES) {
      setImageError('파일이 너무 커요. 10MB 이하로 올려 주세요.');
      e.target.value = '';
      return;
    }

    setImageFile(converted);
    const reader = new FileReader();
    reader.onloadend = () => setLocalPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => {
      setImageError('사진을 읽을 수 없어요. 다른 사진을 골라 주세요.');
      clearSelectedImage();
    };
    reader.readAsDataURL(converted);
  };

  const handleRemoveImage = async () => {
    if (imageFile) {
      clearSelectedImage();
      return;
    }
    if (!user.profileImage) return;
    const ok = await confirm('프로필 사진을 삭제할까요?', '사진 삭제', '삭제');
    if (ok) deleteImageMutation.mutate();
  };

  const onSubmit = (values: ProfileFormValues) => {
    // 바뀐 필드만 보냅니다 (다른 탭에서 바꾼 값을 옛 값으로 덮어쓰지 않도록).
    const fields: UserUpdate = {};
    const nickname = values.nickname.trim();
    if (nickname !== (user.nickname ?? '')) fields.nickname = nickname;
    if (values.bio !== (user.bio ?? '')) fields.bio = values.bio;

    if (Object.keys(fields).length === 0 && !imageFile) {
      showNotice('info', '바뀐 내용이 없어요');
      return;
    }
    saveMutation.mutate({ fields, image: imageFile });
  };

  const busy = saveMutation.isPending || deleteImageMutation.isPending;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-display text-xl leading-7 text-ink">프로필</h3>
        <p className="mt-1 text-sm text-ink-2">친구와 모임 멤버에게 보이는 내 정보예요</p>
      </div>

      <form onSubmit={(e) => handleSubmit(onSubmit)(e)} className="card divide-y divide-line" noValidate>
        {/* 사진 + 계정 정보 */}
        <div className="flex items-start gap-4 px-5 py-5 lg:px-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label="프로필 사진 바꾸기"
            className="group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-raised"
          >
            {preview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt="프로필 사진" className="h-full w-full object-cover" />
            ) : (
              <UserIcon size={24} strokeWidth={1.5} className="text-ink-3" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={16} strokeWidth={1.5} />
            </span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageChange}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-6 text-ink">{user.nickname}</p>
            <p className="mt-0.5 text-[13px] tabular-nums text-ink-2">@{user.customId}</p>
            <p className="mt-0.5 truncate text-[13px] text-ink-3">{user.email || '등록된 이메일이 없어요'}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="btn-secondary btn-sm">
                사진 바꾸기
              </button>
              {(imageFile || user.profileImage) && (
                <button type="button" onClick={handleRemoveImage} disabled={busy} className="btn-ghost btn-sm">
                  <X size={16} strokeWidth={1.5} />
                  {imageFile ? '선택 취소' : '사진 삭제'}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-ink-3">JPG, PNG, GIF, WEBP · 최대 10MB</p>
            {imageFile && <p className="mt-1 text-xs text-ink-2">새 사진은 저장을 눌러야 반영돼요</p>}
            {imageError && (
              <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-negative">
                <AlertCircle size={16} strokeWidth={1.5} /> {imageError}
              </p>
            )}
          </div>
        </div>

        {/* 입력칸 */}
        <div className="space-y-5 px-5 py-5 lg:px-6">
          <div className="space-y-2">
            <label htmlFor="settings-nickname" className="block text-sm font-medium text-ink">
              활동 이름
            </label>
            <input
              id="settings-nickname"
              {...register('nickname')}
              type="text"
              autoComplete="nickname"
              placeholder="이름을 입력해 주세요"
              className={`form-input h-10 ${errors.nickname ? '!border-negative' : ''}`}
            />
            {errors.nickname ? (
              <p className="flex items-center gap-1 text-xs text-negative">
                <AlertCircle size={16} strokeWidth={1.5} /> {errors.nickname.message}
              </p>
            ) : (
              <p className="text-xs text-ink-3">
                {NICKNAME_MIN}~{NICKNAME_MAX}자. 친구와 모임 멤버에게 이 이름으로 보여요.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="settings-bio" className="text-sm font-medium text-ink">
                자기소개
              </label>
              <span className={`stamp ${bioLength > BIO_MAX ? '!text-negative' : ''}`}>
                {bioLength}/{BIO_MAX}
              </span>
            </div>
            <textarea
              id="settings-bio"
              {...register('bio')}
              placeholder="자기소개를 적어 보세요"
              className={`form-input min-h-[120px] resize-none leading-relaxed ${errors.bio ? '!border-negative' : ''}`}
            />
            {errors.bio && (
              <p className="flex items-center gap-1 text-xs text-negative">
                <AlertCircle size={16} strokeWidth={1.5} /> {errors.bio.message}
              </p>
            )}
          </div>

          {error && <InlineError message={error} />}
        </div>

        {/* 저장 */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 lg:px-6">
          {notice && !error && (
            <p role="status" className="mr-auto flex items-center gap-1.5 text-sm text-ink-2">
              {notice.type === 'success' && <CheckCircle2 size={16} strokeWidth={1.5} className="text-positive" />}
              {notice.text}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary">
            {saveMutation.isPending ? (
              <>
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                저장 중…
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
