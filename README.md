# Slack Reminder

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/tiaanswart/harvest-notifier)

Slack Reminder is an integration between Harvest and Slack which automatically reminds users who forget to mark their working hours in Harvest.

This is a NodeJs app for installation on Daily Heroku Scheduler.
Notification is determined from Harvest API V2.

## Features

There are 2 types of reports: Daily and Weekly.

- Daily Report is generated on weekdays (except Monday) and shows those users who did not fill in their time for that day.

(Coming soon)
- Weekly Report is generated every Monday and shows those users who still need to report the required working hours for last week.

This integration allows to:
- mention users in the Slack
- quickly report the working hours from the link
- set up custom report schedule
- configure a whitelist which consists of users, who don't need to be notified in Slack

## Quick Start

1. Prepare access tokens
  * Create Personal Access Tokens on [Harvest](https://id.getharvest.com/developers).
  * Create [Slack app](https://api.slack.com/apps). You can find official guide [here](https://slack.com/intl/en-ru/resources/using-slack/app-launch).
  * Create Bot User OAuth Access Token
  * Add following scopes to Bot:
      ```bash
      chat:write
      users:read
      users:read.email
      ```
  * Add app to Slack channel.

2. [Deploy to Heroku](https://heroku.com/deploy?template=https://github.com/tiaanswart/harvest-notifier)

3. Configure following ENV variables
    ```bash
    heroku config:set HARVEST_TOKEN=harvest-token
    heroku config:set HARVEST_ACCOUNT_ID=harvest-account-id
    heroku config:set SLACK_TOKEN=slack-bot-token
    heroku config:set SLACK_CHANNEL=slack-channel
    heroku config:set EMAILS_WHITELIST=user1@example.com, user2@example.com, user3@example.com
    # EMAILS_WHITELIST is a variable that lists emails separated by commas, which don't need to be notified in Slack.
    # For example, administrators or managers.
    heroku config:set MISSING_HOURS_THRESHOLD=1.0
    # MISSING_HOURS_THRESHOLD is a variable that indicates the minimum threshold of hours at which the employee will not be notified in Slack.
    # For example, 2.5 or 4. The default threshold is 1 hour. Leave empty if satisfied with the default value.
    ```

4. Add job in Heroku Scheduler

  * ```node daily.js``` for daily report