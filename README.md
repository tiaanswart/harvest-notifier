# Harvest Notifier

An automated integration between Harvest and Slack that sends friendly reminders to team members who haven't logged their working hours in Harvest.

## Overview

The Harvest Notifier system consists of three main modules that run on different schedules:

- **Daily Notifications** (`daily.js`) - Runs on weekdays to check the previous working day
- **Weekly Notifications** (`weekly.js`) - Runs on Fridays to check the entire week
- **Monthly Notifications** (`monthly.js`) - Runs on the last day of each month to check the entire month

## Features

- 🔄 **Automated Scheduling**: Different notification frequencies for different time periods
- 👥 **User Matching**: Automatically matches Harvest users with Slack users for personalized mentions
- 📊 **Flexible Thresholds**: Configurable hour thresholds for different notification types
- 🚫 **User Exclusion**: Whitelist system to exclude specific users from notifications
- 📱 **Rich Slack Messages**: Interactive Slack messages with buttons and formatted user mentions
- 📅 **Smart Date Logic**: Handles weekends, holidays, and partial weeks correctly

## Architecture

### File Structure

```
harvest-notifier/
├── app.js          # Main entry point (loads environment and exits)
├── daily.js        # Daily timesheet notifications
├── weekly.js       # Weekly timesheet notifications  
├── monthly.js      # Monthly timesheet notifications
├── package.json    # Dependencies and project metadata
└── README.md       # This documentation
```

### Core Functions

Each module contains the following core functions:

- `getHarvestUsers()` - Retrieves active users from Harvest API
- `getHarvestTeamTimeReport()` - Fetches time reports for a date range
- `getSlackUsers()` - Retrieves users from Slack workspace
- `analyzeHarvestData()` - Analyzes data and identifies users needing notifications
- `slackNotify()` - Sends formatted Slack notifications
- `app()` - Main application logic and scheduling

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd harvest-notifier
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following variables:

   ```env
   # Harvest API Configuration
   HARVEST_TOKEN=your_harvest_api_token
   HARVEST_ACCOUNT_ID=your_harvest_account_id
   
   # Slack Configuration
   SLACK_TOKEN=your_slack_bot_token
   SLACK_CHANNEL=your_slack_channel_id
   
   # Notification Settings
   MISSING_HOURS_THRESHOLD=8
   EMAILS_WHITELIST=user1@example.com,user2@example.com
   
   # Logging Configuration
   LOG_LEVEL=INFO
   ```

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `HARVEST_TOKEN` | Harvest API access token | `Bearer token from Harvest` |
| `HARVEST_ACCOUNT_ID` | Harvest account ID | `123456` |
| `SLACK_TOKEN` | Slack bot user OAuth token | `xoxb-token` |
| `SLACK_CHANNEL` | Slack channel ID to post notifications | `C1234567890` |
| `MISSING_HOURS_THRESHOLD` | Minimum hours required per day | `8` |
| `EMAILS_WHITELIST` | Comma-separated emails to exclude | `admin@company.com` |
| `LOG_LEVEL` | Logging verbosity level | `INFO` |

### API Permissions Required

#### Harvest API
- **Users**: Read access to retrieve team members
- **Reports**: Read access to retrieve time reports

#### Slack API
- **users:read**: To retrieve workspace users for matching
- **chat:write**: To post messages to channels
- **users:read.email**: To match users by email address

## Usage

### Manual Execution

Run any of the notification modules directly:

```bash
# Daily notifications
node daily.js

# Weekly notifications  
node weekly.js

# Monthly notifications
node monthly.js
```

### Scheduled Execution

Set up cron jobs or scheduled tasks to run the modules automatically:

```bash
# Daily at 9:00 AM on weekdays
0 9 * * 1-5 cd /path/to/harvest-notifier && node daily.js

# Weekly on Fridays at 5:00 PM
0 17 * * 5 cd /path/to/harvest-notifier && node weekly.js

# Monthly on the last day at 4:00 PM
0 16 28-31 * * [ "$(date +\%d -d tomorrow)" = "01" ] && cd /path/to/harvest-notifier && node monthly.js
```

