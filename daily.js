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

require('dotenv').config();
const moment = require('moment');
const { getHarvestUsers, getHarvestTeamTimeReport } = require('./utils/harvest-api');
const { getSlackUsers, sendSlackMessage, matchUsersWithSlack } = require('./utils/slack-api');
const { createDailyReminderMessage } = require('./templates/slack-templates');



/**
 * Analyzes Harvest data for Dteligence team and identifies users with insufficient hours
 * 
 * Compares each user's logged hours against the threshold and returns a list
 * of users who need to be notified about missing timesheet entries.
 * 
 * @param {string} timeSheetDateToCheck - Date to check in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of users who need notification
 * @throws {Error} If API requests fail
 */
async function dteligence(timeSheetDateToCheck) {
  console.log('dteligence');
  
  // Get active users from Harvest
  const harvestUsers = await getHarvestUsers(
    process.env.DTELIGENCE_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    process.env.DTELIGENCE_EMAILS_WHITELIST
  );
  
  // Get time reports for the specified date
  const harvestTeamTimeReport = await getHarvestTeamTimeReport(
    process.env.DTELIGENCE_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    timeSheetDateToCheck,
    timeSheetDateToCheck
  );
  
  const usersToNotify = [];
  
  // Check each user's hours against the threshold
  harvestUsers.forEach((user) => {
    // Filter reports by user_id
    const timeReports = harvestTeamTimeReport.filter((t) => t.user_id === user.id);
    // Sum up the total_hours from each filtered report
    const totalHours = timeReports.reduce((sum, report) => sum + report.total_hours, 0);
    
    // If hours are below threshold, add to notification list
    if (totalHours < process.env.MISSING_HOURS_THRESHOLD) {
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
    const slackBlocks = createDailyReminderMessage(usersWithSlackMentions, timeSheetDateToCheck);
    
    // Send message to Slack
    await sendSlackMessage(process.env.SLACK_CHANNEL, slackBlocks, process.env.SLACK_TOKEN);
  } else {
    return; // No users to notify
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
 * @returns {Promise<void>}
 */
async function app() {
  let timeSheetDateToCheck;
  const weekday = moment().format('dddd');
  
  // Only run on weekdays
  if (!['Saturday', 'Sunday'].includes(weekday)) {
    // Determine which date to check based on current day
    if (['Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday)) {
      // Check previous day
      timeSheetDateToCheck = moment().subtract(1, 'days').format('YYYY-MM-DD');
    } else {
      // Monday: check Friday (3 days back)
      timeSheetDateToCheck = moment().subtract(3, 'days').format('YYYY-MM-DD');
    }
    
    // Get users to notify and send Slack message
    const usersToNotify = [...(await dteligence(timeSheetDateToCheck))];
    await slackNotify(usersToNotify, timeSheetDateToCheck);
    process.exit();
  }
}

// Execute the application
app();
