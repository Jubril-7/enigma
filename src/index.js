// NUCLEAR OPTION - IGNORE ALL ERRORS TO KEEP BOT RUNNING
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

const P = require('pino');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { config } = require('./config');
const { getRole, isGroupApproved } = require('./middlewares/roles');
const { sendReaction } = require('./middlewares/reactions');
const { logMessage } = require('./utils/logger');
const { loadStorage, saveStorage } = require('./utils/storage');
const systemCommands = require('./commands/system');
const adminCommands = require('./commands/admin');
const mediaCommands = require('./commands/media');
const hangmanCommands = require('./commands/games/hangman');
const tictactoeCommands = require('./commands/games/tictactoe');
const wordgameCommands = require('./commands/games/wordgame');

// ✅ ADDED: Health check server for Replit + UptimeRobot
const express = require('express');
const healthApp = express();
const HEALTH_PORT = process.env.PORT || 3000;

healthApp.get('/', (req, res) => res.send('🤖¢əρяιѕυη WhatsApp Bot is running fine!'));
healthApp.listen(HEALTH_PORT, () => console.log(`✅ Health check server started on port ${HEALTH_PORT}`));

// Define admin and owner commands
const ADMIN_COMMANDS = new Set([
    'admin', 'groupinfo', 'grouplink', 'kick', 'promote', 'demote', 'add', 'close', 'open',
    'welcome', 'setwelcome', 'warn', 'warnings', 'clearwarn', 'delete', 'antilink', 'tag'
]);

const OWNER_COMMANDS = new Set([
    'ban', 'unban', 'accept', 'reject', 'status', 'setprefix'
]);

async function connectToWhatsApp() {
    const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = await import('@whiskeysockets/baileys');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && !sock.user) {
            console.log('QR Code:', qr);
        }
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                await connectToWhatsApp();
            } else {
                console.log('Connection closed. Please delete auth_info folder and rescan QR.');
            }
        } else if (connection === 'open') {
            console.log('Connected to WhatsApp');
            await logMessage('info', 'Connected to WhatsApp');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ✅ Safe message listener (ignores Bad MAC errors)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message) return;

            const chatId = msg.key.remoteJid;
            const isGroup = chatId.endsWith('@g.us');
            const sender = msg.key.fromMe ? sock.user.id : (msg.key.participant || msg.key.remoteJid);
            const fromMe = msg.key.fromMe;
            
            await logMessage('debug', `Received message in ${chatId}, sender: ${sender}, fromMe: ${fromMe}, participant: ${msg.key.participant || 'none'}`);

            const storage = await loadStorage();
            let prefix = storage.prefix || config.prefix;

            try {
                const approved = await isGroupApproved(chatId, storage);
                if (isGroup && !approved) {
                    if (msg.message.conversation?.startsWith(`${prefix}alive`)) {
                        await logMessage('info', `Unapproved group detected: ${chatId}, Control group: ${config.controlGroupId}`);
                        await handleUnapprovedGroup(sock, msg, chatId, storage);
                        return;
                    }
                    await logMessage('info', `Ignoring message in unapproved group: ${chatId}`);
                    return;
                }

                const role = await getRole(sock, sender, chatId, storage);
                if (role === 'banned' && !fromMe) {
                    try {
                        await logMessage('info', `Ignored message from banned user ${sender} in ${chatId}`);
                    } catch (error) {
                        await logMessage('error', `Failed to log banned user message: ${error.message}`);
                    }
                    return;
                }

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (!text.startsWith(prefix)) {
                    if (isGroup && storage.groups[chatId]?.antilink === 'on') {
                        if (text.includes('http://') || text.includes('https://')) {
                            await handleAntilink(sock, msg, chatId, sender, storage);
                        }
                    }
                    return;
                }

                const [command, ...args] = text.slice(prefix.length).trim().split(/\s+/);
                const commandLower = command.toLowerCase();

                await logMessage('debug', `Processing command: ${commandLower}, role: ${role}, args: ${args.join(' ')}`);

                try {
                    let handled = false;

                    if (OWNER_COMMANDS.has(commandLower) && role !== 'owner') {
                        await sendReaction(sock, msg, '❌');
                        await sock.sendMessage(chatId, { text: '❌ This command is for bot owners only.' });
                        await logMessage('info', `Owner command ${commandLower} attempted by non-owner ${sender}`);
                        return;
                    }

                    if (ADMIN_COMMANDS.has(commandLower) && role !== 'admin' && role !== 'owner') {
                        await sendReaction(sock, msg, '❌');
                        await sock.sendMessage(chatId, { text: '❌ This command is for group admins only.' });
                        await logMessage('info', `Admin command ${commandLower} attempted by non-admin ${sender}`);
                        return;
                    }

                    handled = await systemCommands(sock, msg, commandLower, args, storage, sender, chatId, role, prefix);
                    if (handled) return;

                    handled = await adminCommands(sock, msg, commandLower, args, storage, sender, chatId, role, prefix);
                    if (handled) return;

                    handled = await mediaCommands(sock, msg, commandLower, args, storage, sender, chatId, role, prefix);
                    if (handled) return;

                    handled = await hangmanCommands(sock, msg, commandLower, args, storage, sender, chatId, role, prefix);
                    if (handled) return;

                    handled = await tictactoeCommands(sock, msg, commandLower, args, storage, sender, chatId, role, prefix);
                    if (handled) return;

                    handled = await wordgameCommands(sock, msg, commandLower, args, storage, sender, chatId, role, prefix);
                    if (handled) return;

                    if (!handled) {
                        await sendReaction(sock, msg, '❌');
                        await sock.sendMessage(chatId, { text: `Unknown command: ${command}. Type ${prefix}help for available commands.` });
                    }
                } catch (error) {
                    console.error(error);
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'An error occurred. Please try again.' });
                    await logMessage('error', `Error processing command ${commandLower}: ${error.message}`);
                }
            } catch (error) {
                console.error(error);
                await logMessage('error', `Error in message handling for ${chatId}: ${error.message}`);
            }
        } catch (err) {
            if (String(err).includes('Bad MAC') || String(err).includes('decrypt')) {
                console.warn('⚠️ Ignored Bad MAC/decrypt error');
            } else {
                console.error('❌ messages.upsert error:', err);
            }
        }
    });

    sock.ev.on('group-participants.update', async ({ id: chatId, participants, action }) => {
        const storage = await loadStorage();
        if (action === 'add' && storage.groups[chatId]?.welcome === 'on') {
            const welcomeMsg = storage.groups[chatId]?.welcomeMessage || 'Welcome to the group!';
            for (const participant of participants) {
                await sock.sendMessage(chatId, { text: `${welcomeMsg} @${participant.split('@')[0]}`, mentions: [participant] });
            }
        }
    });
}

