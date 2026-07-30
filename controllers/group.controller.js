const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');

// @route  POST /api/groups
// @desc   Create a group. Creator becomes admin and is auto-added as a member.
// @access Private
const createGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    let members = Array.isArray(memberIds) ? memberIds : [];
    members = members.filter((id) => mongoose.Types.ObjectId.isValid(id));

    // Ensure the creator is always a member
    const memberSet = new Set([...members, req.user._id.toString()]);

    const group = await Group.create({
      name: name.trim(),
      members: Array.from(memberSet),
      admin: req.user._id,
    });

    const populatedGroup = await group.populate('members', 'name email avatar');

    res.status(201).json({ message: 'Group created successfully', group: populatedGroup });
  } catch (error) {
    console.error('Create group error:', error.message);
    res.status(500).json({ message: 'Server error while creating group' });
  }
};

// @route  POST /api/groups/:id/members
// @desc   Add a member to a group (admin only)
// @access Private
const addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid group or user id' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group admin can add members' });
    }

    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({ message: 'User to add was not found' });
    }

    if (group.members.some((m) => m.toString() === userId)) {
      return res.status(409).json({ message: 'User is already a member of this group' });
    }

    group.members.push(userId);
    await group.save();
    await group.populate('members', 'name email avatar');

    res.status(200).json({ message: 'Member added successfully', group });
  } catch (error) {
    console.error('Add member error:', error.message);
    res.status(500).json({ message: 'Server error while adding member' });
  }
};

// @route  DELETE /api/groups/:id/members/:userId
// @desc   Remove a member from a group (admin only, or a member removing themself)
// @access Private
const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid group or user id' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = group.admin.toString() === req.user._id.toString();
    const isSelfRemoval = req.user._id.toString() === userId;

    if (!isAdmin && !isSelfRemoval) {
      return res.status(403).json({ message: 'Not authorized to remove this member' });
    }

    if (group.admin.toString() === userId) {
      return res.status(400).json({ message: 'Cannot remove the group admin' });
    }

    const originalLength = group.members.length;
    group.members = group.members.filter((m) => m.toString() !== userId);

    if (group.members.length === originalLength) {
      return res.status(404).json({ message: 'User is not a member of this group' });
    }

    await group.save();
    await group.populate('members', 'name email avatar');

    res.status(200).json({ message: 'Member removed successfully', group });
  } catch (error) {
    console.error('Remove member error:', error.message);
    res.status(500).json({ message: 'Server error while removing member' });
  }
};

module.exports = { createGroup, addMember, removeMember };
