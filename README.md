# Harvest Slack Notifier

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/tiaanswart/harvest-notifier)

Harvest Slack Notifier is an automated integration between Harvest time tracking and Slack that sends intelligent reminders to team members who haven't logged their working hours. This Node.js application runs on Heroku Scheduler and helps ensure consistent time tracking across your organization.

## 🚀 Features

### Report Types

- **Daily Reports**: Generated on weekdays (except Monday) to notify users who haven't logged time for the previous day
- **Weekly Reports**: Generated every Friday to notify users who haven't logged sufficient hours for the entire week
- **Monthly Reports**: Generated on the last day of each month to notify users who haven't logged sufficient hours for the month

### Key Capabilities

- ✅ **Smart User Matching**: Automatically matches Harvest users with Slack users by name or email
- ✅ **Mention Integration**: Directly mentions users in Slack for immediate attention
- ✅ **Quick Action Buttons**: One-click access to Harvest time entry
- ✅ **Flexible Thresholds**: Configurable minimum hour requirements
- ✅ **Whitelist Support**: Exclude specific users (managers, admins) from notifications
- ✅ **Multi-Account Support**: Handle multiple Harvest accounts (DTELIGENCE, SLEEQ_DIGITAL)
- ✅ **Workday Calculation**: Intelligent calculation of expected working days for monthly reports

## 📋 Prerequisites

Before setting up the Harvest Slack Notifier, ensure you have:

- A Harvest account with API access
- A Slack workspace with admin permissions
- A Heroku account (free tier works)
- Node.js knowledge (for local development/testing)

## 🔧 Installation & Setup

### Step 1: Harvest API Setup

