import { DateTime } from 'luxon';

/**
 * Reminder Scheduler Module
 * 
 * Implements template-based reminder scheduling for legal deadlines with:
 * - Europe/London timezone awareness (DST-safe)
 * - 8am floor constraint (no early morning notifications)
 * - Smart fallback for early morning deadlines
 * - Deduplication of identical reminder times
 * 
 * Design Philosophy:
 * - Use explicit templates instead of calculate-then-clamp
 * - Preserve distinct reminder times by design
 * - Handle edge cases (sub-8am deadlines) with documented fallbacks
 */

interface ReminderTemplate {
  dayOffset: number;  // Days relative to deadline (-1 = previous day, 0 = same day)
  timeOfDay?: string; // Fixed time like "08:00" or "11:00"
  hoursBeforeDeadline?: number; // Calculate relative to deadline time
}

interface ReminderSchedule {
  reminderTimes: DateTime[];  // Absolute reminder times in Europe/London
  minutesBefore: number[];    // Minutes before deadline for Google Calendar API
  provenance: string[];       // Human-readable explanation of each reminder
}

const LONDON_ZONE = 'Europe/London';
const FLOOR_TIME = { hour: 8, minute: 0, second: 0, millisecond: 0 };

/**
 * Get reminder templates based on priority and event type
 */
function getReminderTemplates(priority: string, isAllDay: boolean): ReminderTemplate[] {
  if (isAllDay) {
    // All-day events use fixed 8am reminders on specific days
    if (priority === 'normal') {
      return [
        { dayOffset: 0, timeOfDay: '08:00' }
      ];
    } else {
      // deadline-soon or urgent
      return [
        { dayOffset: -2, timeOfDay: '08:00' },
        { dayOffset: 0, timeOfDay: '08:00' }
      ];
    }
  } else {
    // Timed events use calculated times with 8am floor
    if (priority === 'normal') {
      return [
        { dayOffset: 0, hoursBeforeDeadline: 5 }
      ];
    } else {
      // deadline-soon or urgent
      return [
        { dayOffset: 0, hoursBeforeDeadline: 24 },
        { dayOffset: 0, hoursBeforeDeadline: 5 }
      ];
    }
  }
}

/**
 * Apply 8am floor to a reminder time, with smart fallback for early deadlines
 */
function applyEightAMFloor(
  reminderTime: DateTime,
  deadline: DateTime,
  template: ReminderTemplate,
  priority: string
): DateTime {
  const deadlineDay = deadline.startOf('day');
  const reminderDay = reminderTime.startOf('day');
  const eightAMDeadlineDay = deadlineDay.set(FLOOR_TIME);
  const eightAMReminderDay = reminderDay.set(FLOOR_TIME);
  
  // Check if reminder is on a different day than deadline
  const isPreviousDay = reminderDay < deadlineDay;
  
  // If reminder is on previous day and already >= 8am on that day, keep it
  if (isPreviousDay && reminderTime >= eightAMReminderDay) {
    return reminderTime;
  }
  
  // If reminder is on previous day but before 8am on that day, clamp to 8am
  if (isPreviousDay && reminderTime < eightAMReminderDay) {
    return eightAMReminderDay;
  }
  
  // Reminder is on same day as deadline
  // If calculated reminder is after 8am and before deadline, use it
  if (reminderTime >= eightAMDeadlineDay && reminderTime < deadline) {
    return reminderTime;
  }
  
  // If deadline itself is before 8am, use previous day
  if (deadline < eightAMDeadlineDay) {
    const previousDay = deadlineDay.minus({ days: 1 });
    const eightAMPreviousDay = previousDay.set(FLOOR_TIME);
    
    // For 5-hour reminders on early deadlines with urgent/deadline-soon priority,
    // use 11am previous day to keep it distinct from 24h reminder at 8am
    const isUrgent = priority === 'urgent' || priority === 'deadline-soon';
    if (template.hoursBeforeDeadline === 5 && isUrgent) {
      return eightAMPreviousDay.set({ hour: 11, minute: 0 });
    }
    // For other cases (including normal priority), use 8am previous day
    return eightAMPreviousDay;
  }
  
  // Otherwise clamp to 8am same day
  return eightAMDeadlineDay;
}

