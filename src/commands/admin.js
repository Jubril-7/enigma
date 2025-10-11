const { formatJID } = require('../utils/helpers');
const { sendReaction } = require('../middlewares/reactions');
const { logMessage } = require('../utils/logger');
const { loadStorage, saveStorage } = require('../utils/storage');
const { getRole } = require('../middlewares/roles');

module.exports = async (sock, msg, command, args, storage, sender, chatId, role, prefix) => {
    try {
        if (!chatId.endsWith('@g.us')) {
            await sendReaction(sock, msg, '❌');
            await sock.sendMessage(chatId, { text: 'Admin commands can only be used in groups.' });
            return true;
        }

        // Define command permissions
        const adminCommands = ['kick', 'promote', 'demote', 'add', 'close', 'open', 'welcome', 'setwelcome', 'warn', 'warnings', 'clearwarn', 'delete', 'antilink', 'tag', 'grouplink'];
        const ownerCommands = ['ban', 'unban', 'accept', 'reject'];

        // Check permissions for admin commands
        if (adminCommands.includes(command) && role !== 'admin' && role !== 'owner') {
            await sendReaction(sock, msg, '❌');
            await sock.sendMessage(chatId, { text: '⛔ This command is for admins only.' });
            await logMessage('info', `Permission denied: ${sender} tried to use admin command ${command} in ${chatId}`);
            return true;
        }

        // Check permissions for owner commands
        if (ownerCommands.includes(command) && role !== 'owner') {
            await sendReaction(sock, msg, '❌');
            await sock.sendMessage(chatId, { text: '👑 This command is for bot owner only.' });
            await logMessage('info', `Permission denied: ${sender} tried to use owner command ${command} in ${chatId}`);
            return true;
        }

        if (command === 'admin') {
            try {
                const groupMeta = await sock.groupMetadata(chatId);
                const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);
                const adminList = await Promise.all(admins.map(id => formatJID(sock, id)));
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `Admins:\n${adminList.join('\n')}` });
                await logMessage('info', `Admin command executed: Listed admins for ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in admin command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error listing admins. Please try again.' });
                return true;
            }
        }

        if (command === 'groupinfo') {
            try {
                const groupMeta = await sock.groupMetadata(chatId);
                const text = `Group: ${groupMeta.subject}\nID: ${chatId}\nMembers: ${groupMeta.participants.length}\nCreated: ${new Date(groupMeta.creation * 1000).toLocaleString()}`;
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text });
                await logMessage('info', `Groupinfo command executed: Details for ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in groupinfo command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error retrieving group info. Please try again.' });
                return true;
            }
        }

        if (command === 'grouplink') {
            try {
                const groupMeta = await sock.groupMetadata(chatId);
                const inviteCode = await sock.groupInviteCode(chatId);
                const groupLink = `https://chat.whatsapp.com/${inviteCode}`;
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `Group Link:\n${groupLink}` });
                await logMessage('info', `Grouplink command executed: Generated link for ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in grouplink command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error generating group link. Please try again.' });
                return true;
            }
        }

        if (command === 'kick') {
            try {
                let user;

                // Check if user is mentioned
                if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                    user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }
                // Check if command is replying to a message
                else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                    user = msg.message.extendedTextMessage.contextInfo.participant;
                }
                else {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please tag a user or reply to their message to kick.' });
                    return true;
                }

                await sock.groupParticipantsUpdate(chatId, [user], 'remove');
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has been kicked.`, mentions: [user] });
                await logMessage('info', `Kick command executed: Kicked ${user} from ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in kick command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error kicking user. Please try again.' });
                return true;
            }
        }

        if (command === 'promote') {
            try {
                let user;

                // Check if user is mentioned
                if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                    user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }
                // Check if command is replying to a message
                else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                    user = msg.message.extendedTextMessage.contextInfo.participant;
                }
                else {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please tag a user or reply to their message to promote.' });
                    return true;
                }

                await sock.groupParticipantsUpdate(chatId, [user], 'promote');
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has been promoted to admin.`, mentions: [user] });
                await logMessage('info', `Promote command executed: Promoted ${user} to admin in ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in promote command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error promoting user. Please try again.' });
                return true;
            }
        }

        if (command === 'demote') {
            try {
                let user;

                // Check if user is mentioned
                if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                    user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }
                // Check if command is replying to a message
                else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                    user = msg.message.extendedTextMessage.contextInfo.participant;
                }
                else {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please tag a user or reply to their message to demote.' });
                    return true;
                }

                await sock.groupParticipantsUpdate(chatId, [user], 'demote');
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has been demoted from admin.`, mentions: [user] });
                await logMessage('info', `Demote command executed: Demoted ${user} from admin in ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in demote command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error demoting user. Please try again.' });
                return true;
            }
        }

        if (command === 'ban') {
            try {
                let user;

                // Check if user is mentioned
                if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                    user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }
                // Check if command is replying to a message
                else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                    user = msg.message.extendedTextMessage.contextInfo.participant;
                }
                else {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please tag a user or reply to their message to ban.' });
                    return true;
                }

                storage.bans[user] = true;
                await saveStorage(storage);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has been banned from using the bot.`, mentions: [user] });
                await logMessage('info', `Ban command executed: Banned ${user} from bot usage`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in ban command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error banning user. Please try again.' });
                return true;
            }
        }

        if (command === 'unban') {
            try {
                if (!msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length && !args[0]) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please tag a user or provide a phone number to unban.' });
                    return true;
                }
                const user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || args[0].replace('+', '') + '@s.whatsapp.net';
                if (!storage.bans[user]) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} is not banned.`, mentions: [user] });
                    return true;
                }
                delete storage.bans[user];
                await saveStorage(storage);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has been unbanned.`, mentions: [user] });
                await logMessage('info', `Unban command executed: Unbanned ${user}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in unban command: ${error.message}`);
                await sock.sendMessage(chatId, { text: 'Error unbanning user. Please try again.' });
                return true;
            }
        }

        if (command === 'add') {
            try {
                if (!args[0]) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please provide a phone number to add.' });
                    return true;
                }
                const user = args[0].replace('+', '') + '@s.whatsapp.net';
                await sock.groupParticipantsUpdate(chatId, [user], 'add');
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has been added.`, mentions: [user] });
                await logMessage('info', `Add command executed: Added ${user} to ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in add command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error adding user. Please try again.' });
                return true;
            }
        }

        if (command === 'close') {
            try {
                await sock.groupSettingUpdate(chatId, 'announcement');
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: 'Group is now restricted to admins.' });
                await logMessage('info', `Close command executed: Restricted ${chatId} to admins`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in close command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error restricting group. Please try again.' });
                return true;
            }
        }

        if (command === 'open') {
            try {
                await sock.groupSettingUpdate(chatId, 'not_announcement');
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: 'Group is now open to all members.' });
                await logMessage('info', `Open command executed: Opened ${chatId} to all members`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in open command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error opening group. Please try again.' });
                return true;
            }
        }

        if (command === 'welcome') {
            try {
                if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Usage: welcome on/off' });
                    return true;
                }
                storage.groups[chatId] = storage.groups[chatId] || {};
                storage.groups[chatId].welcome = args[0].toLowerCase();
                await saveStorage(storage);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `Welcome message turned ${args[0].toLowerCase()}.` });
                await logMessage('info', `Welcome command executed: Set welcome to ${args[0].toLowerCase()} for ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in welcome command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error setting welcome message. Please try again.' });
                return true;
            }
        }

        if (command === 'setwelcome') {
            try {
                if (args.length === 0) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please provide a welcome message.' });
                    return true;
                }
                storage.groups[chatId] = storage.groups[chatId] || {};
                storage.groups[chatId].welcomeMessage = args.join(' ');
                await saveStorage(storage);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `Welcome message set to: ${args.join(' ')}` });
                await logMessage('info', `Setwelcome command executed: Set welcome message to "${args.join(' ')}" for ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in setwelcome command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error setting welcome message. Please try again.' });
                return true;
            }
        }

        if (command === 'warn') {
            try {
                let user;

                // Check if user is mentioned
                if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                    user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }
                // Check if command is replying to a message
                else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                    user = msg.message.extendedTextMessage.contextInfo.participant;
                }
                else {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please tag a user or reply to their message to warn.' });
                    return true;
                }

                storage.warnings[user] = (storage.warnings[user] || 0) + 1;
                await saveStorage(storage);

                const warningsCount = storage.warnings[user];
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has been warned. Total warnings: ${warningsCount}/3.`, mentions: [user] });
                await logMessage('info', `Warn command executed: Warned ${user} in ${chatId}, total warnings: ${warningsCount}`);

                // Check if warnings reached 3 and kick immediately
                if (warningsCount >= 3) {
                    const role = await getRole(sock, user, chatId, storage);
                    if (role !== 'owner') {
                        await sock.groupParticipantsUpdate(chatId, [user], 'remove');
                        await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has been kicked for reaching 3 warnings.`, mentions: [user] });
                        await logMessage('info', `User ${user} kicked from ${chatId} for reaching 3 warnings via warn command`);
                    }
                    // Reset warnings after kicking (or if owner, don't kick but reset warnings)
                    delete storage.warnings[user];
                    await saveStorage(storage);
                }

                return true;
            } catch (error) {
                await logMessage('error', `Error in warn command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error warning user. Please try again.' });
                return true;
            }
        }

        if (command === 'warnings') {
            try {
                let user;

                // Check if user is mentioned
                if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                    user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }
                // Check if command is replying to a message
                else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                    user = msg.message.extendedTextMessage.contextInfo.participant;
                }
                else {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please tag a user or reply to their message to check warnings.' });
                    return true;
                }

                const warnings = storage.warnings[user] || 0;
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} has ${warnings} warnings.`, mentions: [user] });
                await logMessage('info', `Warnings command executed: Checked warnings for ${user} in ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in warnings command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error checking warnings. Please try again.' });
                return true;
            }
        }

        if (command === 'clearwarn') {
            try {
                let user;

                // Check if user is mentioned
                if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                    user = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                }
                // Check if command is replying to a message
                else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                    user = msg.message.extendedTextMessage.contextInfo.participant;
                }
                else {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please tag a user or reply to their message to clear warnings.' });
                    return true;
                }

                delete storage.warnings[user];
                await saveStorage(storage);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `@${user.split('@')[0]} warnings cleared.`, mentions: [user] });
                await logMessage('info', `Clearwarn command executed: Cleared warnings for ${user} in ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in clearwarn command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error clearing warnings. Please try again.' });
                return true;
            }
        }

        if (command === 'delete') {
            try {
                if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please reply to a message to delete.' });
                    return true;
                }
                const quotedMsg = msg.message.extendedTextMessage.contextInfo;
                await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: quotedMsg.stanzaId, participant: quotedMsg.participant } });
                await sendReaction(sock, msg, '✅');
                await logMessage('info', `Delete command executed: Deleted message ${quotedMsg.stanzaId} in ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in delete command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error deleting message. Please try again.' });
                return true;
            }
        }

        if (command === 'antilink') {
            try {
                if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Usage: antilink on/off' });
                    return true;
                }
                storage.groups[chatId] = storage.groups[chatId] || {};
                storage.groups[chatId].antilink = args[0].toLowerCase();
                await saveStorage(storage);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `Antilink turned ${args[0].toLowerCase()}.` });
                await logMessage('info', `Antilink command executed: Set antilink to ${args[0].toLowerCase()} for ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in antilink command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error setting antilink. Please try again.' });
                return true;
            }
        }

        if (command === 'accept') {
            try {
                if (!args[0]) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please provide a group ID to accept.' });
                    return true;
                }
                const groupId = args[0];
                storage.groups[groupId] = storage.groups[groupId] || {};
                storage.groups[groupId].approved = true;
                await saveStorage(storage);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `Group ${groupId} has been approved.` });
                await logMessage('info', `Accept command executed: Approved group ${groupId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in accept command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error approving group. Please try again.' });
                return true;
            }
        }

        if (command === 'reject') {
            try {
                if (!args[0]) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please provide a group ID to reject.' });
                    return true;
                }
                const groupId = args[0];
                storage.groups[groupId] = storage.groups[groupId] || {};
                storage.groups[groupId].blocked = true;
                await saveStorage(storage);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `Group ${groupId} has been rejected.` });
                await logMessage('info', `Reject command executed: Rejected group ${groupId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in reject command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error rejecting group. Please try again.' });
                return true;
            }
        }

        if (command === 'tag') {
            try {
                if (args.length === 0) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'Please provide a message to tag all members.' });
                    return true;
                }
                const groupMeta = await sock.groupMetadata(chatId);
                const members = groupMeta.participants.map(p => p.id);
                const message = args.join(' ');
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: message, mentions: members });
                await logMessage('info', `Tag command executed: Tagged all members in ${chatId} with message "${message}"`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in tag command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error tagging members. Please try again.' });
                return true;
            }
        }

        return false;
    } catch (error) {
        await logMessage('error', `Error in adminCommands for ${command}: ${error.message}`);
        await sendReaction(sock, msg, '❌');
        await sock.sendMessage(chatId, { text: 'An error occurred in admin commands. Please try again.' });
        return false;
    }
};