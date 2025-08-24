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

import fetch from 'node-fetch';
import Logger from './logger.js';

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
  Logger.functionEntry('getHarvestUsers', { accountId, excludedUsers });

  Logger.apiRequest('Harvest', 'GET /v2/users', { accountId });
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
  Logger.apiResponse('Harvest', response.status, { usersCount: data.users?.length || 0 });

  // Handle case where data.users is undefined or null
  if (!data.users || !Array.isArray(data.users)) {
    Logger.functionExit('getHarvestUsers', {
      totalUsers: 0,
      activeUsers: 0,
      excludedUsers: excludedUsers ? excludedUsers.split(',').length : 0,
    });
    return [];
  }

  const filteredUsers = data.users.filter(
    (user) => user.is_active && (!excludedUsers || !excludedUsers.split(',').includes(user.email))
  );

  Logger.functionExit('getHarvestUsers', {
    totalUsers: data.users?.length || 0,
    activeUsers: filteredUsers.length,
    excludedUsers: excludedUsers ? excludedUsers.split(',').length : 0,
  });

  return filteredUsers;
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
  Logger.functionEntry('getHarvestTeamTimeReport', { accountId, dateFrom, dateTo });

  Logger.apiRequest('Harvest', 'GET /v2/reports/time/team', { accountId, dateFrom, dateTo });
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
  Logger.apiResponse('Harvest', response.status, { resultsCount: data.results?.length || 0 });

  Logger.functionExit('getHarvestTeamTimeReport', {
    resultsCount: data.results?.length || 0,
  });

  // Handle case where data.results is undefined or null
  return data.results || [];
}

export { getHarvestUsers, getHarvestTeamTimeReport };
