# Testing Documentation

This document provides comprehensive information about the test suite for the Harvest Notifier project.

## Overview

The test suite is built using a **custom test runner** that's compatible with ES modules and provides comprehensive coverage of all modules and functionality. The tests are designed to be fast, reliable, and maintainable.

**Note:** The project uses ES modules with node-fetch v3 for security. Tests use a custom test runner that's compatible with ES modules.

## Test Structure

```
test/
├── minimal.test.js            # Basic functionality tests
├── simple.test.js             # Simple test examples
├── integration.test.js        # End-to-end workflow tests
├── daily.test.js             # Daily notification module tests
├── utils/
│   ├── logger.test.js        # Logger utility tests
│   ├── harvest-api.test.js   # Harvest API utility tests
│   └── slack-api.test.js     # Slack API utility tests
└── templates/
    └── slack-templates.test.js # Slack message template tests
```

## Test Categories

### 1. Unit Tests

Unit tests focus on testing individual functions and modules in isolation.

**Files:**
- `test/utils/logger.test.js`
- `test/utils/harvest-api.test.js`
- `test/utils/slack-api.test.js`
- `test/templates/slack-templates.test.js`

**Coverage:**
- Function input/output validation
- Error handling
- Edge cases
- Boundary conditions
- Mocked external dependencies

### 2. Integration Tests

Integration tests verify that different modules work together correctly.

**Files:**
- `test/integration.test.js`
- `test/daily.test.js`

**Coverage:**
- Complete workflow testing
- Module interaction
- Data flow between components
- Environment variable integration
- Error recovery scenarios

### 3. End-to-End Tests

E2E tests simulate real-world usage scenarios.

**Coverage:**
- Full daily notification workflow
- API integration (mocked)
- Slack message generation
- User matching logic
- Date calculation logic

## Testing Approach

### Mocking Strategy

External dependencies are mocked to ensure:
- **Reliability**: Tests don't depend on external services
- **Speed**: No network calls during testing
- **Isolation**: Tests can run independently
- **Predictability**: Consistent test results

**Mocked Dependencies:**
- `node-fetch` - HTTP requests
- `moment` - Date/time operations (where needed)
- External APIs (Harvest, Slack)

### Test Data

Test data is structured to cover various scenarios:

```javascript
const mockHarvestUsers = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    is_active: true
  },
  // ... more users
];

const mockTimeReports = [
  {
    user_id: 1,
    total_hours: 5.5,
    date: '2024-01-15'
  },
  // ... more reports
];
```

### Environment Setup

Tests use isolated environment variables:

```javascript
beforeEach(() => {
  process.env.HARVEST_ACCOUNT_ID = 'test-account-id';
  process.env.HARVEST_TOKEN = 'test-harvest-token';
  process.env.SLACK_TOKEN = 'test-slack-token';
  process.env.SLACK_CHANNEL = '#general';
  process.env.MISSING_HOURS_THRESHOLD = '8';
  process.env.EMAILS_WHITELIST = 'admin@example.com';
});
```

## Running Tests

### Prerequisites

Install dependencies:
```bash
npm install
```

### Basic Test Commands

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

**Note:** These commands use `node --experimental-vm-modules` to support ES modules with Jest.

### Advanced Test Commands

**Run specific test file:**
```bash
npx jest test/utils/logger.test.js
```

**Run tests matching a pattern:**
```bash
npx jest --testNamePattern="should log error messages"
```

**Run tests with verbose output:**
```bash
npx jest --verbose
```

**Run tests in parallel:**
```bash
npx jest --maxWorkers=4
```

## Test Coverage

The test suite aims for high coverage across:

- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 95%+
- **Lines**: 90%+

### Coverage Reports

After running `npm run test:coverage`, coverage reports are available in:
- **Console**: Summary in terminal output
- **HTML**: Detailed report in `coverage/lcov-report/index.html`
- **LCOV**: Machine-readable format in `coverage/lcov.info`

## Test Patterns

### 1. Arrange-Act-Assert

Tests follow the AAA pattern:

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

### 2. Descriptive Test Names

Test names clearly describe the scenario:

```javascript
test('should handle users with multiple time entries', async () => {
  // Test implementation
});

test('should not send notifications when no users need to be notified', async () => {
  // Test implementation
});
```

