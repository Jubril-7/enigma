const fs = require('fs').promises;
const path = require('path');
const { config } = require('../config');
const { logMessage } = require('../utils/logger');

async function getRole(sock, userId, chatId, storage) {
    // Normalize phone numbers by removing '+' and any ':XX' suffix
    const normalizedUserId = userId.replace('+', '').replace(/:\d+/, '');
    const ownerNumbers = config.ownerNumber.split(',').map(num => num.trim().replace('+', '').replace(/:\d+/, ''));

    await logMessage('debug', `Checking role for userId: ${userId}, normalized: ${normalizedUserId}, owners: ${ownerNumbers.join(', ')}`);
    
    if (ownerNumbers.includes(normalizedUserId)) return 'owner';
    if (storage.bans[userId]) return 'banned';
    if (!chatId.endsWith('@g.us')) return 'member';
    
    try {
        const groupMeta = await sock.groupMetadata(chatId);
        const participant = groupMeta.participants.find(p => p.id === userId);
        if (participant?.admin) return 'admin';
        return 'member';
    } catch (error) {
        await logMessage('error', `Failed to get group metadata for ${chatId}: ${error.message}`);
        return 'member';
    }
}

async function isGroupApproved(chatId, storage) {
    if (!chatId.endsWith('@g.us')) return true;
    if (chatId === config.controlGroupId) return true; // Control group is always approved
    const groupData = storage.groups[chatId];
    return groupData && groupData.approved && !groupData.blocked;
}

module.exports = { getRole, isGroupApproved };