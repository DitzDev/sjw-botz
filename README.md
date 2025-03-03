# Introduction
This WhatsApp bot is made with TypeScript and uses the Library [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)

## Installation
1. First, Clone this Repository by typing the command below:

```bash
git clone https://github.com/DitzDev/sjw-botz.git
```

2. Go to the bot directory and type the command:
```bash
cd sjw-botz && npm install
```

3. After installing Dependency, you need to do a build to run this script.
> [!WARNING]
> If you use `ts-node` this script will not run, you must build this script first before using it.

```bash
npm run build
```
- then:
```bash
npm start
```

## Documentation
If you want to add new features, you can put all your command files in the `src/cmd/**/*.ts` folder, This means you can put your commands in the main directory or subdirectories.

- For Example:
```typescript
import {WAProto} from "@whiskeysockets/baileys";
import {CommandContext} from "../types";

export default {
    title: "Ping",
    desc: "Command to check if the bot is responding",
    alias: ["ping", "test"],
    example: "{prefix}ping",
    run: async (m: WAProto.IWebMessageInfo, {client}: CommandContext) => {
        client.sendMessage(
            m.key.remoteJid!,
            {
                text: `Bot Active!`
            },
            {quoted: m}
        );
    }
};
```

- As appropriate, you can add additional parameters to the `run` option as defined here:
```typescript
export interface CommandContext {
    client: ReturnType<typeof makeWASocket>;
    text: string;
    args: string[];
    prefix: string;
    database: Database;
    command: string;
}
```

For more details, you can check [here](/src/types/index.d.ts)

## Contribution
This repository is open source code, everyone is free to contribute, Fork this repository and make updates so that this script can develop further.

## License
This repository is under MIT License, [Check here for details](LICENSE)