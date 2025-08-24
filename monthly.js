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
 * Analyzes Harvest data for Dteligence team and identifies users with insufficient monthly hours
 * 
 * Compares each user's logged hours for the month against the monthly threshold
 * (workdays x daily threshold) and returns a list of users who need to be notified.
 * 
 * @param {string} timeSheetDateToCheckFrom - Start date of month in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date of month in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of users who need notification
 * @throws {Error} If API requests fail
 */
async function dteligence(timeSheetDateToCheckFrom, timeSheetDateToCheckTo) {
  console.log('dteligence');
  
  // Get active users from Harvest
  const harvestUsers = await getHarvestUsers(
    process.env.DTELIGENCE_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    process.env.DTELIGENCE_EMAILS_WHITELIST
  );
  
  // Get time reports for the specified month
  const harvestTeamTimeReport = await getHarvestTeamTimeReport(
    process.env.DTELIGENCE_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    timeSheetDateToCheckFrom,
    timeSheetDateToCheckTo
  );
  
  const usersToNotify = [];
  
  // Calculate expected workdays for the month
  const expectedWorkdays = workday_count(
    moment(timeSheetDateToCheckFrom),
    moment(timeSheetDateToCheckTo)
  );
  
  // Check each user's monthly hours against the threshold
  harvestUsers.forEach((user) => {
    // Filter reports by user_id
    const timeReports = harvestTeamTimeReport.filter((t) => t.user_id === user.id);
    // Sum up the total_hours from each filtered report
    const totalHours = timeReports.reduce((sum, report) => sum + report.total_hours, 0);
    
    // If monthly hours are below threshold (workdays x daily threshold), add to notification list
    if (
      totalHours <
      process.env.MISSING_HOURS_THRESHOLD * expectedWorkdays
    ) {
      usersToNotify.push({
        ...user,
        totalHours,
      });
    }
    console.log('usersToNotify', usersToNotify);
  });
  
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
  console.log('slackNotify');
  
  // Only proceed if there are users to notify
  if (usersToNotify && usersToNotify.length) {
    const slackUsers = await getSlackUsers(process.env.SLACK_TOKEN);
    
    // Match Harvest users with Slack users and format notification text
    const usersWithSlackMentions = matchUsersWithSlack(usersToNotify, slackUsers);
    
    console.log(
      'usersToNotify',
      usersWithSlackMentions.map((user) => user.slackUser)
    );
    
    // Create Slack message blocks using template
    const slackBlocks = createMonthlyReminderMessage(usersWithSlackMentions, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
    
    // Send message to Slack
    await sendSlackMessage(process.env.SLACK_CHANNEL, slackBlocks, process.env.SLACK_TOKEN);
  } else {
    return; // No users to notify
  }
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
  // Check if today is the last day of the month
  if (moment().format('YYYY-MM-DD') === moment().endOf('month').format('YYYY-MM-DD')) {
    // Check the entire month
    let timeSheetDateToCheckFrom = moment().startOf('month').format('YYYY-MM-DD');
    let timeSheetDateToCheckTo = moment().format('YYYY-MM-DD');
    
    // Get users to notify and send Slack message
    const usersToNotify = [...(await dteligence(timeSheetDateToCheckFrom, timeSheetDateToCheckTo))];
    await slackNotify(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
    process.exit();
  }
}

// Execute the application
app();
