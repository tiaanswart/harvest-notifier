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
import { 
  analyzeHarvestData, 
  slackNotify, 
  determineNotificationsToRun, 
  getDateRangeForNotification, 
  runNotification, 
  app,
  calculateExpectedWorkingDays,
  calculatePersonalizedThreshold,
  workday_count,
  shouldIncludeInDailyNotifications,
  shouldIncludeInNotifications
} from '../app.js';

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

  afterAll(() => {
    mockExit.mockRestore();
  });

  describe('determineNotificationsToRun', () => {
    test('should return daily notification on Monday', () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      const result = determineNotificationsToRun();
      expect(result).toEqual(['daily']);

      Date.now = originalNow;
    });

    test('should return daily and weekly notifications on Friday', () => {
      // Mock Friday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-19').getTime(); // Friday

      const result = determineNotificationsToRun();
      expect(result).toEqual(['daily', 'weekly']);

      Date.now = originalNow;
    });

    test('should return daily, weekly, and monthly notifications on last day of month (Wednesday)', () => {
      // Mock last day of month that's also Wednesday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-31').getTime(); // Last day of January 2024 (Wednesday)

      const result = determineNotificationsToRun();
      expect(result).toContain('daily');
      expect(result).toContain('monthly');

      Date.now = originalNow;
    });

    test('should return no notifications on Saturday', () => {
      // Mock Saturday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-20').getTime(); // Saturday

      const result = determineNotificationsToRun();
      expect(result).toEqual([]);

      Date.now = originalNow;
    });

    test('should return no notifications on Sunday', () => {
      // Mock Sunday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-21').getTime(); // Sunday

      const result = determineNotificationsToRun();
      expect(result).toEqual([]);

      Date.now = originalNow;
    });
  });

  describe('getDateRangeForNotification', () => {
    test('should return correct date range for daily notification on Tuesday', () => {
      // Mock Tuesday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-16').getTime(); // Tuesday

      const result = getDateRangeForNotification('daily');
      expect(result).toEqual({ from: '2024-01-15', to: '2024-01-15' }); // Monday

      Date.now = originalNow;
    });

    test('should return correct date range for daily notification on Monday', () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      const result = getDateRangeForNotification('daily');
      expect(result).toEqual({ from: '2024-01-12', to: '2024-01-12' }); // Friday (3 days back)

      Date.now = originalNow;
    });

    test('should return correct date range for weekly notification', () => {
      // Mock Friday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-19').getTime(); // Friday

      const result = getDateRangeForNotification('weekly');
      expect(result).toEqual({ from: '2024-01-15', to: '2024-01-19' }); // Monday to Friday

      Date.now = originalNow;
    });

    test('should return correct date range for monthly notification', () => {
      // Mock last day of month
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-31').getTime(); // Last day of month

      const result = getDateRangeForNotification('monthly');
      expect(result).toEqual({ from: '2024-01-01', to: '2024-01-31' }); // Start to end of month

      Date.now = originalNow;
    });

    test('should throw error for unknown notification type', () => {
      expect(() => getDateRangeForNotification('unknown')).toThrow('Unknown notification type: unknown');
    });
  });

  describe('analyzeHarvestData', () => {
    test('should analyze daily notification data correctly', async () => {
      const result = await analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

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
      // Mock API responses
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);

      const result = await analyzeHarvestData('2024-01-15', '2024-01-19', 'weekly');

      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        '2024-01-15',
        '2024-01-19'
      );

      // With personalized thresholds:
      // John: 40h/week (5 days) -> 37.5h threshold, has 5.5h -> should be notified
      // Jane: 24h/week (3 days) -> 22.5h threshold, has 2.0h -> should be notified  
      // Bob: 40h/week (5 days) -> 37.5h threshold, has 8.5h -> should be notified
      expect(result).toHaveLength(3);
    });

    test('should analyze monthly notification data correctly', async () => {
      // Mock API responses
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);

      const result = await analyzeHarvestData('2024-01-01', '2024-01-31', 'monthly');

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

      const result = await analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      expect(result).toEqual([]);
    });

    test('should handle null harvest users', async () => {
      getHarvestUsers.mockResolvedValue(null);

      const result = await analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      expect(result).toEqual([]);
    });

    test('should handle API errors', async () => {
      getHarvestUsers.mockRejectedValue(new Error('API Error'));

      await expect(analyzeHarvestData('2024-01-15', '2024-01-15', 'daily')).rejects.toThrow('API Error');
    });
  });

  describe('slackNotify', () => {
    test('should send daily notification correctly', async () => {
      const usersToNotify = [
        { ...mockHarvestUsers[0], totalHours: 5.5 },
        { ...mockHarvestUsers[1], totalHours: 2.0 },
      ];

      await slackNotify(usersToNotify, '2024-01-15', '2024-01-15', 'daily');

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

      await slackNotify(usersToNotify, '2024-01-15', '2024-01-19', 'weekly');

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

      await slackNotify(usersToNotify, '2024-01-01', '2024-01-31', 'monthly');

      expect(getSlackUsers).toHaveBeenCalledWith('test-slack-token');
      expect(matchUsersWithSlack).toHaveBeenCalledWith(usersToNotify, mockSlackUsers);
      expect(createMonthlyReminderMessage).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalledWith('#general', mockSlackBlocks, 'test-slack-token');
    });

    test('should handle empty users list', async () => {
      await slackNotify([], '2024-01-15', '2024-01-15', 'daily');

      expect(getSlackUsers).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();
    });

    test('should handle API errors', async () => {
      const usersToNotify = [
        { ...mockHarvestUsers[0], totalHours: 5.5 },
      ];

      getSlackUsers.mockRejectedValue(new Error('Slack API Error'));

      await expect(slackNotify(usersToNotify, '2024-01-15', '2024-01-15', 'daily')).rejects.toThrow('Slack API Error');
    });
  });

  describe('runNotification', () => {
    test('should run daily notification successfully', async () => {
      // Mock Monday
      const originalNow = Date.now;
      Date.now = () => new Date('2024-01-15').getTime(); // Monday

      await runNotification('daily');

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

      await runNotification('weekly');

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

      await runNotification('monthly');

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

      await app(false); // Don't exit for testing

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

      await app(false); // Don't exit for testing

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

      await app(false); // Don't exit for testing

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

      await expect(app(false)).rejects.toThrow('Test error');

      Date.now = originalNow;
    });
  });
});

