const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User = require('../models/User');

// @route  GET /api/users
// @desc   List all users except the currently logged-in user
// @access Private
router.get('/', protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('name email avatar isOnline lastSeen')
      .sort({ name: 1 });

    res.status(200).json({ users });
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

module.exports = router;
