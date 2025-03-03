import {WAProto} from "@whiskeysockets/baileys";
import {CommandContext} from "../types";

export default {
    title: "Ping",
    desc: "Perintah untuk mengecek apakah bot merespon",
    alias: ["ping", "test"],
    example: "{prefix}ping",
    run: async (m: WAProto.IWebMessageInfo, {client}: CommandContext) => {
        client.sendMessage(
            m.key.remoteJid!,
            {
                text: `Bot aktif!`
            },
            {quoted: m}
        );
    }
};
