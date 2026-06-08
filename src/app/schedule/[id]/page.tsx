'use client';

import { useParams } from 'next/navigation';
import AppointmentDetailView from '@/components/AppointmentDetailView';
import Navbar from '@/components/Navbar';

export default function ScheduleDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  if (!id) return null;

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FB]">
      <Navbar />
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full max-w-7xl mx-auto bg-white shadow-sm overflow-hidden flex flex-col">
          <AppointmentDetailView scheduleId={id} isPage={true} />
        </div>
      </main>
    </div>
  );
}
