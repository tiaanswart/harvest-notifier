/**
 * @fileoverview Integration tests for unified Harvest Notifier
 *
 * Tests the complete workflow from Harvest data analysis to Slack notifications
 * using the unified app.js application.
 *
 * @author tiaan.swart@sleeq.global
 * @version 2.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { getHarvestUsers, getHarvestTeamTimeReport } from '../utils/harvest-api.js';
import { getSlackUsers, sendSlackMessage, matchUsersWithSlack } from '../utils/slack-api.js';
import { createDailyReminderMessage, createWeeklyReminderMessage, createMonthlyReminderMessage } from '../templates/slack-templates.js';
import Logger from '../utils/logger.js';
import * as appModule from '../app.js';

// Mock dependencies
vi.mock('../utils/harvest-api.js');
vi.mock('../utils/slack-api.js');
vi.mock('../templates/slack-templates.js');
vi.mock('../utils/logger.js');

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

describe('Integration Tests - Unified App', () => {
  const mockHarvestUsers = [
    {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      is_active: true,
      weekly_capacity: 144000, // 40 hours (5 days)
    },
    {
      id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      is_active: true,
      weekly_capacity: 86400, // 24 hours (3 days)
    },
    {
      id: 3,
      first_name: 'Bob',
      last_name: 'Wilson',
      email: 'bob@example.com',
      is_active: true,
      weekly_capacity: 144000, // 40 hours (5 days)
    },
  ];

  const mockTimeReports = [
    {
      user_id: 1,
      total_hours: 5.5,
      date: '2024-01-15',
    },
    {
      user_id: 2,
      total_hours: 2.0,
      date: '2024-01-15',
    },
    {
      user_id: 3,
      total_hours: 8.5,
      date: '2024-01-15',
    },
  ];

  const mockSlackUsers = [
    {
      id: 'U123456',
      profile: {
        real_name_normalized: 'John Doe',
        display_name_normalized: 'John',
        email: 'john@example.com',
      },
    },
    {
      id: 'U789012',
      profile: {
        real_name_normalized: 'Jane Smith',
        display_name_normalized: 'Jane',
        email: 'jane@example.com',
      },
    },
    {
      id: 'U345678',
      profile: {
        real_name_normalized: 'Bob Wilson',
        display_name_normalized: 'Bob',
        email: 'bob@example.com',
      },
    },
  ];

  const mockSlackBlocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Test message',
      },
    },
  ];

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Reset environment variables
    process.env.HARVEST_ACCOUNT_ID = 'test-account-id';
    process.env.HARVEST_TOKEN = 'test-harvest-token';
    process.env.SLACK_TOKEN = 'test-slack-token';
    process.env.SLACK_CHANNEL = '#general';
    process.env.MISSING_HOURS_THRESHOLD = '8';
    process.env.EMAILS_WHITELIST = 'admin@example.com';

    // Setup default mocks
    getHarvestUsers.mockResolvedValue(mockHarvestUsers);
    getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
    getSlackUsers.mockResolvedValue(mockSlackUsers);
    sendSlackMessage.mockResolvedValue({ ok: true });
    matchUsersWithSlack.mockReturnValue([
      { ...mockHarvestUsers[0], slackUser: '<@U123456> (Hours logged: 5.5)' },
      { ...mockHarvestUsers[1], slackUser: 'Jane Smith (Hours logged: 2.0)' },
    ]);
    createDailyReminderMessage.mockReturnValue(mockSlackBlocks);
    createWeeklyReminderMessage.mockReturnValue(mockSlackBlocks);
    createMonthlyReminderMessage.mockReturnValue(mockSlackBlocks);

    // No spies - let the real functions run
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Daily Workflow', () => {
    test('should complete full daily notification workflow', async () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await appModule.app(false); // Don't exit for testing

      // Verify Harvest API calls
      expect(getHarvestUsers).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        'admin@example.com'
      );
      expect(getHarvestTeamTimeReport).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        '2024-01-12', // Friday (3 days back from Monday)
        '2024-01-12'
      );

      // Verify Slack API calls
      expect(getSlackUsers).toHaveBeenCalledWith('test-slack-token');
      expect(matchUsersWithSlack).toHaveBeenCalled();
      expect(createDailyReminderMessage).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalledWith('#general', mockSlackBlocks, 'test-slack-token');

      // Verify logging
      expect(Logger.appStart).toHaveBeenCalledWith('unified', expect.any(Object));
      expect(Logger.appEnd).toHaveBeenCalledWith('unified', expect.any(String));

      Date.now = originalNow;
    });

    test('should handle users with sufficient hours', async () => {
      // Mock users with sufficient hours
      const usersWithSufficientHours = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          is_active: true,
        },
      ];

      const timeReportsWithSufficientHours = [
        {
          user_id: 1,
          total_hours: 8.5,
          date: '2024-01-15',
        },
      ];

      getHarvestUsers.mockResolvedValue(usersWithSufficientHours);
      getHarvestTeamTimeReport.mockResolvedValue(timeReportsWithSufficientHours);

      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await appModule.app(false); // Don't exit for testing

      // Should still call Harvest APIs but not Slack APIs since no users need notification
      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalled();
      expect(getSlackUsers).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();

      Date.now = originalNow;
    });
  });

  describe('Complete Weekly Workflow', () => {
    test('should complete full weekly notification workflow', async () => {
      // Mock Friday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-19').getTime(); // Friday

      await appModule.app(false); // Don't exit for testing

      // Should run both daily and weekly notifications
      expect(getHarvestUsers).toHaveBeenCalledTimes(2);
      expect(getHarvestTeamTimeReport).toHaveBeenCalledTimes(2);
      expect(getSlackUsers).toHaveBeenCalledTimes(2);
      expect(sendSlackMessage).toHaveBeenCalledTimes(2);

      // Verify weekly-specific calls
      expect(getHarvestTeamTimeReport).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        '2024-01-15', // Monday
        '2024-01-19'  // Friday
      );

      expect(createWeeklyReminderMessage).toHaveBeenCalled();

      Date.now = originalNow;
    });
  });

  describe('Complete Monthly Workflow', () => {
    test('should complete full monthly notification workflow', async () => {
      // Mock last day of month
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-31').getTime(); // Last day of month

      await appModule.app(false); // Don't exit for testing

      // Should run daily and monthly notifications (Wednesday is not Friday, so no weekly)
      expect(getHarvestUsers).toHaveBeenCalledTimes(2);
      expect(getHarvestTeamTimeReport).toHaveBeenCalledTimes(2);
      expect(getSlackUsers).toHaveBeenCalledTimes(2);
      expect(sendSlackMessage).toHaveBeenCalledTimes(2);

      // Verify monthly-specific calls
      expect(getHarvestTeamTimeReport).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        '2024-01-01', // Start of month
        '2024-01-31'  // End of month
      );

      expect(createMonthlyReminderMessage).toHaveBeenCalled();

      Date.now = originalNow;
    });
  });

  describe('Weekend Handling', () => {
    test('should not run any notifications on Saturday', async () => {
      // Mock Saturday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-20').getTime(); // Saturday

      await appModule.app(false); // Don't exit for testing

      // Should not call any APIs
      expect(getHarvestUsers).not.toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).not.toHaveBeenCalled();
      expect(getSlackUsers).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();

      Date.now = originalNow;
    });

    test('should not run any notifications on Sunday', async () => {
      // Mock Sunday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-21').getTime(); // Sunday

      await appModule.app(false); // Don't exit for testing

      // Should not call any APIs
      expect(getHarvestUsers).not.toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).not.toHaveBeenCalled();
      expect(getSlackUsers).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();

      Date.now = originalNow;
    });
  });

  describe('Error Handling', () => {
    test('should handle Harvest API errors gracefully', async () => {
      getHarvestUsers.mockRejectedValue(new Error('Harvest API Error'));

      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await expect(appModule.app(false)).rejects.toThrow('Harvest API Error');

      Date.now = originalNow;
    });

    test('should handle Slack API errors gracefully', async () => {
      getSlackUsers.mockRejectedValue(new Error('Slack API Error'));

      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await expect(appModule.app(false)).rejects.toThrow('Slack API Error');

      Date.now = originalNow;
    });

    test('should handle template creation errors gracefully', async () => {
      createDailyReminderMessage.mockImplementation(() => {
        throw new Error('Template Error');
      });

      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await expect(appModule.app(false)).rejects.toThrow('Template Error');

      Date.now = originalNow;
    });
  });

  describe('Environment Variables', () => {
    test('should use environment variables for configuration', async () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await appModule.app(false); // Don't exit for testing

      expect(getHarvestUsers).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        'admin@example.com'
      );

      Date.now = originalNow;
    });

    test('should handle missing environment variables', async () => {
      // Clear environment variables
      delete process.env.HARVEST_ACCOUNT_ID;
      delete process.env.HARVEST_TOKEN;
      delete process.env.SLACK_TOKEN;
      delete process.env.EMAILS_WHITELIST;

      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await appModule.app(false); // Don't exit for testing

      // Should still call functions but with undefined values
      expect(getHarvestUsers).toHaveBeenCalledWith(undefined, undefined, undefined);

      Date.now = originalNow;
    });
  });

  describe('Logging', () => {
    test('should log application start and end', async () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await appModule.app(false); // Don't exit for testing

      expect(Logger.appStart).toHaveBeenCalledWith('unified', {
        currentDate: expect.any(String),
        weekday: expect.any(String),
        isLastDayOfMonth: expect.any(Boolean),
      });

      expect(Logger.appEnd).toHaveBeenCalledWith('unified', expect.any(String));

      Date.now = originalNow;
    });

    test('should log function entries and exits', async () => {
      await appModule.analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      expect(Logger.functionEntry).toHaveBeenCalledWith('analyzeHarvestData', expect.any(Object));
      expect(Logger.functionExit).toHaveBeenCalledWith('analyzeHarvestData', expect.any(Object));
    });

    test('should log user analysis results', async () => {
      await appModule.analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      expect(Logger.userAnalysis).toHaveBeenCalledWith(
        'daily',
        expect.any(Number),
        expect.any(Number),
        expect.any(Array)
      );
    });

    test('should log notification sending', async () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5.5,
        },
      ];

      await appModule.slackNotify(usersToNotify, '2024-01-15', '2024-01-15', 'daily');

      expect(Logger.notificationSent).toHaveBeenCalledWith('daily', expect.any(Number), '#general');
    });
  });
});
