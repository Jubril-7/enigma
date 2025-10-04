const { sendReaction } = require('../middlewares/reactions');
const { logMessage } = require('../utils/logger');
const sharp = require('sharp');

module.exports = async (sock, msg, command, args, storage, sender, chatId, role, senderDisplay) => {
    let quotedMsg = null; // Declare quotedMsg once at the top

    // Helper function to create and send a sticker
    const createSticker = async (msg, chatId, quotedMsg, sender, senderDisplay) => {
        let imageMsg = msg.message?.imageMessage;
        let videoMsg = msg.message?.videoMessage;

        // Check if replying to a message that has media
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            imageMsg = imageMsg || quotedMsg.imageMessage;
            videoMsg = videoMsg || quotedMsg.videoMessage;
        }

        if (!imageMsg && !videoMsg) {
            await sendReaction(sock, msg, '❌');
            await sock.sendMessage(chatId, { text: 'Please send or reply to an image/video.' });
            await logMessage('info', `Sticker command failed in ${chatId}: No image or video found`);
            return false;
        }

        try {
            // Dynamically import Baileys' downloadMediaMessage
            const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

            // Log message structure for debugging
            await logMessage('debug', `Sticker command in ${chatId}: imageMsg=${!!imageMsg}, videoMsg=${!!videoMsg}, isQuoted=${!!quotedMsg}, quotedMsg=${JSON.stringify(quotedMsg, null, 2)}`);
            
            // Select the correct message object
            const isQuoted = !!quotedMsg && (quotedMsg.imageMessage || quotedMsg.videoMessage);
            const mediaMsg = isQuoted ? { 
                key: { 
                    remoteJid: chatId, 
                    id: msg.message.extendedTextMessage.contextInfo.stanzaId, 
                    participant: msg.message.extendedTextMessage.contextInfo.participant 
                }, 
                message: quotedMsg 
            } : msg;
            
            // await logMessage('debug', `MediaMsg for sticker: ${JSON.stringify(mediaMsg, null, 2)}`);

            const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {}, { 
                logger: { 
                    warn: (msg) => logMessage('warn', msg), 
                    error: (msg) => logMessage('error', msg) 
                } 
            });

            await logMessage('debug', `Downloaded buffer size: ${buffer.length} bytes`);

            // Convert buffer to WebP with sticker requirements (512x512, <100KB)
            const webpBuffer = await sharp(buffer)
                .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 80, effort: 6 })
                .toBuffer();

            await logMessage('debug', `WebP buffer size: ${webpBuffer.length} bytes`);

            const sendResult = await sock.sendMessage(chatId, { 
                sticker: webpBuffer,
                isAnimated: !!videoMsg,
                packname: "ωнιмѕι¢αℓ ¢əρяιѕυη - вℓσσ∂ℓιηє",
                author: senderDisplay
            });
            // await logMessage('debug', `Sticker send result: ${JSON.stringify(sendResult, null, 2)}`);

            await sendReaction(sock, msg, '✅');
            await logMessage('info', `Sticker created successfully in ${chatId} by ${sender}`);
            return true;
        } catch (error) {
            await sendReaction(sock, msg, '❌');
            await sock.sendMessage(chatId, { text: 'Error creating sticker. Please try again.' });
            await logMessage('error', `Sticker creation error in ${chatId}: ${error.message}`);
            return false;
        }
    };

    switch (command) {
        case 'sticker':
        case 's': {
            return await createSticker(msg, chatId, quotedMsg, sender, senderDisplay);
        }

        case 'toimg': {
            let stickerMsg = msg.message?.stickerMessage;

            // Check if replying to a sticker message
            if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                stickerMsg = stickerMsg || quotedMsg.stickerMessage;
            }

            if (!stickerMsg) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Please send or reply to a sticker.' });
                await logMessage('info', `Toimg command failed in ${chatId}: No sticker found`);
                return true;
            }

            try {
                // Dynamically import Baileys' downloadMediaMessage
                const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

                // Select the correct message object
                const isQuoted = !!quotedMsg && quotedMsg.stickerMessage;
                const mediaMsg = isQuoted ? { 
                    key: { 
                        remoteJid: chatId, 
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId, 
                        participant: msg.message.extendedTextMessage.contextInfo.participant 
                    }, 
                    message: quotedMsg 
                } : msg;

                // Log message structure for debugging
                // await logMessage('debug', `Toimg command in ${chatId}: stickerMsg=${!!stickerMsg}, isQuoted=${!!quotedMsg}, quotedMsg=${JSON.stringify(quotedMsg, null, 2)}`);
                // await logMessage('debug', `MediaMsg for toimg: ${JSON.stringify(mediaMsg, null, 2)}`);

                const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {}, { 
                    logger: { 
                        warn: (msg) => logMessage('warn', msg), 
                        error: (msg) => logMessage('error', msg) 
                    } 
                });

                await logMessage('debug', `Downloaded buffer size: ${buffer.length} bytes`);

                // Convert WebP to JPEG for better compatibility
                const jpegBuffer = await sharp(buffer)
                    .resize({ width: 512, height: 512, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                await logMessage('debug', `JPEG buffer size: ${jpegBuffer.length} bytes`);

                const sendResult = await sock.sendMessage(chatId, { 
                    image: jpegBuffer,
                    mimetype: 'image/jpeg',
                    caption: 'Converted sticker to image'
                });
                // await logMessage('debug', `Image send result: ${JSON.stringify(sendResult, null, 2)}`);

                await sendReaction(sock, msg, '✅');
                await logMessage('info', `Sticker converted to image successfully in ${chatId} by ${sender}`);
            } catch (error) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error converting sticker to image. Please try again.' });
                await logMessage('error', `Sticker to image error in ${chatId}: ${error.message}`);
            }
            return true;
        }

        case 'tag': {
            if (!(role === 'admin' || role === 'owner')) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'This command is for admins only.' });
                await logMessage('info', `Tag command failed in ${chatId}: ${sender} is not admin or owner`);
                return true;
            }
            if (!args[0]) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Please provide a message to tag.' });
                await logMessage('info', `Tag command failed in ${chatId}: No message provided`);
                return true;
            }
            try {
                const groupMeta = await sock.groupMetadata(chatId);
                const mentions = groupMeta.participants.map(p => p.id);
                const sendResult = await sock.sendMessage(chatId, { text: args.join(' '), mentions });
                // await logMessage('debug', `Tag send result: ${JSON.stringify(sendResult, null, 2)}`);
                await sendReaction(sock, msg, '✅');
                await logMessage('info', `Tag command executed in ${chatId} by ${sender}`);
            } catch (error) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Error tagging members. Please try again.' });
                await logMessage('error', `Tag error in ${chatId}: ${error.message}`);
            }
            return true;
        }
    }
    return false;
};