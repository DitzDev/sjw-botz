import {Boom} from "@hapi/boom";
import {makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers} from "@whiskeysockets/baileys";
import readline from "readline";
import {loadCommands, watchCommands, handleMessage} from "./handler.js";
import {logInfo, logWarn, logError} from "./lib/logger.js";
import config from "./config/config.js";
import pino from "pino";
import Database from "./lib/database.js";

const question = (text: string) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise<string>(resolve => {
        rl.question(text, resolve);
    });
};

async function startBot() {
    await loadCommands();
    watchCommands();
    const database = Database.getInstance(config.dbPath);
    try {
        const {state, saveCreds} = await useMultiFileAuthState(config.sessionName);

        const client = makeWASocket({
            logger: pino({level: "silent"}),
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS("Safari"),
            markOnlineOnConnect: false,
            getMessage: async () => {
                return {conversation: "DitzDev"};
            }
        });
        if (!client.authState.creds.pairingCode) {
            const phoneNumber = await question("- Masukan nomor telepon Anda: ");
            const code = await client.requestPairingCode(phoneNumber.trim());
            const formattedCode = code.slice(0, 4) + "-" + code.slice(4);
            console.log("Your Pairing Code: ", formattedCode);
        }

        client.ev.on("creds.update", saveCreds);
        client.ev.on("connection.update", async update => {
            const {connection, lastDisconnect} = update;

            if (connection === "close") {
                const shouldReconnect =
                    (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

                logWarn("Connection closed due to " + lastDisconnect?.error + ", reconnecting: " + shouldReconnect);

                if (shouldReconnect) {
                    startBot();
                } else {
                    logError("Logged out, no reconnection");
                }
            } else if (connection === "open") {
                logInfo("Connection opened successfully!");
                database.backup();
            }
        });

        client.ev.on("messages.upsert", async ({messages}) => {
            try {
                if (!messages || !messages[0]) return;
                const m = messages[0];
                if (m.key.fromMe || !m.message) return;
                if (database.getSetting("maintenance", false) && !config.owner.includes(m.key.remoteJid || "")) {
                    await client.sendMessage(
                        m.key.remoteJid!,
                        {
                            text: "Bot sedang dalam maintenance mode. Mohon coba lagi nanti."
                        },
                        {quoted: m}
                    );
                    return;
                }
                await handleMessage(m, client, config, database);
            } catch (error) {
                logError("Error in messages.upsert event: " + error);
            }
        });

        return client;
    } catch (err) {
        console.log("Error in start bot: ", err);
        throw err;
    }
}

startBot().catch(err => {
    console.log("Fatal error:", err);
    process.exit(1);
});
