/**
 * @fileoverview Entry point for the client-side of the Netpaste application.
 * 
 * @name client.js
 * @author Aliaksei Smirnou
 */

import net from 'net';
import { encrypt } from './encryption.js';
import { getPassphrase } from './passphrase.js';
import { monitorClipboard } from './monitorClipboard.js';
import { handleMessage } from './messageHandler.js';
import { DEFAULT_PORT } from './config.js';
import MessageAssembler from './fragmenter.js';
const messageAssembler = new MessageAssembler();

let passphrase = '';
let client;

function createConnection(hostname, port, disableClipboard = false) {

    client = net.createConnection({ host: hostname, port: port }, () => {
        console.log('Connected to server!');
        const message = 'NETPASTE_HELLO:Netpaste client v1.0';
        const encryptedMessage = encrypt(message, passphrase);
        
        client.write(encryptedMessage);

        console.log('Client connection details:');
        console.log('Remote address:', client.remoteAddress);
        console.log('Remote port:', client.remotePort);
        console.log('Local address:', client.localAddress);
        console.log('Local port:', client.localPort);
        console.log('All client properties:');
        Object.keys(client).forEach(key => {
            console.log(`${key}:`, client[key]);
        });

        if (!disableClipboard) {
            monitorClipboard(client, passphrase);
        }
    });

    client.on('data', (data) => {
        messageAssembler.addData(data, (completeMessage) => {
            handleMessage(completeMessage, passphrase, disableClipboard);
        });
    });
    
    client.once('end', () => {
        console.log('Disconnected from server');
        reconnect();
    });

    client.once('error', (err) => {
        console.error(err);
        console.log('Attempting to reconnect...');
        reconnect();
    });

    const reconnect = () => {
        client = null;
        createConnection(hostname, port);
    }
}

function parseCommandLineArgs() {
    const args = process.argv.slice(2);
    const hostname = args[0];
    const disableClipboard = args.includes('--no-clipboard');
    const port = parseInt(args[1], 10) || DEFAULT_PORT;
    if (!hostname || isNaN(port) || port < 0 || port > 65535) {
        console.error('Invalid command-line arguments. Usage: node client.js <hostname> [port]');
        process.exit(1);
    }
    return { hostname, port, disableClipboard };
}

getPassphrase((input) => {
    passphrase = input;
    const { hostname, port, disableClipboard } = parseCommandLineArgs();
    createConnection(hostname, port, disableClipboard);
});