### 3. Setup and Teardown

Proper setup and cleanup:

```javascript
beforeEach(() => {
  jest.clearAllMocks();
  // Set up test environment
});

afterEach(() => {
  // Clean up after each test
});

afterAll(() => {
  // Final cleanup
});
```

## Error Testing

### API Error Scenarios

Tests cover various error conditions:

```javascript
test('should handle API error', async () => {
  fetch.mockRejectedValue(new Error('API Error'));
  
  await expect(getHarvestUsers(accountId, token))
    .rejects.toThrow('API Error');
});
```

### Edge Cases

Tests handle boundary conditions:

```javascript
test('should handle empty users array', async () => {
  const mockResponse = { users: [] };
  fetch.mockResolvedValue(mockResponse);
  
  const result = await getHarvestUsers(accountId, token);
  expect(result).toHaveLength(0);
});
```

## Performance Considerations

### Test Execution Speed

- **Parallel Execution**: Tests run in parallel where possible
- **Mocked Dependencies**: No real network calls
- **Minimal Setup**: Efficient test setup and teardown
- **Focused Tests**: Each test covers a specific scenario

### Memory Management

- **Mock Cleanup**: Mocks are cleared between tests
- **Environment Reset**: Environment variables are reset
- **Resource Cleanup**: Proper cleanup in afterEach/afterAll hooks

## Continuous Integration

### CI/CD Integration

The test suite is designed to work in CI/CD environments:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test

- name: Generate coverage report
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

Recommended pre-commit hooks:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test",
      "pre-push": "npm run test:coverage"
    }
  }
}
```

## Debugging Tests

### Debug Mode

Run tests in debug mode:

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Verbose Output

Get detailed test output:

```bash
npm test -- --verbose --no-coverage
```

### Test Isolation

Run a single test in isolation:

```bash
npx jest --testNamePattern="specific test name" --verbose
```

## Best Practices

### Writing Tests

1. **Test One Thing**: Each test should verify one specific behavior
2. **Descriptive Names**: Test names should clearly describe the scenario
3. **Arrange-Act-Assert**: Follow the AAA pattern for test structure
4. **Mock External Dependencies**: Don't rely on external services
5. **Test Edge Cases**: Include boundary conditions and error scenarios

### Maintaining Tests

1. **Keep Tests Simple**: Avoid complex test logic
2. **Update Tests with Code**: Modify tests when changing functionality
3. **Review Test Coverage**: Regularly check coverage reports
4. **Refactor Tests**: Keep tests clean and maintainable

### Test Data Management

1. **Use Constants**: Define test data as constants
2. **Avoid Hardcoded Values**: Use descriptive variable names
3. **Keep Data Minimal**: Use only necessary test data
4. **Document Test Data**: Explain complex test scenarios

## Troubleshooting

### Common Issues

**Tests Failing Intermittently:**
- Check for shared state between tests
- Ensure proper cleanup in afterEach hooks
- Verify mock resets

**Slow Test Execution:**
- Check for unnecessary network calls
- Ensure all external dependencies are mocked
- Consider running tests in parallel

**Coverage Issues:**
- Add tests for uncovered code paths
- Check for conditional logic that's not tested
- Verify error handling scenarios

### Debug Commands

```bash
# Run specific test with debugging
npx jest --testNamePattern="test name" --verbose --no-coverage

# Check test configuration
npx jest --showConfig

# Run tests with detailed output
npx jest --verbose --detectOpenHandles
```

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**: For Slack message templates
2. **Performance Testing**: Load testing for API endpoints
3. **Contract Testing**: API contract validation
4. **Mutation Testing**: Test quality validation
5. **E2E Testing**: Real browser testing with Playwright

### Test Automation

1. **Automated Test Generation**: Generate tests from API specifications
2. **Test Data Factories**: Automated test data generation
3. **Visual Test Reports**: Enhanced test reporting
4. **Test Metrics**: Track test quality metrics over time

## Conclusion

The test suite provides comprehensive coverage of the Harvest Notifier application, ensuring reliability, maintainability, and confidence in the codebase. Regular test execution and maintenance are essential for long-term project success.
