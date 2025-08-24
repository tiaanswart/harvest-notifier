/**
 * @fileoverview Monthly Harvest timesheet notification system
 * 
 * This module handles monthly timesheet notifications for the Harvest Notifier system.
 * It checks for users who haven't logged sufficient hours for the current month
 * and sends Slack notifications to remind them to complete their timesheets.
 * 
 * The system runs on the last day of each month and checks the entire month:
 * - Calculates expected workdays for the month
 * - Compares total hours against workdays x daily threshold
 * - Sends notifications for users with insufficient monthly hours
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

require('dotenv').config();
const moment = require('moment');
const { getHarvestUsers, getHarvestTeamTimeReport } = require('./utils/harvest-api');
const { getSlackUsers, sendSlackMessage, matchUsersWithSlack } = require('./utils/slack-api');
const { createMonthlyReminderMessage } = require('./templates/slack-templates');
const Logger = require('./utils/logger');



/**
 * Calculates the number of workdays between two dates (excluding weekends)
 * 
 * This function calculates the number of working days (Monday-Friday) between
 * two dates, excluding weekends. It handles partial weeks at the beginning
 * and end of the date range.
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
 * Analyzes Harvest data and identifies users with insufficient monthly hours
 * 
 * Compares each user's logged hours for the month against the monthly threshold
 * (workdays x daily threshold) and returns a list of users who need to be notified.
 * 
 * @param {string} timeSheetDateToCheckFrom - Start date of month in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date of month in YYYY-MM-DD format
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
  
  // Get time reports for the specified month
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
  
  // Calculate expected workdays for the month
  const expectedWorkdays = workday_count(
    moment(timeSheetDateToCheckFrom),
    moment(timeSheetDateToCheckTo)
  );
  Logger.info('Calculated expected workdays', { expectedWorkdays });
  
  // Check each user's monthly hours against the threshold
  const threshold = process.env.MISSING_HOURS_THRESHOLD * expectedWorkdays;
  Logger.info('Analyzing user hours against threshold', { threshold });
  
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
    
    // If monthly hours are below threshold (workdays x daily threshold), add to notification list
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
  
  Logger.userAnalysis('monthly', harvestUsers.length, usersToNotify.length, usersToNotify);
  Logger.functionExit('analyzeHarvestData', { usersToNotifyCount: usersToNotify.length });
  
  return usersToNotify;
}

/**
 * Sends Slack notifications to users with missing monthly timesheet entries
 * 
 * Creates a formatted Slack message with user mentions and sends it to
 * the configured Slack channel. Only sends notifications if there are
 * users to notify.
 * 
 * @param {Array} usersToNotify - Array of users who need notification
 * @param {string} timeSheetDateToCheckFrom - Start date of month in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date of month in YYYY-MM-DD format
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
    const slackBlocks = createMonthlyReminderMessage(usersWithSlackMentions, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
    
    // Send message to Slack
    Logger.info('Sending Slack notification', { channel: process.env.SLACK_CHANNEL });
    await sendSlackMessage(process.env.SLACK_CHANNEL, slackBlocks, process.env.SLACK_TOKEN);
    
    Logger.notificationSent('monthly', usersToNotify.length, process.env.SLACK_CHANNEL);
  } else {
    Logger.info('No users to notify, skipping Slack notification');
    return; // No users to notify
  }
  
  Logger.functionExit('slackNotify');
}

/**
 * Main application function for monthly timesheet notifications
 * 
 * Runs on the last day of each month to check the entire month and sends
 * notifications to users who haven't logged sufficient hours for the month.
 * 
 * @returns {Promise<void>}
 */
async function app() {
  Logger.appStart('monthly', {
    currentDate: moment().format('YYYY-MM-DD'),
    isLastDayOfMonth: moment().format('YYYY-MM-DD') === moment().endOf('month').format('YYYY-MM-DD')
  });
  
  // Check if today is the last day of the month
  if (moment().format('YYYY-MM-DD') === moment().endOf('month').format('YYYY-MM-DD')) {
    Logger.info('Processing monthly notification - last day of month detected');
    
    // Check the entire month
    let timeSheetDateToCheckFrom = moment().startOf('month').format('YYYY-MM-DD');
    let timeSheetDateToCheckTo = moment().format('YYYY-MM-DD');
    
    Logger.info('Monthly date range', { 
      from: timeSheetDateToCheckFrom, 
      to: timeSheetDateToCheckTo 
    });
    
    // Get users to notify and send Slack message
    const usersToNotify = [...(await analyzeHarvestData(timeSheetDateToCheckFrom, timeSheetDateToCheckTo))];
    await slackNotify(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
    
    Logger.appEnd('monthly', 'Monthly notification completed');
    process.exit();
  } else {
    Logger.info('Skipping monthly notification - not last day of month');
    Logger.appEnd('monthly', 'Not last day of month');
    process.exit();
  }
}

// Execute the application
app();
