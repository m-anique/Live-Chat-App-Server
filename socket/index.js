const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');

// In-memory map of userId -> Set of socket ids.
// A user can be connected from multiple tabs/devices, so we track a Set.
const userSocketMap = new Map();

const addUserSocket = (userId, socketId) => {
  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId).add(socketId);
};

const removeUserSocket = (userId, socketId) => {
  const set = userSocketMap.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    userSocketMap.delete(userId);
  }
};

const getSocketIdsForUser = (userId) => Array.from(userSocketMap.get(String(userId)) || []);

const isUserOnline = (userId) => userSocketMap.has(String(userId));

/**
 * Socket.IO authentication middleware.
 * Client should connect with: io(URL, { auth: { token: '<JWT>' } })
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: no token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('Authentication error: user not found'));
    }

    socket.userId = String(user._id);
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: invalid token'));
  }
};

const initSocket = (io) => {
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const { userId } = socket;
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);

    addUserSocket(userId, socket.id);

    // Also join a room named after the userId for simpler broadcasting
    socket.join(userId);

    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { isOnline: true },
        { new: true }
      );

      // Broadcast this user's online status to everyone else
      socket.broadcast.emit('user_status', {
        userId,
        isOnline: true,
        lastSeen: user?.lastSeen,
      });

      // Join rooms for all groups this user belongs to, so group broadcasts are easy
      const groups = await Group.find({ members: userId }).select('_id');
      groups.forEach((g) => socket.join(`group:${g._id}`));
    } catch (error) {
      console.error('Error marking user online:', error.message);
    }

    // ---------------------------------------------------------------
    // send_message
    // payload: { text, fileUrl, receiverId?, groupId? }
    // ---------------------------------------------------------------
    socket.on('send_message', async (payload, ack) => {
      try {

        console.log('📩 send_message received:', payload);
        const { text = '', fileUrl = '', receiverId = null, groupId = null } = payload || {};

        if (!receiverId && !groupId) {
          return ack?.({ success: false, error: 'receiverId or groupId is required' });
        }
        if (!text.trim() && !fileUrl) {
          return ack?.({ success: false, error: 'Message must have text or a file' });
        }

        // If it's a group message, verify sender is actually a member
        if (groupId) {
          const group = await Group.findById(groupId);
          if (!group) {
            return ack?.({ success: false, error: 'Group not found' });
          }
          if (!group.members.some((m) => m.toString() === userId)) {
            return ack?.({ success: false, error: 'You are not a member of this group' });
          }
        }

        const message = await Message.create({
          sender: userId,
          receiver: groupId ? null : receiverId,
          group: groupId || null,
          text: text.trim(),
          fileUrl,
          readBy: [userId],
        });

        const populatedMessage = await message.populate('sender', 'name avatar');

        if (groupId) {
          // Broadcast to everyone in the group room, including sender (for multi-device sync)
          io.to(`group:${groupId}`).emit('receive_message', populatedMessage);
        } else {
          // Send to all of the receiver's active sockets...
          io.to(String(receiverId)).emit('receive_message', populatedMessage);
          // ...and echo back to all of the sender's own sockets (multi-tab sync)
          io.to(userId).emit('receive_message', populatedMessage);
        }

        ack?.({ success: true, message: populatedMessage });
      } catch (error) {
        console.error('send_message error:', error.message);
        ack?.({ success: false, error: 'Failed to send message' });
      }
    });

    // ---------------------------------------------------------------
    // typing / stop_typing
    // payload: { receiverId? , groupId? }
    // ---------------------------------------------------------------
    socket.on('typing', ({ receiverId, groupId } = {}) => {
      const eventPayload = { userId, name: socket.user.name, groupId: groupId || null };
      if (groupId) {
        socket.to(`group:${groupId}`).emit('typing', eventPayload);
      } else if (receiverId) {
        socket.to(String(receiverId)).emit('typing', eventPayload);
      }
    });

    socket.on('stop_typing', ({ receiverId, groupId } = {}) => {
      const eventPayload = { userId, groupId: groupId || null };
      if (groupId) {
        socket.to(`group:${groupId}`).emit('stop_typing', eventPayload);
      } else if (receiverId) {
        socket.to(String(receiverId)).emit('stop_typing', eventPayload);
      }
    });

    // ---------------------------------------------------------------
    // join_group — call after creating/joining a group so the socket
    // starts receiving that group's broadcasts immediately
    // ---------------------------------------------------------------
    socket.on('join_group', (groupId) => {
      if (groupId) socket.join(`group:${groupId}`);
    });

    socket.on('leave_group', (groupId) => {
      if (groupId) socket.leave(`group:${groupId}`);
    });

    // ---------------------------------------------------------------
    // disconnect
    // ---------------------------------------------------------------
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);
      removeUserSocket(userId, socket.id);

      // Only mark the user offline if they have no other active sockets
      if (!isUserOnline(userId)) {
        try {
          const user = await User.findByIdAndUpdate(
            userId,
            { isOnline: false, lastSeen: new Date() },
            { new: true }
          );

          socket.broadcast.emit('user_status', {
            userId,
            isOnline: false,
            lastSeen: user?.lastSeen,
          });
        } catch (error) {
          console.error('Error marking user offline:', error.message);
        }
      }
    });
  });
};

module.exports = { initSocket, getSocketIdsForUser, isUserOnline };