## Notification Logic

### Daily Notifications (`daily.js`)

- **Schedule**: Runs on weekdays (Monday-Friday)
- **Check Period**: Previous working day
- **Logic**: 
  - Monday: checks Friday (3 days back)
  - Tuesday-Friday: checks previous day
- **Threshold**: `MISSING_HOURS_THRESHOLD` hours

### Weekly Notifications (`weekly.js`)

- **Schedule**: Runs on Fridays
- **Check Period**: Monday to Friday of current week
- **Threshold**: `MISSING_HOURS_THRESHOLD * 5` hours

### Monthly Notifications (`monthly.js`)

- **Schedule**: Runs on the last day of each month
- **Check Period**: First to last day of current month
- **Threshold**: `MISSING_HOURS_THRESHOLD * workdays_in_month` hours
- **Workday Calculation**: Excludes weekends using `workday_count()` function

## User Matching Logic

The system matches Harvest users with Slack users using the following criteria (in order):

1. **Real Name**: `slackUser.profile.real_name_normalized`
2. **Display Name**: `slackUser.profile.display_name_normalized`  
3. **Email Address**: `slackUser.profile.email`

If a match is found, the user is mentioned with `<@slack_user_id>`. If no match is found, the full name is displayed.

## Slack Message Format

Notifications include:

- **Header**: Friendly reminder message with team emoji
- **Date Range**: Clear indication of the period being checked
- **User List**: Formatted list of users with hours logged
- **Call to Action**: Instructions to report hours and react
- **Quick Action Button**: Direct link to Harvest time entry

## Error Handling

The system includes basic error handling:

- API request failures are logged to console
- Invalid responses are handled gracefully
- Missing environment variables will cause the application to fail early
- No notifications are sent if there are no users to notify

## Dependencies

- **dotenv**: Environment variable management
- **moment**: Date manipulation and formatting
- **node-fetch**: HTTP requests for API calls

## Development

### Customizing Notifications

Modify the `slackBlocks` array in the `slackNotify()` function to customize:

- Message content and tone
- Button actions and URLs
- Emoji usage
- Message formatting

## Troubleshooting

### Common Issues

1. **No notifications sent**
   - Check if users have logged sufficient hours
   - Verify environment variables are set correctly
   - Ensure API tokens have proper permissions

2. **User matching failures**
   - Verify Slack user profiles have correct names/emails
   - Check that Harvest user names match Slack display names

3. **API errors**
   - Validate API tokens and account IDs
   - Check network connectivity
   - Verify API rate limits

### Logging

The system includes comprehensive logging with different levels controlled by the `LOG_LEVEL` environment variable:

- **ERROR**: Only error messages
- **WARN**: Error and warning messages  
- **INFO**: Error, warning, and info messages (default)
- **DEBUG**: All messages including detailed debug information

#### Log Levels

- **ERROR**: Critical errors that prevent the application from functioning
- **WARN**: Warning messages for potential issues
- **INFO**: General information about application flow and results
- **DEBUG**: Detailed information for troubleshooting

#### Example Log Output

```
[2024-01-15T09:00:00.000Z] [INFO] Application Starting: daily
[2024-01-15T09:00:00.001Z] [INFO] Processing daily notification - weekday detected
[2024-01-15T09:00:00.002Z] [INFO] Fetching Harvest users
[2024-01-15T09:00:00.500Z] [INFO] API Response: Harvest 200
[2024-01-15T09:00:00.501Z] [DEBUG] Harvest users retrieved 15
[2024-01-15T09:00:00.502Z] [INFO] User Analysis: daily 15 3
[2024-01-15T09:00:00.503Z] [INFO] Notification Sent: daily 3 #timesheets
[2024-01-15T09:00:00.504Z] [INFO] Application Ending: daily
```

### Debug Mode

Set `LOG_LEVEL=DEBUG` in your environment variables to enable detailed logging for troubleshooting:

```bash
export LOG_LEVEL=DEBUG
node daily.js
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions, contact: tiaan.swart@sleeq.global
