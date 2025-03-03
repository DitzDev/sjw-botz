import {readdir} from "fs/promises";
import path from "path";
import chokidar from "chokidar";
import {CommandType, Config} from "./types";
import {WAProto} from "@whiskeysockets/baileys";
import {logInfo, logWarn, logError} from "./lib/logger.js";
import chalk from "chalk";
import Database from "./lib/database.js";

export const commands = new Map<string, CommandType>();

export async function loadCommands(dir = path.join(__dirname, "/cmd")) {
    try {
        commands.clear();
        const items = await readdir(dir, {withFileTypes: true});
        for (const item of items) {
            const itemPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                await loadCommands(itemPath);
                continue;
            }
            if (
                item.isFile() &&
                (item.name.endsWith(".ts") || item.name.endsWith(".js")) &&
                !item.name.startsWith("_")
            ) {
                try {
                    const resolvedPath = path.resolve(itemPath);
                    delete require.cache[require.resolve(resolvedPath)];
                    const command = require(resolvedPath).default as CommandType;
                    if (!command || !command.run) {
                        logWarn(`Invalid Command Structure In ${itemPath}`);
                        continue;
                    }
                    command.alias.forEach((alias: any) => {
                        commands.set(alias.toLowerCase(), command);
                    });

                    logInfo(`Loaded commands: ${command.title} (${command.alias.join(", ")})`);
                } catch (err) {
                    console.log(chalk.bgRed(chalk.black("[ PLUGINS ERROR ]")), err);
                }
            }
        }
    } catch (err) {
        console.log(`Error reading directory ${dir}:`, err);
    }
}

export function watchCommands() {
    const watcher = chokidar.watch(["src/cmd/**/*.ts", "src/cmd/**/*.js"], {
        persistent: true,
        ignoreInitial: true
    });

    watcher
        .on("add", async path => {
            logInfo(`Command Added in ${path}`);
            await loadCommands();
        })
        .on("change", async path => {
            logWarn(`Command file is changed in ${path}`);
            await loadCommands();
        })
        .on("unlink", async path => {
            logError(`Command file is deleted in ${path}`);
            await loadCommands();
        });

    logInfo(`Starting watching commands...`);
}

export async function handleMessage(m: WAProto.IWebMessageInfo, client: any, config: Config, database: Database) {
    try {
        if (!m.message) return;

        const body = (m.message.conversation ||
            (m.message.imageMessage && m.message.imageMessage.caption) ||
            (m.message.videoMessage && m.message.videoMessage.caption) ||
            (m.message.extendedTextMessage && m.message.extendedTextMessage.text) ||
            (m.message.buttonsResponseMessage && m.message.buttonsResponseMessage.selectedButtonId) ||
            (m.message.listResponseMessage && m.message.listResponseMessage.singleSelectReply?.selectedRowId) ||
            (m.message.templateButtonReplyMessage && m.message.templateButtonReplyMessage.selectedId) ||
            "") as string;

        logInfo(`Received message: "${body}" from ${m.key.remoteJid}`);

        const chatId = m.key.remoteJid || "";
        const isGroup = chatId.endsWith("@g.us");
        const sender = isGroup ? m.key.participant : chatId;
        const isOwner = config.owner.includes(sender || "");
        const user = database.getUser(sender || "");
        if (isGroup) {
            const group = database.getGroup(chatId);
            try {
                const groupMetadata = await client.groupMetadata(chatId);
                if (groupMetadata?.subject) {
                    database.updateGroup(chatId, {name: groupMetadata.subject});
                }
            } catch (err) {
                logError("Error fetching group metadata: " + err);
            }
        }

        if (user.banned) {
            logInfo(`Banned user ${sender} tried to use bot`);
            return;
        }

        let isAdmin = false;
        if (isGroup) {
            try {
                const groupMetadata = await client.groupMetadata(chatId);
                const participants = groupMetadata.participants || [];
                isAdmin = participants.some((p: any) => p.id === sender && p.admin);
            } catch (err) {
                logError("Error fetching group metadata: " + err);
            }
        }
        let cmdName = "";
        let prefix = "";
        let text = body.trim();
        let args: string[] = [];

        for (const p of [config.prefix, "/", "!", "#"]) {
            if (body.startsWith(p)) {
                const [cmd, ...cmdArgs] = body.slice(p.length).trim().split(" ");
                cmdName = cmd.toLowerCase();
                prefix = p;
                args = cmdArgs;
                text = cmdArgs.join(" ");
                break;
            }
        }
        let command: CommandType | undefined;
        if (cmdName && commands.has(cmdName)) {
            command = commands.get(cmdName);
        } else {
            for (const [alias, cmd] of commands.entries()) {
                if (cmd.config?.noPrefix && body.toLowerCase().startsWith(alias.toLowerCase())) {
                    command = cmd;
                    prefix = "";
                    cmdName = alias;
                    text = body.slice(alias.length).trim();
                    args = text ? text.split(" ") : [];
                    break;
                }
            }
        }
        if (command) {
            try {
                if (command.config?.requireOwner && !isOwner) {
                    await client.sendMessage(chatId, {text: "This command is only for the owner"}, {quoted: m});
                    return;
                }

                if (command.config?.requireAdmin && !isAdmin && isGroup) {
                    await client.sendMessage(chatId, {text: "This command is only for admins"}, {quoted: m});
                    return;
                }

                const limitCost = command.config?.limit || 1;
                if (!isOwner && !user.premium) {
                    if (user.limit < limitCost) {
                        await client.sendMessage(
                            chatId,
                            {
                                text: `Limit kamu tidak cukup untuk menjalankan perintah ini. Limit tersisa: ${user.limit}/${database.getSetting("maxLimit", 50)}`
                            },
                            {quoted: m}
                        );
                        return;
                    }
                    database.decrementLimit(sender || "", limitCost);
                }

                logInfo(`Executing command: ${command.title} (${cmdName}) from ${sender} in ${chatId}`);

                await command.run(m, {client, text, args, prefix, database, command: cmdName});
            } catch (error) {
                logError(`Error executing command ${cmdName}: ` + error);
                await client.sendMessage(chatId, {text: `Error: ${(error as Error).message}`}, {quoted: m});
            }
        }
    } catch (err) {
        logError("Error processing message: " + err);
    }
}
