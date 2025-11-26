
const { validateShare } = require("./validateShare");

const headerHex = "0060032108d07425e52f4495f4edb735aaa93df444e616e9a6e50100000000000000000066830a6018b414dfb0ca46a63b5c49d2e867d4b65f0fc6b112687acfc0c6a8a8f0dbd56838fa0117a34e85b6"

const header = Buffer.from(headerHex, "hex");

console.log("HEADER (hex):", headerHex);
console.log("LENGTH:", header.length);

const diff = 1; // or 0.01 or whatever

validateShare(header, diff);