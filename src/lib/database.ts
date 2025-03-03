import {LowSync} from "lowdb";
import {JSONFileSync} from "lowdb/node";
import fs from "fs";
import path from "path";
import {logInfo, logError} from "./logger.js";

interface User {
    id: string;
    name: string;
    limit: number;
    premium: boolean;
    banned: boolean;
    lastInteraction: number;
    customData: Record<string, any>;
}

interface Group {
    id: string;
    name: string;
    welcome: boolean;
    antiLink: boolean;
    botAdmin: boolean;
    customData: Record<string, any>;
}

interface DatabaseSchema {
    users: Record<string, User>;
    groups: Record<string, Group>;
    settings: {
        maintenance: boolean;
        maxLimit: number;
        resetLimitInterval: number;
        lastReset: number;
        customSettings: Record<string, any>;
    };
}

const defaultData: DatabaseSchema = {
    users: {},
    groups: {},
    settings: {
        maintenance: false,
        maxLimit: 50,
        resetLimitInterval: 86400000,
        lastReset: Date.now(),
        customSettings: {}
    }
};

export default class Database {
    private db: LowSync<DatabaseSchema>;
    private static instance: Database;

    private constructor(dbPath: string) {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
            logInfo(`Database file created at ${dbPath}`);
        }
        this.db = new LowSync(new JSONFileSync<DatabaseSchema>(dbPath), defaultData);
        this.db.read();

        if (!this.db.data) {
            this.db.data = defaultData;
            this.db.write();
        }
        this.setupLimitReset();
        logInfo("Database initialized successfully");
    }
    public static getInstance(dbPath = path.join(process.cwd(), "data", "database.json")): Database {
        if (!Database.instance) {
            Database.instance = new Database(dbPath);
        }
        return Database.instance;
    }
    private setupLimitReset(): void {
        const checkAndResetLimits = () => {
            try {
                if (!this.db.data) return;

                const {lastReset, resetLimitInterval, maxLimit} = this.db.data.settings;
                const now = Date.now();

                if (now - lastReset >= resetLimitInterval) {
                    Object.keys(this.db.data.users).forEach(userId => {
                        this.db.data!.users[userId].limit = maxLimit;
                    });

                    this.db.data.settings.lastReset = now;
                    this.db.write();

                    logInfo(`Limits reset for all users at ${new Date().toLocaleString()}`);
                }
            } catch (error) {
                logError(`Error in limit reset: ${error}`);
            }
        };
        setInterval(checkAndResetLimits, 3600000);
        checkAndResetLimits();
    }
    public getUser(userId: string, name?: string): User {
        if (!this.db.data) this.db.read();

        const cleanId = userId.split("@")[0] + "@s.whatsapp.net";

        if (!this.db.data!.users[cleanId]) {
            const newUser: User = {
                id: cleanId,
                name: name || cleanId.split("@")[0],
                limit: this.db.data!.settings.maxLimit,
                premium: false,
                banned: false,
                lastInteraction: Date.now(),
                customData: {}
            };

            this.db.data!.users[cleanId] = newUser;
            this.db.write();
            logInfo(`New user created: ${cleanId}`);
        } else {
            this.db.data!.users[cleanId].lastInteraction = Date.now();
            if (name) {
                this.db.data!.users[cleanId].name = name;
            }

            this.db.write();
        }
        return this.db.data!.users[cleanId];
    }
    public getGroup(groupId: string, name?: string): Group {
        if (!this.db.data) this.db.read();

        if (!this.db.data!.groups[groupId]) {
            const newGroup: Group = {
                id: groupId,
                name: name || groupId,
                welcome: false,
                antiLink: false,
                botAdmin: false,
                customData: {}
            };

            this.db.data!.groups[groupId] = newGroup;
            this.db.write();
            logInfo(`New group created: ${groupId}`);
        } else if (name) {
            this.db.data!.groups[groupId].name = name;
            this.db.write();
        }
        return this.db.data!.groups[groupId];
    }
    public updateUser(userId: string, updates: Partial<User>): User {
        if (!this.db.data) this.db.read();

        const user = this.getUser(userId);
        Object.assign(user, updates);

        this.db.write();
        return user;
    }

    public updateGroup(groupId: string, updates: Partial<Group>): Group {
        if (!this.db.data) this.db.read();

        const group = this.getGroup(groupId);
        Object.assign(group, updates);

        this.db.write();
        return group;
    }

    public decrementLimit(userId: string, amount = 1): boolean {
        const user = this.getUser(userId);

        if (user.premium) return true;
        if (user.limit < amount) return false;
        user.limit -= amount;
        this.db.write();
        return true;
    }

    public incrementLimit(userId: string, amount = 1): void {
        const user = this.getUser(userId);

        user.limit += amount;
        this.db.write();
    }
    public getSetting<T>(key: string, defaultValue: T): T {
        if (!this.db.data) this.db.read();

        if (key in this.db.data!.settings) {
            return this.db.data!.settings[key as keyof typeof this.db.data.settings] as unknown as T;
        }

        if (key in this.db.data!.settings.customSettings) {
            return this.db.data!.settings.customSettings[key] as T;
        }

        return defaultValue;
    }

    public setSetting(key: string, value: any): void {
        if (!this.db.data) this.db.read();

        if (key in this.db.data!.settings) {
            (this.db.data!.settings as any)[key] = value;
        } else {
            this.db.data!.settings.customSettings[key] = value;
        }

        this.db.write();
    }

    public getAllUsers(): User[] {
        if (!this.db.data) this.db.read();
        return Object.values(this.db.data!.users);
    }

    public getAllGroups(): Group[] {
        if (!this.db.data) this.db.read();
        return Object.values(this.db.data!.groups);
    }
    public deleteUser(userId: string): boolean {
        if (!this.db.data) this.db.read();

        if (this.db.data!.users[userId]) {
            delete this.db.data!.users[userId];
            this.db.write();
            return true;
        }

        return false;
    }

    public deleteGroup(groupId: string): boolean {
        if (!this.db.data) this.db.read();

        if (this.db.data!.groups[groupId]) {
            delete this.db.data!.groups[groupId];
            this.db.write();
            return true;
        }

        return false;
    }

    public backup(): string {
        if (!this.db.data) this.db.read();

        const backupDir = path.join(process.cwd(), "data", "backups");
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, {recursive: true});
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(backupDir, `backup-${timestamp}.json`);

        fs.writeFileSync(backupPath, JSON.stringify(this.db.data, null, 2));
        logInfo(`Database backup created at ${backupPath}`);

        return backupPath;
    }
}
