/**
 * @fileoverview Slack message templates for Harvest Notifier
 * 
 * This module contains all Slack message templates used by the Harvest Notifier system.
 * Templates are separated from business logic to make them easier to modify and maintain.
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

const moment = require('moment');

/**
 * Creates a daily timesheet reminder message
 * 
 * @param {Array} usersToNotify - Array of users with their Slack mentions and hours
 * @param {string} timeSheetDateToCheck - Date that was checked in YYYY-MM-DD format
 * @returns {Array} Slack blocks for the message
 */
function createDailyReminderMessage(usersToNotify, timeSheetDateToCheck) {
  return [
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
}

/**
 * Creates a weekly timesheet reminder message
 * 
 * @param {Array} usersToNotify - Array of users with their Slack mentions and hours
 * @param {string} timeSheetDateToCheckFrom - Start date of week in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date of week in YYYY-MM-DD format
 * @returns {Array} Slack blocks for the message
 */
function createWeeklyReminderMessage(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo) {
  return [
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
}

/**
 * Creates a monthly timesheet reminder message
 * 
 * @param {Array} usersToNotify - Array of users with their Slack mentions and hours
 * @param {string} timeSheetDateToCheckFrom - Start date of month in YYYY-MM-DD format
 * @param {string} timeSheetDateToCheckTo - End date of month in YYYY-MM-DD format
 * @returns {Array} Slack blocks for the message
 */
function createMonthlyReminderMessage(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo) {
  return [
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
}

module.exports = {
  createDailyReminderMessage,
  createWeeklyReminderMessage,
  createMonthlyReminderMessage,
};
