const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // For 1-to-1 chats. Null when the message belongs to a group.
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // For group chats. Null when the message is a direct message.
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    text: {
      type: String,
      trim: true,
      default: '',
    },
    fileUrl: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// A message must belong to either a direct receiver or a group, not neither.
messageSchema.pre('validate', function (next) {
  if (!this.receiver && !this.group) {
    return next(new Error('Message must have either a receiver or a group'));
  }
  if (!this.text && !this.fileUrl) {
    return next(new Error('Message must have text or a file'));
  }
  next();
});

// Useful indexes for chat history pagination
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ group: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
