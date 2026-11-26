import { MapPin, Plus, ChevronRight } from 'lucide-react';
import { scheduleAlert, type ScheduleResponse } from '@/lib/schedule-api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type GroupResponse } from '@/lib/group-api';
import { getThemeColors } from '@/lib/utils';
import { Modal, Ribbon, EmptyState } from '@/components/ui';
import { GroupAvatar } from '@/components/groups/GroupIdentity';
import { formatTimeOnDay, isMultiDaySchedule, formatScheduleRange, sortSchedules, useTimeFormat } from '@/lib/schedule-utils';

interface AppointmentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  appointments: ScheduleResponse[];
  onCreateNew: () => void;
  onAppointmentClick: (appointment: ScheduleResponse) => void;
  /** 모임 일정 색을 칠할 때 쓴다(없으면 중립색) */
  groups?: GroupResponse[];
}

export default function AppointmentListModal({
  isOpen,
  onClose,
  date,
  appointments,
  onCreateNew,
  onAppointmentClick,
  groups = []
}: AppointmentListModalProps) {
  const tf = useTimeFormat();
  if (!isOpen) return null;
  const day = parseISO(date);
  const sorted = sortSchedules(appointments);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      zIndex="z-[105]"
      title={format(day, 'M월 d일 EEEE', { locale: ko })}
      subtitle={sorted.length > 0 ? `일정 ${sorted.length}개` : undefined}
      bodyClassName="no-scrollbar"
      footer={
        <button
          onClick={() => {
            onClose();
            onCreateNew();
          }}
          className="btn-primary"
        >
          <Plus size={16} strokeWidth={1.5} />
          일정 추가
        </button>
      }
    >
      {sorted.length > 0 ? (
        <div className="-mx-2 space-y-0.5">
          {sorted.map((apt) => {
            const group = apt.groupId ? groups.find((g) => g.id === apt.groupId) : undefined;
            const hex = apt.groupId ? getThemeColors(group?.colorTheme).hex : 'var(--ink-3)';
            const alert = scheduleAlert(apt);
            return (
              <div
                key={apt.id}
                onClick={() => onAppointmentClick(apt)}
                className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 hover:bg-raised transition-colors duration-150 ease-out cursor-pointer"
              >
                <Ribbon color={hex} className="h-9" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base leading-6 text-ink truncate">{apt.title}</h3>
                  {/* 달력에서 붉게 보인 까닭(모바일 월 칸에는 글자가 없어 여기서 알린다) */}
                  {alert && <span className="mb-0.5 inline-flex rounded bg-negative-soft px-1.5 text-[11px] leading-[18px] text-negative">{alert}</span>}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-3 min-w-0">
                    <span className="tabular-nums">
                      {isMultiDaySchedule(apt) ? formatScheduleRange(apt, tf) : `${formatTimeOnDay(apt, day, tf)} – ${format(parseISO(apt.endTime), tf, { locale: ko })}`}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {group && <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />}
                      <span className="truncate">{group ? group.name : apt.groupId ? '모임' : '내 일정'}</span>
                    </span>
                    {apt.location && (
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin size={14} strokeWidth={1.5} className="shrink-0" />
                        <span className="truncate">{apt.location}</span>
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3 shrink-0" />
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState className="py-8" title="등록된 일정이 없어요" description="새 일정을 추가하면 여기에 모여요" />
      )}
    </Modal>
  );
}
