// fragmenter.js

import { MAX_FRAGMENT_SIZE } from './config.js';

const MAGIC_NUMBER = Buffer.from([0x4E, 0x65, 0x74, 0x50]); // 'NetP'
const HEADER_SIZE = 20;
const MAGIC_SIZE = MAGIC_NUMBER.length;

export function fragmentAndSendMessage(message, client) {
    const messageBuffer = Buffer.from(message);
    const totalParts = Math.ceil(messageBuffer.length / MAX_FRAGMENT_SIZE);
    const uid = Date.now();

    for (let part = 0; part < totalParts; part++) {
        const start = part * MAX_FRAGMENT_SIZE;
        const end = start + MAX_FRAGMENT_SIZE;
        const fragment = messageBuffer.subarray(start, end);

        const header = Buffer.alloc(HEADER_SIZE);
        header.writeBigInt64BE(BigInt(uid), 0);      // UID (8 bytes)
        header.writeUInt16BE(part + 1, 8);            // Part number (2 bytes)
        header.writeUInt16BE(totalParts, 10);         // Total parts (2 bytes)
        header.writeUInt16BE(fragment.length, 12);    // Fragment data length (2 bytes)

        const packet = Buffer.concat([MAGIC_NUMBER, header, fragment]);
        client.write(packet);
    }
}

class MessageAssembler {
    constructor() {
        this.messages = {};
        this.buffer = Buffer.alloc(0);
    }

    addData(data, callback) {
        this.buffer = Buffer.concat([this.buffer, data]);

        while (true) {
            const magicIndex = this.buffer.indexOf(MAGIC_NUMBER);
            if (magicIndex === -1) {
                break;
            }

            // Discard any data before the first magic number
            if (magicIndex > 0) {
                this.buffer = this.buffer.subarray(magicIndex);
            }

            const minPacketSize = MAGIC_SIZE + HEADER_SIZE;

            // Not enough data for magic + header yet
            if (this.buffer.length < minPacketSize) {
                break;
            }

            // Read the fragment data length from the header
            const fragmentLength = this.buffer.readUInt16BE(MAGIC_SIZE + 12);
            const fullPacketSize = minPacketSize + fragmentLength;

            // Not enough data for the complete packet yet
            if (this.buffer.length < fullPacketSize) {
                break;
            }

            // Extract header + fragment data and process it
            const fragment = this.buffer.subarray(MAGIC_SIZE, fullPacketSize);
            this.addFragment(fragment, callback);
            this.buffer = this.buffer.subarray(fullPacketSize);
        }
    }

    addFragment(data, callback) {
        const uid = data.readBigInt64BE(0);
        const part = data.readUInt16BE(8);
        const totalParts = data.readUInt16BE(10);
        // Fragment data length at offset 12 already used by addData
        const fragment = data.subarray(HEADER_SIZE);

        if (!this.messages[uid]) {
            this.messages[uid] = { parts: new Array(totalParts), received: 0 };
        }

        if (!this.messages[uid].parts[part - 1]) {
            this.messages[uid].parts[part - 1] = fragment;
            this.messages[uid].received++;

            if (this.messages[uid].received === totalParts) {
                const completeMessage = Buffer.concat(this.messages[uid].parts);
                delete this.messages[uid];

                if (typeof callback === 'function') {
                    callback(completeMessage);
                }
            }
        }

        return null;
    }
}

export default MessageAssembler;
