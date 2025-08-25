# Harvest Notifier

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-127%20passed-brightgreen.svg)](https://github.com/tiaanswart/harvest-notifier)
[![Coverage](https://img.shields.io/badge/coverage-99.08%25-brightgreen.svg)](https://github.com/tiaanswart/harvest-notifier)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/tiaanswart/harvest-notifier)
[![Maintenance](https://img.shields.io/badge/maintained-yes-green.svg)](https://github.com/tiaanswart/harvest-notifier)

An integration between Harvest and Slack that automatically reminds users who forget to mark their working hours in Harvest.

## Features

- **Unified Application**: Single application that handles daily, weekly, and monthly notifications
- **Smart Scheduling**: Automatically determines which notifications to run based on the current date
- **Daily Notifications**: Checks previous working day and sends Slack reminders (runs on weekdays)
- **Weekly Notifications**: Weekly summary of missing timesheet entries (runs on Fridays)
- **Monthly Notifications**: Monthly summary of missing timesheet entries (runs on last day of month)
- **Smart Date Logic**: Handles weekends and holidays appropriately
- **User Matching**: Automatically matches Harvest users with Slack users
- **Configurable Thresholds**: Set minimum hours threshold per day
- **Comprehensive Logging**: Detailed logging for monitoring and debugging
- **Template System**: Centralized Slack message templates for easy customization

## Installation

### Local Development

1. Clone the repository:

```bash
git clone https://github.com/tiaanswart/harvest-notifier.git
cd harvest-notifier
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (see Configuration section)

### Heroku Deployment

The application is designed to run on Heroku with automatic scheduling. Follow these steps to deploy:

#### Prerequisites

- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- [Git](https://git-scm.com/) installed
- Heroku account

#### Deployment Steps

1. **Login to Heroku:**

```bash
heroku login
```

2. **Create a new Heroku app:**

```bash
heroku create your-harvest-notifier-app
```

3. **Set up environment variables:**

```bash
heroku config:set HARVEST_ACCOUNT_ID=your_harvest_account_id
heroku config:set HARVEST_TOKEN=your_harvest_api_token
heroku config:set SLACK_TOKEN=your_slack_bot_token
heroku config:set SLACK_CHANNEL=#your_channel_name
heroku config:set MISSING_HOURS_THRESHOLD=8
heroku config:set EMAILS_WHITELIST=admin@example.com,manager@example.com
heroku config:set LOG_LEVEL=INFO
```

4. **Deploy the application:**

```bash
git push heroku main
```

5. **Verify deployment:**

```bash
heroku logs --tail
```

#### Scheduling with Heroku Scheduler

The application is designed to run once daily. Set up automatic scheduling:

1. **Add the Heroku Scheduler addon:**

```bash
heroku addons:create scheduler:standard
```

2. **Open the scheduler dashboard:**

```bash
heroku addons:open scheduler
```

3. **Configure the job:**
   - **Command:** `node app.js`
   - **Frequency:** Daily
   - **Time:** Choose a time when your team is typically available (e.g., 9:00 AM UTC)

#### Alternative: Manual Scheduling

If you prefer manual control, you can run the application manually:

```bash
heroku run node app.js
```

#### Monitoring and Logs

**View application logs:**

```bash
heroku logs --tail
```

**View scheduler logs:**

```bash
heroku logs --tail --source scheduler
```

**Check app status:**

```bash
heroku ps
```

**Restart the application:**

```bash
heroku restart
```

#### Environment Variables on Heroku

You can view and manage environment variables through the Heroku dashboard or CLI:

**View all config vars:**

```bash
heroku config
```

**Set a single config var:**

```bash
heroku config:set VARIABLE_NAME=value
```

**Remove a config var:**

```bash
heroku config:unset VARIABLE_NAME
```

#### Scaling and Performance

The application is lightweight and designed to run once daily. Default Heroku dyno settings are sufficient:

- **Dyno Type:** Free or Hobby dyno
- **Memory:** 512MB (default)
- **CPU:** Shared (default)

For production use, consider:
- **Hobby Dyno:** $7/month for 24/7 uptime
- **Standard Dyno:** $25/month for better performance

#### Heroku Configuration (app.json)

The project includes an `app.json` file that automatically configures the Heroku deployment:

- **App Name:** Harvest Notifier
- **Description:** Automatic notification script for Slack based on Harvest data
- **Stack:** heroku-24
- **Addons:** scheduler:standard (automatically added)
- **Buildpack:** heroku/nodejs

This configuration ensures:
- Proper Node.js environment setup
- Automatic scheduler addon installation
- Correct environment variable descriptions
- Optimal deployment settings

#### Troubleshooting

**Common Issues:**

1. **Application crashes on startup:**
   - Check environment variables are set correctly
   - Verify API tokens are valid
   - Check logs: `heroku logs --tail`

2. **Scheduler not running:**
   - Verify scheduler addon is installed
   - Check scheduler logs: `heroku logs --source scheduler`
   - Ensure command is correct: `node app.js`

3. **API errors:**
   - Verify Harvest and Slack tokens
   - Check API rate limits
   - Review application logs

**Useful Commands:**

```bash
# Check app status
heroku ps

# View recent logs
heroku logs --num 100

# Run app manually for testing
heroku run node app.js

# Check environment variables
heroku config

# Restart the application
heroku restart
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Harvest Configuration
HARVEST_ACCOUNT_ID=your_harvest_account_id
HARVEST_TOKEN=your_harvest_api_token

# Slack Configuration
SLACK_TOKEN=your_slack_bot_token
SLACK_CHANNEL=#your_channel_name

# Application Settings
MISSING_HOURS_THRESHOLD=8
EMAILS_WHITELIST=admin@example.com,manager@example.com
LOG_LEVEL=INFO
```

### Environment Variables

- `HARVEST_ACCOUNT_ID`: Your Harvest account ID
- `HARVEST_TOKEN`: Your Harvest API token
- `SLACK_TOKEN`: Your Slack bot token
- `SLACK_CHANNEL`: The Slack channel to send notifications to
- `MISSING_HOURS_THRESHOLD`: Minimum hours required per day (default: 8)
- `DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD`: Minimum weekly capacity (in hours) required for users to receive daily notifications. Users below this threshold will only receive weekly and monthly notifications (default: 0 - all users get daily notifications)
- `EMAILS_WHITELIST`: Comma-separated list of email addresses to exclude from notifications
- `LOG_LEVEL`: Logging level (ERROR, WARN, INFO, DEBUG)

### User Filtering Logic

The system automatically filters users based on their weekly capacity:

1. **Zero Capacity Users**: Users with `weekly_capacity` of 0, null, or undefined are completely excluded from all notifications (daily, weekly, and monthly)
2. **Daily Notification Threshold**: Users with weekly capacity below `DAILY_NOTIFICATION_WEEKLY_CAPACITY_THRESHOLD` only receive weekly and monthly notifications
3. **Active Users**: Users with weekly capacity > 0 receive notifications based on their personalized thresholds

## Usage

### Running the Application

The application is designed to be run once daily via a cron job or scheduler. It automatically determines which notifications to run based on the current date:

```bash
node app.js
```

### Notification Schedule

The application automatically determines which notifications to run:

- **Daily**: Runs on weekdays (Monday-Friday), checks the previous working day
- **Weekly**: Runs on Fridays, checks the entire week (Monday-Friday)
- **Monthly**: Runs on the last day of the month, checks the entire month

### Example Scenarios

- **Monday**: Runs daily notification (checks Friday)
- **Friday**: Runs daily notification (checks Thursday) + weekly notification (checks Monday-Friday)
- **Last day of month**: Runs daily + weekly + monthly notifications
- **Weekend**: No notifications run

### Testing Different Scenarios

You can test how the application handles different dates:

```bash
npm run test-scenarios
```

### Development

**Start the application:**

```bash
npm start
```

**Generate documentation:**

```bash
npm run docs
```

**Serve documentation:**

```bash
npm run docs:serve
```

## Testing

The project includes a comprehensive test suite built with **Vitest**, a modern test runner that's fully compatible with ES modules.

### Running Tests

**Run all tests:**

```bash
npm test
```

**Run tests in watch mode:**

```bash
npm run test:watch
```

**Run tests with coverage:**

```bash
npm run test:coverage
```

**Run specific tests:**

```bash
npm run test -- test/utils/logger.test.js
```

**Note:** The project uses ES modules with node-fetch v3 for security. Vitest provides excellent ES module support and fast test execution.

### Test Structure

The test suite is organized as follows:

```
test/
├── app.test.js               # Main application tests ✅
├── integration.test.js       # End-to-end workflow tests ✅
├── utils/
│   ├── logger.test.js        # Logger utility tests ✅
│   ├── harvest-api.test.js   # Harvest API utility tests ✅
│   └── slack-api.test.js     # Slack API utility tests ✅
└── templates/
    └── slack-templates.test.js # Slack message template tests ✅
```

**Status:**

- ✅ **All Tests Passing**: Complete test suite (127 tests passing)
- ✅ **Production Ready**: All functionality thoroughly tested and working

**Note:** The test suite provides comprehensive coverage of all application functionality including API calls, data processing, template generation, logging, and complete workflow integration.

**The application is fully tested and ready for production use!** 🎯

**Current Test Results:**

- **Total Tests**: 127
- **Passing**: 127 (100%)
- **Failing**: 0 (0%)
- **Working Test Files**: 6/6

**All Test Categories - ✅ ALL PASSING:**

- ✅ Logger utility tests (24 tests)
- ✅ Slack template tests (20 tests)
- ✅ Harvest API utility tests (17 tests)
- ✅ Slack API utility tests (23 tests)
- ✅ Integration tests (15 tests)
- ✅ Application tests (28 tests)

### Test Coverage

The test suite covers:

- **Unit Tests**: Individual function and module testing
- **Integration Tests**: Complete workflow testing
- **API Testing**: Mocked external API interactions
- **Error Handling**: Graceful error recovery
- **Edge Cases**: Boundary conditions and unusual scenarios
- **Environment Variables**: Configuration testing

### Test Features

- **Mocking**: External dependencies are mocked for reliable testing
- **Environment Isolation**: Tests run in isolated environment
- **Comprehensive Coverage**: High test coverage across all modules
- **Error Scenarios**: Tests for various failure modes
- **Performance**: Fast test execution with parallel processing

### Testing Approach

#### Mocking Strategy

External dependencies are mocked to ensure:

- **Reliability**: Tests don't depend on external services
- **Speed**: No network calls during testing
- **Isolation**: Tests can run independently
- **Predictability**: Consistent test results

**Mocked Dependencies:**

- `node-fetch` - HTTP requests
- `moment` - Date/time operations (where needed)
- External APIs (Harvest, Slack)

#### Test Patterns

Tests follow the AAA pattern (Arrange-Act-Assert):

```javascript
test('should filter active users', async () => {
  // Arrange
  const mockResponse = { users: [...] };
  fetch.mockResolvedValue(mockResponse);

  // Act
  const result = await getHarvestUsers(accountId, token);

  // Assert
  expect(result).toHaveLength(2);
  expect(result[0].is_active).toBe(true);
});
```

## Slack Templates

The project uses a centralized template system that separates Slack message templates from business logic for easier modification.

### Template Structure

All Slack message templates are centralized in `templates/slack-templates.js`. This makes it easy to modify the appearance and content of Slack messages without touching the business logic.

### Available Template Functions

1. **`createDailyReminderMessage(usersToNotify, timeSheetDateToCheck)`**

   - Creates daily timesheet reminder messages
   - Used by the main application for daily notifications

2. **`createWeeklyReminderMessage(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo)`**

   - Creates weekly timesheet reminder messages
   - Used by the main application for weekly notifications

3. **`createMonthlyReminderMessage(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo)`**
   - Creates monthly timesheet reminder messages
   - Used by the main application for monthly notifications

### Template Structure

Each template function returns an array of Slack blocks that define the message structure:

```javascript
function createDailyReminderMessage(usersToNotify, timeSheetDateToCheck) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Your message text here',
      },
    },
    // ... more blocks
  ];
}
```

### Common Elements

All templates include:

- Header section with team greeting
- Date range information
- List of users with insufficient hours
- Call-to-action text
- "Report Time" button linking to Harvest

### Customizing Templates

To modify a template:

1. **Change text content**: Edit the `text` property in the relevant block
2. **Add new sections**: Insert new block objects in the array
3. **Modify styling**: Change block types or add formatting
4. **Update buttons**: Modify the actions block elements

### Example: Adding a New Section

```javascript
function createDailyReminderMessage(usersToNotify, timeSheetDateToCheck) {
  return [
    // ... existing blocks
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'New custom section here',
      },
    },
    // ... rest of blocks
  ];
}
```

### Example: Changing Message Tone

```javascript
function createDailyReminderMessage(usersToNotify, timeSheetDateToCheck) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Good morning team! 🌅 Just a quick reminder to update your timesheets in Harvest. Keeping accurate time records helps us track project progress effectively.*',
      },
    },
    // ... rest of blocks
  ];
}
```

### Benefits of Template System

1. **Separation of Concerns**: Business logic is separate from presentation
2. **Easy Maintenance**: All templates in one place
3. **Consistency**: Shared styling and structure across all notifications
4. **Version Control**: Template changes are clearly tracked
5. **Testing**: Templates can be tested independently

## API Documentation

Generate and view API documentation:

```bash
npm run docs
npm run docs:serve
```

Documentation will be available at `http://localhost:8080`

## Architecture

The application is structured with the following modules:

- **`app.js`**: Main unified application that handles all notification types
- **`utils/harvest-api.js`**: Harvest API integration
- **`utils/slack-api.js`**: Slack API integration
- **`utils/logger.js`**: Structured logging utility
- **`templates/slack-templates.js`**: Slack message templates

### Project Structure

```
harvest-notifier/
├── app.js                     # Main unified application
├── templates/
│   └── slack-templates.js     # All Slack message templates
├── utils/
│   ├── harvest-api.js         # Shared Harvest API functions
│   ├── slack-api.js           # Shared Slack API functions
│   └── logger.js              # Structured logging utility
├── test/                      # Comprehensive test suite
│   ├── utils/                 # Unit tests for utilities
│   ├── templates/             # Template tests
│   └── integration.test.js    # End-to-end tests
└── docs/                      # Generated documentation
```

### Legacy Files (Deprecated)

The following files are kept for reference but are no longer used:

- **`daily.js`**: Legacy daily notification module
- **`weekly.js`**: Legacy weekly notification module  
- **`monthly.js`**: Legacy monthly notification module

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please open an issue on GitHub or contact tiaan.swart@sleeq.global
