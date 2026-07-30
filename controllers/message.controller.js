const mongoose = require('mongoose');
const Message = require('../models/Message');
const Group = require('../models/Group');

// @route  GET /api/messages/:conversationId?type=dm|group&page=1&limit=20
// @desc   Fetch paginated chat history.
//         If type=dm, :conversationId is the OTHER user's id (messages between them and req.user).
//         If type=group, :conversationId is the group's id (req.user must be a member).
// @access Private
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const type = req.query.type === 'group' ? 'group' : 'dm';
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversationId' });
    }

    let filter;

    if (type === 'group') {
      const group = await Group.findById(conversationId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
      const isMember = group.members.some((m) => m.toString() === req.user._id.toString());
      if (!isMember) {
        return res.status(403).json({ message: 'You are not a member of this group' });
      }
      filter = { group: conversationId };
    } else {
      filter = {
        $or: [
          { sender: req.user._id, receiver: conversationId },
          { sender: conversationId, receiver: req.user._id },
        ],
      };
    }

    // Fetch newest first, then reverse so the client can render top-to-bottom
    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name avatar')
        .lean(),
      Message.countDocuments(filter),
    ]);

    res.status(200).json({
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error.message);
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
};

module.exports = { getMessages };
