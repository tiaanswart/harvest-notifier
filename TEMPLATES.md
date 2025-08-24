# Slack Templates Documentation

This document explains the new template structure for the Harvest Notifier system, which separates Slack message templates from business logic for easier modification.

## Structure

The project now has the following structure for templates and utilities:

```
harvest-notifier/
├── templates/
│   └── slack-templates.js      # All Slack message templates
├── utils/
│   ├── harvest-api.js          # Shared Harvest API functions
│   └── slack-api.js            # Shared Slack API functions
├── daily.js                    # Daily notification logic
├── weekly.js                   # Weekly notification logic
└── monthly.js                  # Monthly notification logic
```

## Modifying Slack Templates

All Slack message templates are now centralized in `templates/slack-templates.js`. This makes it easy to modify the appearance and content of Slack messages without touching the business logic.

### Available Template Functions

1. **`createDailyReminderMessage(usersToNotify, timeSheetDateToCheck)`**

   - Creates daily timesheet reminder messages
   - Used by `daily.js`

2. **`createWeeklyReminderMessage(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo)`**

   - Creates weekly timesheet reminder messages
   - Used by `weekly.js`

3. **`createMonthlyReminderMessage(usersToNotify, timeSheetDateToCheckFrom, timeSheetDateToCheckTo)`**
   - Creates monthly timesheet reminder messages
   - Used by `monthly.js`

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

## Benefits of This Structure

1. **Separation of Concerns**: Business logic is separate from presentation
2. **Easy Maintenance**: All templates in one place
3. **Consistency**: Shared styling and structure across all notifications
4. **Version Control**: Template changes are clearly tracked
5. **Testing**: Templates can be tested independently

## Shared Utilities

The `utils/` directory contains shared functions used across all notification modules:

- **`harvest-api.js`**: Harvest API calls (getHarvestUsers, getHarvestTeamTimeReport)
- **`slack-api.js`**: Slack API calls (getSlackUsers, sendSlackMessage, matchUsersWithSlack)

These utilities eliminate code duplication and ensure consistent behavior across all notification types.

## Migration Notes

The refactoring maintains the same functionality while improving code organization:

- All existing environment variables and configuration remain the same
- API endpoints and data processing logic are unchanged
- Only the internal structure has been reorganized for better maintainability
