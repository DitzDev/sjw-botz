import {WAProto} from "@whiskeysockets/baileys";
import {CommandContext} from "../../types";

export default {
    title: "Profile",
    desc: "Melihat profile pengguna",
    alias: ["profile", "me", "myprofile"],
    config: {
        limit: 1
    },
    run: async (m: WAProto.IWebMessageInfo, {client, database}: CommandContext) => {
        const user = database.getUser(m.key.participant || m.key.remoteJid!);
        const profile: string = `*🧑‍💻 PROFIL PENGGUNA*
    
*Nama:* ${user.name}
*ID:* ${user.id.split("@")[0]}
*Limit:* ${user.limit}/${database.getSetting("maxLimit", 50)}
*Status:* ${user.premium ? "💎 Premium" : "🌐 Regular"}
${user.banned ? "*BANNED* ❌" : ""}
*Terakhir Aktif:* ${new Date(user.lastInteraction).toLocaleString()}`;
        await client.sendMessage(m.key.remoteJid!, {text: profile}, {quoted: m});
    }
};
