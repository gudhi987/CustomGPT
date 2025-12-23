import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Chat from '../models/chat.js';
import { checkDBHealth } from '../db.js';

const router = express.Router();

/**
 * GET /dbhealth
 * Check database connectivity
 * Returns 200 if healthy, 503 if not
 */
router.get('/dbhealth', async (req, res) => {
  try {
    const isHealthy = await checkDBHealth();
    if (isHealthy) {
      return res.status(200).json({ ok: true, message: 'Database is healthy' });
    } else {
      return res.status(503).json({ ok: false, message: 'Database is unavailable' });
    }
  } catch (error) {
    console.error('DB health check error:', error);
    return res.status(503).json({ ok: false, message: 'Database health check failed', error: error.message });
  }
});

/**
 * POST /chats
 * Create a new chat
 * Request body: { chat_name?: string, config_name?: string, interaction_type: 'chat' | 'completion' }
 * Returns: { chat_id, chat_name, created_at, ... }
 */
router.post('/chats', async (req, res) => {
  try {
    const isHealthy = await checkDBHealth();
    if (!isHealthy) {
      return res.status(503).json({
        ok: false,
        message: 'Database unavailable. Chat created locally only.',
        error: 'DB_UNAVAILABLE',
      });
    }

    const { chat_name = 'New Chat', config_name = 'default', interaction_type } = req.body || {};

    // Create system message as the root message
    const systemMessage = {
      message_id: 'root',
      role: 'system',
      interaction_type: 'chat',
      created_at: new Date(),
      message_content: '',
      parent_id: '',
      status: 'success',
    };

    // Create new chat document with the system message
    const newChat = new Chat({
      chat_id: uuidv4(),
      chat_name,
      config_name,
      created_at: new Date(),
      last_updated_at: new Date(),
      messages: [systemMessage],
    });

    const savedChat = await newChat.save();

    return res.status(201).json({
      ok: true,
      chat_id: savedChat.chat_id,
      chat_name: savedChat.chat_name,
      created_at: savedChat.created_at,
      config_name: savedChat.config_name,
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    return res.status(503).json({
      ok: false,
      message: 'Failed to create chat',
      error: error.message,
    });
  }
});

/**
 * GET /chats
 * List all chats (id, name, last_updated_at)
 * Query params: limit (default 50), skip (default 0)
 * Returns: { ok: true, chats: [...] }
 */
router.get('/chats', async (req, res) => {
  try {
    const isHealthy = await checkDBHealth();
    if (!isHealthy) {
      return res.status(503).json({
        ok: false,
        message: 'Database unavailable',
        error: 'DB_UNAVAILABLE',
      });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const skip = parseInt(req.query.skip) || 0;

    const chats = await Chat.find({}, { chat_id: 1, chat_name: 1, last_updated_at: 1, created_at: 1 })
      .sort({ last_updated_at: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Chat.countDocuments();

    return res.status(200).json({
      ok: true,
      chats,
      total,
      limit,
      skip,
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return res.status(503).json({
      ok: false,
      message: 'Failed to fetch chats',
      error: error.message,
    });
  }
});

/**
 * GET /chats/:id
 * Fetch a specific chat with all messages
 * Returns: { ok: true, chat: { chat_id, chat_name, created_at, last_updated_at, config_name, messages } }
 */
router.get('/chats/:id', async (req, res) => {
  try {
    const isHealthy = await checkDBHealth();
    if (!isHealthy) {
      return res.status(503).json({
        ok: false,
        message: 'Database unavailable',
        error: 'DB_UNAVAILABLE',
      });
    }

    const { id } = req.params;
    const chat = await Chat.findOne({ chat_id: id }).lean();

    if (!chat) {
      return res.status(404).json({
        ok: false,
        message: 'Chat not found',
        error: 'CHAT_NOT_FOUND',
      });
    }

    return res.status(200).json({
      ok: true,
      chat,
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return res.status(503).json({
      ok: false,
      message: 'Failed to fetch chat',
      error: error.message,
    });
  }
});

/**
 * POST /chats/:id/messages
 * Append a message to a chat
 * Request body: { role: 'system' | 'user' | 'assistant', interaction_type: 'chat' | 'completion', message_content: string, parent_id?: string, status?: 'success' | 'failure' | 'interrupted' }
 * Returns: { ok: true, message_id, chat: { ... } }
 */
router.post('/chats/:id/messages', async (req, res) => {
  try {
    const isHealthy = await checkDBHealth();
    if (!isHealthy) {
      return res.status(503).json({
        ok: false,
        message: 'Database unavailable. Message not persisted.',
        error: 'DB_UNAVAILABLE',
      });
    }

    const { id } = req.params;
    const { role, interaction_type, message_content, parent_id = 'root', status = 'success' } = req.body || {};

    // Validate required fields
    if (!role || !interaction_type || !message_content) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: role, interaction_type, and message_content',
        error: 'INVALID_INPUT',
      });
    }

    // Check chat exists
    const chat = await Chat.findOne({ chat_id: id });
    if (!chat) {
      return res.status(404).json({
        ok: false,
        message: 'Chat not found',
        error: 'CHAT_NOT_FOUND',
      });
    }

    // Create message object
    const newMessage = {
      message_id: uuidv4(),
      role,
      interaction_type,
      created_at: new Date(),
      message_content,
      parent_id,
      status,
    };

    // Atomic operation: push message and update last_updated_at
    const updatedChat = await Chat.findOneAndUpdate(
      { chat_id: id },
      {
        $push: { messages: newMessage },
        $set: { last_updated_at: new Date() },
      },
      { new: true, lean: true }
    );

    return res.status(201).json({
      ok: true,
      message_id: newMessage.message_id,
      chat: updatedChat,
    });
  } catch (error) {
    console.error('Error appending message:', error);
    return res.status(503).json({
      ok: false,
      message: 'Failed to append message',
      error: error.message,
    });
  }
});

/**
 * PATCH /chats/:id
 * Update chat metadata (name, config_name)
 * Request body: { chat_name?: string, config_name?: string }
 * Returns: { ok: true, chat: { ... } }
 */
router.patch('/chats/:id', async (req, res) => {
  try {
    const isHealthy = await checkDBHealth();
    if (!isHealthy) {
      return res.status(503).json({
        ok: false,
        message: 'Database unavailable',
        error: 'DB_UNAVAILABLE',
      });
    }

    const { id } = req.params;
    const { chat_name, config_name } = req.body || {};

    const updateData = {};
    if (chat_name !== undefined) updateData.chat_name = chat_name;
    if (config_name !== undefined) updateData.config_name = config_name;
    updateData.last_updated_at = new Date();

    const updatedChat = await Chat.findOneAndUpdate(
      { chat_id: id },
      updateData,
      { new: true, lean: true }
    );

    if (!updatedChat) {
      return res.status(404).json({
        ok: false,
        message: 'Chat not found',
        error: 'CHAT_NOT_FOUND',
      });
    }

    return res.status(200).json({
      ok: true,
      chat: updatedChat,
    });
  } catch (error) {
    console.error('Error updating chat:', error);
    return res.status(503).json({
      ok: false,
      message: 'Failed to update chat',
      error: error.message,
    });
  }
});

export default router;
