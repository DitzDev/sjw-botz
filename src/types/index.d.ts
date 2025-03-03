import {WAProto, makeWASocket} from "@whiskeysockets/baileys";
import Database from "../lib/database.js";

export interface CommandType {
    title: string;
    desc: string;
    alias: string[];
    config?: {
        noPrefix?: boolean;
        requireOwner?: boolean;
        requireAdmin?: boolean;
        limit: number;
    };
    example: string;
    run: (m: WAProto.IWebMessageInfo, context: CommandContext) => Promise<any>;
}

export interface CommandContext {
    client: ReturnType<typeof makeWASocket>;
    text: string;
    args: string[];
    prefix: string;
    database: Database;
    command: string;
}

export interface Config {
    owner: string[];
    prefix: string;
    sessionName: string;
    dbPath?: string;
}
