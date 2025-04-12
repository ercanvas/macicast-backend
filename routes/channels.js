const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Channel = require('../models/Channel');
const auth = require('../middleware/auth');

// @route   GET api/channels/lists
// @desc    Get all channel lists for logged in user
// @access  Private
router.get('/lists', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'channelLists.channels',
        model: 'Channel'
      });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.channelLists);
  } catch (err) {
    console.error('Error fetching channel lists:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST api/channels/lists
// @desc    Create a new channel list
// @access  Private
router.post('/lists', auth, async (req, res) => {
  try {
    const { name, isPublic } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if a list with this name already exists
    const existingList = user.channelLists.find(list => list.name === name);
    if (existingList) {
      return res.status(400).json({ error: 'A list with this name already exists' });
    }
    
    // Create new list
    user.channelLists.push({
      name,
      isPublic: isPublic || false,
      channels: []
    });
    
    await user.save();
    
    res.json(user.channelLists[user.channelLists.length - 1]);
  } catch (err) {
    console.error('Error creating channel list:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT api/channels/lists/:listId
// @desc    Update a channel list
// @access  Private
router.put('/lists/:listId', auth, async (req, res) => {
  try {
    const { name, isPublic } = req.body;
    const { listId } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find the list
    const list = user.channelLists.id(listId);
    if (!list) {
      return res.status(404).json({ error: 'Channel list not found' });
    }
    
    // Update fields
    if (name) list.name = name;
    if (isPublic !== undefined) list.isPublic = isPublic;
    
    await user.save();
    
    res.json(list);
  } catch (err) {
    console.error('Error updating channel list:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE api/channels/lists/:listId
// @desc    Delete a channel list
// @access  Private
router.delete('/lists/:listId', auth, async (req, res) => {
  try {
    const { listId } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find the list
    const list = user.channelLists.id(listId);
    if (!list) {
      return res.status(404).json({ error: 'Channel list not found' });
    }
    
    // Don't allow deletion of default list
    if (list.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default channel list' });
    }
    
    // Remove list
    list.remove();
    await user.save();
    
    res.json({ message: 'Channel list deleted' });
  } catch (err) {
    console.error('Error deleting channel list:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST api/channels/lists/:listId/channels
// @desc    Add a channel to a list
// @access  Private
router.post('/lists/:listId/channels', auth, async (req, res) => {
  try {
    const { channelId } = req.body;
    const { listId } = req.params;
    
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    
    // Verify the channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find the list
    const list = user.channelLists.id(listId);
    if (!list) {
      return res.status(404).json({ error: 'Channel list not found' });
    }
    
    // Check if channel is already in the list
    if (list.channels.includes(channelId)) {
      return res.status(400).json({ error: 'Channel already in list' });
    }
    
    // Add channel to list
    list.channels.push(channelId);
    await user.save();
    
    res.json(list);
  } catch (err) {
    console.error('Error adding channel to list:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE api/channels/lists/:listId/channels/:channelId
// @desc    Remove a channel from a list
// @access  Private
router.delete('/lists/:listId/channels/:channelId', auth, async (req, res) => {
  try {
    const { listId, channelId } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find the list
    const list = user.channelLists.id(listId);
    if (!list) {
      return res.status(404).json({ error: 'Channel list not found' });
    }
    
    // Remove channel from list
    const channelIndex = list.channels.indexOf(channelId);
    if (channelIndex === -1) {
      return res.status(400).json({ error: 'Channel not in list' });
    }
    
    list.channels.splice(channelIndex, 1);
    await user.save();
    
    res.json(list);
  } catch (err) {
    console.error('Error removing channel from list:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== WATCH PARTY ROUTES ==========

// @route   POST api/channels/watch-party
// @desc    Create a new watch party
// @access  Private
router.post('/watch-party', auth, async (req, res) => {
  try {
    const { name, channelId } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Watch party name is required' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create new watch party
    const watchParty = {
      name,
      currentChannel: channelId || null,
      activeUsers: [req.user.id]
    };
    
    user.watchParties.push(watchParty);
    await user.save();
    
    // Get the newly created watch party
    const newParty = user.watchParties[user.watchParties.length - 1];
    
    res.json({
      partyId: newParty.partyId,
      passkey: newParty.passkey,
      name: newParty.name,
      url: `https://macicast.vercel.app/${user.username}-watch-party/${newParty.partyId}/${channelId ? 'channel' : 'select'}`
    });
  } catch (err) {
    console.error('Error creating watch party:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET api/channels/watch-party
// @desc    Get all watch parties for the user
// @access  Private
router.get('/watch-party', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'watchParties.currentChannel',
        model: 'Channel'
      });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Filter out expired watch parties
    const activeParties = user.watchParties.filter(party => {
      return new Date(party.expiresAt) > new Date();
    });
    
    res.json(activeParties);
  } catch (err) {
    console.error('Error fetching watch parties:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   GET api/channels/watch-party/:partyId
// @desc    Get a specific watch party
// @access  Public
router.get('/watch-party/:username/:partyId', async (req, res) => {
  try {
    const { username, partyId } = req.params;
    
    // Find the user by username
    const user = await User.findOne({ username })
      .populate({
        path: 'watchParties.currentChannel',
        model: 'Channel'
      });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find the party
    const watchParty = user.watchParties.find(p => p.partyId === partyId);
    if (!watchParty) {
      return res.status(404).json({ error: 'Watch party not found' });
    }
    
    // Check if the party is expired
    if (new Date(watchParty.expiresAt) <= new Date()) {
      return res.status(410).json({ error: 'Watch party has expired' });
    }
    
    // Return party details (without passkey)
    res.json({
      id: watchParty._id,
      partyId: watchParty.partyId,
      name: watchParty.name,
      host: {
        username: user.username,
        displayName: user.displayName
      },
      currentChannel: watchParty.currentChannel,
      activeUsers: watchParty.activeUsers.length,
      createdAt: watchParty.createdAt,
      expiresAt: watchParty.expiresAt
    });
  } catch (err) {
    console.error('Error fetching watch party:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST api/channels/watch-party/:username/:partyId/join
// @desc    Join a watch party
// @access  Public (with passkey)
router.post('/watch-party/:username/:partyId/join', async (req, res) => {
  try {
    const { username, partyId } = req.params;
    const { passkey, userId } = req.body;
    
    if (!passkey) {
      return res.status(400).json({ error: 'Passkey is required' });
    }
    
    // Find the host user
    const hostUser = await User.findOne({ username });
    if (!hostUser) {
      return res.status(404).json({ error: 'Host user not found' });
    }
    
    // Find the party
    const watchParty = hostUser.watchParties.find(p => p.partyId === partyId);
    if (!watchParty) {
      return res.status(404).json({ error: 'Watch party not found' });
    }
    
    // Check if the party is expired
    if (new Date(watchParty.expiresAt) <= new Date()) {
      return res.status(410).json({ error: 'Watch party has expired' });
    }
    
    // Verify passkey
    if (watchParty.passkey !== passkey) {
      return res.status(401).json({ error: 'Invalid passkey' });
    }
    
    // Add the user to the party if authenticated
    if (userId && !watchParty.activeUsers.includes(userId)) {
      watchParty.activeUsers.push(userId);
      await hostUser.save();
    }
    
    // Return channel information
    res.json({
      partyId: watchParty.partyId,
      name: watchParty.name,
      host: {
        username: hostUser.username,
        displayName: hostUser.displayName
      },
      currentChannel: watchParty.currentChannel,
      activeUsers: watchParty.activeUsers.length
    });
  } catch (err) {
    console.error('Error joining watch party:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   PUT api/channels/watch-party/:partyId
// @desc    Update a watch party (change channel)
// @access  Private (host only)
router.put('/watch-party/:partyId', auth, async (req, res) => {
  try {
    const { partyId } = req.params;
    const { channelId } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find the party
    const watchParty = user.watchParties.find(p => p.partyId === partyId);
    if (!watchParty) {
      return res.status(404).json({ error: 'Watch party not found' });
    }
    
    // Update channel
    if (channelId) {
      // Verify the channel exists
      const channel = await Channel.findById(channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      
      watchParty.currentChannel = channelId;
    }
    
    await user.save();
    
    res.json(watchParty);
  } catch (err) {
    console.error('Error updating watch party:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   DELETE api/channels/watch-party/:partyId
// @desc    End a watch party
// @access  Private (host only)
router.delete('/watch-party/:partyId', auth, async (req, res) => {
  try {
    const { partyId } = req.params;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find the party
    const partyIndex = user.watchParties.findIndex(p => p.partyId === partyId);
    if (partyIndex === -1) {
      return res.status(404).json({ error: 'Watch party not found' });
    }
    
    // Remove the party
    user.watchParties.splice(partyIndex, 1);
    await user.save();
    
    res.json({ message: 'Watch party ended' });
  } catch (err) {
    console.error('Error ending watch party:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 