/**
 * @fileoverview Daily Harvest timesheet notification system
 *
 * This module handles daily timesheet notifications for the Harvest Notifier system.
 * It checks for users who haven't logged sufficient hours for the previous working day
 * and sends Slack notifications to remind them to complete their timesheets.
 *
 * The system runs on weekdays and checks the previous working day:
 * - Monday: checks Friday (3 days back)
 * - Tuesday-Friday: checks the previous day
 * - Weekends: no notifications sent
 *
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

import dotenv from 'dotenv';
import moment from 'moment';
import { getHarvestUsers, getHarvestTeamTimeReport } from './utils/harvest-api.js';
import { getSlackUsers, sendSlackMessage, matchUsersWithSlack } from './utils/slack-api.js';
import { createDailyReminderMessage } from './templates/slack-templates.js';
import Logger from './utils/logger.js';

dotenv.config();

/**
 * Analyzes Harvest data and identifies users with insufficient hours
 *
 * Compares each user's logged hours against the threshold and returns a list
 * of users who need to be notified about missing timesheet entries.
 *
 * @param {string} timeSheetDateToCheck - Date to check in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of users who need notification
 * @throws {Error} If API requests fail
 */
async function analyzeHarvestData(timeSheetDateToCheck) {
  Logger.functionEntry('analyzeHarvestData', { timeSheetDateToCheck });

  try {
    // Get active users from Harvest
    Logger.info('Fetching Harvest users');
    const harvestUsers = await getHarvestUsers(
      process.env.HARVEST_ACCOUNT_ID,
      process.env.HARVEST_TOKEN,
      process.env.EMAILS_WHITELIST
    );
    Logger.debug('Harvest users retrieved', { count: harvestUsers?.length || 0 });

    // Get time reports for the specified date
    Logger.info('Fetching Harvest time reports', { date: timeSheetDateToCheck });
    const harvestTeamTimeReport = await getHarvestTeamTimeReport(
      process.env.HARVEST_ACCOUNT_ID,
      process.env.HARVEST_TOKEN,
      timeSheetDateToCheck,
      timeSheetDateToCheck
    );
    Logger.debug('Harvest time reports retrieved', { count: harvestTeamTimeReport?.length || 0 });

    const usersToNotify = [];
    const threshold = process.env.MISSING_HOURS_THRESHOLD;
    Logger.info('Analyzing user hours against threshold', { threshold });

    // Check each user's hours against the threshold
    if (!harvestUsers || !Array.isArray(harvestUsers)) {
      Logger.warn('No harvest users found or invalid data');
      Logger.userAnalysis('daily', 0, 0, []);
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

    Logger.userAnalysis('daily', harvestUsers.length, usersToNotify.length, usersToNotify);
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
 * Creates a formatted Slack message with user mentions and sends it to
 * the configured Slack channel. Only sends notifications if there are
 * users to notify.
 *
 * @param {Array} usersToNotify - Array of users who need notification
 * @param {string} timeSheetDateToCheck - Date that was checked in YYYY-MM-DD format
 * @returns {Promise<void>}
 * @throws {Error} If Slack API request fails
 */
async function slackNotify(usersToNotify, timeSheetDateToCheck) {
  Logger.functionEntry('slackNotify', {
    usersToNotifyCount: usersToNotify?.length || 0,
    timeSheetDateToCheck,
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

      // Create Slack message blocks using template
      Logger.info('Creating Slack message');
      const slackBlocks = createDailyReminderMessage(usersWithSlackMentions, timeSheetDateToCheck);

      // Send message to Slack
      Logger.info('Sending Slack notification', { channel: process.env.SLACK_CHANNEL });
      await sendSlackMessage(process.env.SLACK_CHANNEL, slackBlocks, process.env.SLACK_TOKEN);

      Logger.notificationSent('daily', usersToNotify.length, process.env.SLACK_CHANNEL);
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
 * Main application function for daily timesheet notifications
 *
 * Determines the appropriate date to check based on the current weekday:
 * - Monday: checks Friday (3 days back)
 * - Tuesday-Friday: checks the previous day
 * - Weekends: no action taken
 *
 * Retrieves users with insufficient hours and sends Slack notifications.
 *
 * @param {boolean} shouldExit - Whether to exit the process on completion (default: true)
 * @returns {Promise<void>}
 */
async function app(shouldExit = true) {
  try {
    Logger.appStart('daily', {
      currentDate: moment().format('YYYY-MM-DD'),
      weekday: moment().format('dddd'),
    });

    let timeSheetDateToCheck;
    const weekday = moment().format('dddd');

    // Only run on weekdays
    if (!['Saturday', 'Sunday'].includes(weekday)) {
      Logger.info('Processing daily notification - weekday detected', { weekday });

      // Determine which date to check based on current day
      if (['Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday)) {
        // Check previous day
        timeSheetDateToCheck = moment().subtract(1, 'days').format('YYYY-MM-DD');
        Logger.info('Checking previous day', { date: timeSheetDateToCheck });
      } else {
        // Monday: check Friday (3 days back)
        timeSheetDateToCheck = moment().subtract(3, 'days').format('YYYY-MM-DD');
        Logger.info('Checking Friday (3 days back)', { date: timeSheetDateToCheck });
      }

      // Get users to notify and send Slack message
      const usersToNotify = await analyzeHarvestData(timeSheetDateToCheck);
      await slackNotify(usersToNotify, timeSheetDateToCheck);

      Logger.appEnd('daily', 'Daily notification completed');
      if (shouldExit) process.exit(0);
    } else {
      Logger.info('Skipping daily notification - weekend detected', { weekday });
      Logger.appEnd('daily', 'Weekend - no notification needed');
      if (shouldExit) process.exit(0);
    }
  } catch (error) {
    Logger.error('Error in app', { error: error.message });
    Logger.appEnd('daily', `Error: ${error.message}`);
    if (shouldExit) process.exit(1);
    throw error; // Re-throw the error for testing
  }
}

// Execute the application only if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app();
}

// Export functions for testing
export { analyzeHarvestData, slackNotify, app };
