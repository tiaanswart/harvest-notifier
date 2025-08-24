/**
 * @fileoverview Weekly Harvest timesheet notification system
 * 
 * This module handles weekly timesheet notifications for the Harvest Notifier system.
 * It checks for users who haven't logged sufficient hours for the current week
 * and sends Slack notifications to remind them to complete their timesheets.
 * 
 * The system runs on Fridays and checks the entire week (Monday to Friday):
 * - Compares total hours against 5x the daily threshold
 * - Sends notifications for users with insufficient weekly hours
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

require('dotenv').config();
const moment = require('moment');
const { getHarvestUsers, getHarvestTeamTimeReport } = require('./utils/harvest-api');
const { getSlackUsers, sendSlackMessage, matchUsersWithSlack } = require('./utils/slack-api');
const { createWeeklyReminderMessage } = require('./templates/slack-templates');
const Logger = require('./utils/logger');



/**
 * Analyzes Harvest data and identifies users with insufficient weekly hours
 * 
 * Compares each user's logged hours for the week against the weekly threshold
 * (5x the daily threshold) and returns a list of users who need to be notified.
 * 
 * @param {string} timeSheetDateToCheckFrom - Start date of week in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date of week in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of users who need notification
 * @throws {Error} If API requests fail
 */
async function analyzeHarvestData(timeSheetDateToCheckFrom, timeSheetDateToCheckTo) {
  Logger.functionEntry('analyzeHarvestData', { timeSheetDateToCheckFrom, timeSheetDateToCheckTo });
  
  // Get active users from Harvest
  Logger.info('Fetching Harvest users');
  const harvestUsers = await getHarvestUsers(
    process.env.HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    process.env.EMAILS_WHITELIST
  );
  Logger.debug('Harvest users retrieved', { count: harvestUsers.length });
  
  // Get time reports for the specified week
  Logger.info('Fetching Harvest time reports', { 
    from: timeSheetDateToCheckFrom, 
    to: timeSheetDateToCheckTo 
  });
  const harvestTeamTimeReport = await getHarvestTeamTimeReport(
    process.env.HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    timeSheetDateToCheckFrom,
    timeSheetDateToCheckTo
  );
  Logger.debug('Harvest time reports retrieved', { count: harvestTeamTimeReport.length });
  
  const usersToNotify = [];
  const threshold = process.env.MISSING_HOURS_THRESHOLD * 5;
  Logger.info('Analyzing user hours against weekly threshold', { threshold });
  
  // Check each user's weekly hours against the threshold (5x the daily threshold)
  harvestUsers.forEach((user) => {
    // Filter reports by user_id
    const timeReports = harvestTeamTimeReport.filter((t) => t.user_id === user.id);
    // Sum up the total_hours from each filtered report
    const totalHours = timeReports.reduce((sum, report) => sum + report.total_hours, 0);
    
    Logger.debug('User hours analysis', {
      userId: user.id,
      userName: `${user.first_name} ${user.last_name}`,
      totalHours,
      threshold,
      timeReportsCount: timeReports.length
    });
    
    // If weekly hours are below threshold (5x daily threshold), add to notification list
    if (totalHours < threshold) {
      usersToNotify.push({
        ...user,
        totalHours,
      });
      Logger.info('User added to notification list', {
        userId: user.id,
        userName: `${user.first_name} ${user.last_name}`,
        totalHours,
        threshold
      });
    }
  });
  
  Logger.userAnalysis('weekly', harvestUsers.length, usersToNotify.length, usersToNotify);
  Logger.functionExit('analyzeHarvestData', { usersToNotifyCount: usersToNotify.length });
  
  return usersToNotify;
}

/**
 * Sends Slack notifications to users with missing weekly timesheet entries
 * 
 * Creates a formatted Slack message with user mentions and sends it to
 * the configured Slack channel. Only sends notifications if there are
 * users to notify.
 * 
 * @param {Array} usersToNotify - Array of users who need notification
 * @param {string} timeSheetDateToCheckFrom - Start date of week in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date of week in YYYY-MM-DD format
 * @returns {Promise<void>}
 * @throws {Error} If Slack API request fails
 */
async function slackNotify(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo) {
  Logger.functionEntry('slackNotify', { 
    usersToNotifyCount: usersToNotify?.length || 0,
    timeSheetDateToCheckFrom, 
    timeSheetDateToCheckTo 
  });
  
  // Only proceed if there are users to notify
  if (usersToNotify && usersToNotify.length) {
    Logger.info('Fetching Slack users for notification matching');
    const slackUsers = await getSlackUsers(process.env.SLACK_TOKEN);
    Logger.debug('Slack users retrieved', { count: slackUsers.length });
    
    // Match Harvest users with Slack users and format notification text
    const usersWithSlackMentions = matchUsersWithSlack(usersToNotify, slackUsers);
    Logger.debug('Users matched with Slack', { 
      matchedCount: usersWithSlackMentions.length,
      slackUsers: usersWithSlackMentions.map((user) => user.slackUser)
    });
    
    // Create Slack message blocks using template
    Logger.info('Creating Slack message');
    const slackBlocks = createWeeklyReminderMessage(usersWithSlackMentions, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
    
    // Send message to Slack
    Logger.info('Sending Slack notification', { channel: process.env.SLACK_CHANNEL });
    await sendSlackMessage(process.env.SLACK_CHANNEL, slackBlocks, process.env.SLACK_TOKEN);
    
    Logger.notificationSent('weekly', usersToNotify.length, process.env.SLACK_CHANNEL);
  } else {
    Logger.info('No users to notify, skipping Slack notification');
    return; // No users to notify
  }
  
  Logger.functionExit('slackNotify');
}

/**
 * Main application function for weekly timesheet notifications
 * 
 * Runs on Fridays to check the entire week (Monday to Friday) and sends
 * notifications to users who haven't logged sufficient hours for the week.
 * 
 * @returns {Promise<void>}
 */
async function app() {
  Logger.appStart('weekly', {
    currentDate: moment().format('YYYY-MM-DD'),
    weekday: moment().format('dddd')
  });
  
  const weekday = moment().format('dddd');
  
  // Only run on Fridays
  if (['Friday'].includes(weekday)) {
    Logger.info('Processing weekly notification - Friday detected');
    
    // Check the entire week (Monday to Friday)
    let timeSheetDateToCheckFrom = moment().startOf('week').add(1, 'days').format('YYYY-MM-DD');
    let timeSheetDateToCheckTo = moment().format('YYYY-MM-DD');
    
    Logger.info('Weekly date range', { 
      from: timeSheetDateToCheckFrom, 
      to: timeSheetDateToCheckTo 
    });
    
    // Get users to notify and send Slack message
    const usersToNotify = [...(await analyzeHarvestData(timeSheetDateToCheckFrom, timeSheetDateToCheckTo))];
    await slackNotify(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
    
    Logger.appEnd('weekly', 'Weekly notification completed');
    process.exit();
  } else {
    Logger.info('Skipping weekly notification - not Friday', { weekday });
    Logger.appEnd('weekly', 'Not Friday - no notification needed');
    process.exit();
  }
}

// Execute the application
app();
