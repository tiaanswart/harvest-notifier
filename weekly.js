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



/**
 * Analyzes Harvest data for Dteligence team and identifies users with insufficient weekly hours
 * 
 * Compares each user's logged hours for the week against the weekly threshold
 * (5x the daily threshold) and returns a list of users who need to be notified.
 * 
 * @param {string} timeSheetDateToCheckFrom - Start date of week in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date of week in YYYY-MM-DD format
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
  
  // Get time reports for the specified week
  const harvestTeamTimeReport = await getHarvestTeamTimeReport(
    process.env.DTELIGENCE_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    timeSheetDateToCheckFrom,
    timeSheetDateToCheckTo
  );
  
  const usersToNotify = [];
  
  // Check each user's weekly hours against the threshold (5x daily threshold)
  harvestUsers.forEach((user) => {
    // Filter reports by user_id
    const timeReports = harvestTeamTimeReport.filter((t) => t.user_id === user.id);
    // Sum up the total_hours from each filtered report
    const totalHours = timeReports.reduce((sum, report) => sum + report.total_hours, 0);
    
    // If weekly hours are below threshold (5x daily threshold), add to notification list
    if (totalHours < process.env.MISSING_HOURS_THRESHOLD * 5) {
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
    const slackBlocks = createWeeklyReminderMessage(usersWithSlackMentions, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
    
    // Send message to Slack
    await sendSlackMessage(process.env.SLACK_CHANNEL, slackBlocks, process.env.SLACK_TOKEN);
  } else {
    return; // No users to notify
  }
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
  const weekday = moment().format('dddd');
  
  // Only run on Fridays
  if (['Friday'].includes(weekday)) {
    // Check the entire week (Monday to Friday)
    let timeSheetDateToCheckFrom = moment().startOf('week').add(1, 'days').format('YYYY-MM-DD');
    let timeSheetDateToCheckTo = moment().format('YYYY-MM-DD');
    
    // Get users to notify and send Slack message
    const usersToNotify = [...(await dteligence(timeSheetDateToCheckFrom, timeSheetDateToCheckTo))];
    await slackNotify(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo);
    process.exit();
  }
}

// Execute the application
app();