describe('Personalized Threshold Calculations', () => {
  beforeEach(() => {
    process.env.MISSING_HOURS_THRESHOLD = '7.5';
  });

  describe('calculateExpectedWorkingDays', () => {
    test('should calculate 5 working days for 40-hour week', () => {
      const weeklyCapacity = 144000; // 40 hours in seconds
      const result = calculateExpectedWorkingDays(weeklyCapacity);
      expect(result).toBe(5);
    });

    test('should calculate 3 working days for 24-hour week', () => {
      const weeklyCapacity = 86400; // 24 hours in seconds
      const result = calculateExpectedWorkingDays(weeklyCapacity);
      expect(result).toBe(3);
    });

    test('should calculate 2.5 working days for 20-hour week', () => {
      const weeklyCapacity = 72000; // 20 hours in seconds
      const result = calculateExpectedWorkingDays(weeklyCapacity);
      expect(result).toBe(2.5);
    });

    test('should handle custom hours per day', () => {
      const weeklyCapacity = 144000; // 40 hours in seconds
      const result = calculateExpectedWorkingDays(weeklyCapacity, 10); // 10 hours per day
      expect(result).toBe(4);
    });
  });

  describe('calculatePersonalizedThreshold', () => {
    const mockUser = {
      id: 123,
      first_name: 'Test',
      last_name: 'User',
      weekly_capacity: 144000 // 40 hours
    };

    test('should return base hours for daily notification', () => {
      const result = calculatePersonalizedThreshold(mockUser, 'daily', '2024-01-01', '2024-01-01');
      expect(result).toBe(7.5);
    });

    test('should calculate weekly threshold based on working days', () => {
      const result = calculatePersonalizedThreshold(mockUser, 'weekly', '2024-01-01', '2024-01-05');
      expect(result).toBe(37.5); // 7.5 * 5 days
    });

    test('should calculate monthly threshold proportionally', () => {
      // Mock a month with actual workdays for January 2024
      const result = calculatePersonalizedThreshold(mockUser, 'monthly', '2024-01-01', '2024-01-31');
      // January 2024 has 23 workdays, so: 7.5 * (23 * 5/5) = 172.5 hours
      expect(result).toBe(172.5);
    });

    test('should handle part-time users correctly', () => {
      const partTimeUser = {
        ...mockUser,
        weekly_capacity: 86400 // 24 hours (3 days)
      };
      
      const weeklyResult = calculatePersonalizedThreshold(partTimeUser, 'weekly', '2024-01-01', '2024-01-05');
      expect(weeklyResult).toBe(22.5); // 7.5 * 3 days
    });
  });

  describe('shouldIncludeInDailyNotifications', () => {
    const mockUser = {
      id: 123,
      first_name: 'Test',
      last_name: 'User',
      weekly_capacity: 144000 // 40 hours
    };

    test('should include user when weekly capacity is above threshold', () => {
      process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD = '30';
      const result = shouldIncludeInDailyNotifications(mockUser);
      expect(result).toBe(true);
    });

    test('should exclude user when weekly capacity is below threshold', () => {
      process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD = '50';
      const result = shouldIncludeInDailyNotifications(mockUser);
      expect(result).toBe(false);
    });

    test('should include user when weekly capacity equals threshold', () => {
      process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD = '40';
      const result = shouldIncludeInDailyNotifications(mockUser);
      expect(result).toBe(true);
    });

    test('should include all users when threshold is not set (default 0)', () => {
      delete process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD;
      const result = shouldIncludeInDailyNotifications(mockUser);
      expect(result).toBe(true);
    });

    test('should handle part-time users correctly', () => {
      const partTimeUser = {
        ...mockUser,
        weekly_capacity: 86400 // 24 hours
      };
      
      process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD = '30';
      const result = shouldIncludeInDailyNotifications(partTimeUser);
      expect(result).toBe(false);
    });
  });

  describe('shouldIncludeInNotifications', () => {
    const mockUser = {
      id: 123,
      first_name: 'Test',
      last_name: 'User',
      weekly_capacity: 144000 // 40 hours
    };

    test('should include user when weekly capacity is above 0', () => {
      const result = shouldIncludeInNotifications(mockUser);
      expect(result).toBe(true);
    });

    test('should exclude user when weekly capacity is 0', () => {
      const zeroCapacityUser = {
        ...mockUser,
        weekly_capacity: 0
      };
      const result = shouldIncludeInNotifications(zeroCapacityUser);
      expect(result).toBe(false);
    });

    test('should exclude user when weekly capacity is null', () => {
      const nullCapacityUser = {
        ...mockUser,
        weekly_capacity: null
      };
      const result = shouldIncludeInNotifications(nullCapacityUser);
      expect(result).toBe(false);
    });

    test('should exclude user when weekly capacity is undefined', () => {
      const undefinedCapacityUser = {
        ...mockUser,
        weekly_capacity: undefined
      };
      const result = shouldIncludeInNotifications(undefinedCapacityUser);
      expect(result).toBe(false);
    });
  });

  describe('Zero Capacity User Exclusion', () => {
    beforeEach(() => {
      // Reset environment variables to ensure clean test state
      delete process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD;
    });

    const testHarvestUsersWithZeroCapacity = [
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
        weekly_capacity: 0, // 0 hours (inactive user)
      },
      {
        id: 3,
        first_name: 'Bob',
        last_name: 'Wilson',
        email: 'bob@example.com',
        is_active: true,
        weekly_capacity: 86400, // 24 hours (3 days)
      },
    ];

    const testTimeReports = [
      {
        user_id: 1,
        total_hours: 5.5,
        date: '2024-01-15',
      },
      {
        user_id: 2,
        total_hours: 0.0,
        date: '2024-01-15',
      },
      {
        user_id: 3,
        total_hours: 4.0,
        date: '2024-01-15',
      },
    ];

    test('should exclude users with 0 capacity from daily notifications', async () => {
      // Ensure all users are eligible for daily notifications (no threshold)
      delete process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD;
      
      // Mock API responses
      getHarvestUsers.mockResolvedValue(testHarvestUsersWithZeroCapacity);
      getHarvestTeamTimeReport.mockResolvedValue(testTimeReports);

      const result = await analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      // Jane has 0 hours/week so should be excluded from all notifications
      // John and Bob should be included
      expect(result).toHaveLength(2);
      expect(result.find(u => u.id === 1)).toBeDefined(); // John
      expect(result.find(u => u.id === 3)).toBeDefined(); // Bob
      expect(result.find(u => u.id === 2)).toBeUndefined(); // Jane should be excluded
    });

    test('should exclude users with 0 capacity from weekly notifications', async () => {
      // Mock API responses
      getHarvestUsers.mockResolvedValue(testHarvestUsersWithZeroCapacity);
      getHarvestTeamTimeReport.mockResolvedValue(testTimeReports);

      const result = await analyzeHarvestData('2024-01-15', '2024-01-19', 'weekly');

      // Jane has 0 hours/week so should be excluded from all notifications
      // John and Bob should be included
      expect(result).toHaveLength(2);
      expect(result.find(u => u.id === 1)).toBeDefined(); // John
      expect(result.find(u => u.id === 3)).toBeDefined(); // Bob
      expect(result.find(u => u.id === 2)).toBeUndefined(); // Jane should be excluded
    });

    test('should exclude users with 0 capacity from monthly notifications', async () => {
      // Mock API responses
      getHarvestUsers.mockResolvedValue(testHarvestUsersWithZeroCapacity);
      getHarvestTeamTimeReport.mockResolvedValue(testTimeReports);

      const result = await analyzeHarvestData('2024-01-01', '2024-01-31', 'monthly');

      // Jane has 0 hours/week so should be excluded from all notifications
      // John and Bob should be included
      expect(result).toHaveLength(2);
      expect(result.find(u => u.id === 1)).toBeDefined(); // John
      expect(result.find(u => u.id === 3)).toBeDefined(); // Bob
      expect(result.find(u => u.id === 2)).toBeUndefined(); // Jane should be excluded
    });
  });

  describe('Daily Notification Threshold Integration', () => {
    const testHarvestUsers = [
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

    const testTimeReports = [
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
        total_hours: 6.0,
        date: '2024-01-15',
      },
    ];

    test('should exclude users below threshold from daily notifications', async () => {
      // Set threshold to 30 hours
      process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD = '30';
      
      // Mock API responses
      getHarvestUsers.mockResolvedValue(testHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(testTimeReports);

      const result = await analyzeHarvestData('2024-01-15', '2024-01-15', 'daily');

      // Jane has 24 hours/week (below 30 threshold) so should be excluded from daily notifications
      // John and Bob have 40 hours/week (above 30 threshold) so should be included
      expect(result).toHaveLength(2);
      expect(result.find(u => u.id === 1)).toBeDefined(); // John
      expect(result.find(u => u.id === 3)).toBeDefined(); // Bob
      expect(result.find(u => u.id === 2)).toBeUndefined(); // Jane should be excluded
    });

    test('should include all users in weekly notifications regardless of threshold', async () => {
      // Set threshold to 30 hours
      process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD = '30';
      
      // Mock API responses
      getHarvestUsers.mockResolvedValue(testHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(testTimeReports);

      const result = await analyzeHarvestData('2024-01-15', '2024-01-19', 'weekly');

      // All users should be included in weekly notifications regardless of daily threshold
      expect(result).toHaveLength(3);
    });

    test('should include all users in monthly notifications regardless of threshold', async () => {
      // Set threshold to 30 hours
      process.env.DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD = '30';
      
      // Mock API responses
      getHarvestUsers.mockResolvedValue(testHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(testTimeReports);

      const result = await analyzeHarvestData('2024-01-01', '2024-01-31', 'monthly');

      // All users should be included in monthly notifications regardless of daily threshold
      expect(result).toHaveLength(3);
    });
  });
});
