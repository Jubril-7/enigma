const os = require('os');
const { formatJID } = require('../utils/helpers');
const { sendReaction } = require('../middlewares/reactions');
const { logMessage } = require('../utils/logger');
const { loadStorage, saveStorage } = require('../utils/storage');
const { config } = require('../config');

module.exports = async (sock, msg, command, args, storage, sender, chatId, role, senderDisplay) => {
    try {
        // Define command permissions
        const ownerCommands = ['status', 'setprefix'];

        // Check permissions for owner commands
        if (ownerCommands.includes(command) && role !== 'owner') {
            await sendReaction(sock, msg, '❌');
            await sock.sendMessage(chatId, { text: '👑 This command is for bot owner only.' });
            await logMessage('info', `Permission denied: ${sender} tried to use owner command ${command} in ${chatId}`);
            return true;
        }

        if (command === 'alive') {
            await sendReaction(sock, msg, '✅');
            await sock.sendMessage(chatId, { text: '¢əρяιѕυη is alive!' });
            return true;
        }

        if (command === 'ping') {
            const start = Date.now();
            await sendReaction(sock, msg, '✅');
            await sock.sendMessage(chatId, { text: `Pong ${Date.now() - start}ms` });
            return true;
        }

        if (command === 'uptime') {
            const uptime = process.uptime();
            await sendReaction(sock, msg, '✅');
            await sock.sendMessage(chatId, { text: `Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s` });
            return true;
        }

        if (command === 'status') {
            try {
                const cpu = os.loadavg()[0].toFixed(2);
                const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                const memTotal = (os.totalmem() / 1024 / 1024).toFixed(2);
                const uptime = Math.floor(process.uptime() / 3600);
                const statusText = `Bot Status:\nCPU Load: ${cpu}\nMemory: ${memUsed} MB / ${memTotal} MB\nUptime: ${uptime}h`;
                await logMessage('info', `Sending status: ${statusText}`);
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: statusText });
                return true;
            } catch (error) {
                await logMessage('error', `Error in status command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error retrieving status. Please try again.' });
                return true;
            }
        }

        if (command === 'owner') {
            const ownerNumbers = config.ownerNumber.split(',').map(num => num.trim());
            const ownerDisplay = await Promise.all(ownerNumbers.map(id => formatJID(sock, id)));
            await sendReaction(sock, msg, '✅');
            await sock.sendMessage(chatId, { text: `Bot owners:\n${ownerDisplay.join('\n')}` });
            return true;
        }

        if (command === 'grouplink') {
            try {
                if (!chatId.endsWith('@g.us')) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
                    return true;
                }
                
                const groupMeta = await sock.groupMetadata(chatId);
                const inviteCode = await sock.groupInviteCode(chatId);
                const groupLink = `https://chat.whatsapp.com/${inviteCode}`;
                await sendReaction(sock, msg, '✅');
                await sock.sendMessage(chatId, { text: `Group Link for "${groupMeta.subject}":\n${groupLink}` });
                await logMessage('info', `Grouplink command executed: Generated link for ${chatId}`);
                return true;
            } catch (error) {
                await logMessage('error', `Error in grouplink command: ${error.message}`);
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error generating group link. Please try again.' });
                return true;
            }
        }

        if (command === 'help') {
            const prefix = config.prefix || '+';
            const commandsList = [
                '*System Commands*',
                `${prefix}alive - Check if bot is active`,
                `${prefix}ping - Check response time`,
                `${prefix}uptime - Show bot uptime`,
                `${prefix}status - Show system info (Owner only)`,
                `${prefix}owner - Show owner contact`,
                `${prefix}grouplink - Get group invite link`,
                `${prefix}help - Show this menu`,
                role === 'admin' || role === 'owner' ? '*Admin Commands*' : '',
                `${prefix}admin - List group admins`,
                `${prefix}groupinfo - Show group details`,
                `${prefix}grouplink - Get group invite link (Admin/Owner)`,
                `${prefix}kick @user - Kick a user (Admin/Owner)`,
                `${prefix}promote @user - Promote a user to admin (Admin/Owner)`,
                `${prefix}demote @user - Demote a user from admin (Admin/Owner)`,
                `${prefix}ban @user - Ban a user from bot (Owner only)`,
                `${prefix}unban @user - Unban a user (Owner only)`,
                `${prefix}add @number - Add a user (Admin/Owner)`,
                `${prefix}close - Restrict group to admins (Admin/Owner)`,
                `${prefix}open - Open group to all (Admin/Owner)`,
                `${prefix}welcome on/off - Toggle welcome message (Admin/Owner)`,
                `${prefix}setwelcome [text] - Set welcome message (Admin/Owner)`,
                `${prefix}warn @user - Warn a user (Admin/Owner)`,
                `${prefix}warnings @user - Show user warnings (Admin/Owner)`,
                `${prefix}clearwarn @user - Clear user warnings (Admin/Owner)`,
                `${prefix}delete - Delete replied message (Admin/Owner)`,
                `${prefix}antilink on/off - Toggle anti-link (Admin/Owner)`,
                `${prefix}tag <message> - Tag all members (Admin/Owner)`,
                role === 'owner' ? '*Owner Commands*' : '',
                `${prefix}accept <groupId> - Approve a group (Owner only)`,
                `${prefix}reject <groupId> - Reject a group (Owner only)`,
                `${prefix}setprefix <prefix> - Change bot prefix (Owner only)`,
                '*Media Commands*',
                `${prefix}sticker - Convert image/video to sticker`,
                `${prefix}toimg - Convert sticker to image`,
                '*Game Commands*',
                `${prefix}hangman - Start hangman game`,
                `${prefix}guess <letter> - Guess a letter`,
                `${prefix}hg forfeit - Forfeit hangman`,
                `${prefix}tictactoe @user - Start Tic Tac Toe`,
                `${prefix}m {1-9} - Make a Tic Tac Toe move`,
                `${prefix}ttt forfeit - Forfeit Tic Tac Toe`,
                `${prefix}wordgame - Start word game`,
                `${prefix}wg easy/medium/hard - Set word game difficulty`,
                `${prefix}wjoin - Join word game`,
                `${prefix}wstart - Start word game`,
                `${prefix}w <word> - Submit word`,
                `${prefix}wg forfeit - Forfeit word game`,
            ].filter(line => line).join('\n');
            await sendReaction(sock, msg, '✅');
            await sock.sendMessage(chatId, { text: commandsList });
            return true;
        }

        if (command === 'setprefix') {
            if (args.length === 0) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Please provide a new prefix.' });
                return true;
            }
            storage.prefix = args[0];
            await saveStorage(storage);
            await sendReaction(sock, msg, '✅');
            await sock.sendMessage(chatId, { text: `Prefix updated to ${args[0]}` });
            return true;
        }

        return false;
    } catch (error) {
        await logMessage('error', `Error in systemCommands for ${command}: ${error.message}`);
        await sendReaction(sock, msg, '❌');
        await sock.sendMessage(chatId, { text: 'An error occurred in system commands. Please try again.' });
        return false;
    }
};