/**
 * @fileoverview Tests for Slack API utilities
 * 
 * Tests the Slack API functions including user retrieval, message sending, and user matching.
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import fetch from 'node-fetch';
import { getSlackUsers, sendSlackMessage, matchUsersWithSlack } from '../../utils/slack-api.js';
import Logger from '../../utils/logger.js';

// Mock dependencies
vi.mock('node-fetch');
vi.mock('../../utils/logger.js');

describe('Slack API', () => {
  const mockToken = 'test-token';
  const mockChannel = '#general';

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('getSlackUsers', () => {
    test('should fetch and filter active users successfully', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: true,
          members: [
            {
              id: 'U123456',
              name: 'john.doe',
              profile: {
                real_name_normalized: 'John Doe',
                display_name_normalized: 'John',
                email: 'john@example.com'
              },
              deleted: false,
              is_bot: false
            },
            {
              id: 'U789012',
              name: 'jane.smith',
              profile: {
                real_name_normalized: 'Jane Smith',
                display_name_normalized: 'Jane',
                email: 'jane@example.com'
              },
              deleted: false,
              is_bot: false
            },
            {
              id: 'U345678',
              name: 'deleted.user',
              profile: {
                real_name_normalized: 'Deleted User',
                display_name_normalized: 'Deleted',
                email: 'deleted@example.com'
              },
              deleted: true,
              is_bot: false
            },
            {
              id: 'B123456',
              name: 'slackbot',
              profile: {
                real_name_normalized: 'Slackbot',
                display_name_normalized: 'Slackbot',
                email: 'slackbot@example.com'
              },
              deleted: false,
              is_bot: true
            }
          ]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getSlackUsers(mockToken);

      expect(fetch).toHaveBeenCalledWith('https://slack.com/api/users.list', {
        method: 'get',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('U123456');
      expect(result[1].id).toBe('U789012');
      expect(Logger.functionEntry).toHaveBeenCalledWith('getSlackUsers');
    });

    test('should handle empty members array', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: true,
          members: []
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getSlackUsers(mockToken);

      expect(result).toHaveLength(0);
    });

    test('should handle missing members property', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: true
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getSlackUsers(mockToken);

      expect(result).toHaveLength(0);
    });

    test('should handle API error response', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: false,
          error: 'invalid_auth'
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getSlackUsers(mockToken);

      expect(result).toHaveLength(0);
      expect(Logger.apiResponse).toHaveBeenCalledWith('Slack', undefined, {
        membersCount: 0,
        ok: false
      });
    });

    test('should handle fetch error', async () => {
      fetch.mockRejectedValue(new Error('Network Error'));

      await expect(getSlackUsers(mockToken)).rejects.toThrow('Network Error');
    });

    test('should log API request and response', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: true,
          members: [
            {
              id: 'U123456',
              profile: {
                real_name_normalized: 'John Doe',
                display_name_normalized: 'John',
                email: 'john@example.com'
              },
              deleted: false,
              is_bot: false
            }
          ]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await getSlackUsers(mockToken);

      expect(Logger.apiRequest).toHaveBeenCalledWith('Slack', 'GET /api/users.list');
      expect(Logger.apiResponse).toHaveBeenCalledWith('Slack', undefined, {
        membersCount: 1,
        ok: true
      });
    });
  });

  describe('sendSlackMessage', () => {
    test('should send message successfully', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Test message'
          }
        }
      ];

      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: true,
          ts: '1234567890.123456',
          channel: mockChannel
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await sendSlackMessage(mockChannel, mockBlocks, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://slack.com/api/chat.postMessage'),
        {
          method: 'post',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            charset: 'utf-8',
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );

      expect(result.ok).toBe(true);
      expect(result.ts).toBe('1234567890.123456');
      expect(Logger.functionEntry).toHaveBeenCalledWith('sendSlackMessage', {
        channel: mockChannel,
        blocksCount: 1
      });
    });

    test('should handle message sending failure', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Test message'
          }
        }
      ];

      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: false,
          error: 'channel_not_found'
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await sendSlackMessage(mockChannel, mockBlocks, mockToken);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('channel_not_found');
    });

    test('should handle empty blocks array', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: true,
          ts: '1234567890.123456',
          channel: mockChannel
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await sendSlackMessage(mockChannel, [], mockToken);

      expect(Logger.functionEntry).toHaveBeenCalledWith('sendSlackMessage', {
        channel: mockChannel,
        blocksCount: 0
      });
    });

    test('should handle fetch error', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Test message'
          }
        }
      ];

      fetch.mockRejectedValue(new Error('Network Error'));

      await expect(sendSlackMessage(mockChannel, mockBlocks, mockToken))
        .rejects.toThrow('Network Error');
    });

    test('should log API request and response', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Test message'
          }
        }
      ];

      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: true,
          ts: '1234567890.123456',
          channel: mockChannel
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await sendSlackMessage(mockChannel, mockBlocks, mockToken);

      expect(Logger.apiRequest).toHaveBeenCalledWith('Slack', 'POST /api/chat.postMessage', {
        channel: mockChannel
      });
      expect(Logger.apiResponse).toHaveBeenCalledWith('Slack', undefined, {
        ok: true,
        ts: '1234567890.123456',
        channel: mockChannel
      });
    });

    test('should handle special characters in blocks', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Message with special chars: & < > " \''
          }
        }
      ];

      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          ok: true,
          ts: '1234567890.123456',
          channel: mockChannel
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await sendSlackMessage(mockChannel, mockBlocks, mockToken);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('blocks='),
        expect.any(Object)
      );
    });
  });

  describe('matchUsersWithSlack', () => {
    test('should match users by real name', () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5
        }
      ];

      const slackUsers = [
        {
          id: 'U123456',
          profile: {
            real_name_normalized: 'John Doe',
            display_name_normalized: 'John',
            email: 'john@example.com'
          }
        }
      ];

      const result = matchUsersWithSlack(usersToNotify, slackUsers);

      expect(result).toHaveLength(1);
      expect(result[0].slackUser).toBe('<@U123456> (Hours logged: 5)');
      expect(Logger.functionEntry).toHaveBeenCalledWith('matchUsersWithSlack', {
        usersToNotifyCount: 1,
        slackUsersCount: 1
      });
    });

    test('should match users by display name', () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5
        }
      ];

      const slackUsers = [
        {
          id: 'U123456',
          profile: {
            real_name_normalized: 'Jane Smith',
            display_name_normalized: 'John Doe',
            email: 'jane@example.com'
          }
        }
      ];

      const result = matchUsersWithSlack(usersToNotify, slackUsers);

      expect(result).toHaveLength(1);
      expect(result[0].slackUser).toBe('<@U123456> (Hours logged: 5)');
    });

    test('should match users by email', () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5
        }
      ];

      const slackUsers = [
        {
          id: 'U123456',
          profile: {
            real_name_normalized: 'Jane Smith',
            display_name_normalized: 'Jane',
            email: 'john@example.com'
          }
        }
      ];

      const result = matchUsersWithSlack(usersToNotify, slackUsers);

      expect(result).toHaveLength(1);
      expect(result[0].slackUser).toBe('<@U123456> (Hours logged: 5)');
    });

    test('should handle case insensitive matching', () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'JOHN@EXAMPLE.COM',
          totalHours: 5
        }
      ];

      const slackUsers = [
        {
          id: 'U123456',
          profile: {
            real_name_normalized: 'JANE SMITH',
            display_name_normalized: 'JANE',
            email: 'john@example.com'
          }
        }
      ];

      const result = matchUsersWithSlack(usersToNotify, slackUsers);

      expect(result).toHaveLength(1);
      expect(result[0].slackUser).toBe('<@U123456> (Hours logged: 5)');
    });

    test('should handle unmatched users', () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5
        }
      ];

      const slackUsers = [
        {
          id: 'U123456',
          profile: {
            real_name_normalized: 'Jane Smith',
            display_name_normalized: 'Jane',
            email: 'jane@example.com'
          }
        }
      ];

      const result = matchUsersWithSlack(usersToNotify, slackUsers);

      expect(result).toHaveLength(1);
      expect(result[0].slackUser).toBe('John Doe (Hours logged: 5)');
    });

    test('should handle empty arrays', () => {
      const result = matchUsersWithSlack([], []);

      expect(result).toHaveLength(0);
    });

    test('should handle missing email in Slack user', () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5
        }
      ];

      const slackUsers = [
        {
          id: 'U123456',
          profile: {
            real_name_normalized: 'Jane Smith',
            display_name_normalized: 'Jane'
            // No email property
          }
        }
      ];

      const result = matchUsersWithSlack(usersToNotify, slackUsers);

      expect(result).toHaveLength(1);
      expect(result[0].slackUser).toBe('John Doe (Hours logged: 5)');
    });

    test('should handle multiple users with mixed matches', () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5
        },
        {
          id: 2,
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          totalHours: 8
        },
        {
          id: 3,
          first_name: 'Bob',
          last_name: 'Wilson',
          email: 'bob@example.com',
          totalHours: 3
        }
      ];

      const slackUsers = [
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
        }
        // Bob Wilson not in Slack users
      ];

      const result = matchUsersWithSlack(usersToNotify, slackUsers);

      expect(result).toHaveLength(3);
      expect(result[0].slackUser).toBe('<@U123456> (Hours logged: 5)');
      expect(result[1].slackUser).toBe('<@U789012> (Hours logged: 8)');
      expect(result[2].slackUser).toBe('Bob Wilson (Hours logged: 3)');
    });

    test('should log matching results', () => {
      const usersToNotify = [
        {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          totalHours: 5
        }
      ];

      const slackUsers = [
        {
          id: 'U123456',
          profile: {
            real_name_normalized: 'John Doe',
            display_name_normalized: 'John',
            email: 'john@example.com'
          }
        }
      ];

      matchUsersWithSlack(usersToNotify, slackUsers);

      expect(Logger.functionExit).toHaveBeenCalledWith('matchUsersWithSlack', {
        totalUsers: 1,
        matchedCount: 1,
        unmatchedCount: 0
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON response in getSlackUsers', async () => {
      const mockResponse = {
        json: vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(getSlackUsers(mockToken)).rejects.toThrow('Invalid JSON');
    });

    test('should handle malformed JSON response in sendSlackMessage', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Test message'
          }
        }
      ];

      const mockResponse = {
        json: vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(sendSlackMessage(mockChannel, mockBlocks, mockToken))
        .rejects.toThrow('Invalid JSON');
    });
  });
});
