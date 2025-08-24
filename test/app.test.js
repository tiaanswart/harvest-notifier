/**
 * @fileoverview Tests for unified Harvest Notifier application
 *
 * Tests the unified application that handles daily, weekly, and monthly notifications
 * including date logic, user analysis, and Slack notifications.
 *
 * @author tiaan.swart@sleeq.global
 * @version 2.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
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

describe('Unified Harvest Notifier Application', () => {
  const mockHarvestUsers = [
    {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      is_active: true,
    },
    {
      id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      is_active: true,
    },
    {
      id: 3,
      first_name: 'Bob',
      last_name: 'Wilson',
      email: 'bob@example.com',
      is_active: true,
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

  afterAll(() => {
    mockExit.mockRestore();
  });

  describe('determineNotificationsToRun', () => {
    test('should return daily notification on Monday', () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      const result = appModule.determineNotificationsToRun();
      expect(result).toEqual(['daily']);

      Date.now = originalNow;
    });

    test('should return daily and weekly notifications on Friday', () => {
      // Mock Friday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-19').getTime(); // Friday

      const result = appModule.determineNotificationsToRun();
      expect(result).toEqual(['daily', 'weekly']);

      Date.now = originalNow;
    });

    test('should return daily, weekly, and monthly notifications on last day of month (Wednesday)', () => {
      // Mock last day of month that's also Wednesday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-31').getTime(); // Last day of January 2024 (Wednesday)

      const result = appModule.determineNotificationsToRun();
      expect(result).toContain('daily');
      expect(result).toContain('monthly');

      Date.now = originalNow;
    });

    test('should return no notifications on Saturday', () => {
      // Mock Saturday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-20').getTime(); // Saturday

      const result = appModule.determineNotificationsToRun();
      expect(result).toEqual([]);

      Date.now = originalNow;
    });

    test('should return no notifications on Sunday', () => {
      // Mock Sunday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-21').getTime(); // Sunday

      const result = appModule.determineNotificationsToRun();
      expect(result).toEqual([]);

      Date.now = originalNow;
    });
  });

  describe('getDateRangeForNotification', () => {
    test('should return correct date range for daily notification on Tuesday', () => {
      // Mock Tuesday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-16').getTime(); // Tuesday

      const result = appModule.getDateRangeForNotification('daily');
      expect(result).toEqual({ from: '2024-01-15', to: '2024-01-15' }); // Monday

      Date.now = originalNow;
    });

    test('should return correct date range for daily notification on Monday', () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      const result = appModule.getDateRangeForNotification('daily');
      expect(result).toEqual({ from: '2024-01-12', to: '2024-01-12' }); // Friday (3 days back)

      Date.now = originalNow;
    });

    test('should return correct date range for weekly notification', () => {
      // Mock Friday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-19').getTime(); // Friday

      const result = appModule.getDateRangeForNotification('weekly');
      expect(result).toEqual({ from: '2024-01-15', to: '2024-01-19' }); // Monday to Friday

      Date.now = originalNow;
    });

    test('should return correct date range for monthly notification', () => {
      // Mock last day of month
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-31').getTime(); // Last day of month

      const result = appModule.getDateRangeForNotification('monthly');
      expect(result).toEqual({ from: '2024-01-01', to: '2024-01-31' }); // Start to end of month

      Date.now = originalNow;
    });

    test('should throw error for unknown notification type', () => {
      expect(() => appModule.getDateRangeForNotification('unknown')).toThrow('Unknown notification type: unknown');
    });
  });

  describe('analyzeHarvestData', () => {
    test('should analyze daily notification data correctly', async () => {
      const result = await appModule.analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      expect(getHarvestUsers).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        'admin@example.com'
      );
      expect(getHarvestTeamTimeReport).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        '2024-01-15',
        '2024-01-15'
      );

      // Should return users with insufficient hours (below 8)
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1); // John Doe with 5.5 hours
      expect(result[1].id).toBe(2); // Jane Smith with 2.0 hours
    });

    test('should analyze weekly notification data correctly', async () => {
      const result = await appModule.analyzeHarvestData('2024-01-15', '2024-01-19', 'weekly');

      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        '2024-01-15',
        '2024-01-19'
      );

      // Weekly threshold is 5x daily threshold (40 hours)
      // All users have insufficient hours for the week
      expect(result).toHaveLength(3);
    });

    test('should analyze monthly notification data correctly', async () => {
      const result = await appModule.analyzeHarvestData('2024-01-01', '2024-01-31', 'monthly');

      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        '2024-01-01',
        '2024-01-31'
      );

      // Monthly threshold is workdays x daily threshold
      expect(result).toHaveLength(3);
    });

    test('should handle empty harvest users', async () => {
      getHarvestUsers.mockResolvedValue([]);

      const result = await appModule.analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      expect(result).toEqual([]);
    });

    test('should handle null harvest users', async () => {
      getHarvestUsers.mockResolvedValue(null);

      const result = await appModule.analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      expect(result).toEqual([]);
    });

    test('should handle API errors', async () => {
      getHarvestUsers.mockRejectedValue(new Error('API Error'));

      await expect(appModule.analyzeHarvestData('2024-01-15', '2024-01-15', 'daily')).rejects.toThrow('API Error');
    });
  });

  describe('slackNotify', () => {
    test('should send daily notification correctly', async () => {
      const usersToNotify = [
        { ...mockHarvestUsers[0], totalHours: 5.5 },
        { ...mockHarvestUsers[1], totalHours: 2.0 },
      ];

      await appModule.slackNotify(usersToNotify, '2024-01-15', '2024-01-15', 'daily');

      expect(getSlackUsers).toHaveBeenCalledWith('test-slack-token');
      expect(matchUsersWithSlack).toHaveBeenCalledWith(usersToNotify, mockSlackUsers);
      expect(createDailyReminderMessage).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalledWith('#general', mockSlackBlocks, 'test-slack-token');
    });

    test('should send weekly notification correctly', async () => {
      const usersToNotify = [
        { ...mockHarvestUsers[0], totalHours: 5.5 },
        { ...mockHarvestUsers[1], totalHours: 2.0 },
      ];

      await appModule.slackNotify(usersToNotify, '2024-01-15', '2024-01-19', 'weekly');

      expect(getSlackUsers).toHaveBeenCalledWith('test-slack-token');
      expect(matchUsersWithSlack).toHaveBeenCalledWith(usersToNotify, mockSlackUsers);
      expect(createWeeklyReminderMessage).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalledWith('#general', mockSlackBlocks, 'test-slack-token');
    });

    test('should send monthly notification correctly', async () => {
      const usersToNotify = [
        { ...mockHarvestUsers[0], totalHours: 5.5 },
        { ...mockHarvestUsers[1], totalHours: 2.0 },
      ];

      await appModule.slackNotify(usersToNotify, '2024-01-01', '2024-01-31', 'monthly');

      expect(getSlackUsers).toHaveBeenCalledWith('test-slack-token');
      expect(matchUsersWithSlack).toHaveBeenCalledWith(usersToNotify, mockSlackUsers);
      expect(createMonthlyReminderMessage).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalledWith('#general', mockSlackBlocks, 'test-slack-token');
    });

    test('should handle empty users list', async () => {
      await appModule.slackNotify([], '2024-01-15', '2024-01-15', 'daily');

      expect(getSlackUsers).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();
    });

    test('should handle API errors', async () => {
      const usersToNotify = [
        { ...mockHarvestUsers[0], totalHours: 5.5 },
      ];

      getSlackUsers.mockRejectedValue(new Error('Slack API Error'));

      await expect(appModule.slackNotify(usersToNotify, '2024-01-15', '2024-01-15', 'daily')).rejects.toThrow('Slack API Error');
    });
  });

  describe('runNotification', () => {
    test('should run daily notification successfully', async () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await appModule.runNotification('daily');

      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalled();
      expect(getSlackUsers).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalled();

      Date.now = originalNow;
    });

    test('should run weekly notification successfully', async () => {
      // Mock Friday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-19').getTime(); // Friday

      await appModule.runNotification('weekly');

      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalled();
      expect(getSlackUsers).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalled();

      Date.now = originalNow;
    });

    test('should run monthly notification successfully', async () => {
      // Mock last day of month
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-31').getTime(); // Last day of month

      await appModule.runNotification('monthly');

      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalled();
      expect(getSlackUsers).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalled();

      Date.now = originalNow;
    });
  });

  describe('app', () => {
    test('should run daily notification on Monday', async () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await appModule.app(false); // Don't exit for testing

      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalled();
      expect(getSlackUsers).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalled();

      Date.now = originalNow;
    });

    test('should run daily and weekly notifications on Friday', async () => {
      // Mock Friday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-19').getTime(); // Friday

      await appModule.app(false); // Don't exit for testing

      expect(getHarvestUsers).toHaveBeenCalledTimes(2);
      expect(getHarvestTeamTimeReport).toHaveBeenCalledTimes(2);
      expect(getSlackUsers).toHaveBeenCalledTimes(2);
      expect(sendSlackMessage).toHaveBeenCalledTimes(2);

      Date.now = originalNow;
    });

    test('should not run any notifications on weekend', async () => {
      // Mock Saturday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-20').getTime(); // Saturday

      await appModule.app(false); // Don't exit for testing

      expect(getHarvestUsers).not.toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).not.toHaveBeenCalled();
      expect(getSlackUsers).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();

      Date.now = originalNow;
    });

    test('should handle errors gracefully', async () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      getHarvestUsers.mockRejectedValue(new Error('Test error'));

      await expect(appModule.app(false)).rejects.toThrow('Test error');

      Date.now = originalNow;
    });
  });
});
