#! /app/.heroku/node/bin/node
const fetch = require('node-fetch');
const moment = require('moment');
async function getHarvestUsers(accountId, token, excludedUsers) {
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
async function getHarvestTeamTimeReport(accountId, token, dateFrom, dateTo) {
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
async function getSlackUsers(token) {
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
async function dteligence(timeSheetDateToCheck) {
  const harvestUsers = await getHarvestUsers(
    process.env.DTELIGENCE_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    process.env.DTELIGENCE_EMAILS_WHITELIST
  );
  const harvestTeamTimeReport = await getHarvestTeamTimeReport(
    process.env.DTELIGENCE_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    timeSheetDateToCheck,
    timeSheetDateToCheck
  );
  const usersToNotify = [];
  harvestUsers.forEach((user) => {
    const timeReport = harvestTeamTimeReport.find((t) => t.user_id === user.id);
    if (!timeReport || timeReport.total_hours < 8) {
      usersToNotify.push(user);
    }
  });
  return usersToNotify;
}
async function sleeqDigital(timeSheetDateToCheck) {
  const harvestUsers = await getHarvestUsers(
    process.env.SLEEQ_DIGITAL_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    process.env.SLEEQ_DIGITAL_EMAILS_WHITELIST
  );
  const harvestTeamTimeReport = await getHarvestTeamTimeReport(
    process.env.SLEEQ_DIGITAL_HARVEST_ACCOUNT_ID,
    process.env.HARVEST_TOKEN,
    timeSheetDateToCheck,
    timeSheetDateToCheck
  );
  const usersToNotify = [];
  harvestUsers.forEach((user) => {
    const timeReport = harvestTeamTimeReport.find((t) => t.user_id === user.id);
    if (!timeReport || timeReport.total_hours < process.env.MISSING_HOURS_THRESHOLD) {
      usersToNotify.push(user);
    }
  });
  return usersToNotify;
}
async function slackNotify(usersToNotify, timeSheetDateToCheck) {
  if (usersToNotify && usersToNotify.length) {
    const slackUsers = await getSlackUsers(process.env.SLACK_TOKEN);
    usersToNotify.forEach((user) => {
      const fullName = `${user.first_name} ${user.last_name}`;
      const slackUser = slackUsers.find((slackUser) =>
        [
          slackUser.profile.real_name_normalized.toLowerCase(),
          slackUser.profile.display_name_normalized.toLowerCase(),
        ].includes(fullName.toLowerCase())
      );
      user.slackUser = slackUser
        ? `@${slackUser.profile.display_name_normalized || slackUser.profile.real_name_normalized}`
        : fullName;
    });
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
          text: `We noticed that the following people haven't reported their working hours for ${moment(
            timeSheetDateToCheck
          ).format('MMMM Do YYYY')}:`,
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
  } else return;
}
async function app() {
  let timeSheetDateToCheck;
  const weekday = moment().format('dddd');
  if (!['Saturday', 'Sunday'].includes(weekday)) {
    if (['Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday)) {
      timeSheetDateToCheck = moment().subtract(1, 'days').format('YYYYMMDD');
    } else {
      timeSheetDateToCheck = moment().subtract(3, 'days').format('YYYYMMDD');
    }
    const usersToNotify = [
      ...(await dteligence(timeSheetDateToCheck)),
      ...(await sleeqDigital(timeSheetDateToCheck)),
    ];
    await slackNotify(usersToNotify, timeSheetDateToCheck);
    process.exit();
  }
}
app();
