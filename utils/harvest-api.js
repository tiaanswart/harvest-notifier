/**
 * @fileoverview Harvest API utilities for Harvest Notifier
 * 
 * This module contains shared Harvest API functions used across the Harvest Notifier system.
 * These functions are extracted from the individual notification modules to avoid duplication.
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

const fetch = require('node-fetch');

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

module.exports = {
  getHarvestUsers,
  getHarvestTeamTimeReport,
};
