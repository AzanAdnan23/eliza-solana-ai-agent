import type { Plugin } from "@elizaos/core";
import createToken from "./actions/createToken.ts";
import transfer from "./actions/transfer.ts";
import getTokenInfo from "./actions/getTokenInfo.ts";

export const solanaAgentkitPlugin: Plugin = {
    name: "solana",
    description: "Solana Plugin with solana agent kit for Eliza",
    actions: [createToken, transfer, getTokenInfo],
    evaluators: [],
    providers: [],
};

export default solanaAgentkitPlugin;
