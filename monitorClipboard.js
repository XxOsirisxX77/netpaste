/**
 * @fileoverview Monitors the clipboard for changes and sends updates to the server.
 * 
 * @name monitorClipboard.js
 * @author Aliaksei Smirnou
 */

import chalk from 'chalk';
import clipboardy from 'clipboardy';
import { sendUpdate } from './sendUpdate.js';

let isUpdatingFromNetwork = false;
let isNotText = false;

async function readClipboard() {
    try {
        return await clipboardy.read();
    } catch (error) {
        if (!isNotText) {
            isNotText = true;
            console.error(`Failed to read clipboard: ${error.message}`);
        }
        return null;
    }
}

function logSending(content) {
    const currentTime = new Date().toLocaleTimeString();
    process.stdout.write(`${chalk.gray(`[${currentTime}]`)} ${chalk.blue('Sending content: ')}${chalk.yellow(content.length.toString())} characters...`);
}

function logResult(result) {
    process.stdout.write(result ? chalk.green(' Ok.\n') : chalk.red(' Error.\n'));
}

export async function monitorClipboard(client, passphrase) {
    let lastClipboardContent = await readClipboard();

    const interval = setInterval(async () => {
        if (!client.isRunning) {
            clearInterval(interval);
            console.log("Interval destroyed.");
            return;
        }
        const content = await readClipboard();

        if (isUpdatingFromNetwork) {
            lastClipboardContent = content
            return;
        }

        if (content && content !== lastClipboardContent) {
            isNotText = false;
            logSending(content);
            lastClipboardContent = content;
            try {
                await sendUpdate(client, content, passphrase);
                logResult(true);
            } catch (error) {
                console.error(`Error sending update: ${error.message}`);
                logResult(false);
            }
        }
    }, 1000);
}

export function setClipboardUpdateSource(isFromNetwork) {
    isUpdatingFromNetwork = isFromNetwork;
}
