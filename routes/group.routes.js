const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { createGroup, addMember, removeMember } = require('../controllers/group.controller');

router.post('/', protect, createGroup);
router.post('/:id/members', protect, addMember);
router.delete('/:id/members/:userId', protect, removeMember);

module.exports = router;
