/**
 * @fileoverview Unified Harvest Notifier application
 *
 * This is the main entry point for the Harvest Notifier system that handles
 * daily, weekly, and monthly timesheet notifications based on the current date.
 * 
 * Schedule:
 * - Daily: Runs on weekdays (Mon-Fri), checks previous working day
 * - Weekly: Runs on Fridays, checks entire week (Mon-Fri)
 * - Monthly: Runs on last day of month, checks entire month
 *
 * @author tiaan.swart@sleeq.global
 * @version 2.0.0
 * @license MIT
 */

import dotenv from 'dotenv';
import moment from 'moment';
import { getHarvestUsers, getHarvestTeamTimeReport } from './utils/harvest-api.js';
import { getSlackUsers, sendSlackMessage, matchUsersWithSlack } from './utils/slack-api.js';
import { createDailyReminderMessage, createWeeklyReminderMessage, createMonthlyReminderMessage } from './templates/slack-templates.js';
import Logger from './utils/logger.js';

dotenv.config();

/**
 * Calculates the number of workdays between two dates (excluding weekends)
 *
 * @param {moment.Moment} start - Start date as moment object
 * @param {moment.Moment} end - End date as moment object
 * @returns {number} Number of workdays between the dates
 */
function workday_count(start, end) {
  // Find the end of the first week
  var first = start.clone().endOf('week');
  // Find the start of the last week
  var last = end.clone().startOf('week');

  // Calculate full weeks between (5 workdays per week)
  var days = (last.diff(first, 'days') * 5) / 7;

  // Calculate workdays in the first partial week
  var wfirst = first.day() - start.day();
  if (start.day() == 0) --wfirst; // Adjust for Sunday

  // Calculate workdays in the last partial week
  var wlast = end.day() - last.day();
  if (end.day() == 6) --wlast; // Adjust for Saturday

  return wfirst + Math.floor(days) + wlast;
}

/**
 * Analyzes Harvest data and identifies users with insufficient hours
 *
 * @param {string} timeSheetDateToCheckFrom - Start date in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date in YYYY-MM-DD format (same as from for daily)
 * @param {string} notificationType - 'daily', 'weekly', or 'monthly'
 * @returns {Promise<Array>} Array of users who need notification
 * @throws {Error} If API requests fail
 */
async function analyzeHarvestData(timeSheetDateToCheckFrom, timeSheetDateToCheckTo, notificationType) {
  Logger.functionEntry('analyzeHarvestData', { 
    timeSheetDateToCheckFrom, 
    timeSheetDateToCheckTo, 
    notificationType 
  });

  try {
    // Get active users from Harvest
    Logger.info('Fetching Harvest users');
    const harvestUsers = await getHarvestUsers(
      process.env.HARVEST_ACCOUNT_ID,
      process.env.HARVEST_TOKEN,
      process.env.EMAILS_WHITELIST
    );
    Logger.debug('Harvest users retrieved', { count: harvestUsers?.length || 0 });

    // Get time reports for the specified date range
    Logger.info('Fetching Harvest time reports', {
      from: timeSheetDateToCheckFrom,
      to: timeSheetDateToCheckTo,
    });
    const harvestTeamTimeReport = await getHarvestTeamTimeReport(
      process.env.HARVEST_ACCOUNT_ID,
      process.env.HARVEST_TOKEN,
      timeSheetDateToCheckFrom,
      timeSheetDateToCheckTo
    );
    Logger.debug('Harvest time reports retrieved', { count: harvestTeamTimeReport?.length || 0 });

    const usersToNotify = [];
    let threshold;

    // Calculate threshold based on notification type
    if (notificationType === 'daily') {
      threshold = process.env.MISSING_HOURS_THRESHOLD;
    } else if (notificationType === 'weekly') {
      threshold = process.env.MISSING_HOURS_THRESHOLD * 5;
    } else if (notificationType === 'monthly') {
      const expectedWorkdays = workday_count(
        moment(timeSheetDateToCheckFrom),
        moment(timeSheetDateToCheckTo)
      );
      threshold = process.env.MISSING_HOURS_THRESHOLD * expectedWorkdays;
      Logger.info('Calculated expected workdays', { expectedWorkdays });
    }

    Logger.info('Analyzing user hours against threshold', { threshold, notificationType });

    // Check each user's hours against the threshold
    if (!harvestUsers || !Array.isArray(harvestUsers)) {
      Logger.warn('No harvest users found or invalid data');
      Logger.userAnalysis(notificationType, 0, 0, []);
      Logger.functionExit('analyzeHarvestData', { usersToNotifyCount: 0 });
      return [];
    }

    harvestUsers.forEach((user) => {
      // Filter reports by user_id
      const timeReports = harvestTeamTimeReport?.filter((t) => t.user_id === user.id) || [];
      // Sum up the total_hours from each filtered report
      const totalHours = timeReports.reduce((sum, report) => sum + report.total_hours, 0);

      Logger.debug('User hours analysis', {
        userId: user.id,
        userName: `${user.first_name} ${user.last_name}`,
        totalHours,
        threshold,
        timeReportsCount: timeReports.length,
      });

      // If hours are below threshold, add to notification list
      if (totalHours < threshold) {
        usersToNotify.push({
          ...user,
          totalHours,
        });
        Logger.info('User added to notification list', {
          userId: user.id,
          userName: `${user.first_name} ${user.last_name}`,
          totalHours,
          threshold,
        });
      }
    });

    Logger.userAnalysis(notificationType, harvestUsers.length, usersToNotify.length, usersToNotify);
    Logger.functionExit('analyzeHarvestData', { usersToNotifyCount: usersToNotify.length });

    return usersToNotify;
  } catch (error) {
    Logger.error('Error in analyzeHarvestData', { error: error.message });
    Logger.functionExit('analyzeHarvestData', { error: error.message });
    throw error;
  }
}

