import {WAProto} from "@whiskeysockets/baileys";
import {CommandContext} from "../../types";
import {exec} from "child_process";
import util from "util";

export default {
    title: "Evaluate",
    desc: "Evaluate code JavaScript",
    alias: ["~>", ">", "$"],
    config: {
        requireOwner: true,
        noPrefix: true
    },
    run: async (m: WAProto.IWebMessageInfo, {client, text, command}: CommandContext) => {
        const initialMsg = await client.sendMessage(m.key.remoteJid!, {text: "Executing..."}, {quoted: m});

        try {
            let result = "";

            if (command === "~>") {
                if (!text) {
                    await client.sendMessage(m.key.remoteJid!, {text: "Masukkan kode untuk diinspeksi"}, {quoted: m});
                    await client.sendMessage(m.key.remoteJid!, {delete: initialMsg?.key!});
                    return;
                }

                try {
                    const evaluated = eval(text);
                    result = util.inspect(evaluated, {
                        depth: 5,
                        maxArrayLength: 50,
                        sorted: true
                    });
                } catch (e) {
                    result = `Error: ${e}`;
                }
            } else if (command === ">") {
                if (!text) {
                    await client.sendMessage(m.key.remoteJid!, {text: "Masukkan kode untuk dieksekusi"}, {quoted: m});
                    await client.sendMessage(m.key.remoteJid!, {delete: initialMsg?.key!});
                    return;
                }

                try {
                    const evaluated = await eval(`(async () => { 
            try { 
              return ${text} 
            } catch (e) { 
              return e; 
            } 
          })()`);

                    result = util.inspect(evaluated, {
                        depth: 5,
                        maxArrayLength: 50
                    });
                } catch (e) {
                    result = `Error: ${e}`;
                }
            } else if (command === "$") {
                if (!text) {
                    await client.sendMessage(m.key.remoteJid!, {text: "Masukkan perintah terminal"}, {quoted: m});
                    await client.sendMessage(m.key.remoteJid!, {delete: initialMsg?.key!});
                    return;
                }

                const execPromise = util.promisify(exec);
                try {
                    const {stdout, stderr} = await execPromise(text.trim());

                    if (stderr) result = stderr;
                    if (stdout) result = stdout;
                    if (!stdout && !stderr) result = "Command executed with no output";
                } catch (e: any) {
                    result = `Error: ${e.message}`;
                }
            }

            await client.sendMessage(
                m.key.remoteJid!,
                {
                    text: result ? `\`\`\`${result}\`\`\`` : "Executed with no output"
                },
                {quoted: m}
            );

            await client.sendMessage(m.key.remoteJid!, {delete: initialMsg?.key!});
        } catch (error) {
            await client.sendMessage(
                m.key.remoteJid!,
                {
                    text: `Error: \`\`\`${util.inspect(error)}\`\`\``
                },
                {quoted: m}
            );

            await client.sendMessage(m.key.remoteJid!, {delete: initialMsg?.key!});
        }
    }
};
