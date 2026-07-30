const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { getMessages } = require('../controllers/message.controller');

// GET /api/messages/:conversationId?type=dm|group&page=1&limit=20
router.get('/:conversationId', protect, getMessages);

module.exports = router;
