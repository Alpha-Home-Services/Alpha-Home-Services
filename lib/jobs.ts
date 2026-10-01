// Job helpers shared by intake, the job list and the job page.
export const JOB_STATUS:Record<string,string>={scheduled:'Scheduled',enroute:'On the way',progress:'In progress',parts:'Waiting on parts',invoiced:'Invoiced',paid:'Paid'};
export const WINDOWS=[['1','1 hour'],['1.5','1.5 hours'],['2','2 hours'],['3','3 hours'],['4','4 hours'],['6','6 hours'],['8','All day']] as const;
export const LEAD_SOURCES=['Google','Referral','Repeat customer','Facebook','Yard sign','Truck wrap','Other'] as const;
export type Slot={time:string;window_hours:number|string};
const minutes=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+(m||0);};
// Two arrival windows on the same day overlap if one starts before the other ends (touching end-to-start is fine).
export function overlaps(a:Slot,b:Slot){const as=minutes(a.time),ae=as+Math.round(Number(a.window_hours)*60),bs=minutes(b.time),be=bs+Math.round(Number(b.window_hours)*60);return as<be&&bs<ae;}
export function clock(t:string){const [h,m]=t.split(':').map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}
export function windowText(time:string,hours:number|string){const end=minutes(time)+Math.round(Number(hours)*60);return clock(time)+'–'+clock(`${Math.floor(end/60)%24}:${end%60}`);}
export function longDate(iso:string){return new Date(iso+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});}
export const jobNumber=(n:number)=>'J-'+n;
// Alpha works in Arizona (no daylight saving), so "today" for scheduling uses Arizona time, not the server's clock.
export const TIME_ZONE='America/Phoenix';
export const todayIso=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE}).format(new Date());
