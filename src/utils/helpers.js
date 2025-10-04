async function formatJID(sock, jid) {
    try {
        const contact = await sock.onWhatsApp(jid);
        if (contact[0]?.verifiedName) return `@${contact[0].verifiedName}`;
        return `@${jid.split('@')[0]}`;
    } catch {
        return `@${jid.split('@')[0]}`;
    }
}

module.exports = { formatJID };