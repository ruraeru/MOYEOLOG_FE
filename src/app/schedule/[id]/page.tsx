'use client';

import { useParams } from 'next/navigation';
import AppointmentDetailView from '@/components/AppointmentDetailView';
import Navbar from '@/components/Navbar';

export default function ScheduleDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  if (!id) return null;

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-screen bg-canvas">
      <Navbar />
      <main className="flex-1 overflow-hidden relative lg:px-8 lg:py-6">
        <div className="h-full max-w-6xl mx-auto bg-surface overflow-hidden flex flex-col lg:rounded-xl lg:border lg:border-line">
          <AppointmentDetailView scheduleId={id} isPage={true} />
        </div>
      </main>
    </div>
  );
}
