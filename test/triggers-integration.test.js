/**
 * Integration tests for the triggers tab UI
 * 
 * These tests simulate user interactions with the triggers UI
 * and verify that the UI behaves as expected.
 * 
 * To run these tests, you'll need to:
 * 1. Install puppeteer: npm install --save-dev puppeteer
 * 2. Start the server: node index.js
 * 3. Run the tests: npx mocha test/triggers-integration.test.js
 */

const puppeteer = require('puppeteer');
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');

describe('Triggers UI Integration Tests', function() {
  // Set timeout for tests
  this.timeout(10000);
  
  let browser;
  let page;
  const serverUrl = 'http://localhost:3000';
  const triggersPath = path.join(__dirname, '../config/triggers.json');
  const backupPath = path.join(__dirname, '../config/triggers.backup.json');
  
  // Backup existing triggers file before tests
  before(async function() {
    if (fs.existsSync(triggersPath)) {
      const data = fs.readFileSync(triggersPath, 'utf8');
      fs.writeFileSync(backupPath, data);
    }
    
    // Set up test data
    const testData = {
      groupTriggers: ['bot', 'xeno'],
      customTriggers: []
    };
    fs.writeFileSync(triggersPath, JSON.stringify(testData, null, 2));
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });
  
  // Restore triggers file and close browser after tests
  after(async function() {
    if (fs.existsSync(backupPath)) {
      const data = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(triggersPath, data);
      fs.unlinkSync(backupPath);
    }
    
    await browser.close();
  });
  
  it('should load the triggers tab and display existing triggers', async function() {
    await page.goto(`${serverUrl}/#triggers`);
    await page.waitForSelector('#triggers');
    
    // Wait for triggers to load
    await page.waitForSelector('#groupTriggersList .list-group-item');
    
    // Check if triggers are displayed
    const triggerTexts = await page.$$eval('#groupTriggersList .trigger-text', elements => 
      elements.map(el => el.textContent)
    );
    
    expect(triggerTexts).to.include('bot');
    expect(triggerTexts).to.include('xeno');
  });
  
  it('should add a new group trigger', async function() {
    await page.goto(`${serverUrl}/#triggers`);
    await page.waitForSelector('#triggers');
    
    // Add a new trigger
    await page.type('#newGroupTrigger', 'testtrigger');
    await page.click('#addGroupTrigger');
    
    // Wait for the new trigger to appear
    await page.waitForFunction(
      () => document.querySelector('#groupTriggersList').textContent.includes('testtrigger')
    );
    
    // Verify the trigger was added
    const triggerTexts = await page.$$eval('#groupTriggersList .trigger-text', elements => 
      elements.map(el => el.textContent)
    );
    
    expect(triggerTexts).to.include('testtrigger');
  });
  
  it('should edit an existing trigger', async function() {
    await page.goto(`${serverUrl}/#triggers`);
    await page.waitForSelector('#triggers');
    
    // Wait for triggers to load
    await page.waitForSelector('#groupTriggersList .list-group-item');
    
    // Click edit button on the first trigger
    await page.click('#groupTriggersList .edit-trigger');
    
    // Wait for edit input to appear
    await page.waitForSelector('.edit-trigger-input');
    
    // Clear input and type new value
    await page.evaluate(() => document.querySelector('.edit-trigger-input').value = '');
    await page.type('.edit-trigger-input', 'editedtrigger');
    
    // Click save button
    await page.click('.save-trigger');
    
    // Wait for the edited trigger to appear
    await page.waitForFunction(
      () => document.querySelector('#groupTriggersList').textContent.includes('editedtrigger')
    );
    
    // Verify the trigger was edited
    const triggerTexts = await page.$$eval('#groupTriggersList .trigger-text', elements => 
      elements.map(el => el.textContent)
    );
    
    expect(triggerTexts).to.include('editedtrigger');
  });
  
  it('should delete a trigger', async function() {
    await page.goto(`${serverUrl}/#triggers`);
    await page.waitForSelector('#triggers');
    
    // Wait for triggers to load
    await page.waitForSelector('#groupTriggersList .list-group-item');
    
    // Get initial trigger count
    const initialCount = await page.$$eval('#groupTriggersList .list-group-item', items => items.length);
    
    // Click delete button on the first trigger
    await page.click('#groupTriggersList .delete-trigger');
    
    // Wait for the trigger list to update
    await page.waitForFunction(
      (count) => document.querySelectorAll('#groupTriggersList .list-group-item').length < count,
      {},
      initialCount
    );
    
    // Verify the trigger was deleted
    const newCount = await page.$$eval('#groupTriggersList .list-group-item', items => items.length);
    expect(newCount).to.be.lessThan(initialCount);
  });
  
  it('should save triggers to the server', async function() {
    await page.goto(`${serverUrl}/#triggers`);
    await page.waitForSelector('#triggers');
    
    // Wait for triggers to load
    await page.waitForSelector('#groupTriggersList .list-group-item');
    
    // Add a new unique trigger
    const uniqueTrigger = 'uniquesavetrigger' + Date.now();
    await page.type('#newGroupTrigger', uniqueTrigger);
    await page.click('#addGroupTrigger');
    
    // Wait for the new trigger to appear
    await page.waitForFunction(
      (trigger) => document.querySelector('#groupTriggersList').textContent.includes(trigger),
      {},
      uniqueTrigger
    );
    
    // Click save button
    await page.click('#saveTriggers');
    
    // Wait for success toast (or some indication of success)
    await page.waitForTimeout(1000); // Wait for save to complete
    
    // Verify the trigger was saved to the file
    const savedData = JSON.parse(fs.readFileSync(triggersPath, 'utf8'));
    expect(savedData.groupTriggers).to.include(uniqueTrigger);
  });
});
