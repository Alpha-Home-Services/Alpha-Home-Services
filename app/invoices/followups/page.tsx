import Link from 'next/link';
import {session} from '@/lib/auth';
import {Nav} from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function FollowupsPage() {
  const {db, profile} = await session();

  if (profile.role === 'tech') {
    return (
      <>
        <Nav name={profile.display_name} role={profile.role} />
        <p className="error">No access.</p>
      </>
    );
  }

  const {data: followups} = await db
    .from('follow_ups')
    .select('*, customers(name, email, phone)')
    .order('date', {ascending: true});

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const categorized = {
    overdue: [] as any[],
    today: [] as any[],
    thisWeek: [] as any[],
    thisMonth: [] as any[],
    later: [] as any[]
  };

  (followups || []).forEach((fu) => {
    const fuDate = new Date(fu.date);
    fuDate.setHours(0, 0, 0, 0);
    const daysFromNow = Math.floor((fuDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysFromNow < 0) {
      categorized.overdue.push({...fu, daysFromNow});
    } else if (daysFromNow === 0) {
      categorized.today.push({...fu, daysFromNow});
    } else if (daysFromNow <= 7) {
      categorized.thisWeek.push({...fu, daysFromNow});
    } else if (daysFromNow <= 30) {
      categorized.thisMonth.push({...fu, daysFromNow});
    } else {
      categorized.later.push({...fu, daysFromNow});
    }
  });

  const renderSection = (title: string, items: any[], color: string) => (
    <div style={{marginBottom: '2rem'}}>
      <div
        style={{
          display: 'flex',