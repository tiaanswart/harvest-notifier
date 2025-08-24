/**
 * @fileoverview Tests for Harvest API utilities
 * 
 * Tests the Harvest API functions including user retrieval and time report fetching.
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import fetch from 'node-fetch';
import { getHarvestUsers, getHarvestTeamTimeReport } from '../../utils/harvest-api.js';
import Logger from '../../utils/logger.js';

// Mock dependencies
vi.mock('node-fetch');
vi.mock('../../utils/logger.js');

describe('Harvest API', () => {
  const mockAccountId = 'test-account-id';
  const mockToken = 'test-token';
  const mockDateFrom = '2024-01-01';
  const mockDateTo = '2024-01-02';

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset environment variables
    delete process.env.HARVEST_ACCOUNT_ID;
    delete process.env.HARVEST_TOKEN;
  });

  describe('getHarvestUsers', () => {
    test('should fetch and filter active users successfully', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          users: [
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
              last_name: 'Inactive',
              email: 'bob@example.com',
              is_active: false
            }
          ]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getHarvestUsers(mockAccountId, mockToken);

      expect(fetch).toHaveBeenCalledWith('https://api.harvestapp.com/v2/users', {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Harvest-Account-Id': mockAccountId,
          Authorization: `Bearer ${mockToken}`,
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].first_name).toBe('John');
      expect(result[1].first_name).toBe('Jane');
      expect(Logger.functionEntry).toHaveBeenCalledWith('getHarvestUsers', {
        accountId: mockAccountId,
        excludedUsers: undefined
      });
    });

    test('should filter out excluded users', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          users: [
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
            }
          ]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const excludedUsers = 'john@example.com';
      const result = await getHarvestUsers(mockAccountId, mockToken, excludedUsers);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('jane@example.com');
    });

    test('should handle multiple excluded users', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          users: [
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
          ]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const excludedUsers = 'john@example.com,jane@example.com';
      const result = await getHarvestUsers(mockAccountId, mockToken, excludedUsers);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('bob@example.com');
    });

    test('should handle empty users array', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          users: []
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getHarvestUsers(mockAccountId, mockToken);

      expect(result).toHaveLength(0);
    });

    test('should handle missing users property', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({})
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getHarvestUsers(mockAccountId, mockToken);

      expect(result).toHaveLength(0);
    });

    test('should handle API error', async () => {
      const mockResponse = {
        json: vi.fn().mockRejectedValue(new Error('API Error'))
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(getHarvestUsers(mockAccountId, mockToken)).rejects.toThrow('API Error');
    });

    test('should handle fetch error', async () => {
      fetch.mockRejectedValue(new Error('Network Error'));

      await expect(getHarvestUsers(mockAccountId, mockToken)).rejects.toThrow('Network Error');
    });

    test('should log API request and response', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          users: [
            {
              id: 1,
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com',
              is_active: true
            }
          ]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await getHarvestUsers(mockAccountId, mockToken);

      expect(Logger.apiRequest).toHaveBeenCalledWith('Harvest', 'GET /v2/users', {
        accountId: mockAccountId
      });
      expect(Logger.apiResponse).toHaveBeenCalledWith('Harvest', undefined, {
        usersCount: 1
      });
    });
  });

  describe('getHarvestTeamTimeReport', () => {
    test('should fetch time reports successfully', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          results: [
            {
              user_id: 1,
              total_hours: 8.5,
              date: '2024-01-01'
            },
            {
              user_id: 2,
              total_hours: 7.0,
              date: '2024-01-01'
            }
          ]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getHarvestTeamTimeReport(mockAccountId, mockToken, mockDateFrom, mockDateTo);

      expect(fetch).toHaveBeenCalledWith(
        `https://api.harvestapp.com/v2/reports/time/team?from=${mockDateFrom}&to=${mockDateTo}`,
        {
          method: 'get',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Harvest-Account-Id': mockAccountId,
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );

      expect(result).toHaveLength(2);
      expect(result[0].user_id).toBe(1);
      expect(result[0].total_hours).toBe(8.5);
      expect(Logger.functionEntry).toHaveBeenCalledWith('getHarvestTeamTimeReport', {
        accountId: mockAccountId,
        dateFrom: mockDateFrom,
        dateTo: mockDateTo
      });
    });

    test('should handle empty results array', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          results: []
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getHarvestTeamTimeReport(mockAccountId, mockToken, mockDateFrom, mockDateTo);

      expect(result).toHaveLength(0);
    });

    test('should handle missing results property', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({})
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getHarvestTeamTimeReport(mockAccountId, mockToken, mockDateFrom, mockDateTo);

      expect(result).toHaveLength(0);
    });

    test('should handle API error', async () => {
      const mockResponse = {
        json: vi.fn().mockRejectedValue(new Error('API Error'))
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(getHarvestTeamTimeReport(mockAccountId, mockToken, mockDateFrom, mockDateTo))
        .rejects.toThrow('API Error');
    });

    test('should handle fetch error', async () => {
      fetch.mockRejectedValue(new Error('Network Error'));

      await expect(getHarvestTeamTimeReport(mockAccountId, mockToken, mockDateFrom, mockDateTo))
        .rejects.toThrow('Network Error');
    });

    test('should log API request and response', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          results: [
            {
              user_id: 1,
              total_hours: 8.5,
              date: '2024-01-01'
            }
          ]
        })
      };

      fetch.mockResolvedValue(mockResponse);

      await getHarvestTeamTimeReport(mockAccountId, mockToken, mockDateFrom, mockDateTo);

      expect(Logger.apiRequest).toHaveBeenCalledWith('Harvest', 'GET /v2/reports/time/team', {
        accountId: mockAccountId,
        dateFrom: mockDateFrom,
        dateTo: mockDateTo
      });
      expect(Logger.apiResponse).toHaveBeenCalledWith('Harvest', undefined, {
        resultsCount: 1
      });
    });

    test('should handle different date formats', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          results: []
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const customDateFrom = '2024-12-25';
      const customDateTo = '2024-12-31';

      await getHarvestTeamTimeReport(mockAccountId, mockToken, customDateFrom, customDateTo);

      expect(fetch).toHaveBeenCalledWith(
        `https://api.harvestapp.com/v2/reports/time/team?from=${customDateFrom}&to=${customDateTo}`,
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle non-200 status codes', async () => {
      const mockResponse = {
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'Unauthorized'
        })
      };

      fetch.mockResolvedValue(mockResponse);

      const result = await getHarvestUsers(mockAccountId, mockToken);
      
      // The function should still process the response even with non-200 status
      expect(Logger.apiResponse).toHaveBeenCalledWith('Harvest', 401, {
        usersCount: 0
      });
    });

    test('should handle malformed JSON response', async () => {
      const mockResponse = {
        json: vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(getHarvestUsers(mockAccountId, mockToken)).rejects.toThrow('Invalid JSON');
    });
  });
});
