import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { computeReminderSchedule, selectOutlookReminder } from './reminderScheduler';

/**
 * Comprehensive test suite for reminder scheduler
 * 
 * Tests all 7 documented scenarios:
 * 1. Normal timed @ 15:00 → 10:00 same day
 * 2. Normal timed @ 11:00 → 8am same day
 * 3. Normal timed @ 07:00 → 8am previous day
 * 4. Urgent timed @ 15:00 → 15:00 prev + 10:00 same
 * 5. Urgent timed @ 07:00 → 8am prev + 11am prev
 * 6. Normal all-day → 8am same day
 * 7. Urgent all-day → 8am 2-days + 8am same
 * 
 * Plus DST transition edge cases
 */

/**
 * Helper to create a deadline in Europe/London timezone
 */
function createLondonDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return DateTime.fromObject(
    { year, month, day, hour, minute },
    { zone: 'Europe/London' }
  ).toJSDate();
}

describe('Reminder Scheduler', () => {
  describe('Normal Priority Timed Events', () => {
    it('should schedule 10:00 same day for 15:00 deadline (Scenario 1)', () => {
      // 15:00 deadline - 5h = 10:00, which is >= 8am and < deadline
      const deadline = createLondonDate(2025, 11, 15, 15, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'normal'
      });

      expect(schedule.reminderTimes.length).toBe(1);
      
      const reminder = schedule.reminderTimes[0];
      expect(reminder.hour).toBe(10);
      expect(reminder.minute).toBe(0);
      expect(reminder.day).toBe(15);
    });

    it('should clamp to 8am same day for 11:00 deadline (Scenario 2)', () => {
      // 11:00 deadline - 5h = 6:00, which is < 8am → clamp to 8am same day
      const deadline = createLondonDate(2025, 11, 15, 11, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'normal'
      });

      expect(schedule.reminderTimes.length).toBe(1);
      
      const reminder = schedule.reminderTimes[0];
      expect(reminder.hour).toBe(8);
      expect(reminder.minute).toBe(0);
      expect(reminder.day).toBe(15);
    });

    it('should use 8am previous day for 07:00 deadline (Scenario 3)', () => {
      // 07:00 deadline is before 8am → use 8am previous day (normal priority)
      const deadline = createLondonDate(2025, 11, 15, 7, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'normal'
      });

      expect(schedule.reminderTimes.length).toBe(1);
      
      const reminder = schedule.reminderTimes[0];
      expect(reminder.hour).toBe(8);
      expect(reminder.minute).toBe(0);
      expect(reminder.day).toBe(14); // Previous day
    });
  });

  describe('Urgent Priority Timed Events', () => {
    it('should schedule 15:00 prev + 10:00 same for 15:00 deadline (Scenario 4)', () => {
      // Urgent: 24h before = 15:00 prev day, 5h before = 10:00 same day
      const deadline = createLondonDate(2025, 11, 15, 15, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'urgent'
      });

      expect(schedule.reminderTimes.length).toBe(2);
      
      // First reminder: 24h before at 15:00 previous day
      const reminder1 = schedule.reminderTimes[0];
      expect(reminder1.hour).toBe(15);
      expect(reminder1.minute).toBe(0);
      expect(reminder1.day).toBe(14); // Previous day
      
      // Second reminder: 5h before at 10:00 same day
      const reminder2 = schedule.reminderTimes[1];
      expect(reminder2.hour).toBe(10);
      expect(reminder2.minute).toBe(0);
      expect(reminder2.day).toBe(15);
    });

    it('should schedule 8am prev + 11am prev for 07:00 deadline (Scenario 5)', () => {
      // Urgent early deadline: 24h clamped to 8am prev, 5h uses 11am fallback
      const deadline = createLondonDate(2025, 11, 15, 7, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'urgent'
      });

      expect(schedule.reminderTimes.length).toBe(2);
      
      // First reminder: 24h before clamped to 8am previous day
      const reminder1 = schedule.reminderTimes[0];
      expect(reminder1.hour).toBe(8);
      expect(reminder1.minute).toBe(0);
      expect(reminder1.day).toBe(14); // Previous day
      
      // Second reminder: 5h before with smart fallback to 11am previous day
      const reminder2 = schedule.reminderTimes[1];
      expect(reminder2.hour).toBe(11);
      expect(reminder2.minute).toBe(0);
      expect(reminder2.day).toBe(14); // Previous day (distinct from 8am!)
    });

    it('should use deadline-soon priority same as urgent', () => {
      // deadline-soon should behave identically to urgent
      const deadline = createLondonDate(2025, 11, 15, 15, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'deadline-soon'
      });

      expect(schedule.reminderTimes.length).toBe(2);
      expect(schedule.reminderTimes[0].hour).toBe(15);
      expect(schedule.reminderTimes[1].hour).toBe(10);
    });
  });

  describe('All-Day Events', () => {
    it('should schedule 8am same day for normal all-day (Scenario 6)', () => {
      const deadline = createLondonDate(2025, 11, 15);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: true,
        priority: 'normal'
      });

      expect(schedule.reminderTimes.length).toBe(1);
      
      const reminder = schedule.reminderTimes[0];
      expect(reminder.hour).toBe(8);
      expect(reminder.minute).toBe(0);
      expect(reminder.day).toBe(15); // Same day
      
      // Should be 540 minutes before effective 5pm deadline
      expect(schedule.minutesBefore[0]).toBe(540);
    });

    it('should schedule 8am 2-days + 8am same for urgent all-day (Scenario 7)', () => {
      const deadline = createLondonDate(2025, 11, 15);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: true,
        priority: 'urgent'
      });

      expect(schedule.reminderTimes.length).toBe(2);
      
      // First reminder: 8am two days before
      const reminder1 = schedule.reminderTimes[0];
      expect(reminder1.hour).toBe(8);
      expect(reminder1.minute).toBe(0);
      expect(reminder1.day).toBe(13); // 2 days before
      
      // Second reminder: 8am same day
      const reminder2 = schedule.reminderTimes[1];
      expect(reminder2.hour).toBe(8);
      expect(reminder2.minute).toBe(0);
      expect(reminder2.day).toBe(15); // Same day
    });
  });

  describe('Deduplication', () => {
    it('should not create duplicate reminder times', () => {
      // Test various scenarios to ensure deduplication works
      const deadline = createLondonDate(2025, 11, 15, 8, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'urgent'
      });

      // Verify all reminder times are unique
      const times = schedule.reminderTimes.map(t => t.toMillis());
      const uniqueTimes = new Set(times);
      expect(times.length).toBe(uniqueTimes.size);
    });
  });

  describe('DST Transitions', () => {
    it('should handle GMT to BST transition (spring forward)', () => {
      // Last Sunday of March 2025: clocks move forward 1 hour at 1am
      // Test deadline on March 30, 2025 at 15:00 (in BST)
      const deadline = createLondonDate(2025, 3, 30, 15, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'urgent'
      });

      expect(schedule.reminderTimes.length).toBe(2);
      
      // 24h reminder: Luxon correctly handles DST - subtracts 24 wall-clock hours
      const reminder1 = schedule.reminderTimes[0];
      expect(reminder1.day).toBe(29);
      expect(reminder1.hour).toBe(14); // DST-aware: 15:00 BST - 24h = 14:00 GMT
      
      // 5h reminder should be on March 30 at 10:00 (in BST)
      const reminder2 = schedule.reminderTimes[1];
      expect(reminder2.day).toBe(30);
      expect(reminder2.hour).toBe(10);
    });

    it('should handle BST to GMT transition (fall back)', () => {
      // Last Sunday of October 2025: clocks move back 1 hour at 2am
      // Test deadline on October 26, 2025 at 15:00 (in GMT after fallback)
      const deadline = createLondonDate(2025, 10, 26, 15, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'urgent'
      });

      expect(schedule.reminderTimes.length).toBe(2);
      
      // 24h reminder: Luxon correctly handles DST - subtracts 24 wall-clock hours
      const reminder1 = schedule.reminderTimes[0];
      expect(reminder1.day).toBe(25);
      expect(reminder1.hour).toBe(16); // DST-aware: 15:00 GMT - 24h = 16:00 BST (previous day)
      
      const reminder2 = schedule.reminderTimes[1];
      expect(reminder2.day).toBe(26);
      expect(reminder2.hour).toBe(10);
    });
  });

  describe('Outlook Single Reminder Selection', () => {
    it('should select closest reminder to deadline for Outlook', () => {
      const deadline = createLondonDate(2025, 11, 15, 15, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'urgent'
      });

      const outlookReminder = selectOutlookReminder(schedule);
      
      // Should select the 5h reminder (closer to deadline than 24h)
      expect(outlookReminder).not.toBeNull();
      expect(outlookReminder!.minutes).toBe(300); // 5 hours = 300 minutes
    });

    it('should handle all-day events for Outlook', () => {
      const deadline = createLondonDate(2025, 11, 15);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: true,
        priority: 'urgent'
      });

      const outlookReminder = selectOutlookReminder(schedule);
      
      // Should select 8am same day (closer than 8am 2-days-before)
      expect(outlookReminder).not.toBeNull();
      expect(outlookReminder!.minutes).toBe(540); // 9 hours before 5pm
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight deadlines correctly', () => {
      const deadline = createLondonDate(2025, 11, 15, 0, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'normal'
      });

      // Midnight - 5h = 19:00 previous day (after 8am floor, so kept as-is)
      expect(schedule.reminderTimes.length).toBe(1);
      const reminder = schedule.reminderTimes[0];
      expect(reminder.day).toBe(14); // Previous day
      expect(reminder.hour).toBe(19); // 19:00 is after 8am, so it's valid
    });

    it('should handle exactly 8am deadline', () => {
      const deadline = createLondonDate(2025, 11, 15, 8, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'normal'
      });

      // 8am deadline - 5h = 3am same day → clamped to 8am same day
      expect(schedule.reminderTimes.length).toBe(1);
      const reminder = schedule.reminderTimes[0];
      expect(reminder.day).toBe(15); // Same day
      expect(reminder.hour).toBe(8);
    });

    it('should handle late evening deadlines', () => {
      const deadline = createLondonDate(2025, 11, 15, 23, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'urgent'
      });

      expect(schedule.reminderTimes.length).toBe(2);
      
      // 24h before = 23:00 previous day
      expect(schedule.reminderTimes[0].hour).toBe(23);
      expect(schedule.reminderTimes[0].day).toBe(14);
      
      // 5h before = 18:00 same day
      expect(schedule.reminderTimes[1].hour).toBe(18);
      expect(schedule.reminderTimes[1].day).toBe(15);
    });
  });

  describe('Provenance Tracking', () => {
    it('should provide human-readable provenance for debugging', () => {
      const deadline = createLondonDate(2025, 11, 15, 15, 0);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: false,
        priority: 'urgent'
      });

      expect(schedule.provenance.length).toBe(2);
      expect(schedule.provenance[0]).toContain('24h before');
      expect(schedule.provenance[1]).toContain('5h before');
    });

    it('should provide provenance for all-day events', () => {
      const deadline = createLondonDate(2025, 11, 15);
      const schedule = computeReminderSchedule({
        deadline,
        isAllDay: true,
        priority: 'urgent'
      });

      expect(schedule.provenance.length).toBe(2);
      expect(schedule.provenance[0]).toBe('08:00 2 days before');
      expect(schedule.provenance[1]).toBe('08:00 same day');
    });
  });
});