async function handleUnapprovedGroup(sock, msg, chatId, storage) {
    try {
        const groupMeta = await sock.groupMetadata(chatId);
        const groupName = groupMeta.subject;
        await sock.sendMessage(chatId, { text: 'This group is not approved. Request sent to control group.' });
        try {
            await sock.sendMessage(config.controlGroupId, {
                text: `New group request:\nName: ${groupName}\nID: ${chatId}\nUse ${config.prefix}accept ${chatId} or ${config.prefix}reject ${chatId}`
            });
        } catch (sendError) {
            await logMessage('error', `Failed to send message to control group ${config.controlGroupId}: ${sendError.message}`);
        }
    } catch (error) {
        await logMessage('error', `Failed to handle unapproved group ${chatId}: ${error.message}`);
    }
}

async function handleAntilink(sock, msg, chatId, sender, storage) {
    const warnings = storage.warnings[sender] || 0;
    storage.warnings[sender] = warnings + 1;
    await saveStorage(storage);
    try {
        await sock.sendMessage(chatId, { text: `@${sender.split('@')[0]}, links are not allowed. Warning ${warnings + 1}/3.`, mentions: [sender] });
        await sock.sendMessage(chatId, { delete: msg.key });
    } catch (error) {
        await logMessage('error', `Failed to handle antilink for ${sender}: ${error.message}`);
    }

    if (warnings + 1 >= 3) {
        if (!(await getRole(sock, sender, chatId, storage) === 'owner')) {
            try {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                await sock.sendMessage(chatId, { text: `@${sender.split('@')[0]} has been kicked for too many warnings.`, mentions: [sender] });
            } catch (error) {
                await logMessage('error', `Failed to kick ${sender}: ${error.message}`);
            }
            delete storage.warnings[sender];
            await saveStorage(storage);
        }
    }
}

connectToWhatsApp().catch(console.error);

// ✅ Global error handlers — prevent crashes on Render
process.on('uncaughtException', (err) => {
    if (String(err).includes('Bad MAC') || String(err).includes('decrypt')) {
        console.warn('⚠️ Ignored uncaught decrypt error');
    } else {
        console.error('❌ Uncaught Exception:', err);
    }
});

process.on('unhandledRejection', (reason) => {
    if (String(reason).includes('Bad MAC') || String(reason).includes('decrypt')) {
        console.warn('⚠️ Ignored unhandled decrypt rejection');
    } else {
        console.error('❌ Unhandled Rejection:', reason);
    }
});

// ✅ KEPT: Your existing web server (now runs alongside health check)
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('🤖¢əρяιѕυη WhatsApp Bot is running fine!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Web server started on port ${PORT}`));
