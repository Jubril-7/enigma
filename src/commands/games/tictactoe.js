const { sendReaction } = require('../../middlewares/reactions');
const { logMessage } = require('../../utils/logger');
const { loadStorage, saveStorage } = require('../../utils/storage');

// In-memory cache for group metadata and profile names
const metadataCache = new Map();
const profileNameCache = new Map();

async function getDisplayName(sock, jid, chatId, msg) {
    if (!jid) {
        await logMessage('error', `getDisplayName: JID is undefined in ${chatId}`);
        return '@unknown';
    }
    try {
        // Check profile name cache first
        if (profileNameCache.has(jid)) {
            await logMessage('debug', `Name for ${jid} in ${chatId}: @${profileNameCache.get(jid)} from profileNameCache`);
            return `@${profileNameCache.get(jid)}`;
        }

        // Fetch group metadata
        let metadata = metadataCache.get(chatId);
        if (!metadata) {
            metadata = await sock.groupMetadata(chatId);
            metadataCache.set(chatId, metadata);
            await logMessage('debug', `Cached group metadata for ${chatId}`);
        }

        // Check participant metadata
        const participant = metadata.participants.find(p => p.id === jid);
        if (participant) {
            const name = participant.name || participant.notifyName || participant.vname || participant.shortName;
            if (name) {
                profileNameCache.set(jid, name);
                await logMessage('debug', `Name for ${jid} in ${chatId}: @${name} from group metadata (name: ${participant.name}, notifyName: ${participant.notifyName}, vname: ${participant.vname}, shortName: ${participant.shortName})`);
                return `@${name}`;
            }
        }

        // Check msg.pushName for sender
        if (msg.pushName && jid === msg.key.participant) {
            profileNameCache.set(jid, msg.pushName);
            await logMessage('debug', `Name for ${jid} in ${chatId}: @${msg.pushName} from msg.pushName`);
            return `@${msg.pushName}`;
        }

        // Fetch recent messages for opponent's pushName
        try {
            const messages = await sock.fetchMessages(chatId, { limit: 50 });
            const opponentMessage = messages.find(m => m.key.participant === jid && m.pushName);
            if (opponentMessage && opponentMessage.pushName) {
                profileNameCache.set(jid, opponentMessage.pushName);
                await logMessage('debug', `Name for ${jid} in ${chatId}: @${opponentMessage.pushName} from recent messages`);
                return `@${opponentMessage.pushName}`;
            }
        } catch (msgError) {
            await logMessage('debug', `Failed to fetch messages for ${jid} in ${chatId}: ${msgError.message}`);
        }

        // Fetch contact name using sock.onWhatsApp
        try {
            const contact = await sock.onWhatsApp(jid);
            if (contact[0]?.verifiedName) {
                profileNameCache.set(jid, contact[0].verifiedName);
                await logMessage('debug', `Name for ${jid} in ${chatId}: @${contact[0].verifiedName} from sock.onWhatsApp`);
                return `@${contact[0].verifiedName}`;
            }
        } catch (contactError) {
            await logMessage('debug', `Failed to fetch contact for ${jid} in ${chatId}: ${contactError.message}`);
        }

        // Fallback to cleaned JID
        const number = jid.split('@')[0].replace(/^\+?/, '');
        await logMessage('debug', `Name for ${jid} in ${chatId}: using fallback @${number}`);
        return `@${number}`;
    } catch (error) {
        await logMessage('error', `Failed to get name for ${jid} in ${chatId}: ${error.message}`);
        const number = jid.split('@')[0].replace(/^\+?/, '');
        return `@${number}`;
    }
}

