import {
    type ActionExample,
    composeContext,
    type Content,
    elizaLogger,
    generateObjectDeprecated,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    type Action,
} from "@elizaos/core";
import { getSAK } from "../client";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const createTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "marketId": "5iXodU6GzucjvH9jvVbxTTrREfqihPVYn3RnMQ7ntQkT",
    "baseAmount": 200,
    "quoteAmount": 200,
    "startTime": 1700000000
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information for liquidity pool creation:
Extract these values:
- Market ID (exact match, Solana PublicKey format)
- Base token amount (numeric, amount of base token added to pool)
- Quote token amount (numeric, amount of quote token added to pool)
- Start time (Unix timestamp or human-readable time format)

Respond with a JSON markdown block containing only the extracted values.`;

export interface CreatePoolContent extends Content {
    marketId: string;
    baseAmount: string | number;
    quoteAmount: string | number;
    startTime: string | number;
}

function isCreatePoolContent(content: any): content is CreatePoolContent {
    elizaLogger.log("Content for createToken", content);
    return (
        typeof content.marketId === "string" &&
        (typeof content.baseAmount === "string" ||
            typeof content.baseAmount === "number") &&
        (typeof content.quoteAmount === "string" ||
            typeof content.quoteAmount === "number") &&
        (typeof content.startTime === "string" ||
            typeof content.startTime === "number")
    );
}

export default {
    name: "RAYDIUM_CREATE_AMM_V4",
    similes: [
        "create raydium v4 pool",
        "setup raydium v4 liquidity pool",
        "initialize raydium v4 amm",
        "create raydium v4 market maker",
        "setup raydium v4 pool",
        "create raydium v4 trading pair",
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
    description:
        "Create a new AMM V4 pool on Raydium with advanced features and improved efficiency",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting RAYDIUM_CREATE_AMM_V4 handler...");
        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose transfer context
        const transferContext = composeContext({
            state,
            template: createTemplate,
        });
        elizaLogger.log("Transfer context: ", transferContext);
        // Generate transfer content
        const content = await generateObjectDeprecated({
            runtime,
            context: transferContext,
            modelClass: ModelClass.LARGE,
        });

        // Validate transfer content
        if (!isCreatePoolContent(content)) {
            elizaLogger.error(
                "Invalid content for RAYDIUM_CREATE_AMM_V4 action"
            );
            if (callback) {
                callback({
                    text: "Unable to process raydium liquidity pool request. Invalid content provided.",
                    content: {
                        error: "Invalid create raydium liquidity pool content",
                    },
                });
            }
            return false;
        }

        elizaLogger.log("Init solana agent kit...");
        const solanaAgentKit = await getSAK(runtime);
        try {
            const signature = await solanaAgentKit.raydiumCreateAmmV4(
                new PublicKey(content.marketId),
                new BN(content.baseAmount),
                new BN(content.quoteAmount),
                new BN(content.startTime)
            );

            elizaLogger.log("Create successful: ", signature);

            if (callback) {
                callback({
                    text: `Successfully created raydium liquidity pool ${content.name} on Solana at address ${signature}`,
                    content: {
                        success: true,
                        tokenAddress: signature,
                    },
                });
            }
            return true;
        } catch (error) {
            if (callback) {
                elizaLogger.error(
                    "Error during create raydium liquidity pool: ",
                    error
                );
                callback({
                    text: `Error creating raydium liquidity pool: ${error.message}`,
                    content: { error: error.message },
                });
            }
            if (error.message.includes("insufficient liquidity")) {
                elizaLogger.log(
                    "Error during create raydium liquidity pool insufficient liquidity ",
                    error
                );
            } else if (error.message.includes("invalid market")) {
                elizaLogger.log(
                    "Error during create raydium liquidity pool invalid market ",
                    error
                );
            }

            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a USDC-SOL liquidity pool on raydium market id is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v, usdc base amount is 200, and quote Amount is 200 and start time is 0",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll create the liquidity pool now...",
                    action: "RAYDIUM_CREATE_AMM_V4",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully created Raydium AMM V4 pool",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
