import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
	},
	testDir: 'e2e',
	
	// Reporter configuration
	reporter: process.env.CI ? 'html' : 'list',
	
	// Test configuration
	use: {
		// Base URL for all tests
		baseURL: 'http://localhost:4173',
		
		// Screenshot on failure (always in CI)
		screenshot: process.env.CI ? 'on' : 'only-on-failure',
		
		// Record trace on first retry
		trace: 'on-first-retry',
		
		// Video on first retry
		video: 'on-first-retry',
	},
	
	// Retry failed tests in CI
	retries: process.env.CI ? 2 : 0,
	
	// Parallel execution
	workers: process.env.CI ? 1 : undefined,
	
	// Project configuration
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
		},
		{
			name: 'mobile-chrome',
			use: { ...devices['Pixel 5'] },
		},
		{
			name: 'mobile-safari',
			use: { ...devices['iPhone 12'] },
		},
	],
	
	// Output directory for test artifacts
	outputDir: 'test-results',
});
