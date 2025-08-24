/**
 * @fileoverview Tests for Logger utility
 *
 * Tests the logging functionality including different log levels,
 * environment variable control, and structured logging methods.
 *
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import Logger from '../../utils/logger.js';

// Mock console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.LOG_LEVEL;

    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods
    if (consoleSpy.log) consoleSpy.log.mockRestore();
    if (consoleSpy.warn) consoleSpy.warn.mockRestore();
    if (consoleSpy.error) consoleSpy.error.mockRestore();
  });

  afterAll(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('Log Levels', () => {
    test('should log error messages by default', () => {
      Logger.error('Test error message');
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Test error message')
      );
    });

    test('should log warning messages by default', () => {
      Logger.warn('Test warning message');
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Test warning message')
      );
    });

    test('should log info messages by default', () => {
      Logger.info('Test info message');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Test info message')
      );
    });

    test('should not log debug messages by default', () => {
      Logger.debug('Test debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    test('should log debug messages when LOG_LEVEL is DEBUG', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      Logger.debug('Test debug message');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] Test debug message')
      );
    });

    test('should not log info messages when LOG_LEVEL is WARN', () => {
      process.env.LOG_LEVEL = 'WARN';
      Logger.info('Test info message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    test('should not log debug messages when LOG_LEVEL is WARN', () => {
      process.env.LOG_LEVEL = 'WARN';
      Logger.debug('Test debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    test('should handle invalid LOG_LEVEL gracefully', () => {
      process.env.LOG_LEVEL = 'INVALID';
      Logger.info('Test info message');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Test info message')
      );
    });
  });

  describe('Message Formatting', () => {
    test('should include timestamp in log messages', () => {
      Logger.info('Test message');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/)
      );
    });

    test('should format messages with data', () => {
      const testData = { key: 'value', number: 123 };
      Logger.info('Test message', testData);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Test message'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"key": "value"'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"number": 123'));
    });

    test('should handle null data gracefully', () => {
      Logger.info('Test message', null);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test message'));
    });
  });

  describe('Structured Logging Methods', () => {
    test('functionEntry should log debug message with function name', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      Logger.functionEntry('testFunction');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Entering function: testFunction')
      );
    });

    test('functionEntry should log debug message with parameters', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const params = { id: 123, name: 'test' };
      Logger.functionEntry('testFunction', params);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"id": 123'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"name": "test"'));
    });

    test('functionExit should log debug message with function name', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      Logger.functionExit('testFunction');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Exiting function: testFunction')
      );
    });

    test('functionExit should log debug message with result', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const result = { success: true, data: 'test' };
      Logger.functionExit('testFunction', result);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"success": true'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"data": "test"'));
    });

    test('apiRequest should log info message with API details', () => {
      Logger.apiRequest('Harvest', 'GET /v2/users', { accountId: '123' });
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('API Request: Harvest'));
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('"endpoint": "GET /v2/users"')
      );
    });

    test('apiResponse should log info message with response details', () => {
      Logger.apiResponse('Slack', 200, { ok: true });
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('API Response: Slack'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"statusCode": 200'));
    });

    test('userAnalysis should log info message with analysis details', () => {
      const usersToNotify = [
        { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com', totalHours: 5 },
      ];
      Logger.userAnalysis('daily', 10, 1, usersToNotify);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('User Analysis: daily'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"totalUsers": 10'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"usersToNotify": 1'));
    });

    test('notificationSent should log info message with notification details', () => {
      Logger.notificationSent('daily', 5, '#general');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Notification Sent: daily')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"usersNotified": 5'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"channel": "#general"'));
    });

    test('appStart should log info message with module details', () => {
      Logger.appStart('daily', { config: 'test' });
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Application Starting: daily')
      );
    });

    test('appEnd should log info message with completion details', () => {
      Logger.appEnd('daily', 'Test completion');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Application Ending: daily')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('"reason": "Test completion"')
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined messages gracefully', () => {
      Logger.info(undefined);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] undefined'));
    });

    test('should handle empty string messages', () => {
      Logger.info('');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] '));
    });

    test('should handle complex data objects', () => {
      const complexData = {
        array: [1, 2, 3],
        nested: { key: 'value' },
        nullValue: null,
        undefinedValue: undefined,
      };
      Logger.info('Complex data test', complexData);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('"array": ['));
    });
  });
});
