/**
 * @fileoverview Slack API utilities for Harvest Notifier
 * 
 * This module contains shared Slack API functions used across the Harvest Notifier system.
 * These functions are extracted from the individual notification modules to avoid duplication.
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

const fetch = require('node-fetch');
const Logger = require('./logger');

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
  Logger.functionEntry('getSlackUsers');
  
  Logger.apiRequest('Slack', 'GET /api/users.list');
  const response = await fetch('https://slack.com/api/users.list', {
    method: 'get',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  Logger.apiResponse('Slack', response.status, { 
    membersCount: data.members?.length || 0,
    ok: data.ok 
  });
  
  const filteredUsers = data.members.filter((user) => !user.deleted && !user.is_bot);
  
  Logger.functionExit('getSlackUsers', { 
    totalMembers: data.members?.length || 0, 
    activeMembers: filteredUsers.length 
  });
  
  return filteredUsers;
}

/**
 * Sends a message to Slack using the chat.postMessage API
 * 
 * @param {string} channel - The Slack channel to send the message to
 * @param {Array} blocks - The Slack blocks for the message
 * @param {string} token - The Slack API token
 * @returns {Promise<Object>} The response from Slack API
 * @throws {Error} If the API request fails
 */
async function sendSlackMessage(channel, blocks, token) {
  Logger.functionEntry('sendSlackMessage', { channel, blocksCount: blocks?.length || 0 });
  
  Logger.apiRequest('Slack', 'POST /api/chat.postMessage', { channel });
  const response = await fetch(
    `https://slack.com/api/chat.postMessage?channel=${channel}&blocks=${encodeURIComponent(JSON.stringify(blocks))}&pretty=1`,
    {
      method: 'post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        charset: 'utf-8',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  
  const data = await response.json();
  Logger.apiResponse('Slack', response.status, { 
    ok: data.ok,
    ts: data.ts,
    channel: data.channel 
  });
  
  Logger.functionExit('sendSlackMessage', { 
    success: data.ok,
    messageTs: data.ts 
  });
  
  return data;
}

/**
 * Matches Harvest users with Slack users and formats notification text
 * 
 * @param {Array} usersToNotify - Array of Harvest users to notify
 * @param {Array} slackUsers - Array of Slack users
 * @returns {Array} Array of users with formatted Slack mentions
 */
function matchUsersWithSlack(usersToNotify, slackUsers) {
  Logger.functionEntry('matchUsersWithSlack', { 
    usersToNotifyCount: usersToNotify.length, 
    slackUsersCount: slackUsers.length 
  });
  
  const matchedUsers = usersToNotify.map((user) => {
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
    
    return user;
  });
  
  const matchedCount = matchedUsers.filter(user => user.slackUser.includes('<@')).length;
  Logger.functionExit('matchUsersWithSlack', { 
    totalUsers: usersToNotify.length,
    matchedCount,
    unmatchedCount: usersToNotify.length - matchedCount
  });
  
  return matchedUsers;
}

module.exports = {
  getSlackUsers,
  sendSlackMessage,
  matchUsersWithSlack,
};
