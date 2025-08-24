/**
 * @fileoverview Tests for Slack message templates
 * 
 * Tests the Slack message template functions for daily, weekly, and monthly reminders.
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import moment from 'moment';
import {
  createDailyReminderMessage,
  createWeeklyReminderMessage,
  createMonthlyReminderMessage
} from '../../templates/slack-templates.js';
import Logger from '../../utils/logger.js';

// Mock dependencies
vi.mock('../../utils/logger.js');

describe('Slack Templates', () => {
  const mockUsersToNotify = [
    {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      totalHours: 5,
      slackUser: '<@U123456> (Hours logged: 5)'
    },
    {
      id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      totalHours: 3,
      slackUser: '<@U789012> (Hours logged: 3)'
    }
  ];

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('createDailyReminderMessage', () => {
    test('should create daily reminder message with users', () => {
      const timeSheetDateToCheck = '2024-01-15';
      const result = createDailyReminderMessage(mockUsersToNotify, timeSheetDateToCheck);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(5); // 5 blocks: header, date info, user list, footer, action button

      // Check header block
      expect(result[0]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*Hi there :sleeq: team! Here's a friendly reminder to complete your timesheets in Harvest. Remember to report your working hours every day to help us keep track of our progress.*"
        }
      });

      // Check date info block
      expect(result[1]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "We noticed that the following people haven't reported their working hours for January 15th 2024:"
        }
      });

      // Check user list block
      expect(result[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• <@U123456> (Hours logged: 5)\n• <@U789012> (Hours logged: 3)'
        }
      });

      // Check footer block
      expect(result[3]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please take a moment to report your hours and react with :heavy_check_mark: to confirm that you have completed your timesheet. Thank you for your cooperation!'
        }
      });

      // Check action button block
      expect(result[4]).toEqual({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':clock5: Report Time',
              emoji: true
            },
            value: 'report_time',
            url: 'https://harvestapp.com/time',
            action_id: 'button-action',
            style: 'primary'
          }
        ]
      });

      expect(Logger.functionEntry).toHaveBeenCalledWith('createDailyReminderMessage', {
        usersToNotifyCount: 2,
        timeSheetDateToCheck
      });
    });

    test('should handle empty users array', () => {
      const timeSheetDateToCheck = '2024-01-15';
      const result = createDailyReminderMessage([], timeSheetDateToCheck);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(5);

      // Check user list block with empty list
      expect(result[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• '
        }
      });
    });

    test('should handle single user', () => {
      const singleUser = [mockUsersToNotify[0]];
      const timeSheetDateToCheck = '2024-01-15';
      const result = createDailyReminderMessage(singleUser, timeSheetDateToCheck);

      expect(result[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• <@U123456> (Hours logged: 5)'
        }
      });
    });

    test('should handle different date formats', () => {
      const timeSheetDateToCheck = '2024-12-25';
      const result = createDailyReminderMessage(mockUsersToNotify, timeSheetDateToCheck);

      expect(result[1]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "We noticed that the following people haven't reported their working hours for December 25th 2024:"
        }
      });
    });

    test('should handle users without Slack mentions', () => {
      const usersWithoutSlack = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5,
          slackUser: 'John Doe (Hours logged: 5)'
        }
      ];
      const timeSheetDateToCheck = '2024-01-15';
      const result = createDailyReminderMessage(usersWithoutSlack, timeSheetDateToCheck);

      expect(result[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• John Doe (Hours logged: 5)'
        }
      });
    });

    test('should log function entry and exit', () => {
      const timeSheetDateToCheck = '2024-01-15';
      createDailyReminderMessage(mockUsersToNotify, timeSheetDateToCheck);

      expect(Logger.functionEntry).toHaveBeenCalledWith('createDailyReminderMessage', {
        usersToNotifyCount: 2,
        timeSheetDateToCheck
      });
      expect(Logger.functionExit).toHaveBeenCalledWith('createDailyReminderMessage', {
        blocksCount: 5
      });
    });
  });

  describe('createWeeklyReminderMessage', () => {
    test('should create weekly reminder message with users', () => {
      const timeSheetDateToCheckFrom = '2024-01-08';
      const timeSheetDateToCheckTo = '2024-01-12';
      const result = createWeeklyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(5);

      // Check header block
      expect(result[0]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*Hi there :sleeq: team! Here's a friendly reminder to complete your timesheets in Harvest. Remember to report your working hours every day to help us keep track of our progress.*"
        }
      });

      // Check date info block
      expect(result[1]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "We noticed that the following people haven't reported all their working hours between January 8th 2024 and January 12th 2024:"
        }
      });

      // Check user list block
      expect(result[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• <@U123456> (Hours logged: 5)\n• <@U789012> (Hours logged: 3)'
        }
      });

      // Check footer and action button blocks should be the same as daily
      expect(result[3]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please take a moment to report your hours and react with :heavy_check_mark: to confirm that you have completed your timesheet. Thank you for your cooperation!'
        }
      });

      expect(result[4]).toEqual({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':clock5: Report Time',
              emoji: true
            },
            value: 'report_time',
            url: 'https://harvestapp.com/time',
            action_id: 'button-action',
            style: 'primary'
          }
        ]
      });

      expect(Logger.functionEntry).toHaveBeenCalledWith('createWeeklyReminderMessage', {
        usersToNotifyCount: 2,
        timeSheetDateToCheckFrom,
        timeSheetDateToCheckTo
      });
    });

    test('should handle different date ranges', () => {
      const timeSheetDateToCheckFrom = '2024-12-23';
      const timeSheetDateToCheckTo = '2024-12-29';
      const result = createWeeklyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      expect(result[1]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "We noticed that the following people haven't reported all their working hours between December 23rd 2024 and December 29th 2024:"
        }
      });
    });

    test('should handle empty users array', () => {
      const timeSheetDateToCheckFrom = '2024-01-08';
      const timeSheetDateToCheckTo = '2024-01-12';
      const result = createWeeklyReminderMessage([], timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      expect(result[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• '
        }
      });
    });

    test('should log function entry and exit', () => {
      const timeSheetDateToCheckFrom = '2024-01-08';
      const timeSheetDateToCheckTo = '2024-01-12';
      createWeeklyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      expect(Logger.functionEntry).toHaveBeenCalledWith('createWeeklyReminderMessage', {
        usersToNotifyCount: 2,
        timeSheetDateToCheckFrom,
        timeSheetDateToCheckTo
      });
      expect(Logger.functionExit).toHaveBeenCalledWith('createWeeklyReminderMessage', {
        blocksCount: 5
      });
    });
  });

  describe('createMonthlyReminderMessage', () => {
    test('should create monthly reminder message with users', () => {
      const timeSheetDateToCheckFrom = '2024-01-01';
      const timeSheetDateToCheckTo = '2024-01-31';
      const result = createMonthlyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(5);

      // Check header block
      expect(result[0]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*Hi there :sleeq: team! Here's a friendly reminder to complete your timesheets in Harvest. Remember to report your working hours every day to help us keep track of our progress.*"
        }
      });

      // Check date info block
      expect(result[1]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "We noticed that the following people haven't reported all their working hours between January 1st 2024 and January 31st 2024:"
        }
      });

      // Check user list block
      expect(result[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• <@U123456> (Hours logged: 5)\n• <@U789012> (Hours logged: 3)'
        }
      });

      // Check footer and action button blocks should be the same as daily/weekly
      expect(result[3]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please take a moment to report your hours and react with :heavy_check_mark: to confirm that you have completed your timesheet. Thank you for your cooperation!'
        }
      });

      expect(result[4]).toEqual({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':clock5: Report Time',
              emoji: true
            },
            value: 'report_time',
            url: 'https://harvestapp.com/time',
            action_id: 'button-action',
            style: 'primary'
          }
        ]
      });

      expect(Logger.functionEntry).toHaveBeenCalledWith('createMonthlyReminderMessage', {
        usersToNotifyCount: 2,
        timeSheetDateToCheckFrom,
        timeSheetDateToCheckTo
      });
    });

    test('should handle different month ranges', () => {
      const timeSheetDateToCheckFrom = '2024-12-01';
      const timeSheetDateToCheckTo = '2024-12-31';
      const result = createMonthlyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      expect(result[1]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "We noticed that the following people haven't reported all their working hours between December 1st 2024 and December 31st 2024:"
        }
      });
    });

    test('should handle empty users array', () => {
      const timeSheetDateToCheckFrom = '2024-01-01';
      const timeSheetDateToCheckTo = '2024-01-31';
      const result = createMonthlyReminderMessage([], timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      expect(result[2]).toEqual({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '• '
        }
      });
    });

    test('should log function entry and exit', () => {
      const timeSheetDateToCheckFrom = '2024-01-01';
      const timeSheetDateToCheckTo = '2024-01-31';
      createMonthlyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      expect(Logger.functionEntry).toHaveBeenCalledWith('createMonthlyReminderMessage', {
        usersToNotifyCount: 2,
        timeSheetDateToCheckFrom,
        timeSheetDateToCheckTo
      });
      expect(Logger.functionExit).toHaveBeenCalledWith('createMonthlyReminderMessage', {
        blocksCount: 5
      });
    });
  });

  describe('Template Consistency', () => {
    test('should have consistent structure across all templates', () => {
      const timeSheetDateToCheck = '2024-01-15';
      const timeSheetDateToCheckFrom = '2024-01-08';
      const timeSheetDateToCheckTo = '2024-01-12';

      const dailyResult = createDailyReminderMessage(mockUsersToNotify, timeSheetDateToCheck);
      const weeklyResult = createWeeklyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
      const monthlyResult = createMonthlyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      // All templates should have the same number of blocks
      expect(dailyResult).toHaveLength(5);
      expect(weeklyResult).toHaveLength(5);
      expect(monthlyResult).toHaveLength(5);

      // Header should be identical
      expect(dailyResult[0]).toEqual(weeklyResult[0]);
      expect(dailyResult[0]).toEqual(monthlyResult[0]);

      // User list should be identical
      expect(dailyResult[2]).toEqual(weeklyResult[2]);
      expect(dailyResult[2]).toEqual(monthlyResult[2]);

      // Footer should be identical
      expect(dailyResult[3]).toEqual(weeklyResult[3]);
      expect(dailyResult[3]).toEqual(monthlyResult[3]);

      // Action button should be identical
      expect(dailyResult[4]).toEqual(weeklyResult[4]);
      expect(dailyResult[4]).toEqual(monthlyResult[4]);
    });

    test('should have different date formatting for different template types', () => {
      const timeSheetDateToCheck = '2024-01-15';
      const timeSheetDateToCheckFrom = '2024-01-08';
      const timeSheetDateToCheckTo = '2024-01-12';

      const dailyResult = createDailyReminderMessage(mockUsersToNotify, timeSheetDateToCheck);
      const weeklyResult = createWeeklyReminderMessage(mockUsersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);

      // Daily should mention single date
      expect(dailyResult[1].text.text).toContain("haven't reported their working hours for January 15th 2024");

      // Weekly should mention date range
      expect(weeklyResult[1].text.text).toContain("haven't reported all their working hours between January 8th 2024 and January 12th 2024");
    });
  });

  describe('Edge Cases', () => {
    test('should handle null or undefined users', () => {
      const timeSheetDateToCheck = '2024-01-15';
      
      // These should not throw but handle gracefully
      expect(() => createDailyReminderMessage(null, timeSheetDateToCheck)).not.toThrow();
      expect(() => createDailyReminderMessage(undefined, timeSheetDateToCheck)).not.toThrow();
    });

    test('should handle null or undefined dates', () => {
      // These should not throw but handle gracefully
      expect(() => createDailyReminderMessage(mockUsersToNotify, null)).not.toThrow();
      expect(() => createDailyReminderMessage(mockUsersToNotify, undefined)).not.toThrow();
    });

    test('should handle invalid date formats', () => {
      // This should not throw but handle gracefully
      expect(() => createDailyReminderMessage(mockUsersToNotify, 'invalid-date')).not.toThrow();
    });

    test('should handle users with missing properties', () => {
      const incompleteUser = [
        {
          id: 1,
          first_name: 'John',
          // Missing last_name, email, totalHours, slackUser
        }
      ];
      const timeSheetDateToCheck = '2024-01-15';

      // This should not throw but handle gracefully
      expect(() => createDailyReminderMessage(incompleteUser, timeSheetDateToCheck)).not.toThrow();
    });
  });
});
