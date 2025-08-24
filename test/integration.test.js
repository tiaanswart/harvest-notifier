/**
 * @fileoverview Integration tests for Harvest Notifier
 * 
 * Tests the complete workflow from Harvest data analysis to Slack notifications.
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { getHarvestUsers, getHarvestTeamTimeReport } from '../utils/harvest-api.js';
import { getSlackUsers, sendSlackMessage, matchUsersWithSlack } from '../utils/slack-api.js';
import { createDailyReminderMessage } from '../templates/slack-templates.js';
import Logger from '../utils/logger.js';
import { analyzeHarvestData, slackNotify, app } from '../daily.js';

// Mock dependencies
vi.mock('../utils/harvest-api.js');
vi.mock('../utils/slack-api.js');
vi.mock('../templates/slack-templates.js');
vi.mock('../utils/logger.js');

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

describe('Integration Tests', () => {
  const mockHarvestUsers = [
    {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      is_active: true
    },
    {
      id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      is_active: true
    },
    {
      id: 3,
      first_name: 'Bob',
      last_name: 'Wilson',
      email: 'bob@example.com',
      is_active: true
    }
  ];

  const mockTimeReports = [
    {
      user_id: 1,
      total_hours: 5.5,
      date: '2024-01-15'
    },
    {
      user_id: 2,
      total_hours: 2.0,
      date: '2024-01-15'
    },
    {
      user_id: 3,
      total_hours: 8.5,
      date: '2024-01-15'
    }
  ];

  const mockSlackUsers = [
    {
      id: 'U123456',
      profile: {
        real_name_normalized: 'John Doe',
        display_name_normalized: 'John',
        email: 'john@example.com'
      }
    },
    {
      id: 'U789012',
      profile: {
        real_name_normalized: 'Jane Smith',
        display_name_normalized: 'Jane',
        email: 'jane@example.com'
      }
    },
    {
      id: 'U345678',
      profile: {
        real_name_normalized: 'Bob Wilson',
        display_name_normalized: 'Bob',
        email: 'bob@example.com'
      }
    }
  ];

  const mockSlackBlocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Test message'
      }
    }
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Daily Workflow', () => {
    test('should complete full daily notification workflow successfully', async () => {
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockResolvedValue(mockSlackUsers);
      matchUsersWithSlack.mockReturnValue([
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5.5,
          slackUser: '<@U123456>'
        },
        {
          id: 2,
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          totalHours: 2.0,
          slackUser: '<@U789012>'
        }
      ]);
      createDailyReminderMessage.mockReturnValue(mockSlackBlocks);
      sendSlackMessage.mockResolvedValue({ ok: true });

      await app(false);

      // Verify that all functions were called
      expect(getHarvestUsers).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        'admin@example.com'
      );
      expect(getHarvestTeamTimeReport).toHaveBeenCalledWith(
        'test-account-id',
        'test-harvest-token',
        expect.any(String), // Allow any date
        expect.any(String)
      );
      expect(getSlackUsers).toHaveBeenCalledWith('test-slack-token');
      expect(matchUsersWithSlack).toHaveBeenCalled();
      expect(createDailyReminderMessage).toHaveBeenCalled();
      expect(sendSlackMessage).toHaveBeenCalledWith('#general', mockSlackBlocks, 'test-slack-token');

      // Verify logging
      expect(Logger.appStart).toHaveBeenCalledWith('daily', expect.any(Object));
      expect(Logger.appEnd).toHaveBeenCalledWith('daily', 'Daily notification completed');
    });

    test('should handle workflow with no users needing notification', async () => {
      const usersWithSufficientHours = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          is_active: true
        }
      ];

      const timeReportsWithSufficientHours = [
        {
          user_id: 1,
          total_hours: 8.5, // Sufficient hours
          date: '2024-01-15'
        }
      ];

      getHarvestUsers.mockResolvedValue(usersWithSufficientHours);
      getHarvestTeamTimeReport.mockResolvedValue(timeReportsWithSufficientHours);

      const usersToNotify = await analyzeHarvestData('2024-01-15');

      // Verify that no Slack functions were called
      expect(getSlackUsers).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();

      // Verify the result
      expect(usersToNotify).toHaveLength(0); // No users to notify

      // Verify logging
      expect(Logger.userAnalysis).toHaveBeenCalledWith('daily', 1, 0, []);
    });

    test('should handle workflow with API errors gracefully', async () => {
      // Mock Harvest API error
      getHarvestUsers.mockRejectedValue(new Error('Harvest API Error'));

      // Test error handling
      await expect(analyzeHarvestData('2024-01-15')).rejects.toThrow('Harvest API Error');

      // Verify that Slack API was not called
      expect(getSlackUsers).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();
    });

    test('should handle workflow with Slack API errors gracefully', async () => {
      // Mock successful Harvest API calls but Slack API error
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockRejectedValue(new Error('Slack API Error'));

      // Test Slack API error handling
      const usersToNotify = await analyzeHarvestData('2024-01-15');
      await expect(slackNotify(usersToNotify, '2024-01-15')).rejects.toThrow('Slack API Error');

      // Verify that Harvest API was called
      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalled();
    });
  });

  describe('User Analysis Integration', () => {
    test('should correctly identify users with insufficient hours', async () => {
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);

      const usersToNotify = await analyzeHarvestData('2024-01-15');

      // Verify that users with less than 8 hours were identified
      expect(Logger.userAnalysis).toHaveBeenCalledWith(
        'daily',
        3, // total users
        2, // users to notify (John with 5.5 hours, Jane with 2.0 hours)
        expect.arrayContaining([
          expect.objectContaining({ id: 1, totalHours: 5.5 }),
          expect.objectContaining({ id: 2, totalHours: 2.0 })
        ])
      );

      expect(usersToNotify).toHaveLength(2);
      expect(usersToNotify).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 1, totalHours: 5.5 }),
        expect.objectContaining({ id: 2, totalHours: 2.0 })
      ]));
    });

    test('should handle users with multiple time entries', async () => {
      const usersWithMultipleEntries = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          is_active: true
        }
      ];

      const multipleTimeReports = [
        {
          user_id: 1,
          total_hours: 4.0,
          date: '2024-01-15'
        },
        {
          user_id: 1,
          total_hours: 3.5,
          date: '2024-01-15'
        }
      ];

      getHarvestUsers.mockResolvedValue(usersWithMultipleEntries);
      getHarvestTeamTimeReport.mockResolvedValue(multipleTimeReports);

      const usersToNotify = await analyzeHarvestData('2024-01-15');

      // Verify that hours were summed correctly (4.0 + 3.5 = 7.5)
      expect(Logger.userAnalysis).toHaveBeenCalledWith(
        'daily',
        1,
        1, // user should be notified since 7.5 < 8
        expect.arrayContaining([
          expect.objectContaining({ id: 1, totalHours: 7.5 })
        ])
      );

      expect(usersToNotify).toHaveLength(1);
      expect(usersToNotify[0]).toMatchObject({ id: 1, totalHours: 7.5 });
    });

    test('should handle users with no time entries', async () => {
      const usersWithNoEntries = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          is_active: true
        }
      ];

      const emptyTimeReports = [];

      getHarvestUsers.mockResolvedValue(usersWithNoEntries);
      getHarvestTeamTimeReport.mockResolvedValue(emptyTimeReports);

      const usersToNotify = await analyzeHarvestData('2024-01-15');

      // Verify that user with no entries was identified (0 hours < 8)
      expect(Logger.userAnalysis).toHaveBeenCalledWith(
        'daily',
        1,
        1, // user should be notified since 0 < 8
        expect.arrayContaining([
          expect.objectContaining({ id: 1, totalHours: 0 })
        ])
      );

      expect(usersToNotify).toHaveLength(1);
      expect(usersToNotify[0]).toMatchObject({ id: 1, totalHours: 0 });
    });
  });

  describe('Slack Integration', () => {
    test('should correctly match Harvest users with Slack users', async () => {
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockResolvedValue(mockSlackUsers);
      matchUsersWithSlack.mockReturnValue([
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5.5,
          slackUser: '<@U123456>'
        }
      ]);
      createDailyReminderMessage.mockReturnValue(mockSlackBlocks);
      sendSlackMessage.mockResolvedValue({ ok: true });

      const usersToNotify = await analyzeHarvestData('2024-01-15');
      await slackNotify(usersToNotify, '2024-01-15');

      // Verify that matchUsersWithSlack was called with correct parameters
      expect(matchUsersWithSlack).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, totalHours: 5.5 }),
          expect.objectContaining({ id: 2, totalHours: 2.0 })
        ]),
        mockSlackUsers
      );
    });

    test('should handle users not found in Slack', async () => {
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockResolvedValue(mockSlackUsers);
      matchUsersWithSlack.mockReturnValue([
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5.5,
          slackUser: 'John Doe (john@example.com)' // Fallback format
        }
      ]);
      createDailyReminderMessage.mockReturnValue(mockSlackBlocks);
      sendSlackMessage.mockResolvedValue({ ok: true });

      const usersToNotify = await analyzeHarvestData('2024-01-15');
      await slackNotify(usersToNotify, '2024-01-15');

      // Verify that matchUsersWithSlack was called
      expect(matchUsersWithSlack).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, totalHours: 5.5 }),
          expect.objectContaining({ id: 2, totalHours: 2.0 })
        ]),
        mockSlackUsers
      );
    });

    test('should send correct Slack message format', async () => {
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockResolvedValue(mockSlackUsers);
      matchUsersWithSlack.mockReturnValue([
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5.5,
          slackUser: '<@U123456>'
        }
      ]);
      createDailyReminderMessage.mockReturnValue(mockSlackBlocks);
      sendSlackMessage.mockResolvedValue({ ok: true });

      const usersToNotify = await analyzeHarvestData('2024-01-15');
      await slackNotify(usersToNotify, '2024-01-15');

      // Verify that createDailyReminderMessage was called with correct parameters
      expect(createDailyReminderMessage).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ slackUser: expect.stringContaining('<@') })
        ]),
        '2024-01-15'
      );
    });
  });

  describe('Environment Variable Integration', () => {
    test('should use all environment variables correctly', async () => {
      // Set custom environment variables
      process.env.HARVEST_ACCOUNT_ID = 'custom-account-id';
      process.env.HARVEST_TOKEN = 'custom-harvest-token';
      process.env.SLACK_TOKEN = 'custom-slack-token';
      process.env.SLACK_CHANNEL = '#custom-channel';
      process.env.MISSING_HOURS_THRESHOLD = '6';
      process.env.EMAILS_WHITELIST = 'custom@example.com';

      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockResolvedValue(mockSlackUsers);
      createDailyReminderMessage.mockReturnValue(mockSlackBlocks);
      sendSlackMessage.mockResolvedValue({ ok: true });

      await app(false);

      // Verify that environment variables were used correctly
      expect(getHarvestUsers).toHaveBeenCalledWith(
        'custom-account-id',
        'custom-harvest-token',
        'custom@example.com'
      );
      expect(getSlackUsers).toHaveBeenCalledWith('custom-slack-token');
      expect(sendSlackMessage).toHaveBeenCalledWith('#custom-channel', expect.anything(), 'custom-slack-token');
    });

    test('should handle missing environment variables gracefully', async () => {
      // Clear environment variables
      delete process.env.HARVEST_ACCOUNT_ID;
      delete process.env.HARVEST_TOKEN;
      delete process.env.SLACK_TOKEN;
      delete process.env.SLACK_CHANNEL;
      delete process.env.EMAILS_WHITELIST;

      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockResolvedValue(mockSlackUsers);
      createDailyReminderMessage.mockReturnValue(mockSlackBlocks);
      sendSlackMessage.mockResolvedValue({ ok: true });

      await app(false);

      // Verify that functions were called with undefined values
      expect(getHarvestUsers).toHaveBeenCalledWith(undefined, undefined, undefined);
      expect(getSlackUsers).toHaveBeenCalledWith(undefined);
      expect(sendSlackMessage).toHaveBeenCalledWith(undefined, expect.anything(), undefined);
    });
  });

  describe('Error Recovery', () => {
    test('should handle partial API failures gracefully', async () => {
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockRejectedValue(new Error('Slack API Error'));

      await expect(app(false)).rejects.toThrow('Slack API Error');

      // Verify that Harvest API was called successfully
      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalled();
    });

    test('should handle template creation failures', async () => {
      getHarvestUsers.mockResolvedValue(mockHarvestUsers);
      getHarvestTeamTimeReport.mockResolvedValue(mockTimeReports);
      getSlackUsers.mockResolvedValue(mockSlackUsers);
      createDailyReminderMessage.mockImplementation(() => {
        throw new Error('Template Creation Error');
      });

      await expect(app(false)).rejects.toThrow('Template Creation Error');

      // Verify that Harvest and Slack APIs were called
      expect(getHarvestUsers).toHaveBeenCalled();
      expect(getHarvestTeamTimeReport).toHaveBeenCalled();
      expect(getSlackUsers).toHaveBeenCalled();
    });
  });
});
