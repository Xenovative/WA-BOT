const express = require('express');
const router = express.Router();

const { getRecipients, getCooldown, isConfigured } = require('../utils/alertNotifier');

router.get('/status', (req, res) => {
  res.json({
    configured: isConfigured(),
    recipients: getRecipients(),
    cooldownMs: getCooldown()
  });
});

module.exports = router;
