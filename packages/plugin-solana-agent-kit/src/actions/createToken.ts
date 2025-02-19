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

export interface CreateTokenContent extends Content {
    name: string;
    uri: string;
    symbol: string;
    decimals: string | number;
    initialSupply: string | number;
}

function isCreateTokenContent(content: any): content is CreateTokenContent {
    elizaLogger.log("Content for createToken", content);
    return (
        typeof content.name === "string" &&
        typeof content.uri === "string" &&
        typeof content.symbol === "string" &&
        (typeof content.decimals === "string" ||
            typeof content.decimals === "number") &&
        (typeof content.initialSupply === "number" ||
            typeof content.initialSupply === "string")
    );
}

const createTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "name": "Example Token",
    "symbol": "EXMPL",
    "uri": "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/image.png",
    "decimals": 9,
    "initialSupply": 100000,
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested token transfer:
Extract these values:
- Token name (exact match)
- Token symbol (uppercase)
- Token uri (full URL)
- Token decimals (0-18)
- Token initialSupply (number without commas)

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: "CREATE_SOLANA_TOKEN",
    similes: ["DEPLOY_SOLANA_TOKEN"],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
    description: "Create tokens",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CREATE_SOLANA_TOKEN handler...");
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
        if (!isCreateTokenContent(content)) {
            elizaLogger.error(
                "Invalid content for CREATE_SOLANA_TOKEN action ayooo."
            );
            if (callback) {
                callback({
                    text: "Unable to process create token request. Invalid content provided.",
                    content: { error: "Invalid create token content" },
                });
            }
            return false;
        }

        elizaLogger.log("Init solana agent kit...");
        const solanaAgentKit = await getSAK(runtime);
        try {
            const result = await solanaAgentKit.deployToken(
                content.name,
                content.uri,
                content.symbol,
                Number(content.decimals),
                Number(content.initialSupply) //comment out this cause the sdk has some issue with this parameter
            );
            const deployedAddress = result.mint.toString();
            elizaLogger.log("Create successful: ", deployedAddress);
            elizaLogger.log(deployedAddress);
            elizaLogger.info(deployedAddress);
            elizaLogger.debug(deployedAddress);

            if (callback) {
                callback({
                    text: `Successfully created token ${content.name} on Solana at address ${deployedAddress}`,
                    content: {
                        success: true,
                        tokenAddress: deployedAddress,
                    },
                });
            }
            return true;
        } catch (error) {
            if (callback) {
                elizaLogger.error("Error during create token: ", error);
                callback({
                    text: `Error creating token: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a token on solana, name is Example Token, symbol is EXMPL, uri is https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/image.png, decimals is 9, initialSupply is 100000000000",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll create token now...",
                    action: "CREATE_SOLANA_TOKEN",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully created token on following address 3jkEotRmwhE4pNukTJiDEgBDPP8Wev4MjtbERaTrc1Bz53VcuHqJMrqSdtghhGqd4kz2jZqqXgCTL7jDXtFHaRuy",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
