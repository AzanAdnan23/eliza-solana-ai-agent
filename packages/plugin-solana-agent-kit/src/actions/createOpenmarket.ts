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

const createTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "baseToken": "5iXodU6GzucjvH9jvVbxTTrREfqihPVYn3RnMQ7ntQkT",
    "quoteToken": "csRiqBeUTmigZnEkk2zZNY6PUY5fyEQzyErgy4qZYiA"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information for OpenBook market creation:
Extract these values:
- Base token address (exact match, Solana PublicKey format)
- Quote token address (exact match, Solana PublicKey format)

Respond with a JSON markdown block containing only the extracted values.`;

export interface CreateOpenMarketContent extends Content {
    baseToken: string;
    quoteToken: string;
}

function isCreateOpenMarketContent(
    content: any
): content is CreateOpenMarketContent {
    elizaLogger.log("Content for openBook Market", content);
    return (
        typeof content.baseToken === "string" &&
        typeof content.quoteToken === "string"
    );
}
function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

export default {
    name: "CREATE_OPENBOOK_MARKET",
    similes: ["DEPLOY_OPENBOOK_MARKET"],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
    description: "Create new trading markets on OpenBook DEX",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CREATE_OPEN_MARKET handler...");
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

        if (
            !isValidSolanaAddress(content.baseToken) ||
            !isValidSolanaAddress(content.quoteToken)
        ) {
            elizaLogger.error("Invalid token address provided.");
            if (callback) {
                callback({
                    text: "Unable to process create openbook market request. Invalid solana address provided.",
                    content: { error: "Invalid open solana address provided" },
                });
            }
            return false;
        }

        // Validate transfer content
        if (!isCreateOpenMarketContent(content)) {
            elizaLogger.error(
                "Invalid content for CREATE_OPENBOOK_MARKET action."
            );
            if (callback) {
                callback({
                    text: "Unable to process create openbook market request. Invalid content provided.",
                    content: { error: "Invalid open market content" },
                });
            }
            return false;
        }

        elizaLogger.log("Init solana agent kit...");
        const solanaAgentKit = await getSAK(runtime);
        try {
            const signatures = await solanaAgentKit.openbookCreateMarket(
                new PublicKey(content.baseToken),
                new PublicKey(content.quoteToken)
                //  1, // 1 unit minimum order
                //0.01 // $0.01 minimum price increment
            );

            console.log("Market created:", signatures);
            // return signatures;
            if (callback) {
                callback({
                    text: `Successfully created openbook on Solana ${signatures}`,
                    content: {
                        success: true,
                        tokenAddress: signatures,
                    },
                });
            }
            return true;
        } catch (error) {
            if (callback) {
                elizaLogger.error("Error during create openmarket: ", error);
                callback({
                    text: `Error create openmarket: ${error.message}`,
                    content: { error: error.message },
                });
            }
            if (error.message.includes("TOKEN_PROGRAM_ID")) {
                elizaLogger.error(
                    "Market creation failed token profram id issue:",
                    error
                );
            } else if (error.message.includes("decimals")) {
                elizaLogger.error(
                    "Market creation failed decimal issue:",
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
                    text: "Create an openbook market on solana, baseToken is 5iXodU6GzucjvH9jvVbxTTrREfqihPVYn3RnMQ7ntQkT, quoteToken is csRiqBeUTmigZnEkk2zZNY6PUY5fyEQzyErgy4qZYiA",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll create the openbook market now...",
                    action: "CREATE_OPENBOOK_MARKET",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully created openbook market with market id 1vetvqB6UTmigZnEkk2zZNY6PUY5fyEQzyErgy4qZYiA",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