/**
 * Sends Slack notifications to users with missing timesheet entries
 *
 * @param {Array} usersToNotify - Array of users who need notification
 * @param {string} timeSheetDateToCheckFrom - Start date in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date in YYYY-MM-DD format
 * @param {string} notificationType - 'daily', 'weekly', or 'monthly'
 * @returns {Promise<void>}
 * @throws {Error} If Slack API request fails
 */
async function slackNotify(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo, notificationType) {
  Logger.functionEntry('slackNotify', {
    usersToNotifyCount: usersToNotify?.length || 0,
    timeSheetDateToCheckFrom,
    timeSheetDateToCheckTo,
    notificationType,
  });

  try {
    // Only proceed if there are users to notify
    if (usersToNotify && usersToNotify.length) {
      Logger.info('Fetching Slack users for notification matching');
      const slackUsers = await getSlackUsers(process.env.SLACK_TOKEN);
      Logger.debug('Slack users retrieved', { count: slackUsers?.length || 0 });

      // Match Harvest users with Slack users and format notification text
      const usersWithSlackMentions = matchUsersWithSlack(usersToNotify, slackUsers);
      Logger.debug('Users matched with Slack', {
        matchedCount: usersWithSlackMentions?.length || 0,
        slackUsers: usersWithSlackMentions?.map((user) => user.slackUser) || [],
      });

      // Create Slack message blocks using appropriate template
      Logger.info('Creating Slack message');
      let slackBlocks;
      
      if (notificationType === 'daily') {
        slackBlocks = createDailyReminderMessage(usersWithSlackMentions, timeSheetDateToCheckFrom);
      } else if (notificationType === 'weekly') {
        slackBlocks = createWeeklyReminderMessage(usersWithSlackMentions, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
      } else if (notificationType === 'monthly') {
        slackBlocks = createMonthlyReminderMessage(usersWithSlackMentions, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
      }

      // Send message to Slack
      Logger.info('Sending Slack notification', { channel: process.env.SLACK_CHANNEL });
      await sendSlackMessage(process.env.SLACK_CHANNEL, slackBlocks, process.env.SLACK_TOKEN);

      Logger.notificationSent(notificationType, usersToNotify.length, process.env.SLACK_CHANNEL);
    } else {
      Logger.info('No users to notify, skipping Slack notification');
    }

    Logger.functionExit('slackNotify');
  } catch (error) {
    Logger.error('Error in slackNotify', { error: error.message });
    Logger.functionExit('slackNotify', { error: error.message });
    throw error;
  }
}

/**
 * Determines which notifications should run based on the current date
 *
 * @returns {Array} Array of notification types that should run today
 */
function determineNotificationsToRun() {
  const currentDate = moment();
  const weekday = currentDate.format('dddd');
  const isLastDayOfMonth = currentDate.format('YYYY-MM-DD') === currentDate.endOf('month').format('YYYY-MM-DD');
  
  const notificationsToRun = [];
  
  // Daily notifications run on weekdays
  if (!['Saturday', 'Sunday'].includes(weekday)) {
    notificationsToRun.push('daily');
  }
  
  // Weekly notifications run on Fridays
  if (weekday === 'Friday') {
    notificationsToRun.push('weekly');
  }
  
  // Monthly notifications run on the last day of the month
  if (isLastDayOfMonth) {
    notificationsToRun.push('monthly');
  }
  
  return notificationsToRun;
}

/**
 * Gets the date range for a specific notification type
 *
 * @param {string} notificationType - 'daily', 'weekly', or 'monthly'
 * @returns {Object} Object with from and to dates in YYYY-MM-DD format
 */
function getDateRangeForNotification(notificationType) {
  const currentDate = moment();
  
  if (notificationType === 'daily') {
    const weekday = currentDate.format('dddd');
    let dateToCheck;
    
    if (['Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday)) {
      // Check previous day
      dateToCheck = currentDate.subtract(1, 'days').format('YYYY-MM-DD');
    } else {
      // Monday: check Friday (3 days back)
      dateToCheck = currentDate.subtract(3, 'days').format('YYYY-MM-DD');
    }
    
    return { from: dateToCheck, to: dateToCheck };
  } else if (notificationType === 'weekly') {
    // Check the entire week (Monday to Friday)
    const from = currentDate.clone().startOf('week').add(1, 'days').format('YYYY-MM-DD');
    const to = currentDate.format('YYYY-MM-DD');
    return { from, to };
  } else if (notificationType === 'monthly') {
    // Check the entire month
    const from = currentDate.startOf('month').format('YYYY-MM-DD');
    const to = currentDate.endOf('month').format('YYYY-MM-DD');
    return { from, to };
  }
  
  throw new Error(`Unknown notification type: ${notificationType}`);
}

/**
 * Runs a specific notification type
 *
 * @param {string} notificationType - 'daily', 'weekly', or 'monthly'
 * @returns {Promise<void>}
 */
async function runNotification(notificationType) {
  Logger.info(`Starting ${notificationType} notification`);
  
  const dateRange = getDateRangeForNotification(notificationType);
  Logger.info(`${notificationType} date range`, dateRange);
  
  const usersToNotify = await analyzeHarvestData(
    dateRange.from, 
    dateRange.to, 
    notificationType
  );
  
  await slackNotify(
    usersToNotify, 
    dateRange.from, 
    dateRange.to, 
    notificationType
  );
  
  Logger.info(`${notificationType} notification completed`);
}

/**
 * Main application function
 *
 * Determines which notifications should run based on the current date
 * and executes them in sequence.
 *
 * @param {boolean} shouldExit - Whether to exit the process on completion (default: true)
 * @returns {Promise<void>}
 */
async function app(shouldExit = true) {
  try {
    const currentDate = moment().format('YYYY-MM-DD');
    const weekday = moment().format('dddd');
    const isLastDayOfMonth = moment().format('YYYY-MM-DD') === moment().endOf('month').format('YYYY-MM-DD');
    
    Logger.appStart('unified', {
      currentDate,
      weekday,
      isLastDayOfMonth,
    });

    const notificationsToRun = determineNotificationsToRun();
    
    if (notificationsToRun.length === 0) {
      Logger.info('No notifications scheduled for today');
      Logger.appEnd('unified', 'No notifications needed');
      if (shouldExit) process.exit(0);
      return;
    }
    
    Logger.info('Notifications to run today', { notificationsToRun });
    
    // Run each notification in sequence
    for (const notificationType of notificationsToRun) {
      await runNotification(notificationType);
    }
    
    Logger.appEnd('unified', 'All notifications completed');
    if (shouldExit) process.exit(0);
  } catch (error) {
    Logger.error('Error in app', { error: error.message });
    Logger.appEnd('unified', `Error: ${error.message}`);
    if (shouldExit) process.exit(1);
    throw error; // Re-throw the error for testing
  }
}

// Execute the application only if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app();
}

// Export functions for testing
export { 
  analyzeHarvestData, 
  slackNotify, 
  determineNotificationsToRun, 
  getDateRangeForNotification, 
  runNotification, 
  app 
};