module.exports = async (sock, msg, command, args, storage, sender, chatId, role, prefix) => {
    try {
        storage.games = storage.games || {};
        storage.games.tictactoe = storage.games.tictactoe || {};

        const game = storage.games.tictactoe[chatId];

        if (command === 'tictactoe' || command === 'ttt') {
            if (args[0] === 'forfeit') {
                if (!game || !game.active || !game.players.includes(sender)) {
                    await sendReaction(sock, msg, '❌');
                    await sock.sendMessage(chatId, { text: 'No active game or you are not a player.' });
                    return true;
                }
                const player1Name = await getDisplayName(sock, game.players[0], chatId, msg);
                const player2Name = await getDisplayName(sock, game.players[1], chatId, msg);
                const winner = game.players[game.players[0] === sender ? 1 : 0];
                const winnerName = game.players[0] === sender ? player2Name : player1Name;
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, {
                    text: `${player1Name === (await getDisplayName(sock, sender, chatId, msg)) ? player1Name : player2Name} forfeited. ${winnerName} wins!`,
                    mentions: [sender, winner]
                });
                delete storage.games.tictactoe[chatId];
                await saveStorage(storage);
                await logMessage('info', `Tic Tac Toe forfeited in ${chatId} by ${sender}, winner: ${winner}`);
                return true;
            }

            if (game && game.active) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'A Tic Tac Toe game is already active!' });
                return true;
            }
            if (!msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Please tag a user to play with.' });
                return true;
            }
            const opponent = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            // Validate opponent is a group participant
            const metadata = await sock.groupMetadata(chatId);
            if (!metadata.participants.some(p => p.id === opponent)) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Tagged user is not a participant in this group.' });
                return true;
            }
            if (opponent === sender) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'You cannot play against yourself.' });
                return true;
            }
            const player1Name = await getDisplayName(sock, sender, chatId, msg);
            const player2Name = await getDisplayName(sock, opponent, chatId, msg);
            storage.games.tictactoe[chatId] = {
                active: true,
                players: [sender, opponent],
                board: Array(9).fill(null),
                turn: 0
            };
            await saveStorage(storage);
            await sendReaction(sock, msg, '🎮');
            await sock.sendMessage(chatId, {
                text: `Tic Tac Toe: ${player1Name} (❌) vs ${player2Name} (⭕)\n${renderBoard(storage.games.tictactoe[chatId].board)}\n${player1Name}'s turn (❌). Use ${prefix}m {1-9}`,
                mentions: [sender, opponent]
            });
            await logMessage('info', `Tic Tac Toe started in ${chatId}: ${sender} (X) vs ${opponent} (O)`);
            return true;
        }

        if (command === 'm') {
            if (!game || !game.active || !game.players.includes(sender)) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'No active game or you are not a player.' });
                return true;
            }
            if (game.players[game.turn % 2] !== sender) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: 'Not your turn!' });
                return true;
            }
            const move = parseInt(args[0]) - 1;
            if (isNaN(move) || move < 0 || move > 8 || game.board[move]) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: `Invalid move. Use ${prefix}m {1-9} for an empty cell.` });
                return true;
            }
            game.board[move] = game.turn % 2 === 0 ? 'X' : 'O';
            game.turn += 1;
            const winner = checkWinner(game.board);
            const player1Name = await getDisplayName(sock, game.players[0], chatId, msg);
            const player2Name = await getDisplayName(sock, game.players[1], chatId, msg);
            if (winner) {
                await sendReaction(sock, msg, '🎉');
                await sock.sendMessage(chatId, {
                    text: `${winner === 'X' ? player1Name : player2Name} wins!\n${renderBoard(game.board)}`,
                    mentions: [winner === 'X' ? game.players[0] : game.players[1]]
                });
                delete storage.games.tictactoe[chatId];
                await saveStorage(storage);
                await logMessage('info', `Tic Tac Toe ended in ${chatId}, winner: ${winner === 'X' ? game.players[0] : game.players[1]}`);
                return true;
            }
            if (!game.board.includes(null)) {
                await sendReaction(sock, msg, '❌');
                await sock.sendMessage(chatId, { text: `Draw!\n${renderBoard(game.board)}` });
                delete storage.games.tictactoe[chatId];
                await saveStorage(storage);
                await logMessage('info', `Tic Tac Toe ended in ${chatId}, result: draw`);
                return true;
            }
            await sendReaction(sock, msg, '✅');
            await sock.sendMessage(chatId, {
                text: `${renderBoard(game.board)}\n${game.turn % 2 === 0 ? player1Name : player2Name}'s turn (${game.turn % 2 === 0 ? '❌' : '⭕'}). Use ${prefix}m {1-9}`,
                mentions: [game.turn % 2 === 0 ? game.players[0] : game.players[1]]
            });
            await saveStorage(storage);
            await logMessage('info', `Tic Tac Toe move in ${chatId}, player: ${sender}, move: ${move + 1}`);
            return true;
        }

        return false;
    } catch (error) {
        await logMessage('error', `Error in tictactoe command ${command} for ${chatId}: ${error.message}`);
        await sendReaction(sock, msg, '❌');
        await sock.sendMessage(chatId, { text: 'An error occurred in the Tic Tac Toe game. Please try again.' });
        return false;
    }
};

function renderBoard(board) {
    const symbols = { null: '⬜', 'X': '❌', 'O': '⭕' };
    return board.reduce((str, cell, i) => {
        str += symbols[cell] || '⬜';
        if (i % 3 === 2) {
            str += '\n';
            if (i !== 8) str += '------+------+------\n';
        } else {
            str += ' | ';
        }
        return str;
    }, '');
}

function checkWinner(board) {
    const wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of wins) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return board[a];
        }
    }
    return null;
}