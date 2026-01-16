/**
 * Groups Routes - Category 3 & 4 (17 endpoints)
 */

import { Router } from 'express';
import {
  getJoinedGroups,
  getGroupParticipants,
  createGroup,
  leaveGroup,
  setGroupName,
  setGroupDescription,
  setGroupPhoto,
  addGroupMembers,
  removeGroupMembers,
  promoteGroupAdmin,
  demoteGroupAdmin,
  setGroupAnnounce,
  setGroupLocked,
  getGroupInviteLink,
  joinGroupWithLink,
  previewGroupLink,
  createPoll
} from '../whatsapp';

export const groupsRoute = Router();

// GET /groups - Get all joined groups
groupsRoute.get('/', async (req, res) => {
  try {
    const groups = await getJoinedGroups();

    res.json({
      success: true,
      groups,
      count: groups.length
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /groups - Create new group
groupsRoute.post('/', async (req, res) => {
  try {
    const { name, participants } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    const result = await createGroup(name, participants || []);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /groups/join - Join group via invite link
groupsRoute.post('/join', async (req, res) => {
  try {
    const { invite_link } = req.body;

    if (!invite_link) {
      return res.status(400).json({
        success: false,
        error: 'invite_link is required'
      });
    }

    const result = await joinGroupWithLink(invite_link);

    res.json({
      success: true,
      groupId: result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /groups/preview - Preview group from link
groupsRoute.get('/preview', async (req, res) => {
  try {
    const inviteLink = req.query.invite_link as string;

    if (!inviteLink) {
      return res.status(400).json({
        success: false,
        error: 'invite_link query parameter is required'
      });
    }

    const result = await previewGroupLink(inviteLink);

    res.json({
      success: true,
      group: result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /groups/:jid/participants - Get group participants
groupsRoute.get('/:jid/participants', async (req, res) => {
  try {
    const { jid } = req.params;
    const participants = await getGroupParticipants(jid);

    res.json({
      success: true,
      participants,
      count: participants.length
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /groups/:jid/leave - Leave group
groupsRoute.post('/:jid/leave', async (req, res) => {
  try {
    const { jid } = req.params;
    await leaveGroup(jid);

    res.json({
      success: true,
      message: 'Left group successfully'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /groups/:jid/name - Set group name
groupsRoute.patch('/:jid/name', async (req, res) => {
  try {
    const { jid } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required'
      });
    }

    await setGroupName(jid, name);

    res.json({
      success: true,
      message: 'Group name updated'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /groups/:jid/description - Set group description
groupsRoute.patch('/:jid/description', async (req, res) => {
  try {
    const { jid } = req.params;
    const { description } = req.body;

    if (description === undefined) {
      return res.status(400).json({
        success: false,
        error: 'description is required'
      });
    }

    await setGroupDescription(jid, description);

    res.json({
      success: true,
      message: 'Group description updated'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /groups/:jid/photo - Set group photo
groupsRoute.patch('/:jid/photo', async (req, res) => {
  try {
    const { jid } = req.params;
    const { photo_path } = req.body;

    if (!photo_path) {
      return res.status(400).json({
        success: false,
        error: 'photo_path is required'
      });
    }

    await setGroupPhoto(jid, photo_path);

    res.json({
      success: true,
      message: 'Group photo updated'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /groups/:jid/members - Add members
groupsRoute.post('/:jid/members', async (req, res) => {
  try {
    const { jid } = req.params;
    const { participants } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        error: 'participants array is required'
      });
    }

    const result = await addGroupMembers(jid, participants);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /groups/:jid/members - Remove members
groupsRoute.delete('/:jid/members', async (req, res) => {
  try {
    const { jid } = req.params;
    const { participants } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        error: 'participants array is required'
      });
    }

    const result = await removeGroupMembers(jid, participants);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /groups/:jid/admins - Promote to admin
groupsRoute.post('/:jid/admins', async (req, res) => {
  try {
    const { jid } = req.params;
    const { participants } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        error: 'participants array is required'
      });
    }

    const result = await promoteGroupAdmin(jid, participants);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /groups/:jid/admins - Demote from admin
groupsRoute.delete('/:jid/admins', async (req, res) => {
  try {
    const { jid } = req.params;
    const { participants } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        error: 'participants array is required'
      });
    }

    const result = await demoteGroupAdmin(jid, participants);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /groups/:jid/announce - Toggle admin-only messaging
groupsRoute.patch('/:jid/announce', async (req, res) => {
  try {
    const { jid } = req.params;
    const { announce } = req.body;

    if (announce === undefined) {
      return res.status(400).json({
        success: false,
        error: 'announce boolean is required'
      });
    }

    await setGroupAnnounce(jid, announce);

    res.json({
      success: true,
      message: announce ? 'Only admins can send messages now' : 'All members can send messages now'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /groups/:jid/locked - Toggle admin-only info editing
groupsRoute.patch('/:jid/locked', async (req, res) => {
  try {
    const { jid } = req.params;
    const { locked } = req.body;

    if (locked === undefined) {
      return res.status(400).json({
        success: false,
        error: 'locked boolean is required'
      });
    }

    await setGroupLocked(jid, locked);

    res.json({
      success: true,
      message: locked ? 'Only admins can edit group info now' : 'All members can edit group info now'
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /groups/:jid/invite - Get/reset invite link
groupsRoute.get('/:jid/invite', async (req, res) => {
  try {
    const { jid } = req.params;
    const reset = req.query.reset === 'true';

    const inviteCode = await getGroupInviteLink(jid, reset);

    res.json({
      success: true,
      inviteLink: `https://chat.whatsapp.com/${inviteCode}`,
      reset
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /polls - Create poll
groupsRoute.post('/polls', async (req, res) => {
  try {
    const { chat_jid, question, options, max_selections } = req.body;

    if (!chat_jid || !question || !options) {
      return res.status(400).json({
        success: false,
        error: 'chat_jid, question, and options are required'
      });
    }

    const result = await createPoll(chat_jid, question, options, max_selections || 1);

    res.json({
      success: true,
      messageId: result.id._serialized
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});