/**
 * Materialize a template into a concrete reminder time
 */
function materializeTemplate(
  template: ReminderTemplate,
  deadline: DateTime,
  priority: string
): { time: DateTime; provenance: string } {
  let reminderTime: DateTime;
  let provenance: string;
  
  if (template.timeOfDay) {
    // Fixed time template (for all-day events)
    const [hour, minute] = template.timeOfDay.split(':').map(Number);
    const baseDay = deadline.startOf('day').plus({ days: template.dayOffset });
    reminderTime = baseDay.set({ hour, minute, second: 0, millisecond: 0 });
    
    const dayLabel = template.dayOffset === 0 ? 'same day' : 
                     template.dayOffset === -1 ? 'previous day' :
                     `${Math.abs(template.dayOffset)} days before`;
    provenance = `${template.timeOfDay} ${dayLabel}`;
  } else if (template.hoursBeforeDeadline) {
    // Calculated time template (for timed events)
    const calculated = deadline.minus({ hours: template.hoursBeforeDeadline });
    reminderTime = applyEightAMFloor(calculated, deadline, template, priority);
    
    provenance = `${template.hoursBeforeDeadline}h before (clamped to 8am floor)`;
  } else {
    throw new Error('Invalid reminder template: must specify either timeOfDay or hoursBeforeDeadline');
  }
  
  return { time: reminderTime, provenance };
}

/**
 * Compute reminder schedule for a deadline
 * 
 * @param deadline - Deadline as Date object (will be converted to Europe/London)
 * @param isAllDay - Whether this is an all-day event
 * @param priority - Priority level: 'normal', 'deadline-soon', or 'urgent'
 * @returns Schedule with absolute times, minutes-before, and provenance
 */
export function computeReminderSchedule(params: {
  deadline: Date;
  isAllDay: boolean;
  priority: string;
}): ReminderSchedule {
  const { deadline: deadlineDate, isAllDay, priority } = params;
  
  // Convert deadline to Europe/London timezone
  let deadline = DateTime.fromJSDate(deadlineDate, { zone: LONDON_ZONE });
  
  // For all-day events, treat as occurring at 5pm for reminder calculation
  // This ensures 8am reminders are genuinely "before" the event
  if (isAllDay) {
    deadline = deadline.startOf('day').set({ hour: 17, minute: 0 });
  }
  
  // Get templates for this priority/event type
  const templates = getReminderTemplates(priority, isAllDay);
  
  // Materialize templates into concrete reminder times
  const materializedReminders = templates.map(template => 
    materializeTemplate(template, deadline, priority)
  );
  
  // Deduplicate reminders (keep first occurrence of each unique time)
  const seen = new Set<number>();
  const uniqueReminders = materializedReminders.filter(({ time }) => {
    const timestamp = time.toMillis();
    if (seen.has(timestamp)) {
      return false;
    }
    seen.add(timestamp);
    return true;
  });
  
  // Extract times and provenance
  const reminderTimes = uniqueReminders.map(r => r.time);
  const provenance = uniqueReminders.map(r => r.provenance);
  
  // Calculate minutes-before for Google Calendar API
  const minutesBefore = reminderTimes.map(reminderTime => {
    const diffMs = deadline.toMillis() - reminderTime.toMillis();
    return Math.max(0, Math.floor(diffMs / (60 * 1000)));
  });
  
  return {
    reminderTimes,
    minutesBefore,
    provenance
  };
}

/**
 * Select single reminder for Outlook (which only supports one reminder)
 * Returns the closest reminder to the deadline
 */
export function selectOutlookReminder(schedule: ReminderSchedule): {
  minutes: number;
  provenance: string;
} | null {
  if (schedule.minutesBefore.length === 0) {
    return null;
  }
  
  // Find the smallest non-zero minutes-before (closest to deadline)
  let minIndex = 0;
  let minMinutes = schedule.minutesBefore[0];
  
  for (let i = 1; i < schedule.minutesBefore.length; i++) {
    if (schedule.minutesBefore[i] > 0 && schedule.minutesBefore[i] < minMinutes) {
      minMinutes = schedule.minutesBefore[i];
      minIndex = i;
    }
  }
  
  return {
    minutes: minMinutes,
    provenance: schedule.provenance[minIndex]
  };
}
