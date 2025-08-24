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
const fetch = require('node-fetch');
const moment = require('moment');

/**
 * Retrieves active users from Harvest API
 * 
 * Fetches all users from the Harvest account and filters out inactive users
 * and users in the exclusion list (whitelist).
 * 
 * @param {string} accountId - The Harvest account ID
 * @param {string} token - The Harvest API token
 * @param {string} excludedUsers - Comma-separated list of email addresses to exclude
 * @returns {Promise<Array>} Array of active Harvest users
 * @throws {Error} If the API request fails
 */
async function getHarvestUsers(accountId, token, excludedUsers) {
  console.log('getHarvestUsers');
  const response = await fetch('https://api.harvestapp.com/v2/users', {
    method: 'get',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Harvest-Account-Id': accountId,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  return data.users.filter(
    (user) => user.is_active && (!excludedUsers || !excludedUsers.split(',').includes(user.email))
  );
}

/**
 * Retrieves team time reports from Harvest API for a specific date range
 * 
 * Fetches time entries for all users within the specified date range.
 * 
 * @param {string} accountId - The Harvest account ID
 * @param {string} token - The Harvest API token
 * @param {string} dateFrom - Start date in YYYY-MM-DD format
 * @param {string} dateTo - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of time report entries
 * @throws {Error} If the API request fails
 */
async function getHarvestTeamTimeReport(accountId, token, dateFrom, dateTo) {
  console.log('getHarvestTeamTimeReport');
  const response = await fetch(
    `https://api.harvestapp.com/v2/reports/time/team?from=${dateFrom}&to=${dateTo}`,
    {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Harvest-Account-Id': accountId,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();
  return data.results;
}

/**
 * Retrieves users from Slack workspace
 * 
 * Fetches all users from the Slack workspace and filters out deleted users and bots.
 * 
 * @param {string} token - The Slack API token
 * @returns {Promise<Array>} Array of active Slack users
 * @throws {Error} If the API request fails
 */
async function getSlackUsers(token) {
  console.log('getSlackUsers');
  const response = await fetch('https://slack.com/api/users.list', {
    method: 'get',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  return data.members.filter((user) => !user.deleted && !user.is_bot);
}

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
    usersToNotify.forEach((user) => {
      const fullName = `${user.first_name} ${user.last_name}`;
      const slackUser = slackUsers.find(
        (slackUser) =>
          [
            slackUser.profile.real_name_normalized.toLowerCase(),
            slackUser.profile.display_name_normalized.toLowerCase(),
          ].includes(fullName.toLowerCase()) ||
          (slackUser.profile.email || '').toLowerCase() === user.email.toLowerCase()
      );
      
      // Format user mention with hours logged
      user.slackUser = slackUser
        ? `<@${slackUser.id}> (Hours logged: ${user.totalHours})`
        : `${fullName} (Hours logged: ${user.totalHours})`;
    });
    
    console.log(
      'usersToNotify',
      usersToNotify.map((user) => user.slackUser)
    );
    
    // Create Slack message blocks
    const slackBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*Hi there :sleeq: team! Here's a friendly reminder to complete your timesheets in Harvest. Remember to report your working hours every day to help us keep track of our progress.*",
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `We noticed that the following people haven't reported all their working hours between ${moment(
            timeSheetDateToCheckFrom
          ).format('MMMM Do YYYY')} and ${moment(timeSheetDateToCheckTo).format('MMMM Do YYYY')}:`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• ${usersToNotify.map((user) => user.slackUser).join('\n• ')}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please take a moment to report your hours and react with :heavy_check_mark: to confirm that you have completed your timesheet. Thank you for your cooperation!',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':clock5: Report Time',
              emoji: true,
            },
            value: 'report_time',
            url: 'https://harvestapp.com/time',
            action_id: 'button-action',
            style: 'primary',
          },
        ],
      },
    ];
    
    // Send message to Slack
    const response = await fetch(
      `https://slack.com/api/chat.postMessage?channel=${
        process.env.SLACK_CHANNEL
      }&blocks=${encodeURIComponent(JSON.stringify(slackBlocks))}&pretty=1`,
      {
        method: 'post',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          charset: 'utf-8',
          Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
        },
      }
    );
    const data = await response.json();
    console.log('slackResponse', data);
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
