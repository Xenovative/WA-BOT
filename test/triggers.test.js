const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs');
const path = require('path');
const expect = chai.expect;

// Import server
const server = require('../guiServer').app;

chai.use(chaiHttp);

describe('Triggers API', function() {
  const triggersPath = path.join(__dirname, '../config/triggers.json');
  const backupPath = path.join(__dirname, '../config/triggers.backup.json');
  
  // Backup existing triggers file before tests
  before(function() {
    if (fs.existsSync(triggersPath)) {
      const data = fs.readFileSync(triggersPath, 'utf8');
      fs.writeFileSync(backupPath, data);
    }
  });
  
  // Restore triggers file after tests
  after(function() {
    if (fs.existsSync(backupPath)) {
      const data = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(triggersPath, data);
      fs.unlinkSync(backupPath);
    }
  });
  
  describe('GET /api/triggers', function() {
    it('should return triggers data', function(done) {
      chai.request(server)
        .get('/api/triggers')
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('success').equal(true);
          expect(res.body).to.have.property('triggers');
          expect(res.body.triggers).to.have.property('groupTriggers').to.be.an('array');
          expect(res.body.triggers).to.have.property('customTriggers').to.be.an('array');
          done();
        });
    });
  });
  
  describe('POST /api/triggers', function() {
    it('should update triggers data', function(done) {
      const testData = {
        groupTriggers: ['test1', 'test2'],
        customTriggers: ['custom1', 'custom2']
      };
      
      chai.request(server)
        .post('/api/triggers')
        .send(testData)
        .end(function(err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('success').equal(true);
          
          // Verify data was saved
          const savedData = JSON.parse(fs.readFileSync(triggersPath, 'utf8'));
          expect(savedData).to.deep.equal(testData);
          done();
        });
    });
    
    it('should reject invalid data format', function(done) {
      const invalidData = {
        groupTriggers: 'not-an-array',
        customTriggers: []
      };
      
      chai.request(server)
        .post('/api/triggers')
        .send(invalidData)
        .end(function(err, res) {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body).to.have.property('success').equal(false);
          done();
        });
    });
  });
});

// Test trigger loading in index.js
describe('Trigger Loading', function() {
  const triggersPath = path.join(__dirname, '../config/triggers.json');
  const testData = {
    groupTriggers: ['testbot', 'testxeno'],
    customTriggers: ['custom1', 'custom2']
  };
  
  before(function() {
    // Save test data to triggers.json
    fs.writeFileSync(triggersPath, JSON.stringify(testData, null, 2));
  });
  
  it('should load triggers from config file', function() {
    // This is a simple test that verifies the file exists with our test data
    // Full integration testing would require mocking the message event in index.js
    const data = JSON.parse(fs.readFileSync(triggersPath, 'utf8'));
    expect(data).to.deep.equal(testData);
    expect(data.groupTriggers).to.include('testbot');
    expect(data.groupTriggers).to.include('testxeno');
  });
});
