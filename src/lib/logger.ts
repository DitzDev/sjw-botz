import chalk from "chalk";
import {format} from "date-fns-tz";

function getTime() {
    return format(new Date(), "yyyy-MM-dd HH:mm:ss", {timeZone: "Asia/Jakarta"});
}

const pid = process.pid;

export function logInfo(text: string) {
    console.log(`${chalk.bgGreen(chalk.black(" INFO "))} [${getTime()}] [DitzDev@${pid}]`, text);
}

export function logWarn(text: string) {
    console.log(`${chalk.bgYellow(chalk.black(" WARN "))} [${getTime()}] [DitzDev@${pid}]`, text);
}

export function logError(text: string) {
    console.log(`${chalk.bgRed(chalk.black(" ERROR "))} [${getTime()}] [DitzDev@${pid}]`, text);
}
