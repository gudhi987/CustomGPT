import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Message subdocument schema
 */
const messageSchema = new mongoose.Schema(
  {
    message_id: {
      type: String,
      default: () => uuidv4(),
      required: true,
    },
    interaction_type: {
      type: String,
      enum: ['chat', 'completion'],
      required: true,
    },
    created_at: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
    message_content: {
      type: String,
      required: true,
    },
    parent_id: {
      type: String,
      default: 'root',
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'failure', 'interrupted'],
      default: 'success',
      required: true,
    },
  },
  { _id: false }
);

/**
 * Chat schema
 */
const chatSchema = new mongoose.Schema({
  chat_id: {
    type: String,
    default: () => uuidv4(),
    required: true,
    unique: true,
    index: true,
  },
  chat_name: {
    type: String,
    default: 'New Chat',
    required: true,
  },
  created_at: {
    type: Date,
    default: () => new Date(),
    required: true,
  },
  last_updated_at: {
    type: Date,
    default: () => new Date(),
    required: true,
    index: true,
  },
  config_name: {
    type: String,
    default: 'default',
    required: true,
  },
  messages: {
    type: [messageSchema],
    default: [],
  },
});

// Ensure proper indexing for performance
chatSchema.index({ last_updated_at: -1 });

/**
 * Create and export the Chat model
 */
const Chat = mongoose.model('Chat', chatSchema, 'chats');

export default Chat;
