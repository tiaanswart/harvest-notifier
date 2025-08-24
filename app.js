/**
 * @fileoverview Main entry point for the Harvest Notifier application
 * 
 * This file serves as the primary entry point for the Harvest Notifier system.
 * It loads environment variables and exits immediately, as the actual functionality
 * is implemented in separate modules (daily.js, weekly.js, monthly.js) that are
 * intended to be run as scheduled tasks.
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

require('dotenv').config();
process.exit();