1. **Create Personal Access Token**:
   - Go to [Harvest Developer Portal](https://id.getharvest.com/developers)
   - Create a new Personal Access Token
   - Note down your Account ID (found in your Harvest account settings)

2. **Verify API Access**:
   - Ensure your token has access to:
     - User data (for team member information)
     - Time reports (for checking logged hours)

### Step 2: Slack App Configuration

1. **Create Slack App**:
   - Visit [Slack API Apps](https://api.slack.com/apps)
   - Click "Create New App" → "From scratch"
   - Name your app (e.g., "Harvest Notifier")
   - Select your workspace

2. **Configure Bot Permissions**:
   - Go to "OAuth & Permissions" in the sidebar
   - Add the following Bot Token Scopes:
     ```
     chat:write
     users:read
     users:read.email
     ```
   - Install the app to your workspace
   - Copy the "Bot User OAuth Token" (starts with `xoxb-`)

3. **Add Bot to Channel**:
   - Invite the bot to the channel where you want notifications
   - Note the channel name (e.g., `#timesheets`)

### Step 3: Deploy to Heroku

#### Option A: One-Click Deploy (Recommended)

1. Click the "Deploy to Heroku" button above
2. Fill in the required environment variables (see Configuration section)
3. Deploy the application

#### Option B: Manual Deploy

```bash
# Clone the repository
git clone https://github.com/tiaanswart/harvest-notifier.git
cd harvest-notifier

# Create Heroku app
heroku create your-harvest-notifier

# Set environment variables
heroku config:set HARVEST_TOKEN=your-harvest-token
heroku config:set DTELIGENCE_HARVEST_ACCOUNT_ID=your-account-id
heroku config:set SLACK_TOKEN=xoxb-your-slack-token
heroku config:set SLACK_CHANNEL=#your-channel

# Deploy
git push heroku main
```

### Step 4: Configure Environment Variables

Set the following environment variables in your Heroku app:

#### Required Variables

```bash
# Harvest Configuration
HARVEST_TOKEN=your-harvest-personal-access-token
DTELIGENCE_HARVEST_ACCOUNT_ID=your-harvest-account-id
SLEEQ_DIGITAL_HARVEST_ACCOUNT_ID=your-second-account-id

# Slack Configuration
SLACK_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=#your-notification-channel
```

#### Optional Variables

```bash
# User Whitelists (comma-separated emails)
DTELIGENCE_EMAILS_WHITELIST=manager@company.com,admin@company.com
SLEEQ_DIGITAL_EMAILS_WHITELIST=manager@company.com,admin@company.com

# Hour Thresholds
MISSING_HOURS_THRESHOLD=1.0
```

### Step 5: Configure Heroku Scheduler

1. **Add Scheduler Add-on**:
   ```bash
   heroku addons:create scheduler:standard
   ```

2. **Configure Jobs**:
   - Open Heroku Scheduler dashboard
   - Add the following jobs:

   **Daily Report** (runs every weekday at 9:00 AM):
   ```
   node daily.js
   ```

   **Weekly Report** (runs every Friday at 10:00 AM):
   ```
   node weekly.js
   ```

   **Monthly Report** (runs daily at 11:00 AM - will only execute on month end):
   ```
   node monthly.js
   ```

## ⚙️ Configuration Details

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `HARVEST_TOKEN` | Yes | Personal access token from Harvest | `harvest-token-here` |
| `DTELIGENCE_HARVEST_ACCOUNT_ID` | Yes | Primary Harvest account ID | `1234567` |
| `SLEEQ_DIGITAL_HARVEST_ACCOUNT_ID` | Yes | Secondary Harvest account ID | `7654321` |
| `SLACK_TOKEN` | Yes | Bot user OAuth token from Slack | `xoxb-token-here` |
| `SLACK_CHANNEL` | Yes | Channel name for notifications | `#timesheets` |
| `DTELIGENCE_EMAILS_WHITELIST` | No | Comma-separated emails to exclude | `admin@company.com,manager@company.com` |
| `SLEEQ_DIGITAL_EMAILS_WHITELIST` | No | Comma-separated emails to exclude | `admin@company.com,manager@company.com` |
| `MISSING_HOURS_THRESHOLD` | No | Minimum hours before notification (default: 1.0) | `2.5` |

### Report Scheduling Logic

#### Daily Reports (`daily.js`)
- **When**: Weekdays (Tuesday-Friday)
- **Checks**: Previous day's hours
- **Threshold**: `MISSING_HOURS_THRESHOLD` hours
- **Special Case**: Monday checks Friday's hours (3 days back)

#### Weekly Reports (`weekly.js`)
- **When**: Every Friday
- **Checks**: Monday to Friday of current week
- **Threshold**: `MISSING_HOURS_THRESHOLD * 5` hours (5 workdays)

#### Monthly Reports (`monthly.js`)
- **When**: Last day of each month
- **Checks**: Entire month
- **Threshold**: `MISSING_HOURS_THRESHOLD * workdays_in_month`
- **Workday Calculation**: Excludes weekends automatically

## 🏗️ Architecture Overview

### Project Structure

```
harvest-notifier/
├── app.js              # Main entry point (minimal)
├── daily.js            # Daily report logic
├── weekly.js           # Weekly report logic
├── monthly.js          # Monthly report logic
├── package.json        # Dependencies and metadata
├── app.json           # Heroku deployment configuration
└── README.md          # This documentation
```

### Core Functions

#### Harvest Integration
- `getHarvestUsers()`: Fetches active users from Harvest API
- `getHarvestTeamTimeReport()`: Retrieves time reports for specified date range
- User filtering with whitelist support

#### Slack Integration
- `getSlackUsers()`: Fetches workspace users from Slack API
- `slackNotify()`: Sends formatted notifications with user mentions
- Automatic user matching by name or email

#### Business Logic
- `dteligence()`: Main processing function for each report type
- Workday calculation for monthly reports
- Threshold-based filtering

### Data Flow

1. **Scheduler Trigger** → Script execution
2. **Date Calculation** → Determine report period
3. **Harvest API Calls** → Fetch users and time data
4. **Data Processing** → Filter users below threshold
5. **Slack User Matching** → Match Harvest users to Slack users
6. **Notification Generation** → Create formatted Slack message
7. **Slack API Call** → Send notification to channel

## 🔍 Troubleshooting

### Common Issues

#### "No notifications being sent"

**Possible Causes:**
- All users have logged sufficient hours
- Environment variables not set correctly
- Scheduler jobs not configured

**Debugging Steps:**
1. Check Heroku logs: `heroku logs --tail`
2. Verify environment variables: `heroku config`
3. Test manually: `heroku run node daily.js`

#### "Users not being mentioned in Slack"

**Possible Causes:**
- Name mismatch between Harvest and Slack
- Email addresses don't match
- Slack user is inactive or deleted

**Solutions:**
1. Ensure Harvest user names match Slack display names
2. Verify email addresses are consistent
3. Check Slack user status

#### "Incorrect hour calculations"

**Possible Causes:**
- Wrong `MISSING_HOURS_THRESHOLD` value
- Timezone issues
- Date range calculation errors

**Solutions:**
1. Verify threshold value in environment variables
2. Check date formatting in logs
3. Ensure consistent timezone handling

### Log Analysis

The application provides detailed console logging. Key log messages:

- `getHarvestUsers`: User fetching process
- `getHarvestTeamTimeReport`: Time report retrieval
- `getSlackUsers`: Slack user fetching
- `dteligence`: Main processing function
- `slackNotify`: Notification sending
- `usersToNotify`: List of users to be notified

### Manual Testing

Test individual scripts locally:

```bash
# Set up environment variables
export HARVEST_TOKEN=your-token
export DTELIGENCE_HARVEST_ACCOUNT_ID=your-account-id
export SLACK_TOKEN=your-slack-token
export SLACK_CHANNEL=#your-channel

# Test daily report
node daily.js

# Test weekly report
node weekly.js

# Test monthly report
node monthly.js
```

## 🔒 Security Considerations

### API Token Security
- Never commit tokens to version control
- Use Heroku environment variables for all sensitive data
- Rotate tokens regularly
- Use minimal required permissions

### Data Privacy
- Only active users are processed
- Whitelist functionality prevents unnecessary notifications
- User data is not stored persistently

### Rate Limiting
- Harvest API: Respect rate limits (100 requests per 15 seconds)
- Slack API: Respect rate limits (50 requests per second)
- Built-in delays and error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Setup

```bash
# Clone repository
git clone https://github.com/tiaanswart/harvest-notifier.git
cd harvest-notifier

# Install dependencies
npm install

# Create .env file for local testing
cp .env.example .env
# Edit .env with your test credentials

# Run tests (when implemented)
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review Heroku logs for error details
3. Open an issue on GitHub with:
   - Error messages
   - Environment configuration (without sensitive data)
   - Steps to reproduce

## 🔄 Version History

- **v1.0.0**: Initial release with daily, weekly, and monthly reports
- Support for multiple Harvest accounts
- Slack integration with user mentions
- Configurable thresholds and whitelists

---

**Note**: This application is designed for automated time tracking compliance. Ensure your team is aware of the notification system and has proper time tracking policies in place.
