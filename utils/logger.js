/**
 * @fileoverview Logging utility for Harvest Notifier
 * 
 * Provides structured logging with different levels and environment variable control.
 * Supports different log levels: error, warn, info, debug
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

require('dotenv').config();

// Log levels in order of priority
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Get log level from environment variable, default to INFO
const getLogLevel = () => {
  const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
  return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
};

// Get current timestamp
const getTimestamp = () => {
  return new Date().toISOString();
};

// Format log message
const formatMessage = (level, message, data = null) => {
  const timestamp = getTimestamp();
  const baseMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (data !== null) {
    return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
  }
  
  return baseMessage;
};

// Check if log level should be output
const shouldLog = (level) => {
  return LOG_LEVELS[level] <= getLogLevel();
};

/**
 * Logger utility class
 */
class Logger {
  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {*} data - Optional data to include
   */
  static error(message, data = null) {
    if (shouldLog('ERROR')) {
      console.error(formatMessage('ERROR', message, data));
    }
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {*} data - Optional data to include
   */
  static warn(message, data = null) {
    if (shouldLog('WARN')) {
      console.warn(formatMessage('WARN', message, data));
    }
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {*} data - Optional data to include
   */
  static info(message, data = null) {
    if (shouldLog('INFO')) {
      console.log(formatMessage('INFO', message, data));
    }
  }

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {*} data - Optional data to include
   */
  static debug(message, data = null) {
    if (shouldLog('DEBUG')) {
      console.log(formatMessage('DEBUG', message, data));
    }
  }

  /**
   * Log function entry
   * @param {string} functionName - Name of the function being entered
   * @param {*} params - Optional parameters to log
   */
  static functionEntry(functionName, params = null) {
    this.debug(`Entering function: ${functionName}`, params);
  }

  /**
   * Log function exit
   * @param {string} functionName - Name of the function being exited
   * @param {*} result - Optional result to log
   */
  static functionExit(functionName, result = null) {
    this.debug(`Exiting function: ${functionName}`, result);
  }

  /**
   * Log API request
   * @param {string} apiName - Name of the API being called
   * @param {string} endpoint - API endpoint
   * @param {*} params - Optional parameters
   */
  static apiRequest(apiName, endpoint, params = null) {
    this.info(`API Request: ${apiName}`, { endpoint, params });
  }

  /**
   * Log API response
   * @param {string} apiName - Name of the API that responded
   * @param {number} statusCode - HTTP status code
   * @param {*} data - Response data
   */
  static apiResponse(apiName, statusCode, data = null) {
    this.info(`API Response: ${apiName}`, { statusCode, data });
  }

  /**
   * Log user analysis results
   * @param {string} analysisType - Type of analysis (daily, weekly, monthly)
   * @param {number} totalUsers - Total users analyzed
   * @param {number} usersToNotify - Number of users to notify
   * @param {Array} usersToNotifyList - List of users to notify
   */
  static userAnalysis(analysisType, totalUsers, usersToNotify, usersToNotifyList = []) {
    this.info(`User Analysis: ${analysisType}`, {
      totalUsers,
      usersToNotify,
      usersToNotifyList: usersToNotifyList.map(user => ({
        id: user.id,
        name: user.first_name + ' ' + user.last_name,
        email: user.email,
        totalHours: user.totalHours
      }))
    });
  }

  /**
   * Log notification sending
   * @param {string} notificationType - Type of notification (daily, weekly, monthly)
   * @param {number} usersNotified - Number of users being notified
   * @param {string} channel - Slack channel
   */
  static notificationSent(notificationType, usersNotified, channel) {
    this.info(`Notification Sent: ${notificationType}`, {
      usersNotified,
      channel
    });
  }

  /**
   * Log application start
   * @param {string} moduleName - Name of the module starting
   * @param {*} config - Optional configuration
   */
  static appStart(moduleName, config = null) {
    this.info(`Application Starting: ${moduleName}`, config);
  }

  /**
   * Log application end
   * @param {string} moduleName - Name of the module ending
   * @param {string} reason - Reason for ending
   */
  static appEnd(moduleName, reason = 'Normal completion') {
    this.info(`Application Ending: ${moduleName}`, { reason });
  }
}

module.exports = Logger;
